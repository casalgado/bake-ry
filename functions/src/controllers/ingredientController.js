const ingredientService = require("../services/ingredientService");

const ingredientController = {
  async createIngredient(req, res) {
    try {
      const { bakeryId } = req.params;
      const ingredientData = req.body;

      const newIngredient = await ingredientService.createIngredient(
        bakeryId,
        ingredientData
      );

      res.status(201).json(newIngredient);
    } catch (error) {
      console.error("Error in createIngredient controller:", error);
      res.status(400).json({ error: error.message });
    }
  },

  async getIngredient(req, res) {
    try {
      const { bakeryId, ingredientId } = req.params;
      const ingredient = await ingredientService.getIngredient(
        bakeryId,
        ingredientId
      );

      if (ingredient) {
        res.json(ingredient);
      } else {
        res.status(404).json({ error: "Ingredient not found" });
      }
    } catch (error) {
      console.error("Error in getIngredient controller:", error);
      res.status(500).json({ error: error.message });
    }
  },

  async getAllIngredients(req, res) {
    try {
      const { bakeryId } = req.params;
      const filters = {};

      const ingredients = await ingredientService.getAllIngredients(
        bakeryId,
        filters
      );
      res.json(ingredients);
    } catch (error) {
      console.error("Error in getAllIngredients controller:", error);
      res.status(500).json({ error: error.message });
    }
  },

  async updateIngredient(req, res) {
    try {
      const { bakeryId, ingredientId } = req.params;

      const {
        createdAt,
        id, // Also removing id as it shouldn't be updated
        ...updateData
      } = req.body;

      const updatedIngredient = await ingredientService.updateIngredient(
        bakeryId,
        ingredientId,
        updateData
      );

      if (updatedIngredient) {
        res.json(updatedIngredient);
      } else {
        res.status(404).json({ error: "Ingredient not found" });
      }
    } catch (error) {
      console.error("Error in updateIngredient controller:", error);
      res.status(400).json({ error: error.message });
    }
  },

  async deleteIngredient(req, res) {
    try {
      const { bakeryId, ingredientId } = req.params;
      await ingredientService.deleteIngredient(bakeryId, ingredientId);
      res.status(204).send();
    } catch (error) {
      console.error("Error in deleteIngredient controller:", error);
      if (error.message.includes("Cannot delete")) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  },

  async updateStock(req, res) {
    try {
      const { bakeryId, ingredientId } = req.params;
      const { quantity, type } = req.body;

      const updatedIngredient = await ingredientService.updateStock(
        bakeryId,
        ingredientId,
        quantity,
        type
      );

      res.json(updatedIngredient);
    } catch (error) {
      console.error("Error in updateStock controller:", error);
      if (error.message === "Insufficient stock") {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  },
};

module.exports = ingredientController;
