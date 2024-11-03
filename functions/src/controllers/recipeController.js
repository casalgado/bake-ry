
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
  const ingredients = recipeData.ingredients;

  // Validate ingredients exist and get their current costs
  if (ingredients.length > 0) {
    ingredients.forEach((ingredient, index) => {
      if (!ingredient.ingredientId || !ingredient.quantity) {
        errors.push(`Ingredient at index ${index} must have ingredientId and quantity`);
      }
    });
  } else {
    errors.push('Recipe must have at least one ingredient');
  }

  const hasResaleItems = ingredients.some(ing => ing.isResaleItem);
  const hasManufacturedItems = ingredients.some(ing => !ing.isResaleItem);

  if (hasResaleItems && hasManufacturedItems) {
    errors.push('Recipe cannot mix resale and manufactured ingredients');
  }

  return errors;
}

module.exports = RecipeController;
