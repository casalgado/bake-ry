const createBaseController = require('./base/controllerFactory');
const ingredientService = require('../services/ingredientService');
const recipeGraph = require('../services/recipeGraph');
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

  // Validate isResale if provided
  if (data.isResale !== undefined && typeof data.isResale !== 'boolean') {
    errors.push('isResale must be a boolean');
  }

  return errors;
};

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

      // Special handling for ingredients used in recipes. Editor threaded for
      // the updateHistory / cost-propagation audit trail.
      const result = await ingredientService.update(
        id,
        updateData,
        bakeryId,
        req.user,
      );
      baseController.handleResponse(res, result);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },

  // Read-only preview: what changing this ingredient's cost to ?newCost=X would
  // do to downstream recipe/product/ingredient costs, without applying it.
  async costImpact(req, res) {
    try {
      const { id, bakeryId } = req.params;
      const newCost = Number(req.query.newCost);

      if (!Number.isFinite(newCost) || newCost < 0) {
        throw new BadRequestError('newCost debe ser un número mayor o igual a 0');
      }

      const impact = await recipeGraph.previewIngredientCostImpact(
        bakeryId,
        id,
        newCost,
      );
      baseController.handleResponse(res, { impact });
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
