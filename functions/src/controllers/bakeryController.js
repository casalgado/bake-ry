// controllers/bakeryController.js
const createBaseController = require('./base/controllerFactory');
const bakeryService = require('../services/bakeryService');

const validateBakeryData = (data) => {
  const errors = [];

  // Validate user data
  if (!data.user) {
    errors.push('User information is required');
  } else {
    if (!data.user.email) {
      errors.push('User email is required');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.user.email)) {
        errors.push('Invalid email format');
      }
    }

    if (!data.user.password) {
      errors.push('User password is required');
    }

    if (!data.user.name) {
      errors.push('User name is required');
    }
  }

  // Validate bakery data
  if (!data.bakery) {
    errors.push('Bakery information is required');
  } else {
    if (!data.bakery.name) {
      errors.push('Bakery name is required');
    }

    // Validate operating hours if provided
    if (data.bakery.operatingHours) {
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
        const hours = data.bakery.operatingHours[day];
        if (hours && hours.isOpen) {
          if (!hours.open || !hours.close) {
            errors.push(`${day} operating hours must include open and close times`);
          }
        }
      });
    }
  }

  return errors;
};

const baseController = createBaseController(bakeryService, validateBakeryData);

const bakeryController = {
  ...baseController,

  async create(req, res) {
    try {
      baseController.validateRequestData(req.body);

      // Extract user, bakery, and settings data from request
      const { user: userData, bakery: bakeryData, settings: settingsData } = req.body;

      // Create bakery using service (now handles user creation internally)
      const result = await bakeryService.create({
        userData,
        bakeryData,
        settingsData,
      });

      baseController.handleResponse(res, result, 201);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },
};

module.exports = bakeryController;
