const createBaseController = require('./base/controllerFactory');
const IngredientService = require('../services/IngredientService');
const { BadRequestError } = require('../utils/errors');

const validateIngredientData = (data) => {
  const errors = [];

  // Validate required fields
  if (!data.name) {
    errors.push('Ingredient name is required');
  }
  if (!data.categoryId) {
    errors.push('Category ID is required');
  }
  if (!data.categoryName) {
    errors.push('Category name is required');
  }
  if (!data.unit) {
    errors.push('Unit is required');
  }
  if (data.costPerUnit < 0) {
    errors.push('Cost per unit cannot be negative');
  }

  // Validate type if provided
  if (data.type && !['manufactured', 'resale'].includes(data.type)) {
    errors.push('Invalid ingredient type');
  }

  return errors;
};

const ingredientService = new IngredientService();
const baseController = createBaseController(ingredientService, validateIngredientData);

const ingredientController = {
  ...baseController,

  // Ingredient-specific overrides would go here
  async update(req, res) {
    try {
      const { id, bakeryId } = req.params;
      const { createdAt, ...updateData } = req.body;
      void createdAt;

      if (!id) throw new BadRequestError('ID parameter is required');
      if (!updateData) throw new BadRequestError('Update data is required');

      baseController.validateRequestData(updateData);

      // Special handling for ingredients used in recipes
      const result = await ingredientService.update(id, updateData, bakeryId);
      baseController.handleResponse(res, result);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },

  async remove(req, res) {
    try {
      const { id, bakeryId } = req.params;
      if (!id) throw new BadRequestError('ID parameter is required');

      // Special handling to prevent deletion if ingredient is used in recipes
      const result = await ingredientService.remove(id, bakeryId, req.user);
      baseController.handleResponse(res, result, 204);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },
};

module.exports = ingredientController;
