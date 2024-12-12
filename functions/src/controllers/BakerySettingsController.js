const createBaseController = require('./base/controllerFactory');
const BakerySettingsService = require('../services/BakerySettingsService');
const { BadRequestError } = require('../utils/errors');

const validateSettingsData = (data) => {
  const errors = [];

  return errors;
};

const bakerySettingsService = new BakerySettingsService();
const baseController = createBaseController(bakerySettingsService, validateSettingsData);

const bakerySettingsController = {
  ...baseController,

  async getStaffList(req, res) {
    try {
      const { bakeryId } = req.params;
      const staff = await bakerySettingsService.getStaffList(bakeryId);
      baseController.handleResponse(res, staff);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },

  // Override patch to handle product categories
  async patch(req, res) {
    try {
      const { id, bakeryId } = req.params;
      const patchData = req.body;

      if (!id) throw new BadRequestError('ID parameter is required');
      if (!patchData || Object.keys(patchData).length === 0) {
        throw new BadRequestError('Patch data is required');
      }

      const immutableFields = ['id', 'createdAt'];
      const attemptedImmutableUpdate = immutableFields.find(field =>
        Object.prototype.hasOwnProperty.call(patchData, field),
      );

      if (attemptedImmutableUpdate) {
        throw new BadRequestError(`Cannot update immutable field: ${attemptedImmutableUpdate}`);
      }

      baseController.validateRequestData(patchData);

      const result = await bakerySettingsService.patch(id, patchData, bakeryId);
      baseController.handleResponse(res, result);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },
};

module.exports = bakerySettingsController;
