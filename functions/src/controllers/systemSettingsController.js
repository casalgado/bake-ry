const createBaseController = require('./base/controllerFactory');
const systemSettingsService = require('../services/systemSettingsService');
const { BadRequestError } = require('../utils/errors');

const validateSystemSettingsData = (data) => {
  const errors = [];

  if (data.maintenanceMode !== undefined && typeof data.maintenanceMode !== 'boolean') {
    errors.push('maintenanceMode must be a boolean');
  }

  if (data.allowNewRegistrations !== undefined && typeof data.allowNewRegistrations !== 'boolean') {
    errors.push('allowNewRegistrations must be a boolean');
  }

  if (data.systemNotification !== undefined) {
    if (typeof data.systemNotification !== 'object') {
      errors.push('systemNotification must be an object');
    } else {
      if (data.systemNotification.isActive !== undefined && typeof data.systemNotification.isActive !== 'boolean') {
        errors.push('systemNotification.isActive must be a boolean');
      }
      if (data.systemNotification.type !== undefined) {
        const validTypes = ['info', 'warning', 'error', 'success'];
        if (!validTypes.includes(data.systemNotification.type)) {
          errors.push(`systemNotification.type must be one of: ${validTypes.join(', ')}`);
        }
      }
    }
  }

  if (data.globalFeatureFlags !== undefined && typeof data.globalFeatureFlags !== 'object') {
    errors.push('globalFeatureFlags must be an object');
  }

  if (data.systemLimits !== undefined && typeof data.systemLimits !== 'object') {
    errors.push('systemLimits must be an object');
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
