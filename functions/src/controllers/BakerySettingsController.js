const BaseController = require('./base/BaseController');

class BakerySettingsController extends BaseController {
  constructor(bakerySettingsService) {
    if (!bakerySettingsService) {
      throw new Error('BakerySettingsService is required');
    }
    super(bakerySettingsService);
  }

  async getStaffList(req, res) {
    try {
      const { bakeryId } = req.params;
      const staff = await this.service.getStaffList(bakeryId);
      this.handleResponse(res, staff);
    } catch (error) {
      this.handleError(res, error);
    }
  }
}

module.exports = BakerySettingsController;
