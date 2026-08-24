// services/recipeGraph.js
//
// Everything that walks the recipe component graph:
//   - save-time guardrails: cycle detection + depth cap (§6, plan 1A.6)
//   - cost propagation planning: recipe cost -> owner cost -> consumers (§7, plan 1A.8)
//
// Both live here because they traverse the same edges. Phase 2's deduction
// expansion is a third walk of this graph, but it belongs to stockService — it
// runs inside the order transaction and yields movements, not validations.
const { db } = require('../config/firebase');
const { BadRequestError } = require('../utils/errors');

// The depth cap is what makes phase-2 write fan-out provably bounded (§6).
const MAX_DEPTH = 5;

const recipesRef = (bakeryId) => db.collection(`bakeries/${bakeryId}/recipes`);
const productsRef = (bakeryId) => db.collection(`bakeries/${bakeryId}/products`);
const ingredientsRef = (bakeryId) =>
  db.collection(`bakeries/${bakeryId}/ingredients`);

/**
 * The one place that decides which recipe a sellable unit uses (§2, plan 1A.3).
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
 * Reduces a stored or incoming component row to { type, id, combinationId }.
 *
 * Rows reach us in three shapes: typed ({ type, id }), legacy ({ ingredientId },
 * no type) and half-legacy (the ingredient's own 'manufactured' / 'resale' type
 * in the `type` field). Only an explicit 'product' is a product — everything
 * else is an ingredient. This is the same rule resolveComponents applies in
 * recipeService; both must agree or the cycle check keys a node differently
 * from how it reads it.
 */
const normalizeComponent = (raw = {}) => ({
  type: raw.type === 'product' ? 'product' : 'ingredient',
  id: raw.id || raw.ingredientId,
  combinationId: raw.combinationId || null,
});

/** Stable identity of a stock-holding / recipe-owning node (mirrors §8.1 itemKey). */
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

const totalCostOf = (components = []) =>
  components.reduce(
    (sum, c) => sum + (Number(c.quantity) || 0) * (Number(c.costPerUnit) || 0),
    0,
  );

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
 * graph cyclic between this check and the commit. The phase-2 runtime depth
 * guard is the backstop; a transactional graph lock is not worth it at bakery
 * scale.
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
 * recipe-costed combinations is reached through two different recipes. Two
 * separate transaction.update() calls would each carry a full `variations` blob
 * built from the same pre-change snapshot, so the last one silently discarded
 * the other's new costPrice.
 */
const createPlan = () => ({ visited: new Set(), writesByPath: new Map() });

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

/**
 * Plans — never applies — the writes implied by a recipe's cost.
 *
 * Every Firestore read happens while planning, so the caller can apply the
 * returned writes afterwards and keep a transaction's reads-before-writes rule
 * (plan invariant 4). Returns [{ ref, data }].
 */
const planRecipeCostPropagation = async (
  transaction,
  bakeryId,
  recipe,
  { plan = createPlan(), depth = 0 } = {},
) => {
  const key = ownerKeyOf(recipe);

  // The save-time cycle check guarantees termination; these are belt-and-braces
  // for data that predates it.
  if (depth > MAX_DEPTH || !key || plan.visited.has(key)) return planWrites(plan);
  plan.visited.add(key);

  const totalCost = totalCostOf(recipe.ingredients);

  // Ingredient-owned recipe: derive costPerUnit through the yield, then let the
  // ingredient's own consumers pick the change up (§7).
  if (recipe.ingredientId) {
    if (!recipe.yield) return planWrites(plan);

    const ref = ingredientsRef(bakeryId).doc(recipe.ingredientId);
    const doc = await transaction.get(ref);
    if (!doc.exists) return planWrites(plan);

    const newCostPerUnit = totalCost / recipe.yield;
    if (sameCost(doc.data().costPerUnit, newCostPerUnit)) return planWrites(plan);

    stage(plan, ref, { costPerUnit: newCostPerUnit, updatedAt: new Date() });

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

    // A manual cost is never silently clobbered (§7 / plan 1A.8).
    if (!target || target.costPriceSource !== 'recipe') return planWrites(plan);
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

    return planWrites(plan);
  }

  // Product-owned (no variations).
  if (product.costPriceSource !== 'recipe') return planWrites(plan);
  if (sameCost(product.costPrice, totalCost)) return planWrites(plan);

  stage(plan, productDocRef, { costPrice: totalCost, updatedAt: new Date() });
  return planWrites(plan);
};

/**
 * An ingredient's cost changed: refresh the denormalized costPerUnit on every
 * recipe that uses it, then carry each of those recipes' new totals on to their
 * own owners. One hop at a time; the cycle check keeps it terminating.
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

    // Same reason as the variations blob below: this run can reach one recipe
    // twice (it uses ingredient A, and is also the production recipe of
    // ingredient B, which A's fan-out reaches). Rebuilding from the stored
    // array would drop the cost already staged for the earlier ingredient.
    const components = stagedData(plan, ref)?.ingredients
      || recipe.ingredients
      || [];

    // Legacy rows keep their id in `ingredientId`; typed rows use `id` (§1A.4).
    const isTarget = (c) =>
      c.type !== 'product' && (c.id || c.ingredientId) === ingredientId;

    if (!components.some(isTarget)) continue;

    const updatedComponents = components.map((c) =>
      isTarget(c) ? { ...c, costPerUnit: newCostPerUnit } : c,
    );

    stage(plan, ref, { ingredients: updatedComponents, updatedAt: new Date() });

    await planRecipeCostPropagation(
      transaction,
      bakeryId,
      { ...recipe, ingredients: updatedComponents },
      { plan, depth: depth + 1 },
    );
  }

  return planWrites(plan);
};

const applyWrites = (transaction, writes) => {
  writes.forEach(({ ref, data }) => transaction.update(ref, data));
};

module.exports = {
  assertGraphIsSane,
  planRecipeCostPropagation,
  planIngredientCostPropagation,
  applyWrites,
};
