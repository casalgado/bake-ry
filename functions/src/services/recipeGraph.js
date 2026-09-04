// services/recipeGraph.js
//
// Everything that walks the recipe component graph:
//   - save-time guardrails: cycle detection + depth cap
//   - cost propagation: recipe cost -> owner cache -> consumers, and back again
//
// Both live here because they traverse the same edges. Stock deduction is a
// third walk of this graph, but it belongs to stockService — it runs inside the
// order transaction and yields movements, not validations.
//
// See docs/recipe-costing.md for how the pieces fit together.
const { db } = require('../config/firebase');
const { BadRequestError, NotFoundError } = require('../utils/errors');
const recordHistory = require('./base/recordHistory');

// Bounds the propagation write fan-out: a valid recipe graph can nest at most
// this deep (assertGraphIsSane refuses to save anything deeper).
const MAX_DEPTH = 5;

const recipesRef = (bakeryId) => db.collection(`bakeries/${bakeryId}/recipes`);
const productsRef = (bakeryId) => db.collection(`bakeries/${bakeryId}/products`);
const ingredientsRef = (bakeryId) =>
  db.collection(`bakeries/${bakeryId}/ingredients`);

/**
 * The one place that decides which recipe a sellable unit uses.
 * NO FALLBACK: a combination without a recipe never inherits the product's.
 */
const resolveRecipeId = (product, combinationId = null) => {
  if (!product) return null;

  if (product.hasVariations) {
    const combinations = product.variations?.combinations || [];
    const combination = combinations.find((c) => c.id === combinationId);
    return combination?.recipeId || null;
  }

  return product.recipeId || null;
};

/**
 * Reduces a component row to { type, id, combinationId }.
 *
 * Only an explicit 'product' is a product — everything else is an ingredient.
 * This is the same rule resolveComponents applies in recipeService; both must
 * agree or the cycle check keys a node differently from how it reads it.
 */
const normalizeComponent = (raw = {}) => ({
  type: raw.type === 'product' ? 'product' : 'ingredient',
  id: raw.id,
  combinationId: raw.combinationId || null,
});

/** Stable identity of a stock-holding / recipe-owning node (matches stockService's itemKey). */
const nodeKey = (component) => {
  const { type, id, combinationId } = normalizeComponent(component);
  if (type === 'product') {
    return combinationId ? `product_${id}_${combinationId}` : `product_${id}`;
  }
  return `ingredient_${id}`;
};

const ownerKeyOf = (recipe) => {
  if (recipe.ingredientId) return `ingredient_${recipe.ingredientId}`;
  if (recipe.combinationId) {
    return `product_${recipe.productId}_${recipe.combinationId}`;
  }
  return recipe.productId ? `product_${recipe.productId}` : null;
};

// Costs are money; compare with a cent-level epsilon so float noise never
// triggers a cascade of pointless writes.
const sameCost = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.005;

/**
 * Rejects a recipe whose component graph contains a cycle or exceeds the depth
 * cap. Runs BEFORE the save transaction: it reads an unbounded number of docs,
 * which a transaction must not do, and the recipe is not yet stored so we walk
 * the incoming components directly.
 *
 * ponytail: read-then-write race — a concurrent save elsewhere could make the
 * graph cyclic between this check and the commit. The MAX_DEPTH guard in the
 * propagation walk is the backstop; a transactional graph lock is not worth it
 * at bakery scale.
 */
const assertGraphIsSane = async (bakeryId, recipe) => {
  const ownerKey = ownerKeyOf(recipe);
  const docCache = new Map();

  const readDoc = async (collectionRef, id) => {
    const key = `${collectionRef.path}/${id}`;
    if (!docCache.has(key)) {
      const doc = await collectionRef.doc(id).get();
      docCache.set(key, doc.exists ? { id: doc.id, ...doc.data() } : null);
    }
    return docCache.get(key);
  };

  // Which recipe does this component's node produce from?
  const recipeIdForComponent = async ({ type, id, combinationId }) => {
    if (type === 'product') {
      const product = await readDoc(productsRef(bakeryId), id);
      return resolveRecipeId(product, combinationId);
    }

    const ingredient = await readDoc(ingredientsRef(bakeryId), id);
    return ingredient?.recipeId || null;
  };

  const walk = async (rawComponents, path) => {
    if (path.length > MAX_DEPTH) {
      throw new BadRequestError(
        `La receta es demasiado profunda (máximo ${MAX_DEPTH} niveles). Ruta: ${path.join(' → ')}`,
      );
    }

    for (const raw of rawComponents) {
      const component = normalizeComponent(raw);

      // A row without an id cannot be walked. resolveComponents rejects it
      // inside the transaction with a proper message; bailing out here keeps
      // Firestore from throwing on an empty document path first.
      if (!component.id) continue;

      const key = nodeKey(component);

      if (key === ownerKey || path.includes(key)) {
        throw new BadRequestError(
          `Ciclo detectado en la receta: ${[...path, key].join(' → ')}`,
        );
      }

      const childRecipeId = await recipeIdForComponent(component);
      if (!childRecipeId) continue;

      const childRecipe = await readDoc(recipesRef(bakeryId), childRecipeId);
      if (!childRecipe) continue;

      await walk(childRecipe.ingredients || [], [...path, key]);
    }
  };

  await walk(recipe.ingredients || [], ownerKey ? [ownerKey] : []);
};

