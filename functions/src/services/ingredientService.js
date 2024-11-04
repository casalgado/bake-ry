// services/ingredientService.js

const { db } = require('../config/firebase');
const Ingredient = require('../models/Ingredient');
const BaseService = require('./base/BaseService');
const recipeService = require('./RecipeService');
const { NotFoundError } = require('../utils/errors');

class IngredientService extends BaseService {
  constructor() {
    super('ingredients', Ingredient, 'bakeries/{bakeryId}');
  }

  // Helper Methods
  hasCostChanged(currentIngredient, updateData) {
    return (
      updateData.costPerUnit !== undefined &&
        updateData.costPerUnit !== currentIngredient.costPerUnit
    );
  }

  async updateRecipesWithNewCost(
    transaction,
    bakeryId,
    ingredientId,
    newCostPerUnit,
    usedInRecipes,
  ) {
    const updatePromises = usedInRecipes.map(async (recipeId) => {
      const recipe = await recipeService.getById(recipeId, bakeryId);
      if (!recipe) return;

      // Update the ingredient cost in the recipe
      const updatedIngredients = recipe.ingredients.map((ing) =>
        ing.ingredientId === ingredientId
          ? { ...ing, costPerUnit: newCostPerUnit }
          : ing,
      );

      console.log('in ingredientService updating recipe', recipeId);
      await recipeService.update(
        recipeId,
        {
          ingredients: updatedIngredients,
        },
        bakeryId,
        transaction,
      );
    });

    await Promise.all(updatePromises);
  }

  async create(ingredientData, bakeryId) {
    return super.create(ingredientData, bakeryId);
  }

  async getById(ingredientId, bakeryId) {
    return super.getById(ingredientId, bakeryId);
  }

  async getAll(bakeryId, filters = {}, options = {}) {
    try {
      // Convert specific ingredient filters to generic filter format
      const queryFilters = {
        ...(filters.category && { category: filters.category }),
        ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      };

      // Pass both filters and options to base service
      return super.getAll(bakeryId, queryFilters, options);
    } catch (error) {
      console.error('Error in getAllIngredients:', error);
      throw error;
    }
  }

  async update(ingredientId, updateData, bakeryId) {
    try {
      const ingredientRef = this.getCollectionRef(bakeryId).doc(ingredientId);

      // Start a transaction
      return await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(ingredientRef);
        if (!doc.exists) {
          throw new NotFoundError('Ingredient not found');
        }

        const currentIngredient = this.ModelClass.fromFirestore(doc);

        // Check if cost has changed
        if (this.hasCostChanged(currentIngredient, updateData)) {
          await this.updateRecipesWithNewCost(
            transaction,
            bakeryId,
            ingredientId,
            updateData.costPerUnit,
            currentIngredient.usedInRecipes || [],
          );
        }

        const updatedIngredient = new this.ModelClass({
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
  }

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

      return super.delete(ingredientId, bakeryId);
    } catch (error) {
      console.error('Error in deleteIngredient:', error);
      throw error;
    }
  }

}

// Export a single instance
module.exports = new IngredientService();
