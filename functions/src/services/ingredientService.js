const { db } = require("../config/firebase");
const Ingredient = require("../models/Ingredient");

const ingredientService = {
  async createIngredient(bakeryId, ingredientData) {
    try {
      const ingredientsRef = db
        .collection("bakeries")
        .doc(bakeryId)
        .collection("ingredients");
      const newIngredientRef = ingredientsRef.doc();

      const ingredient = new Ingredient({
        id: newIngredientRef.id,
        bakeryId,
        ...ingredientData,
      });

      await newIngredientRef.set(ingredient.toFirestore());
      return ingredient;
    } catch (error) {
      console.error("Error in createIngredient:", error);
      throw error;
    }
  },

  async getIngredient(bakeryId, ingredientId) {
    try {
      const doc = await db
        .collection("bakeries")
        .doc(bakeryId)
        .collection("ingredients")
        .doc(ingredientId)
        .get();

      if (!doc.exists) {
        return null;
      }

      return Ingredient.fromFirestore(doc);
    } catch (error) {
      console.error("Error in getIngredient:", error);
      throw error;
    }
  },

  async getAllIngredients(bakeryId, filters = {}) {
    try {
      let query = db
        .collection("bakeries")
        .doc(bakeryId)
        .collection("ingredients");

      // Apply filters
      if (filters.category) {
        query = query.where("category", "==", filters.category);
      }
      if (filters.isActive !== undefined) {
        query = query.where("isActive", "==", filters.isActive);
      }
      if (filters.needsRestock === true) {
        query = query.where("currentStock", "<=", "reorderPoint");
      }

      const snapshot = await query.get();
      return snapshot.docs.map((doc) => Ingredient.fromFirestore(doc));
    } catch (error) {
      console.error("Error in getAllIngredients:", error);
      throw error;
    }
  },

  async updateIngredient(bakeryId, ingredientId, updateData) {
    try {
      const ingredientRef = db
        .collection("bakeries")
        .doc(bakeryId)
        .collection("ingredients")
        .doc(ingredientId);

      const doc = await ingredientRef.get();
      if (!doc.exists) {
        return null;
      }

      const currentIngredient = Ingredient.fromFirestore(doc);
      const updatedIngredient = new Ingredient({
        ...currentIngredient,
        ...updateData,
        updatedAt: new Date(),
      });

      // checks if costPerUnit has changed, if so, calls updateRecipe on all recipes that use this ingredient

      await ingredientRef.update(updatedIngredient.toFirestore());
      return updatedIngredient;
    } catch (error) {
      console.error("Error in updateIngredient:", error);
      throw error;
    }
  },

  async deleteIngredient(bakeryId, ingredientId) {
    try {
      // First check if the ingredient is used in any recipes
      const recipesRef = db
        .collection("bakeries")
        .doc(bakeryId)
        .collection("recipes");
      const recipeSnapshot = await recipesRef
        .where("ingredients", "array-contains", ingredientId)
        .limit(1)
        .get();

      if (!recipeSnapshot.empty) {
        throw new Error("Cannot delete ingredient that is used in recipes");
      }

      await db
        .collection("bakeries")
        .doc(bakeryId)
        .collection("ingredients")
        .doc(ingredientId)
        .delete();

      return true;
    } catch (error) {
      console.error("Error in deleteIngredient:", error);
      throw error;
    }
  },

  async updateStock(bakeryId, ingredientId, quantity, type = "decrease") {
    try {
      const ingredientRef = db
        .collection("bakeries")
        .doc(bakeryId)
        .collection("ingredients")
        .doc(ingredientId);

      return await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(ingredientRef);
        if (!doc.exists) {
          throw new Error("Ingredient not found");
        }

        const ingredient = Ingredient.fromFirestore(doc);
        const newStock =
          type === "decrease"
            ? ingredient.currentStock - quantity
            : ingredient.currentStock + quantity;

        if (newStock < 0) {
          throw new Error("Insufficient stock");
        }

        const updates = {
          currentStock: newStock,
          lastStockCheck: new Date(),
          updatedAt: new Date(),
        };

        if (type === "increase") {
          updates.lastRestockDate = new Date();
        }

        transaction.update(ingredientRef, updates);

        return {
          ...ingredient,
          ...updates,
        };
      });
    } catch (error) {
      console.error("Error in updateStock:", error);
      throw error;
    }
  },
};

module.exports = ingredientService;