/**
 * Accumulator shared by one propagation run.
 *
 * `writesByPath` is keyed by document path, not pushed to a list, because one
 * run legitimately touches the same document more than once: a product with two
 * recipe-costed combinations is reached through two different recipes. Keying by
 * path merges the two edits; separate transaction.update() calls would each
 * carry a full `variations` blob built from the same snapshot, and the last one
 * would win.
 */
const createPlan = () => ({
  visited: new Set(),
  writesByPath: new Map(),
  // nodeKey -> the node's post-walk cost (per-unit for an ingredient, total for
  // a product/combination). computeRecipeCost reads this before hitting
  // Firestore, so a value changed earlier in the same walk — and not yet
  // committed — is still seen by everything downstream.
  costOverrides: new Map(),
  // [{ ref, changes }] — one entry per owner doc whose cached cost the walk
  // actually moved. Flushed to updateHistory by applyPlan; read as-is (without
  // committing) by the dry-run preview.
  history: [],
});

/** Merges a document's planned fields, so later edits build on earlier ones. */
const stage = (plan, ref, data) => {
  const existing = plan.writesByPath.get(ref.path);

  if (existing) {
    existing.data = { ...existing.data, ...data };
    return;
  }

  plan.writesByPath.set(ref.path, { ref, data });
};

/** What a document will look like after the writes planned so far. */
const stagedData = (plan, ref) => plan.writesByPath.get(ref.path)?.data;

const planWrites = (plan) => [...plan.writesByPath.values()];

/** Records that an owner doc's cached cost moved, for applyPlan / the preview. */
const recordCostChange = (plan, ref, changes) => {
  plan.history.push({ ref, changes });
};

/**
 * "What does this recipe's component list cost right now" — the single place
 * that question is answered. One live read per component (ingredient.costPerUnit
 * or product.costPrice / combination.costPrice); a component whose cost already
 * moved earlier in this same walk is taken from plan.costOverrides instead, so
 * the sum reflects the not-yet-committed state the walk is building.
 *
 * Not recursive: a recipe's own component list is flat. Nesting is handled by
 * the propagation walk, which calls this once per level.
 */
const computeRecipeCost = async (
  transaction,
  bakeryId,
  components = [],
  plan = createPlan(),
) => {
  let total = 0;

  for (const raw of components) {
    const component = normalizeComponent(raw);
    if (!component.id) continue;

    const quantity = Number(raw.quantity) || 0;
    if (quantity <= 0) continue;

    const key = nodeKey(component);
    if (plan.costOverrides.has(key)) {
      total += quantity * plan.costOverrides.get(key);
      continue;
    }

    if (component.type === 'product') {
      const doc = await transaction.get(productsRef(bakeryId).doc(component.id));
      if (!doc.exists) continue;
      const product = doc.data();

      if (component.combinationId) {
        const combination = (product.variations?.combinations || []).find(
          (c) => c.id === component.combinationId,
        );
        total += quantity * (Number(combination?.costPrice) || 0);
      } else {
        total += quantity * (Number(product.costPrice) || 0);
      }
    } else {
      const doc = await transaction.get(
        ingredientsRef(bakeryId).doc(component.id),
      );
      if (!doc.exists) continue;
      total += quantity * (Number(doc.data().costPerUnit) || 0);
    }
  }

  return total;
};

/**
 * Stages — never applies — the owner-cache writes implied by a recipe's cost,
 * onto the shared `plan`. Every Firestore read happens here, so the caller
 * applies the plan afterwards and keeps a transaction's reads-before-writes
 * rule.
 */
