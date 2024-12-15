// services/recipeService.js
const { db } = require('../config/firebase');
const { FieldValue } = require('firebase-admin/firestore');
const { Recipe, RecipeIngredient } = require('../models/Recipe');
const createBaseService = require('./base/serviceFactory');
const {
  requiresNewVersion,
  recipeVersioningService,
  ingredientsChanged,
} = require('./versioning/recipeVersioning');
const { BadRequestError, NotFoundError } = require('../utils/errors');

const createRecipeService = () => {
  const baseService = createBaseService('recipes', Recipe, 'bakeries/{bakeryId}');

  const updateIngredientRelationships = async (
    transaction,
    bakeryId,
    recipeId,
    oldIngredients,
    newIngredients,
  ) => {
    const oldIngredientIds = new Set(oldIngredients.map((i) => i.ingredientId));
    const newIngredientIds = new Set(newIngredients.map((i) => i.ingredientId));

    // Find ingredients to remove and add
    const toRemove = [...oldIngredientIds].filter(
      (id) => !newIngredientIds.has(id),
    );
    const toAdd = [...newIngredientIds].filter(
      (id) => !oldIngredientIds.has(id),
    );

    // Update ingredient references
    toRemove.forEach((ingredientId) => {
      const ingredientRef = db
        .collection(`bakeries/${bakeryId}/ingredients`)
        .doc(ingredientId);

      transaction.update(ingredientRef, {
        usedInRecipes: FieldValue.arrayRemove(recipeId),
        updatedAt: new Date(),
      });
    });

    toAdd.forEach((ingredientId) => {
      const ingredientRef = db
        .collection(`bakeries/${bakeryId}/ingredients`)
        .doc(ingredientId);

      transaction.update(ingredientRef, {
        usedInRecipes: FieldValue.arrayUnion(recipeId),
        updatedAt: new Date(),
      });
    });
  };

  const create = async (recipeData, bakeryId) => {
    try {
      // Start a transaction to validate ingredients and get their costs
      const recipe = await db.runTransaction(async (transaction) => {
        // 1. Validate ingredients and get costs
        const ingredientsWithCosts = await Promise.all(
          recipeData.ingredients.map(async (ingredient) => {
            const ingredientRef = db
              .collection(`bakeries/${bakeryId}/ingredients`)
              .doc(ingredient.ingredientId);

            const ingredientDoc = await transaction.get(ingredientRef);

            if (!ingredientDoc.exists) {
              throw new BadRequestError(
                `Ingredient ${ingredient.ingredientId} not found`,
              );
            }

            const ingredientData = ingredientDoc.data();

            // Create RecipeIngredient instance
            const recipeIngredient = new RecipeIngredient({
              ingredientId: ingredient.ingredientId,
              name: ingredientData.name,
              quantity: ingredient.quantity,
              unit: ingredientData.unit,
              costPerUnit: ingredientData.costPerUnit,
              notes: ingredient.notes || '',
            });

            return {
              ingredient: recipeIngredient,
              ref: ingredientRef,
              currentUsedInRecipes: ingredientData.usedInRecipes || [],
            };
          }),
        );

        // 2. Create new recipe
        const recipeRef = baseService.getCollectionRef(bakeryId).doc();
        const recipeId = recipeRef.id;

        const newRecipe = new Recipe({
          id: recipeId,
          bakeryId,
          ...recipeData,
          ingredients: ingredientsWithCosts.map((item) => item.ingredient),
        });

        // 3. Create recipe document and update ingredient references
        transaction.set(recipeRef, newRecipe.toFirestore());

        ingredientsWithCosts.forEach(({ ref, currentUsedInRecipes }) => {
          if (!currentUsedInRecipes.includes(recipeId)) {
            transaction.update(ref, {
              usedInRecipes: FieldValue.arrayUnion(recipeId),
              updatedAt: new Date(),
            });
          }
        });

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
      const updateLogic = async (t) => {
        const recipeRef = baseService.getCollectionRef(bakeryId).doc(recipeId);
        const recipeDoc = await t.get(recipeRef);

        if (!recipeDoc.exists) {
          throw new NotFoundError('Recipe not found');
        }

        let currentRecipe = Recipe.fromFirestore(recipeDoc);

        const updatedRecipe = new Recipe({
          ...currentRecipe,
          ...updateData,
          updatedAt: new Date(),
        });

        // Check if changes require versioning
        if (requiresNewVersion(currentRecipe, updatedRecipe)) {
          if (ingredientsChanged(currentRecipe, updatedRecipe)) {
            await updateIngredientRelationships(
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

        // Save updates
        t.update(recipeRef, updatedRecipe.toFirestore());
        return updatedRecipe;
      };

      // Use existing transaction or create new one
      return transaction
        ? await updateLogic(transaction)
        : await db.runTransaction(updateLogic);
    } catch (error) {
      console.error('Error in updateRecipe:', error);
      throw error;
    }
  };

  const remove = async (recipeId, bakeryId) => {
    try {
      return await db.runTransaction(async (transaction) => {
        // 1. Validate recipe exists
        const recipeRef = baseService.getCollectionRef(bakeryId).doc(recipeId);
        const recipeDoc = await transaction.get(recipeRef);

        if (!recipeDoc.exists) {
          throw new NotFoundError('Recipe not found');
        }

        // 2. Check for active products using this recipe
        const productsRef = db
          .collection(`bakeries/${bakeryId}/products`)
          .where('recipeId', '==', recipeId)
          .where('isActive', '==', true);

        const productsSnapshot = await transaction.get(productsRef);

        if (!productsSnapshot.empty) {
          throw new BadRequestError(
            'Cannot delete recipe that is used by active products',
          );
        }

        // 3. Delete the recipe within the transaction
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
    delete: remove,
  };
};

module.exports = createRecipeService();
