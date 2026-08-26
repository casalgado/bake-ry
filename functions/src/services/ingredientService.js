// services/ingredientService.js
const { db } = require('../config/firebase');
const Ingredient = require('../models/Ingredient');
const createBaseService = require('./base/serviceFactory');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const {
  planIngredientCostPropagation,
  applyWrites,
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

  const update = async (ingredientId, updateData, bakeryId) => {
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
        // recipes' owners (§7). Planned first, applied below, so the
        // transaction never reads after it writes.
        const costWrites = hasCostChanged(currentIngredient, updateData)
          ? await planIngredientCostPropagation(
            transaction,
            bakeryId,
            ingredientId,
            updateData.costPerUnit,
          )
          : [];

        const updatedIngredient = new Ingredient({
          ...currentIngredient,
          ...updateData,
          updatedAt: new Date(),
        });

        // ---- writes ----
        transaction.update(ingredientRef, updatedIngredient.toFirestore());
        applyWrites(transaction, costWrites);
        return updatedIngredient;
      });

      // A stocked ingredient needs a stocks doc (§8.1). Post-commit and
      // non-fatal: the cache is rebuildable, writeMovements creates what it
      // finds missing, and syncIngredientStockDoc swallows its own failures.
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
      // recipeService maintains it transactionally. (A previous
      // where('ingredients', 'array-contains', ingredientId) query never matched,
      // because recipe.ingredients holds objects, not ids.)
      const doc = await baseService.getCollectionRef(bakeryId).doc(ingredientId).get();
      if (!doc.exists) {
        throw new NotFoundError('Ingredient not found');
      }

      const ingredient = Ingredient.fromFirestore(doc);

      // A manufactured ingredient owns its production recipe. Deleting it would
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