const planRecipeCostPropagation = async (
  transaction,
  bakeryId,
  recipe,
  { plan = createPlan(), depth = 0 } = {},
) => {
  const key = ownerKeyOf(recipe);

  // assertGraphIsSane already rejects cyclic/too-deep graphs at save time; the
  // depth cap and visited set here just bound a walk over data that reaches
  // this without that check (a direct Firestore edit, a future script).
  if (depth > MAX_DEPTH || !key || plan.visited.has(key)) return planWrites(plan);
  plan.visited.add(key);

  const totalCost = await computeRecipeCost(
    transaction,
    bakeryId,
    recipe.ingredients,
    plan,
  );

  // Ingredient-owned recipe: derive costPerUnit through the yield, then let the
  // ingredient's own consumers pick the change up.
  if (recipe.ingredientId) {
    if (!recipe.yield) return planWrites(plan);

    const ref = ingredientsRef(bakeryId).doc(recipe.ingredientId);
    const doc = await transaction.get(ref);
    if (!doc.exists) return planWrites(plan);

    const newCostPerUnit = totalCost / recipe.yield;
    // Publish the new per-unit cost to the walk before the sameCost gate: a
    // sibling recipe reached later this walk must cost this ingredient
    // consistently even when the owner cache itself needs no write.
    plan.costOverrides.set(key, newCostPerUnit);
    if (sameCost(doc.data().costPerUnit, newCostPerUnit)) return planWrites(plan);

    stage(plan, ref, { costPerUnit: newCostPerUnit, updatedAt: new Date() });
    recordCostChange(plan, ref, {
      costPerUnit: { from: Number(doc.data().costPerUnit) || 0, to: newCostPerUnit },
    });

    await planIngredientCostPropagation(
      transaction,
      bakeryId,
      recipe.ingredientId,
      newCostPerUnit,
      { plan, depth: depth + 1 },
    );

    return planWrites(plan);
  }

  if (!recipe.productId) return planWrites(plan);

  // NB: unlike the ingredient branch, the override is published only AFTER the
  // costPriceSource gate below. A 'manual' owner keeps the cost the user typed,
  // so that — not this recipe's total — is what consumers must see for the rest
  // of the walk. planOwnerLink falls back to computeRecipeCost when the override
  // is absent, which is exactly the manual-owner case at create time.
  const productDocRef = productsRef(bakeryId).doc(recipe.productId);
  const productDoc = await transaction.get(productDocRef);
  if (!productDoc.exists) return planWrites(plan);
  const product = productDoc.data();

  // Combination-owned: rewrite that one combination inside the variations blob.
  if (recipe.combinationId) {
    // Build on the staged variations when a sibling combination was already
    // planned in this run, otherwise on the stored snapshot.
    const variations =
      stagedData(plan, productDocRef)?.variations || product.variations || {};
    const combinations = variations.combinations || [];
    const target = combinations.find((c) => c.id === recipe.combinationId);

    // A manually typed cost is never silently clobbered by propagation.
    if (!target || target.costPriceSource !== 'recipe') return planWrites(plan);

    plan.costOverrides.set(key, totalCost);
    if (sameCost(target.costPrice, totalCost)) return planWrites(plan);

    stage(plan, productDocRef, {
      variations: {
        ...variations,
        combinations: combinations.map((c) =>
          c.id === recipe.combinationId ? { ...c, costPrice: totalCost } : c,
        ),
      },
      updatedAt: new Date(),
    });
    recordCostChange(plan, productDocRef, {
      costPrice: {
        from: Number(target.costPrice) || 0,
        to: totalCost,
        combinationId: recipe.combinationId,
      },
    });

    return planWrites(plan);
  }

  // Product-owned (no variations).
  if (product.costPriceSource !== 'recipe') return planWrites(plan);

  plan.costOverrides.set(key, totalCost);
  if (sameCost(product.costPrice, totalCost)) return planWrites(plan);

  stage(plan, productDocRef, { costPrice: totalCost, updatedAt: new Date() });
  recordCostChange(plan, productDocRef, {
    costPrice: { from: Number(product.costPrice) || 0, to: totalCost },
  });
  // ponytail: the walk stops here. The ingredient branch above recurses into
  // planIngredientCostPropagation, but a product's new cost is never carried on
  // to the recipes that consume that product, even though product.usedInRecipes
  // is maintained. reconcileOwnerCost on the consumer is the backstop.
  return planWrites(plan);
};

/**
 * An ingredient's cost changed: for every recipe that uses it, recompute that
 * recipe's cost and carry the new total on to its owner. One hop at a time; the
 * depth cap keeps it terminating.
 *
 * The new cost is published to the walk via plan.costOverrides — computeRecipeCost
 * reads it from there instead of the ingredient doc, whose write isn't committed
 * until this transaction ends.
 */
