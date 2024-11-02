const BaseController = require('./base/BaseController');

class IngredientController extends BaseController {
  /**
   * IngredientController constructor
   * @param {IngredientService} ingredientService - Instance of IngredientService
   */
  constructor(ingredientService) {
    if (!ingredientService) {
      throw new Error('IngredientService is required');
    }
    super(ingredientService);
  }

}

module.exports = IngredientController;
