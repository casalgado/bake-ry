
const BaseController = require('./base/BaseController');
const { BadRequestError } = require('../utils/errors');

class RecipeController extends BaseController {
  /**
   * RecipeController constructor
   * @param {RecipeService} recipeService - Instance of RecipeService
   */
  constructor(recipeService) {
    if (!recipeService) {
      throw new Error('RecipeService is required');
    }
    super(recipeService);
  }

  async create(req, res) {
    try {
      const { bakeryId } = req.params;
      const recipeData = {
        ...req.body,
        bakeryId,
      };

      // Validate ingredients exist and get their current costs
      if (recipeData.ingredients) {
        for (const ingredient of recipeData.ingredients) {
          if (!ingredient.ingredientId || !ingredient.quantity) {
            throw new BadRequestError(
              'Each ingredient must have ingredientId and quantity',
            );
          }
        }
      }

      // Validate products exist if provided
      if (recipeData.productIds) {
        if (!Array.isArray(recipeData.productIds)) {
          throw new BadRequestError('productIds must be an array');
        }
      }
      console.log('In controller createRecipe, recipeData', recipeData);
      const recipe = await this.service.create(recipeData, bakeryId);
      res.status(201).json(recipe);
    } catch (error) {
      console.error('Error in createRecipe:', error);
      if (error instanceof BadRequestError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Error creating recipe' });
      }
    }
  }
}

module.exports = RecipeController;
