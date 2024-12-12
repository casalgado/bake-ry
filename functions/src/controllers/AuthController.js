// controllers/authController.js
const createBaseController = require('./base/controllerFactory');
const authService = require('../services/authService');
const { BadRequestError } = require('../utils/errors');

const validateRegistrationData = (data) => {
  const errors = [];

  if (!data.email) {
    errors.push('Email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('Invalid email format');
    }
  }

  if (!data.password) {
    errors.push('Password is required');
  }

  if (!data.role) {
    errors.push('Role is required');
  }

  if (!data.name) {
    errors.push('Name is required');
  }

  if (data.role !== 'system_admin' && data.role !== 'bakery_admin' && !data.bakeryId) {
    errors.push('BakeryId is required for non-admin users');
  }

  return errors;
};

const baseController = createBaseController(authService, validateRegistrationData);

const authController = {
  ...baseController,

  async register(req, res) {
    try {
      const { email, password, role, name, bakeryId } = req.body;

      baseController.validateRequestData(req.body);

      const user = await authService.register({
        email,
        password,
        role,
        name,
        bakeryId,
      });

      baseController.handleResponse(res, {
        message: 'User created successfully',
        user,
      }, 201);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },

  async login(req, res) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new BadRequestError('No token provided');
      }

      const idToken = authHeader.split('Bearer ')[1];
      const { email } = req.body;

      if (!email) {
        throw new BadRequestError('Email is required');
      }

      const userData = await authService.login(idToken, email);
      baseController.handleResponse(res, userData);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },
};

module.exports = authController;
