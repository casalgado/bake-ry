const { db } = require("../config/firebase");
const { Recipe, RecipeIngredient } = require("../models/Recipe"); // Assuming we export both
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
            const ingredientDoc = await transaction.get(
              db
                .collection(`bakeries/${bakeryId}/ingredients`)
                .doc(ingredient.ingredientId)
            );

            if (!ingredientDoc.exists) {
              throw new BadRequestError(
                `Ingredient ${ingredient.ingredientId} not found`
              );
            }

            const ingredientData = ingredientDoc.data();

            // Create RecipeIngredient instance with current ingredient data
            return new RecipeIngredient({
              ingredientId: ingredient.ingredientId,
              name: ingredientData.name,
              quantity: ingredient.quantity,
              unit: ingredientData.unit,
              costPerUnit: ingredientData.costPerUnit,
              notes: ingredient.notes || "",
              allergens: ingredientData.allergens || [],
            });
          })
        );

        // If productIds provided, validate they exist
        if (recipeData.productIds?.length > 0) {
          await Promise.all(
            recipeData.productIds.map(async (productId) => {
              const productDoc = await transaction.get(
                db.collection(`bakeries/${bakeryId}/products`).doc(productId)
              );
              if (!productDoc.exists) {
                throw new BadRequestError(`Product ${productId} not found`);
              }
            })
          );
        }

        // Create new recipe with RecipeIngredient instances
        const newRecipe = new Recipe({
          ...recipeData,
          ingredients: ingredientsWithCosts,
        });

        // Create the recipe document
        console.log("In service createRecipe, newRecipe", newRecipe);
        const recipeRef = db.collection(`bakeries/${bakeryId}/recipes`).doc();
        transaction.set(recipeRef, newRecipe.toFirestore());

        return {
          id: recipeRef.id,
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

        // Handle different update types
        if (updateData.action === "updateIngredients") {
          // Fetch and validate all ingredients, get current costs
          const ingredientsWithCosts = await Promise.all(
            updateData.ingredients.map(async (ingredient) => {
              const ingredientDoc = await transaction.get(
                db
                  .collection(`bakeries/${bakeryId}/ingredients`)
                  .doc(ingredient.ingredientId)
              );

              if (!ingredientDoc.exists) {
                throw new BadRequestError(
                  `Ingredient ${ingredient.ingredientId} not found`
                );
              }

              const ingredientData = ingredientDoc.data();

              // Create new RecipeIngredient instance
              return new RecipeIngredient({
                ingredientId: ingredient.ingredientId,
                name: ingredientData.name,
                quantity: ingredient.quantity,
                unit: ingredientData.unit,
                costPerUnit: ingredientData.costPerUnit,
                notes: ingredient.notes || "",
                allergens: ingredientData.allergens || [],
              });
            })
          );

          updateData.ingredients = ingredientsWithCosts;
        } else if (updateData.action === "updateProducts") {
          // Validate all products exist
          await Promise.all(
            updateData.productIds.map(async (productId) => {
              const productDoc = await transaction.get(
                db.collection(`bakeries/${bakeryId}/products`).doc(productId)
              );
              if (!productDoc.exists) {
                throw new BadRequestError(`Product ${productId} not found`);
              }
            })
          );
        }

        // Create updated recipe
        const updatedRecipe = new Recipe({
          ...currentRecipe,
          ...updateData,
          updatedAt: new Date(),
        });

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
