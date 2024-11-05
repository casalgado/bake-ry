const BaseController = require('./base/BaseController');
const { BadRequestError } = require('../utils/errors');

class AdminUserController extends BaseController {
  /**
   * AdminUserController constructor
   * @param {AdminUserService} adminUserService - Instance of AdminUserService
   */
  constructor(adminUserService) {
    if (!adminUserService) {
      throw new Error('AdminUserService is required');
    }
    super(adminUserService);
  }

  /**
   * Create admin user
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   */
  async create(req, res) {
    try {
      const { email, password, role, name, bakeryId } = req.body;

      // Validate required fields
      if (!email || !password || !role || !name) {
        throw new BadRequestError('Email, password, role, and name are required');
      }

      // Validate admin role
      if (!['system_admin', 'bakery_admin'].includes(role)) {
        throw new BadRequestError('Invalid admin role');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new BadRequestError('Invalid email format');
      }

      // Validate password
      if (password.length < 6) {
        throw new BadRequestError('Password must be at least 6 characters long');
      }

      const user = await this.service.create({
        email,
        password,
        role,
        name,
        bakeryId,
      });

      this.handleResponse(res, user, 201);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Update admin user
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Get current user data to verify it's an admin
      const currentUser = await this.service.getById(id);
      if (!['system_admin', 'bakery_admin'].includes(currentUser.role)) {
        throw new BadRequestError('User is not an admin');
      }

      // Validate role if it's being updated
      if (updateData.role && !['system_admin', 'bakery_admin'].includes(updateData.role)) {
        throw new BadRequestError('Cannot change admin user to non-admin role');
      }

      // Validate email if it's being updated
      if (updateData.email) {
        throw new BadRequestError('Email cannot be updated.');
      }

      return super.update(req, res);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Delete admin user
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   */
  async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        throw new BadRequestError('User ID is required');
      }

      // Verify user is an admin before deletion
      const user = await this.service.getById(id);
      if (!['system_admin', 'bakery_admin'].includes(user.role)) {
        throw new BadRequestError('User is not an admin');
      }

      await this.service.delete(id);
      this.handleResponse(res, null, 204);
    } catch (error) {
      this.handleError(res, error);
    }
  }
}

module.exports = AdminUserController;
