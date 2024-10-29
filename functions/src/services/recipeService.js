const { db } = require("../config/firebase");
const { Recipe, RecipeIngredient } = require("../models/Recipe");
const {
  requiresNewVersion,
  recipeVersioningService,
  ingredientsChanged,
} = require("./versioning/recipeVersioning");
const { BadRequestError, NotFoundError } = require("../utils/errors");

const recipeService = {
  async createRecipe(recipeData) {
    try {
      const { bakeryId } = recipeData;

      // Start a transaction to validate ingredients and get their costs
      const recipe = await db.runTransaction(async (transaction) => {
        // Fetch all referenced ingredients to validate they exist and get costs
        const ingredientsWithCosts = await Promise.all(
          recipeData.ingredients.map(async (ingredient) => {
            const ingredientRef = db
              .collection(`bakeries/${bakeryId}/ingredients`)
              .doc(ingredient.ingredientId);

            const ingredientDoc = await transaction.get(ingredientRef);

            if (!ingredientDoc.exists) {
              throw new BadRequestError(
                `Ingredient ${ingredient.ingredientId} not found`
              );
            }

            const ingredientData = ingredientDoc.data();

            // Create RecipeIngredient instance with current ingredient data
            const recipeIngredient = new RecipeIngredient({
              ingredientId: ingredient.ingredientId,
              name: ingredientData.name,
              quantity: ingredient.quantity,
              unit: ingredientData.unit,
              costPerUnit: ingredientData.costPerUnit,
              notes: ingredient.notes || "",
              allergens: ingredientData.allergens || [],
            });

            return {
              ingredient: recipeIngredient,
              ref: ingredientRef,
              currentUsedInRecipes: ingredientData.usedInRecipes || [],
            };
          })
        );

        // Create new recipe
        const recipeRef = db.collection(`bakeries/${bakeryId}/recipes`).doc();
        const recipeId = recipeRef.id;

        const newRecipe = new Recipe({
          ...recipeData,
          ingredients: ingredientsWithCosts.map((item) => item.ingredient),
        });

        // Create the recipe document
        transaction.set(recipeRef, newRecipe.toFirestore());

        // Update each ingredient's usedInRecipes array
        ingredientsWithCosts.forEach(({ ref, currentUsedInRecipes }) => {
          // Only add the recipe if it's not already in the array
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
      console.error("Error in createRecipe service:", error);
      throw error;
    }
  },

  async getRecipeById(bakeryId, recipeId) {
    try {
      const recipeDoc = await db
        .collection(`bakeries/${bakeryId}/recipes`)
        .doc(recipeId)
        .get();

      if (!recipeDoc.exists) {
        return null;
      }

      const recipeData = recipeDoc.data();

      // Convert plain ingredient objects to RecipeIngredient instances
      const ingredients = recipeData.ingredients.map(
        (ingredient) => new RecipeIngredient(ingredient)
      );

      return new Recipe({
        id: recipeDoc.id,
        ...recipeData,
        ingredients,
      });
    } catch (error) {
      console.error("Error in getRecipeById service:", error);
      throw error;
    }
  },

  async getAllRecipes(bakeryId) {
    try {
      const snapshot = await db
        .collection(`bakeries/${bakeryId}/recipes`)
        .get();

      return snapshot.docs.map((doc) => {
        const recipeData = doc.data();
        // Convert plain ingredient objects to RecipeIngredient instances
        const ingredients = recipeData.ingredients.map(
          (ingredient) => new RecipeIngredient(ingredient)
        );

        return new Recipe({
          id: doc.id,
          ...recipeData,
          ingredients,
        });
      });
    } catch (error) {
      console.error("Error in getAllRecipes service:", error);
      throw error;
    }
  },

  async updateRecipe(bakeryId, recipeId, updateData) {
    try {
      return await db.runTransaction(async (transaction) => {
        // Get current recipe
        const recipeRef = db
          .collection(`bakeries/${bakeryId}/recipes`)
          .doc(recipeId);
        const recipeDoc = await transaction.get(recipeRef);

        if (!recipeDoc.exists) {
          throw new NotFoundError("Recipe not found");
        }

        let currentRecipe = Recipe.fromFirestore(recipeDoc);

        const updatedRecipe = new Recipe({
          ...currentRecipe,
          ...updateData,
          updatedAt: new Date(),
        });

        // Check if changes require versioning
        if (requiresNewVersion(currentRecipe, updatedRecipe)) {
          console.log("requires new version");

          if (ingredientsChanged(currentRecipe, updatedRecipe)) {
            console.log("ingredients changed");
            // modify usedInRecipes arrays for each ingredient
            const oldIngredientIds = new Set(
              currentRecipe.ingredients.map((i) => i.ingredientId)
            );
            const newIngredientIds = new Set(
              updatedRecipe.ingredients.map((i) => i.ingredientId)
            );

            console.log("oldIngredientIds", oldIngredientIds);
            console.log("newIngredientIds", newIngredientIds);

            // Collect all ingredient IDs that need updating
            const toRemove = [...oldIngredientIds].filter(
              (id) => !newIngredientIds.has(id)
            );
            const toAdd = [...newIngredientIds].filter(
              (id) => !oldIngredientIds.has(id)
            );

            // Step 1: Perform all reads first
            const ingredientDocs = await Promise.all([
              ...toRemove.map((id) =>
                transaction.get(
                  db.collection(`bakeries/${bakeryId}/ingredients`).doc(id)
                )
              ),
              ...toAdd.map((id) =>
                transaction.get(
                  db.collection(`bakeries/${bakeryId}/ingredients`).doc(id)
                )
              ),
            ]);

            // Step 2: After all reads, perform writes
            ingredientDocs.forEach((doc, index) => {
              if (!doc.exists) return;

              const isRemove = index < toRemove.length;
              const usedInRecipes = doc.data().usedInRecipes || [];

              if (isRemove) {
                // Remove recipe from usedInRecipes
                console.log("removing recipe from ingredient", doc.id);
                transaction.update(doc.ref, {
                  usedInRecipes: usedInRecipes.filter((id) => id !== recipeId),
                });
              } else {
                // Add recipe to usedInRecipes if not already there
                if (!usedInRecipes.includes(recipeId)) {
                  console.log("adding recipe to ingredient", doc.id);
                  transaction.update(doc.ref, {
                    usedInRecipes: [...usedInRecipes, recipeId],
                  });
                }
              }
            });
          }
          const newVersion = await recipeVersioningService.createVersion(
            transaction,
            recipeRef,
            currentRecipe
          );
          updatedRecipe.version = newVersion;
        }

        // Save updates
        transaction.update(recipeRef, updatedRecipe.toFirestore());

        return updatedRecipe;
      });
    } catch (error) {
      console.error("Error in updateRecipe service:", error);
      throw error;
    }
  },

  async deleteRecipe(bakeryId, recipeId) {
    try {
      return await db.runTransaction(async (transaction) => {
        // Check if recipe exists
        const recipeRef = db
          .collection(`bakeries/${bakeryId}/recipes`)
          .doc(recipeId);
        const recipeDoc = await transaction.get(recipeRef);

        if (!recipeDoc.exists) {
          throw new NotFoundError("Recipe not found");
        }

        // Check if any active products use this recipe
        const productsSnapshot = await transaction.get(
          db
            .collection(`bakeries/${bakeryId}/products`)
            .where("recipeId", "==", recipeId)
            .where("isActive", "==", true)
        );

        if (!productsSnapshot.empty) {
          throw new BadRequestError(
            "Cannot delete recipe that is used by active products"
          );
        }

        // Delete the recipe
        transaction.delete(recipeRef);
      });
    } catch (error) {
      console.error("Error in deleteRecipe service:", error);
      throw error;
    }
  },

  async scaleRecipe(bakeryId, recipeId, factor) {
    try {
      const recipe = await this.getRecipeById(bakeryId, recipeId);
      if (!recipe) {
        return null;
      }

      // Use Recipe class scale method which handles RecipeIngredient scaling
      recipe.scale(factor);
      return recipe;
    } catch (error) {
      console.error("Error in scaleRecipe service:", error);
      throw error;
    }
  },
};

module.exports = recipeService;
