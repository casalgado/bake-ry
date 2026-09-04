// services/ingredientService.js
const { db } = require('../config/firebase');
const Ingredient = require('../models/Ingredient');
const createBaseService = require('./base/serviceFactory');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const {
  planIngredientCostPropagation,
  createPlan,
  applyPlan,
} = require('./recipeGraph');
const { syncIngredientStockDoc } = require('./stockService');

const createIngredientService = () => {
  const baseService = createBaseService('ingredients', Ingredient, 'bakeries/{bakeryId}');

  const hasCostChanged = (currentIngredient, updateData) => {
    return (
      updateData.costPerUnit !== undefined &&
      updateData.costPerUnit !== currentIngredient.costPerUnit
    );
  };

  const create = async (ingredientData, bakeryId) => {
    const created = await baseService.create(ingredientData, bakeryId);
    // Same post-commit, non-fatal sync as update(): an ingredient created
    // already 'stocked' needs its stocks doc without waiting for a first edit.
    await syncIngredientStockDoc(bakeryId, created);
    return created;
  };

  const update = async (ingredientId, updateData, bakeryId, editor = null) => {
    try {
      const ingredientRef = baseService.getCollectionRef(bakeryId).doc(ingredientId);

      const updated = await db.runTransaction(async (transaction) => {
        // ---- reads ----
        const doc = await transaction.get(ingredientRef);
        if (!doc.exists) {
          throw new NotFoundError('Ingredient not found');
        }

        const currentIngredient = Ingredient.fromFirestore(doc);

        // A cost change fans out to every consuming recipe and onward to those
        // recipes' owners. Planned first, applied below, so the transaction
        // never reads after it writes.
        const plan = createPlan();
        if (hasCostChanged(currentIngredient, updateData)) {
          await planIngredientCostPropagation(
            transaction,
            bakeryId,
            ingredientId,
            updateData.costPerUnit,
            { plan },
          );
        }

        const updatedIngredient = new Ingredient({
          ...currentIngredient,
          ...updateData,
          updatedAt: new Date(),
        });

        // ---- writes ----
        // This runs its own transaction (for the propagation reads), so the
        // updateHistory entry that baseService.update writes is written here
        // directly — same shape, via the shared recordHistory.
        const changes = baseService.diffObjects(currentIngredient, updatedIngredient);
        if (Object.keys(changes).length > 0) {
          baseService.recordHistory(
            transaction,
            ingredientRef,
            changes,
            currentIngredient,
            editor,
          );
        }

        transaction.update(ingredientRef, updatedIngredient.toFirestore());
        applyPlan(transaction, plan, { editor });
        return updatedIngredient;
      });

      // A stocked ingredient needs a stocks doc. Post-commit and non-fatal: the
      // cache is rebuildable, writeMovements creates what it finds missing, and
      // syncIngredientStockDoc swallows its own failures.
      await syncIngredientStockDoc(bakeryId, { ...updated, id: ingredientId });

      return updated;
    } catch (error) {
      console.error('Error in updateIngredient:', error);
      throw error;
    }
  };

  const remove = async (ingredientId, bakeryId, editor = null) => {
    try {
      // The ingredient's own usedInRecipes array is the source of truth here —
      // recipeService maintains it transactionally. recipe.ingredients holds
      // component objects, not ids, so it can't be queried with array-contains.
      const doc = await baseService.getCollectionRef(bakeryId).doc(ingredientId).get();
      if (!doc.exists) {
        throw new NotFoundError('Ingredient not found');
      }

      const ingredient = Ingredient.fromFirestore(doc);

      // A production ingredient owns its recipe. Deleting it would
      // orphan that recipe — recipeService guards the same edge from the other
      // side (findRecipeOwners queries ingredients by recipeId).
      if (ingredient.recipeId) {
        throw new BadRequestError(
          'No se puede eliminar un ingrediente con receta propia. Elimina primero su receta.',
        );
      }

      const recipeIds = ingredient.usedInRecipes || [];

      if (recipeIds.length > 0) {
        const recipeDocs = await db.getAll(
          ...recipeIds.map((recipeId) =>
            db
              .collection('bakeries')
              .doc(bakeryId)
              .collection('recipes')
              .doc(recipeId),
          ),
        );

        const recipeNames = recipeDocs
          .filter((recipeDoc) => recipeDoc.exists)
          .map((recipeDoc) => recipeDoc.data().name || recipeDoc.id);

        // Stale ids (recipe deleted without cleaning the back-reference) must not
        // block a deletion — only recipes that actually exist do.
        if (recipeNames.length > 0) {
          throw new BadRequestError(
            `No se puede eliminar un ingrediente usado en recetas. Usado en: ${recipeNames.join(', ')}`,
          );
        }
      }

      return baseService.remove(ingredientId, bakeryId, editor);
    } catch (error) {
      console.error('Error in deleteIngredient:', error);
      throw error;
    }
  };

  return {
    ...baseService,
    create,
    update,
    remove,
  };
};

module.exports = createIngredientService();
