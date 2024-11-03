const { db } = require('../config/firebase');
const { Recipe, RecipeIngredient } = require('../models/Recipe');
const {
  requiresNewVersion,
  recipeVersioningService,
  ingredientsChanged,
} = require('./versioning/recipeVersioning');
const { BadRequestError, NotFoundError } = require('../utils/errors');

/**
 * Updates ingredient associations when recipe ingredients change
 * @param {FirebaseFirestore.Transaction} transaction - Firestore transaction
 * @param {string} bakeryId - Bakery ID
 * @param {string} recipeId - Recipe ID
 * @param {Set<string>} oldIngredientIds - Original recipe ingredients
 * @param {Set<string>} newIngredientIds - Updated recipe ingredients
 */

const recipeService = {
  /**
   * Creates a new recipe and updates ingredient associations
   * @param {Object} recipeData - Recipe data including ingredients
   * @param {string} recipeData.bakeryId - Bakery ID
   * @returns {Promise<Recipe>} Created recipe
   * @throws {BadRequestError} When ingredients are not found
   */
  async create(recipeData, bakeryId) {
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
              allergens: ingredientData.allergens || [],
            });

            return {
              ingredient: recipeIngredient,
              ref: ingredientRef,
              currentUsedInRecipes: ingredientData.usedInRecipes || [],
            };
          }),
        );

        // 2. Create new recipe
        const recipeRef = db.collection(`bakeries/${bakeryId}/recipes`).doc();
        const recipeId = recipeRef.id;

        const newRecipe = new Recipe({
          ...recipeData,
          ingredients: ingredientsWithCosts.map((item) => item.ingredient),
        });

        // 3. Create recipe document and update ingredient references
        transaction.set(recipeRef, newRecipe.toFirestore());

        ingredientsWithCosts.forEach(({ ref, currentUsedInRecipes }) => {
          if (!currentUsedInRecipes.includes(recipeId)) {
            transaction.update(ref, {
              usedInRecipes: [...currentUsedInRecipes, recipeId],
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
      console.error('Error in createRecipe service:', error);
      throw error;
    }
  },

  /**
   * Retrieves a recipe by ID
   * @param {string} bakeryId - Bakery ID
   * @param {string} recipeId - Recipe ID
   * @returns {Promise<Recipe|null>} Recipe if found, null otherwise
   */
  async getById(recipeId, bakeryId) {
    try {
      const recipeDoc = await db
        .collection(`bakeries/${bakeryId}/recipes`)
        .doc(recipeId)
        .get();

      if (!recipeDoc.exists) {
        return null;
      }

      return Recipe.fromFirestore(recipeDoc);
    } catch (error) {
      console.error('Error in getRecipeById service:', error);
      throw error;
    }
  },

  /**
   * Retrieves all recipes for a bakery
   * @param {string} bakeryId - Bakery ID
   * @returns {Promise<Recipe[]>} Array of recipes
   */
  async getAll(bakeryId) {
    try {
      const snapshot = await db
        .collection(`bakeries/${bakeryId}/recipes`)
        .get();

      return snapshot.docs.map((doc) => Recipe.fromFirestore(doc));
    } catch (error) {
      console.error('Error in getAllRecipes service:', error);
      throw error;
    }
  },

  /**
   * Updates a recipe and manages its ingredient associations
   * @param {string} bakeryId - Bakery ID
   * @param {string} recipeId - Recipe ID to update
   * @param {Object} updateData - New recipe data
   * @param {FirebaseFirestore.Transaction} [transaction] - Optional existing transaction
   * @returns {Promise<Recipe>} Updated recipe object
   * @throws {NotFoundError} When recipe is not found
   */
  async update(recipeId, updateData, bakeryId, transaction = null) {
    try {
      const updateLogic = async (t) => {
        // Get current recipe
        const recipeRef = db
          .collection(`bakeries/${bakeryId}/recipes`)
          .doc(recipeId);
        const recipeDoc = await t.get(recipeRef);

        if (!recipeDoc.exists) {
          throw new NotFoundError('Recipe not found');
        }

        if (updateData.ingredients) {
          validateIngredientData(updateData.ingredients);
        }

        let currentRecipe = Recipe.fromFirestore(recipeDoc);

        const updatedRecipe = new Recipe({
          ...currentRecipe,
          ...updateData,
          updatedAt: new Date(),
        });

        // Check if changes require versioning
        if (requiresNewVersion(currentRecipe, updatedRecipe)) {
          console.log('requires new version');

          if (ingredientsChanged(currentRecipe, updatedRecipe)) {
            console.log('ingredients changed');
            // modify usedInRecipes arrays for each ingredient
            const oldIngredientIds = new Set(
              currentRecipe.ingredients.map((i) => i.ingredientId),
            );
            const newIngredientIds = new Set(
              updatedRecipe.ingredients.map((i) => i.ingredientId),
            );

            console.log('oldIngredientIds', oldIngredientIds);
            console.log('newIngredientIds', newIngredientIds);

            // Collect all ingredient IDs that need updating
            const toRemove = [...oldIngredientIds].filter(
              (id) => !newIngredientIds.has(id),
            );
            const toAdd = [...newIngredientIds].filter(
              (id) => !oldIngredientIds.has(id),
            );

            // Step 1: Perform all reads first
            const ingredientDocs = await Promise.all([
              ...toRemove.map((id) =>
                t.get(db.collection(`bakeries/${bakeryId}/ingredients`).doc(id)),
              ),
              ...toAdd.map((id) =>
                t.get(db.collection(`bakeries/${bakeryId}/ingredients`).doc(id)),
              ),
            ]);

            // Step 2: After all reads, perform writes
            ingredientDocs.forEach((doc, index) => {
              if (!doc.exists) return;

              const isRemove = index < toRemove.length;
              const usedInRecipes = doc.data().usedInRecipes || [];

              if (isRemove) {
                // Remove recipe from usedInRecipes
                console.log('removing recipe from ingredient', doc.id);
                t.update(doc.ref, {
                  usedInRecipes: usedInRecipes.filter((id) => id !== recipeId),
                });
              } else {
                // Add recipe to usedInRecipes if not already there
                if (!usedInRecipes.includes(recipeId)) {
                  console.log('adding recipe to ingredient', doc.id);
                  t.update(doc.ref, {
                    usedInRecipes: [...usedInRecipes, recipeId],
                  });
                }
              }
            });
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
      console.error('Error in updateRecipe service:', error);
      throw error;
    }
  },

  /**
   * Deletes a recipe if it's not used by any active products
   * @param {string} bakeryId - Bakery ID
   * @param {string} recipeId - Recipe ID to delete
   * @throws {NotFoundError} When recipe is not found
   * @throws {BadRequestError} When recipe is used by active products
   */
  async delete(recipeId, bakeryId) {
    try {
      return await db.runTransaction(async (transaction) => {
        // 1. Validate recipe exists
        const recipeRef = db
          .collection(`bakeries/${bakeryId}/recipes`)
          .doc(recipeId);
        const recipeDoc = await transaction.get(recipeRef);

        if (!recipeDoc.exists) {
          throw new NotFoundError('Recipe not found');
        }

        // 2. Check for active products using this recipe
        const productsSnapshot = await transaction.get(
          db
            .collection(`bakeries/${bakeryId}/products`)
            .where('recipeId', '==', recipeId)
            .where('isActive', '==', true),
        );

        if (!productsSnapshot.empty) {
          throw new BadRequestError(
            'Cannot delete recipe that is used by active products',
          );
        }

        // 3. Delete the recipe
        transaction.delete(recipeRef);
      });
    } catch (error) {
      console.error('Error in deleteRecipe service:', error);
      throw error;
    }
  },

};

const validateIngredientData = (ingredients) => {
  if (!Array.isArray(ingredients)) {
    throw new BadRequestError('Ingredients must be an array');
  }

  ingredients.forEach((ing, index) => {
    if (
      !ing.ingredientId ||
      !ing.quantity ||
      ing.costPerUnit === undefined ||
      !ing.name
    ) {
      throw new BadRequestError(
        `Invalid ingredient data at index ${index}. Required fields: ingredientId, quantity, costPerUnit, name`,
      );
    }
  });
};

module.exports = recipeService;
