const recipeService = require("../services/recipeService");
const { BadRequestError, NotFoundError } = require("../utils/errors");

const recipeController = {
  async createRecipe(req, res) {
    console.log("In controller createRecipe, req.body", req.body);
    try {
      const { bakeryId } = req.params;
      const recipeData = {
        ...req.body,
        bakeryId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Validate ingredients exist and get their current costs
      if (recipeData.ingredients) {
        for (const ingredient of recipeData.ingredients) {
          if (!ingredient.ingredientId || !ingredient.quantity) {
            throw new BadRequestError(
              "Each ingredient must have ingredientId and quantity"
            );
          }
        }
      }

      // Validate products exist if provided
      if (recipeData.productIds) {
        if (!Array.isArray(recipeData.productIds)) {
          throw new BadRequestError("productIds must be an array");
        }
      }
      console.log("In controller createRecipe, recipeData", recipeData);
      const recipe = await recipeService.createRecipe(recipeData);
      res.status(201).json(recipe);
    } catch (error) {
      console.error("Error in createRecipe:", error);
      if (error instanceof BadRequestError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Error creating recipe" });
      }
    }
  },

  async getRecipe(req, res) {
    try {
      const { bakeryId, recipeId } = req.params;
      const recipe = await recipeService.getRecipeById(bakeryId, recipeId);

      if (!recipe) {
        throw new NotFoundError("Recipe not found");
      }

      res.json(recipe);
    } catch (error) {
      console.error("Error in getRecipe:", error);
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Error fetching recipe" });
      }
    }
  },

  async getAllRecipes(req, res) {
    try {
      const { bakeryId } = req.params;
      // Can add query parameters later for filtering
      const recipes = await recipeService.getAllRecipes(bakeryId);
      res.json(recipes);
    } catch (error) {
      console.error("Error in getAllRecipes:", error);
      res.status(500).json({ error: "Error fetching recipes" });
    }
  },

  async updateRecipe(req, res) {
    try {
      const { bakeryId, recipeId } = req.params;
      const updateData = {
        ...req.body,
        updatedAt: new Date(),
      };

      // Handle different types of updates
      if (updateData.action === "updateIngredients") {
        console.log(
          "In controller updateRecipe, updateData.action",
          updateData.action
        );
        // Validate ingredients
        if (!Array.isArray(updateData.ingredients)) {
          throw new BadRequestError("ingredients must be an array");
        }

        for (const ingredient of updateData.ingredients) {
          if (!ingredient.ingredientId || !ingredient.quantity) {
            throw new BadRequestError(
              "Each ingredient must have ingredientId and quantity"
            );
          }
        }
      }

      const updatedRecipe = await recipeService.updateRecipe(
        bakeryId,
        recipeId,
        updateData
      );

      if (!updatedRecipe) {
        throw new NotFoundError("Recipe not found");
      }

      res.json(updatedRecipe);
    } catch (error) {
      console.error("Error in updateRecipe:", error);
      if (error instanceof BadRequestError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Error updating recipe" });
      }
    }
  },

  async deleteRecipe(req, res) {
    try {
      const { bakeryId, recipeId } = req.params;

      // Service will check if recipe can be deleted (no active products)
      await recipeService.deleteRecipe(bakeryId, recipeId);

      res.status(204).send();
    } catch (error) {
      console.error("Error in deleteRecipe:", error);
      if (error instanceof BadRequestError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Error deleting recipe" });
      }
    }
  },

  async scaleRecipe(req, res) {
    try {
      const { bakeryId, recipeId } = req.params;
      const { factor } = req.body;

      if (!factor || typeof factor !== "number" || factor <= 0) {
        throw new BadRequestError(
          "Valid scaling factor greater than 0 is required"
        );
      }

      const scaledRecipe = await recipeService.scaleRecipe(
        bakeryId,
        recipeId,
        factor
      );

      if (!scaledRecipe) {
        throw new NotFoundError("Recipe not found");
      }

      res.json(scaledRecipe);
    } catch (error) {
      console.error("Error in scaleRecipe:", error);
      if (error instanceof BadRequestError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Error scaling recipe" });
      }
    }
  },
};

module.exports = recipeController;
