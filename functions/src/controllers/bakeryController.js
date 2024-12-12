// controllers/bakeryController.js
const createBaseController = require('./base/controllerFactory');
const bakeryService = require('../services/bakeryService');
const { ForbiddenError } = require('../utils/errors');

const validateBakeryData = (data) => {
  const errors = [];

  if (!data.name) {
    errors.push('Name is required');
  }

  if (!data.address) {
    errors.push('Address is required');
  }

  // Validate operating hours if provided
  if (data.operatingHours) {
    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
      const hours = data.operatingHours[day];
      if (hours && hours.isOpen) {
        if (!hours.open || !hours.close) {
          errors.push(`${day} operating hours must include open and close times`);
        }
      }
    });
  }

  return errors;
};

const baseController = createBaseController(bakeryService, validateBakeryData);

const bakeryController = {
  ...baseController,

  async create(req, res) {
    try {
      // Get user info from request (added by authentication middleware)
      const { uid, bakeryId } = req.user;

      // Validate user doesn't already have a bakery
      if (bakeryId) {
        throw new ForbiddenError(
          'User already has a bakery assigned and cannot create another one',
        );
      }

      baseController.validateRequestData(req.body);

      // Prepare bakery data with owner ID
      const bakeryData = {
        ...req.body,
        ownerId: uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create bakery using service
      const result = await bakeryService.create(bakeryData);
      baseController.handleResponse(res, result, 201);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },
};

module.exports = bakeryController;
