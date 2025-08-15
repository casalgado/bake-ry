const createBaseController = require('./base/controllerFactory');
const systemSettingsService = require('../services/systemSettingsService');
const { BadRequestError } = require('../utils/errors');

const validateSystemSettingsData = (data) => {
  const errors = [];

  if (data.orderStatuses !== undefined && !Array.isArray(data.orderStatuses)) {
    errors.push('orderStatuses must be an array');
  }

  if (data.fulfillmentTypes !== undefined && !Array.isArray(data.fulfillmentTypes)) {
    errors.push('fulfillmentTypes must be an array');
  }

  if (data.paymentMethods !== undefined && !Array.isArray(data.paymentMethods)) {
    errors.push('paymentMethods must be an array');
  }

  if (data.unitOptions !== undefined && !Array.isArray(data.unitOptions)) {
    errors.push('unitOptions must be an array');
  }

  if (data.storageTemperatures !== undefined && !Array.isArray(data.storageTemperatures)) {
    errors.push('storageTemperatures must be an array');
  }

  if (data.availablePaymentMethods !== undefined && !Array.isArray(data.availablePaymentMethods)) {
    errors.push('availablePaymentMethods must be an array');
  }

  return errors;
};

const baseController = createBaseController(systemSettingsService, validateSystemSettingsData);

const systemSettingsController = {
  async getById(req, res) {
    try {
      const settings = await systemSettingsService.getById();
      baseController.handleResponse(res, settings);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },

  async patch(req, res) {
    try {
      const patchData = req.body;

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

      const result = await systemSettingsService.patch('default', patchData, null, req.user);
      baseController.handleResponse(res, result);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },

  async update(req, res) {
    try {
      const updateData = req.body;

      if (!updateData || Object.keys(updateData).length === 0) {
        throw new BadRequestError('Update data is required');
      }

      const immutableFields = ['id', 'createdAt'];
      const attemptedImmutableUpdate = immutableFields.find(field =>
        Object.prototype.hasOwnProperty.call(updateData, field),
      );

      if (attemptedImmutableUpdate) {
        throw new BadRequestError(`Cannot update immutable field: ${attemptedImmutableUpdate}`);
      }

      baseController.validateRequestData(updateData);

      const result = await systemSettingsService.update('default', updateData, null, req.user);
      baseController.handleResponse(res, result);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },
};

module.exports = systemSettingsController;
