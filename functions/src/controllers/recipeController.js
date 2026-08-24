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

  // Components are ingredients or products (§3); legacy payloads carry the id
  // in `ingredientId`, typed ones in `id`.
  ingredients.forEach((ingredient, index) => {
    if (!(ingredient.id || ingredient.ingredientId) || !ingredient.quantity) {
      errors.push(`Component at index ${index} must have an id and a quantity`);
    }
  });

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

      // NB: the 4th argument of recipeService.update is an optional outer
      // transaction, not the editor. Passing req.user here made every recipe
      // update throw.
      const result = await recipeService.update(id, updateData, bakeryId);
      baseController.handleResponse(res, result);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },
};

module.exports = recipeController;
