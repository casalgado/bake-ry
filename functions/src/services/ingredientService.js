const { db } = require('../config/firebase');
const Ingredient = require('../models/Ingredient');
const recipeService = require('./recipeService');

/**
 * Checks if costPerUnit has changed between current and update data
 * @param {Object} currentIngredient - Current ingredient data
 * @param {Object} updateData - New ingredient data
 * @returns {boolean} True if cost changed
 */
const hasCostChanged = (currentIngredient, updateData) => {
  return (
    updateData.costPerUnit !== undefined &&
    updateData.costPerUnit !== currentIngredient.costPerUnit
  );
};

/**
 * Updates recipes when ingredient cost changes
 * @param {FirebaseFirestore.Transaction} transaction - Firestore transaction
 * @param {string} bakeryId - Bakery ID
 * @param {string} ingredientId - Ingredient ID
 * @param {number} newCostPerUnit - New cost per unit
 * @param {string[]} usedInRecipes - Array of recipe IDs using this ingredient
 */
const updateRecipesWithNewCost = async (
  transaction,
  bakeryId,
  ingredientId,
  newCostPerUnit,
  usedInRecipes,
) => {
  const updatePromises = usedInRecipes.map(async (recipeId) => {
    const recipe = await recipeService.getRecipeById(bakeryId, recipeId);
    if (!recipe) return;

    // Update the ingredient cost in the recipe
    const updatedIngredients = recipe.ingredients.map((ing) =>
      ing.ingredientId === ingredientId
        ? { ...ing, costPerUnit: newCostPerUnit }
        : ing,
    );

    // Let recipeService handle the update and versioning
    console.log('updating recipe', recipeId);
    await recipeService.updateRecipe(
      bakeryId,
      recipeId,
      {
        ingredients: updatedIngredients,
      },
      transaction,
    );
  });

  await Promise.all(updatePromises);
};

const ingredientService = {
  async create(ingredientData, bakeryId) {
    try {
      const ingredientsRef = db
        .collection('bakeries')
        .doc(bakeryId)
        .collection('ingredients');
      const newIngredientRef = ingredientsRef.doc();

      const ingredient = new Ingredient({
        id: newIngredientRef.id,
        bakeryId,
        ...ingredientData,
      });

      await newIngredientRef.set(ingredient.toFirestore());
      return ingredient;
    } catch (error) {
      console.error('Error in createIngredient:', error);
      throw error;
    }
  },

  async getById(ingredientId, bakeryId) {
    try {
      const doc = await db
        .collection('bakeries')
        .doc(bakeryId)
        .collection('ingredients')
        .doc(ingredientId)
        .get();

      if (!doc.exists) {
        return null;
      }

      return Ingredient.fromFirestore(doc);
    } catch (error) {
      console.error('Error in getIngredient:', error);
      throw error;
    }
  },

  async getAll(bakeryId, filters = {}) {
    try {
      let query = db
        .collection('bakeries')
        .doc(bakeryId)
        .collection('ingredients');

      // Apply filters
      if (filters.category) {
        query = query.where('category', '==', filters.category);
      }
      if (filters.isActive !== undefined) {
        query = query.where('isActive', '==', filters.isActive);
      }
      if (filters.needsRestock === true) {
        query = query.where('currentStock', '<=', 'reorderPoint');
      }

      const snapshot = await query.get();
      return snapshot.docs.map((doc) => Ingredient.fromFirestore(doc));
    } catch (error) {
      console.error('Error in getAllIngredients:', error);
      throw error;
    }
  },

  async update(ingredientId, updateData, bakeryId) {
    try {
      const ingredientRef = db
        .collection('bakeries')
        .doc(bakeryId)
        .collection('ingredients')
        .doc(ingredientId);

      // Start a transaction
      return await db.runTransaction(async (transaction) => {
        const doc = await ingredientRef.get();
        if (!doc.exists) {
          return null;
        }

        const currentIngredient = Ingredient.fromFirestore(doc);

        // checks if costPerUnit has changed, if so, calls updateRecipe on all recipes that use this ingredient
        if (hasCostChanged(currentIngredient, updateData)) {
          console.log('Ingredient cost changed, updating recipes  ');
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

        await ingredientRef.update(updatedIngredient.toFirestore());
        return updatedIngredient;
      });
    } catch (error) {
      console.error('Error in updateIngredient:', error);
      throw error;
    }
  },

  async delete(ingredientId, bakeryId) {
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

      await db
        .collection('bakeries')
        .doc(bakeryId)
        .collection('ingredients')
        .doc(ingredientId)
        .delete();

      return true;
    } catch (error) {
      console.error('Error in deleteIngredient:', error);
      throw error;
    }
  },

};

module.exports = ingredientService;
