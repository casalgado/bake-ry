const createBaseController = require('./base/controllerFactory');
const recipeService = require('../services/recipeService');
const { BadRequestError } = require('../utils/errors');

const validateRecipeData = (recipeData) => {
  const errors = [];
  const ingredients = recipeData.ingredients;

  // Validate ingredients exist and get their current costs
  if (!ingredients || ingredients.length === 0) {
    errors.push('Recipe must have at least one ingredient');
    return errors;
  }

  ingredients.forEach((ingredient, index) => {
    if (!ingredient.ingredientId || !ingredient.quantity) {
      errors.push(`Ingredient at index ${index} must have ingredientId and quantity`);
    }
  });

  const hasResaleItems = ingredients.some(ing => ing.type === 'resale');
  const hasManufacturedItems = ingredients.some(ing => ing.type === 'manufactured');

  if (hasResaleItems && hasManufacturedItems) {
    errors.push('Recipe cannot mix resale and manufactured ingredients');
  }

  return errors;
};

const baseController = createBaseController(recipeService, validateRecipeData);

const recipeController = {
  ...baseController,

  // Recipe-specific overrides would go here
  // For example, if we needed special version handling:
  async update(req, res) {
    try {
      const { id, bakeryId } = req.params;
      const { createdAt, ...updateData } = req.body;
      void createdAt;

      if (!id) throw new BadRequestError('ID parameter is required');
      if (!updateData) throw new BadRequestError('Update data is required');

      baseController.validateRequestData(updateData);

      const result = await recipeService.update(id, updateData, bakeryId, req.user);
      baseController.handleResponse(res, result);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },
};

module.exports = recipeController;
