// src/services/versioning/recipeVersioning.js
const recipeVersioningService = {
  async createVersion(transaction, recipeRef, recipe) {
    const historyRef = recipeRef.collection("history").doc();

    recipe = recipe.toFirestore();

    transaction.set(historyRef, {
  
      version: recipe.version || 1,
      ingredients: recipe.ingredients,
      steps: recipe.steps || null,
      bakingTemp: recipe.bakingTemp || null,
      bakingTime: recipe.bakingTime || null,
      timestamp: new Date(),
    });

    return (recipe.version || 1) + 1;
  },

  async getVersionAtDate(recipeRef, date) {
    const snapshot = await recipeRef
      .collection("history")
      .where("timestamp", "<=", date)
      .orderBy("timestamp", "desc")
      .limit(1)
      .get();

    return snapshot.empty ? null : snapshot.docs[0].data();
  },
};

const requiresNewVersion = (oldRecipe, newRecipe) => {
  // Compare ingredients (both costs and composition)
  const ingredientsChanged =
    JSON.stringify(oldRecipe.ingredients) !==
    JSON.stringify(newRecipe.ingredients);

  // Compare production-critical fields
  const criticalFieldsChanged =
    oldRecipe.bakingTemp !== newRecipe.bakingTemp ||
    oldRecipe.bakingTime !== newRecipe.bakingTime ||
    JSON.stringify(oldRecipe.steps) !== JSON.stringify(newRecipe.steps);

  return ingredientsChanged || criticalFieldsChanged;
};

const ingredientsChanged = (oldRecipe, newRecipe) => {
  return (
    JSON.stringify(oldRecipe.ingredients) !==
    JSON.stringify(newRecipe.ingredients)
  );
};

module.exports = {
  requiresNewVersion,
  recipeVersioningService,
  ingredientsChanged,
};

// src/services/recipeService.js
