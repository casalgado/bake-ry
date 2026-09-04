const createBaseController = require('./base/controllerFactory');
const recipeService = require('../services/recipeService');
const recipeGraph = require('../services/recipeGraph');
const { BadRequestError } = require('../utils/errors');

const validateRecipeData = (recipeData) => {
  const errors = [];
  const ingredients = recipeData.ingredients;

  // A recipe needs at least one component, each with an id and a quantity.
  if (!ingredients || ingredients.length === 0) {
    errors.push('Recipe must have at least one ingredient');
    return errors;
  }

  // Components are ingredients or products, both keyed by `id`.
  ingredients.forEach((ingredient, index) => {
    if (!ingredient.id || !ingredient.quantity) {
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

      // 4th arg is an optional outer transaction (must stay null here); the
      // editor is 5th, for the updateHistory / cost-history audit trail.
      const result = await recipeService.update(
        id,
        updateData,
        bakeryId,
        null,
        req.user,
      );
      baseController.handleResponse(res, result);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },

  // On-demand cost reconciliation for one owner: recompute its recipe's cost
  // live and correct the cached value if it drifted. Body: { owner: {
  // type: 'product' | 'ingredient', id, combinationId? } }.
  async reconcileCosts(req, res) {
    try {
      const { bakeryId } = req.params;
      const { owner } = req.body || {};

      if (!owner || !owner.type || !owner.id) {
        throw new BadRequestError('owner { type, id } es obligatorio');
      }
      if (!['product', 'ingredient'].includes(owner.type)) {
        throw new BadRequestError('owner.type debe ser "product" o "ingredient"');
      }

      const result = await recipeGraph.reconcileOwnerCost(bakeryId, owner, req.user);
      baseController.handleResponse(res, result);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },
};

module.exports = recipeController;
