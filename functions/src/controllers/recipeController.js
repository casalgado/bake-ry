
const BaseController = require('./base/BaseController');

class RecipeController extends BaseController {
  /**
   * RecipeController constructor
   * @param {RecipeService} recipeService - Instance of RecipeService
   */
  constructor(recipeService) {
    if (!recipeService) {
      throw new Error('RecipeService is required');
    }
    super(recipeService, validateRecipeData);
  }
}

function validateRecipeData(recipeData) {
  const errors = [];

  // Validate ingredients exist and get their current costs
  if (recipeData.ingredients.length > 0) {
    recipeData.ingredients.forEach((ingredient, index) => {
      if (!ingredient.ingredientId || !ingredient.quantity) {
        errors.push(`Ingredient at index ${index} must have ingredientId and quantity`);
      }
    });
  } else {
    errors.push('Recipe must have at least one ingredient');
  }

  // Validate products exist if provided
  if (recipeData.productIds && !Array.isArray(recipeData.productIds)) {
    errors.push('productIds must be an array');
  }

  return errors;
}

module.exports = RecipeController;
