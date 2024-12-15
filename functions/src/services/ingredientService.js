// services/ingredientService.js
const { db } = require('../config/firebase');
const Ingredient = require('../models/Ingredient');
const createBaseService = require('./base/serviceFactory');
const { NotFoundError } = require('../utils/errors');

const createIngredientService = () => {
  const baseService = createBaseService('ingredients', Ingredient, 'bakeries/{bakeryId}');

  const hasCostChanged = (currentIngredient, updateData) => {
    return (
      updateData.costPerUnit !== undefined &&
      updateData.costPerUnit !== currentIngredient.costPerUnit
    );
  };

  const updateRecipesWithNewCost = async (
    transaction,
    bakeryId,
    ingredientId,
    newCostPerUnit,
    usedInRecipes,
  ) => {
    const updatePromises = usedInRecipes.map(async (recipeId) => {
      const recipeRef = db
        .collection('bakeries')
        .doc(bakeryId)
        .collection('recipes')
        .doc(recipeId);

      const recipeDoc = await transaction.get(recipeRef);
      if (!recipeDoc.exists) return;

      const recipe = recipeDoc.data();

      // Update the ingredient cost in the recipe
      const updatedIngredients = recipe.ingredients.map((ing) =>
        ing.ingredientId === ingredientId
          ? { ...ing, costPerUnit: newCostPerUnit }
          : ing,
      );

      transaction.update(recipeRef, {
        ingredients: updatedIngredients,
        updatedAt: new Date(),
      });
    });

    await Promise.all(updatePromises);
  };

  const update = async (ingredientId, updateData, bakeryId) => {
    try {
      const ingredientRef = baseService.getCollectionRef(bakeryId).doc(ingredientId);

      return await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(ingredientRef);
        if (!doc.exists) {
          throw new NotFoundError('Ingredient not found');
        }

        const currentIngredient = Ingredient.fromFirestore(doc);

        // Check if cost has changed
        if (hasCostChanged(currentIngredient, updateData)) {
          await updateRecipesWithNewCost(
            transaction,
            bakeryId,
            ingredientId,
            updateData.costPerUnit,
            currentIngredient.usedInRecipes || [],
          );
        }

        const updatedIngredient = new Ingredient({
          ...currentIngredient,
          ...updateData,
          updatedAt: new Date(),
        });

        await transaction.update(ingredientRef, updatedIngredient.toFirestore());
        return updatedIngredient;
      });
    } catch (error) {
      console.error('Error in updateIngredient:', error);
      throw error;
    }
  };

  const remove = async (ingredientId, bakeryId) => {
    try {
      // First check if the ingredient is used in any recipes
      const recipesRef = db
        .collection('bakeries')
        .doc(bakeryId)
        .collection('recipes');
      const recipeSnapshot = await recipesRef
        .where('ingredients', 'array-contains', ingredientId)
        .limit(1)
        .get();

      if (!recipeSnapshot.empty) {
        throw new Error('Cannot delete ingredient that is used in recipes');
      }

      return baseService.remove(ingredientId, bakeryId);
    } catch (error) {
      console.error('Error in deleteIngredient:', error);
      throw error;
    }
  };

  return {
    ...baseService,
    update,
    remove,
  };
};

module.exports = createIngredientService();