const planIngredientCostPropagation = async (
  transaction,
  bakeryId,
  ingredientId,
  newCostPerUnit,
  { plan = createPlan(), depth = 0 } = {},
) => {
  if (depth > MAX_DEPTH) return planWrites(plan);

  // Seed — never check — the entry node: a cycle coming back to a recipe owned
  // by this ingredient is then caught by the guard in planRecipeCostPropagation.
  plan.visited.add(`ingredient_${ingredientId}`);
  plan.costOverrides.set(`ingredient_${ingredientId}`, newCostPerUnit);

  const ingredientDoc = await transaction.get(
    ingredientsRef(bakeryId).doc(ingredientId),
  );
  if (!ingredientDoc.exists) return planWrites(plan);

  const usedInRecipes = ingredientDoc.data().usedInRecipes || [];

  for (const recipeId of usedInRecipes) {
    const ref = recipesRef(bakeryId).doc(recipeId);
    const doc = await transaction.get(ref);
    if (!doc.exists) continue;

    const recipe = { id: doc.id, ...doc.data() };

    const isTarget = (c) => c.type !== 'product' && c.id === ingredientId;
    if (!(recipe.ingredients || []).some(isTarget)) continue;

    // ponytail: a recipe fed by two ingredients that BOTH move in one walk is
    // re-costed only on its first reach (planRecipeCostPropagation's visited
    // guard); the second mover isn't reflected until the next cost change or a
    // reconcileOwnerCost run. A diamond in the cost graph — rare enough at
    // bakery scale that widening the walk isn't worth it.
    await planRecipeCostPropagation(transaction, bakeryId, recipe, {
      plan,
      depth: depth + 1,
    });
  }

  return planWrites(plan);
};

const applyWrites = (transaction, writes) => {
  writes.forEach(({ ref, data }) => transaction.update(ref, data));
};

/**
 * Commits a plan: the staged owner-cache writes, then one updateHistory entry
 * per owner whose cost actually moved. `reason` tags the history entries
 * ('reconciliation' for a drift fix); ordinary edits leave it null.
 */
const applyPlan = (transaction, plan, { editor = null, reason = null } = {}) => {
  applyWrites(transaction, planWrites(plan));
  for (const { ref, changes } of plan.history) {
    recordHistory(transaction, ref, changes, null, editor, reason);
  }
};

/**
 * Read-only dry run: what an ingredient cost change WOULD do, without doing it.
 * Runs the same walk inside a transaction and returns the planned owner-cost
 * moves; never calls applyPlan.
 */
const previewIngredientCostImpact = (bakeryId, ingredientId, newCostPerUnit) =>
  db.runTransaction(async (transaction) => {
    const plan = createPlan();
    await planIngredientCostPropagation(
      transaction,
      bakeryId,
      ingredientId,
      newCostPerUnit,
      { plan },
    );
    return plan.history.map(({ ref, changes }) => ({ path: ref.path, changes }));
  });

/**
 * Recompute-and-compare-and-correct for one owner (product, combination or
 * manufactured ingredient). Targets the owner's recipe directly, so it catches
 * drift even when the usedInRecipes reverse-index — what normal propagation
 * follows — has gone stale. On mismatch it corrects the cache and writes a
 * history entry tagged 'reconciliation'. On-demand only.
 */
const reconcileOwnerCost = (bakeryId, owner = {}, editor = null) =>
  db.runTransaction(async (transaction) => {
    const { type, id, combinationId = null } = owner;

    let recipeId;
    if (type === 'ingredient') {
      const doc = await transaction.get(ingredientsRef(bakeryId).doc(id));
      if (!doc.exists) throw new NotFoundError('Ingredient not found');
      recipeId = doc.data().recipeId || null;
    } else {
      const doc = await transaction.get(productsRef(bakeryId).doc(id));
      if (!doc.exists) throw new NotFoundError('Product not found');
      recipeId = resolveRecipeId(doc.data(), combinationId);
    }

    if (!recipeId) return { changed: false, reason: 'owner has no recipe' };

    const recipeDoc = await transaction.get(recipesRef(bakeryId).doc(recipeId));
    if (!recipeDoc.exists) return { changed: false, reason: 'recipe not found' };

    const plan = createPlan();
    await planRecipeCostPropagation(
      transaction,
      bakeryId,
      { id: recipeDoc.id, ...recipeDoc.data() },
      { plan },
    );

    if (planWrites(plan).length === 0) return { changed: false };

    applyPlan(transaction, plan, { editor, reason: 'reconciliation' });
    return {
      changed: true,
      corrections: plan.history.map(({ ref, changes }) => ({
        path: ref.path,
        changes,
      })),
    };
  });

module.exports = {
  assertGraphIsSane,
  sameCost,
  computeRecipeCost,
  createPlan,
  stage,
  stagedData,
  recordCostChange,
  planRecipeCostPropagation,
  planIngredientCostPropagation,
  applyPlan,
  previewIngredientCostImpact,
  reconcileOwnerCost,
};
