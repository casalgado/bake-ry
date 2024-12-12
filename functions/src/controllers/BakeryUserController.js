const createBaseController = require('./base/controllerFactory');
const BakeryUserService = require('../services/BakeryUserService');
const { BadRequestError } = require('../utils/errors');

const validateUserData = (data) => {
  const errors = [];

  if (!data.email) {
    errors.push('Email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('Invalid email format');
    }
  }

  if (!data.role) {
    errors.push('Role is required');
  } else if (!['bakery_staff', 'bakery_customer', 'delivery_assistant', 'production_assistant'].includes(data.role)) {
    errors.push('Invalid bakery user role');
  }

  return errors;
};

const bakeryUserService = new BakeryUserService();
const baseController = createBaseController(bakeryUserService, validateUserData);

const bakeryUserController = {
  ...baseController,

  async create(req, res) {
    try {
      console.log('Creating bakery user', req.body);
      const { email, password, role, name, phone } = req.body;
      const { bakeryId } = req.params;

      baseController.validateRequestData(req.body);

      const result = await bakeryUserService.create({
        email,
        password,
        role,
        name,
        phone,
      }, bakeryId);

      baseController.handleResponse(res, result, 201);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },

  async update(req, res) {
    try {
      const { id, bakeryId } = req.params;
      const updateData = req.body;

      if (!id) throw new BadRequestError('ID parameter is required');
      if (!updateData) throw new BadRequestError('Update data is required');

      // Get current user data to verify it's a bakery user
      const currentUser = await bakeryUserService.getById(id, bakeryId);
      if (!['bakery_staff', 'bakery_customer'].includes(currentUser.role)) {
        throw new BadRequestError('Invalid bakery user role');
      }

      // Validate role if it's being updated
      if (updateData.role && !['bakery_staff', 'bakery_customer'].includes(updateData.role)) {
        throw new BadRequestError('Cannot change to non-bakery user role');
      }

      // Validate email if it's being updated
      if (updateData.email && updateData.email !== currentUser.email) {
        throw new BadRequestError('Email cannot be updated');
      }

      const result = await bakeryUserService.update(id, updateData, bakeryId);
      baseController.handleResponse(res, result);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },

  async delete(req, res) {
    try {
      const { id, bakeryId } = req.params;

      // Verify user is a bakery user before deletion
      const user = await bakeryUserService.getById(id, bakeryId);
      if (!['bakery_staff', 'bakery_customer'].includes(user.role)) {
        throw new BadRequestError('Invalid bakery user role');
      }

      await bakeryUserService.delete(id, bakeryId);
      baseController.handleResponse(res, null, 204);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },
};

module.exports = bakeryUserController;
