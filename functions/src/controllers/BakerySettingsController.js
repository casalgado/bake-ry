const BaseController = require('./base/BaseController');

class BakerySettingsController extends BaseController {
  constructor(bakerySettingsService) {
    if (!bakerySettingsService) {
      throw new Error('BakerySettingsService is required');
    }
    super(bakerySettingsService);
  }

}

module.exports = BakerySettingsController;
