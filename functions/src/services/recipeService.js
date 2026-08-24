// services/recipeService.js
const { db } = require('../config/firebase');
const { FieldValue } = require('firebase-admin/firestore');
const { Recipe, RecipeComponent } = require('../models/Recipe');
const createBaseService = require('./base/serviceFactory');
const {
  requiresNewVersion,
  recipeVersioningService,
  ingredientsChanged,
} = require('./versioning/recipeVersioning');
const {
  assertGraphIsSane,
  planRecipeCostPropagation,
  applyWrites,
} = require('./recipeGraph');
const { BadRequestError, NotFoundError } = require('../utils/errors');

const createRecipeService = () => {
  const baseService = createBaseService('recipes', Recipe, 'bakeries/{bakeryId}');

  const ingredientsRef = (bakeryId) =>
    db.collection(`bakeries/${bakeryId}/ingredients`);
  const productsRef = (bakeryId) => db.collection(`bakeries/${bakeryId}/products`);

  const componentRef = (bakeryId, component) =>
    component.type === RecipeComponent.TYPES.PRODUCT
      ? productsRef(bakeryId).doc(component.id)
      : ingredientsRef(bakeryId).doc(component.id);

  // Identity for relationship bookkeeping. Deliberately ignores combinationId:
  // usedInRecipes lives on the product document, not per combination.
  const componentRefKey = (component) =>
    `${component.type === 'product' ? 'product' : 'ingredient'}:${component.id || component.ingredientId}`;

  /**
   * Exactly one owner (§1A.3): productId alone, productId + combinationId, or
   * ingredientId alone. An unassigned recipe (no owner yet) stays legal — the
   * editor creates a recipe first and links it from the product afterwards.
   */
  const validateOwner = (recipe) => {
    const { productId, combinationId, ingredientId } = recipe;

    if (ingredientId && (productId || combinationId)) {
      throw new BadRequestError(
        'Una receta pertenece a un producto, a una combinación o a un ingrediente — no a varios',
      );
    }

    if (combinationId && !productId) {
      throw new BadRequestError(
        'Una receta de combinación debe indicar también el producto',
      );
    }

    // Yield is what makes a produced ingredient costable (§4).
    if (ingredientId && !(Number(recipe.yield) > 0)) {
      throw new BadRequestError(
        'Una receta de ingrediente debe indicar cuánto produce (yield)',
      );
    }

    if (!ingredientId && recipe.yield) {
      throw new BadRequestError(
        'Solo las recetas de ingredientes llevan yield',
      );
    }
  };

  /**
   * Reads every component's source doc to denormalize name/unit/cost, and
   * enforces unit discipline: a component's quantity is always expressed in the
   * component's own unit. No conversions, ever (§6).
   */
  const resolveComponents = async (transaction, bakeryId, components = []) => {
    return Promise.all(
      components.map(async (raw) => {
        const type =
          raw.type === RecipeComponent.TYPES.PRODUCT
            ? RecipeComponent.TYPES.PRODUCT
            : RecipeComponent.TYPES.INGREDIENT;
        const id = raw.id || raw.ingredientId;

        if (!id) {
          throw new BadRequestError('Cada componente de la receta necesita un id');
        }

        const quantity = Number(raw.quantity);
        if (!(quantity > 0)) {
          throw new BadRequestError(`Cantidad inválida en el componente ${id}`);
        }

        const assertUnit = (sourceUnit, name) => {
          if (raw.unit && raw.unit !== sourceUnit) {
            throw new BadRequestError(
              `"${name}" se mide en ${sourceUnit}, no en ${raw.unit}. No se hacen conversiones.`,
            );
          }
        };

        if (type === RecipeComponent.TYPES.INGREDIENT) {
          const ref = ingredientsRef(bakeryId).doc(id);
          const doc = await transaction.get(ref);

          if (!doc.exists) {
            throw new BadRequestError(`Ingredient ${id} not found`);
          }

          const data = doc.data();
          assertUnit(data.unit, data.name);

          return {
            component: new RecipeComponent({
              type,
              id,
              name: data.name,
              quantity,
              unit: data.unit,
              costPerUnit: data.costPerUnit,
              notes: raw.notes || '',
            }),
            ref,
            currentUsedInRecipes: data.usedInRecipes || [],
          };
        }

        const ref = productsRef(bakeryId).doc(id);
        const doc = await transaction.get(ref);

        if (!doc.exists) {
          throw new BadRequestError(`Product ${id} not found`);
        }

        const data = doc.data();
        let name = data.name;
        let costPerUnit = data.costPrice || 0;
        let combinationId = null;

        // A product component must resolve to a sellable unit (§3): "torta" is
        // not stockable, "torta 500g" is.
        if (data.hasVariations) {
          combinationId = raw.combinationId;
          if (!combinationId) {
            throw new BadRequestError(
              `"${data.name}" tiene variaciones: elige cuál se usa en la receta`,
            );
          }

          const combination = (data.variations?.combinations || []).find(
            (c) => c.id === combinationId,
          );

          if (!combination) {
            throw new BadRequestError(
              `La variación elegida de "${data.name}" ya no existe`,
            );
          }

          name = `${data.name} ${combination.name}`.trim();
          costPerUnit = combination.costPrice || 0;
        }

        assertUnit('unidad', name);

        return {
          component: new RecipeComponent({
            type,
            id,
            combinationId,
            name,
            quantity,
            unit: 'unidad',
            costPerUnit,
            notes: raw.notes || '',
          }),
          ref,
          currentUsedInRecipes: data.usedInRecipes || [],
        };
      }),
    );
  };

  /**
   * Keeps the reverse index (usedInRecipes) honest on ingredients AND products.
   * The deletion guards in 1A.7 are what read it.
   */
  const updateComponentRelationships = (
    transaction,
    bakeryId,
    recipeId,
    oldComponents,
    newComponents,
  ) => {
    const oldKeys = new Map(
      oldComponents.map((c) => [componentRefKey(c), c]),
    );
    const newKeys = new Map(
      newComponents.map((c) => [componentRefKey(c), c]),
    );

    oldKeys.forEach((component, key) => {
      if (newKeys.has(key)) return;
      transaction.update(componentRef(bakeryId, component), {
        usedInRecipes: FieldValue.arrayRemove(recipeId),
        updatedAt: new Date(),
      });
    });

    newKeys.forEach((component, key) => {
      if (oldKeys.has(key)) return;
      transaction.update(componentRef(bakeryId, component), {
        usedInRecipes: FieldValue.arrayUnion(recipeId),
        updatedAt: new Date(),
      });
    });
  };

  const create = async (recipeData, bakeryId) => {
    try {
      validateOwner(recipeData);

      // Guardrails run before the transaction: the graph walk reads an unbounded
      // number of documents, which a transaction must not do (§1A.6).
      await assertGraphIsSane(bakeryId, recipeData);

      const recipe = await db.runTransaction(async (transaction) => {
        // ---- reads ----
        const resolved = await resolveComponents(
          transaction,
          bakeryId,
          recipeData.ingredients,
        );

        const recipeRef = baseService.getCollectionRef(bakeryId).doc();
        const recipeId = recipeRef.id;

        const newRecipe = new Recipe({
          id: recipeId,
          bakeryId,
          ...recipeData,
          ingredients: resolved.map((item) => item.component),
        });

        const costWrites = await planRecipeCostPropagation(
          transaction,
          bakeryId,
          newRecipe,
        );

        // ---- writes ----
        transaction.set(recipeRef, newRecipe.toFirestore());

        resolved.forEach(({ ref, currentUsedInRecipes }) => {
          if (!currentUsedInRecipes.includes(recipeId)) {
            transaction.update(ref, {
              usedInRecipes: FieldValue.arrayUnion(recipeId),
              updatedAt: new Date(),
            });
          }
        });

        applyWrites(transaction, costWrites);

        return {
          id: recipeId,
          ...newRecipe,
        };
      });

      return recipe;
    } catch (error) {
      console.error('Error in createRecipe:', error);
      throw error;
    }
  };

  const update = async (recipeId, updateData, bakeryId, transaction = null) => {
    try {
      const componentsChanged = updateData.ingredients !== undefined;

      const updateLogic = async (t) => {
        const recipeRef = baseService.getCollectionRef(bakeryId).doc(recipeId);
        const recipeDoc = await t.get(recipeRef);

        if (!recipeDoc.exists) {
          throw new NotFoundError('Recipe not found');
        }

        const currentRecipe = Recipe.fromFirestore(recipeDoc);

        // ---- reads ----
        const resolved = componentsChanged
          ? await resolveComponents(t, bakeryId, updateData.ingredients)
          : null;

        const updatedRecipe = new Recipe({
          ...currentRecipe,
          ...updateData,
          ...(resolved ? { ingredients: resolved.map((i) => i.component) } : {}),
          updatedAt: new Date(),
        });

        validateOwner(updatedRecipe);

        const needsVersion = requiresNewVersion(currentRecipe, updatedRecipe);
        const costWrites = await planRecipeCostPropagation(
          t,
          bakeryId,
          updatedRecipe,
        );

        // ---- writes ----
        if (needsVersion) {
          if (ingredientsChanged(currentRecipe, updatedRecipe)) {
            updateComponentRelationships(
              t,
              bakeryId,
              recipeId,
              currentRecipe.ingredients,
              updatedRecipe.ingredients,
            );
          }

          const newVersion = await recipeVersioningService.createVersion(
            t,
            recipeRef,
            currentRecipe,
          );
          updatedRecipe.version = newVersion;
        }

        t.update(recipeRef, updatedRecipe.toFirestore());
        applyWrites(t, costWrites);
        return updatedRecipe;
      };

      // Same pre-transaction guardrail as create (§1A.6). The owner has to come
      // from the stored doc when the patch doesn't carry it — without it a
      // recipe could be made a component of itself.
      //
      // Skipped when the caller supplies its own transaction: the walk reads an
      // unbounded number of documents, so it cannot run inside one, and running
      // it outside would read state the open transaction cannot see. A caller
      // passing a transaction is mid-operation on a graph it already validated.
      if (componentsChanged && !transaction) {
        const storedDoc = await baseService
          .getCollectionRef(bakeryId)
          .doc(recipeId)
          .get();

        if (!storedDoc.exists) {
          throw new NotFoundError('Recipe not found');
        }

        await assertGraphIsSane(bakeryId, {
          ...storedDoc.data(),
          ...updateData,
          id: recipeId,
        });
      }

      // Use existing transaction or create new one
      return transaction
        ? await updateLogic(transaction)
        : await db.runTransaction(updateLogic);
    } catch (error) {
      console.error('Error in updateRecipe:', error);
      throw error;
    }
  };

  /**
   * A recipe may only be deleted when nothing points at it: no product, no
   * combination, no ingredient (§1A.7 — the old check only covered products).
   * Combinations live inside the product document, so they cannot be queried
   * directly; scanning the bakery's products is fine at this scale.
   */
  const findRecipeOwners = async (bakeryId, recipeId) => {
    const [productsSnapshot, ingredientsSnapshot] = await Promise.all([
      productsRef(bakeryId).get(),
      ingredientsRef(bakeryId).where('recipeId', '==', recipeId).get(),
    ]);

    const owners = [];

    productsSnapshot.forEach((doc) => {
      const product = doc.data();

      if (product.recipeId === recipeId) {
        owners.push(product.name);
        return;
      }

      (product.variations?.combinations || []).forEach((combination) => {
        if (combination.recipeId === recipeId) {
          owners.push(`${product.name} ${combination.name}`.trim());
        }
      });
    });

    ingredientsSnapshot.forEach((doc) => owners.push(doc.data().name));

    return owners;
  };

  const remove = async (recipeId, bakeryId, editor = null) => {
    try {
      const recipeRef = baseService.getCollectionRef(bakeryId).doc(recipeId);
      const recipeDoc = await recipeRef.get();

      if (!recipeDoc.exists) {
        throw new NotFoundError('Recipe not found');
      }

      const owners = await findRecipeOwners(bakeryId, recipeId);

      if (owners.length > 0) {
        throw new BadRequestError(
          `No se puede eliminar una receta en uso. Usada por: ${owners.join(', ')}`,
        );
      }

      const currentRecipe = Recipe.fromFirestore(recipeDoc);

      return await db.runTransaction(async (transaction) => {
        const components = currentRecipe.ingredients;

        // Release the reverse index so components don't keep a dangling id.
        updateComponentRelationships(
          transaction,
          bakeryId,
          recipeId,
          components,
          [],
        );

        // A recipe is hard-deleted, so it cannot carry lastEditedBy the way a
        // soft-deleted document does. The history subcollection survives the
        // delete, so the record of who removed it goes there.
        transaction.set(recipeRef.collection('history').doc(), {
          version: currentRecipe.version || 1,
          deleted: true,
          timestamp: new Date(),
          editor: editor
            ? { userId: editor.uid, email: editor.email, role: editor.role }
            : null,
        });

        transaction.delete(recipeRef);
        return null;
      });
    } catch (error) {
      console.error('Error in deleteRecipe:', error);
      throw error;
    }
  };

  return {
    ...baseService,
    create,
    update,
    // The controller factory calls `remove`; exporting only `delete` left the
    // guard below unreachable behind baseService.remove.
    remove,
    delete: remove,
  };
};

module.exports = createRecipeService();
