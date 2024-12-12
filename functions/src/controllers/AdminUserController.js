const createBaseController = require('./base/controllerFactory');
const AdminUserService = require('../services/AdminUserService');
const { BadRequestError } = require('../utils/errors');

const validateAdminData = (data) => {
  const errors = [];

  // Validate required fields
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
  } else if (data.password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  if (!data.role) {
    errors.push('Role is required');
  } else if (!['system_admin', 'bakery_admin'].includes(data.role)) {
    errors.push('Invalid admin role');
  }

  if (!data.name) {
    errors.push('Name is required');
  }

  return errors;
};

const adminUserService = new AdminUserService();
const baseController = createBaseController(adminUserService, validateAdminData);

const adminController = {
  ...baseController,

  async create(req, res) {
    try {
      const { email, password, role, name, bakeryId } = req.body;

      baseController.validateRequestData(req.body);

      const user = await adminUserService.create({
        email,
        password,
        role,
        name,
        bakeryId,
      });

      baseController.handleResponse(res, user, 201);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) throw new BadRequestError('ID parameter is required');

      // Get current user data to verify it's an admin
      const currentUser = await adminUserService.getById(id);
      if (!['system_admin', 'bakery_admin'].includes(currentUser.role)) {
        throw new BadRequestError('User is not an admin');
      }

      // Validate role if it's being updated
      if (updateData.role && !['system_admin', 'bakery_admin'].includes(updateData.role)) {
        throw new BadRequestError('Cannot change admin user to non-admin role');
      }

      // Prevent email updates
      if (updateData.email) {
        throw new BadRequestError('Email cannot be updated');
      }

      const result = await adminUserService.update(id, updateData);
      baseController.handleResponse(res, result);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;
      if (!id) throw new BadRequestError('User ID is required');

      // Verify user is an admin before deletion
      const user = await adminUserService.getById(id);
      if (!['system_admin', 'bakery_admin'].includes(user.role)) {
        throw new BadRequestError('User is not an admin');
      }

      await adminUserService.delete(id);
      baseController.handleResponse(res, null, 204);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },
};

module.exports = adminController;
