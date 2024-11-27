const BaseController = require('./base/BaseController');
const { BadRequestError } = require('../utils/errors');

class BakeryUserController extends BaseController {
  constructor(bakeryUserService) {
    if (!bakeryUserService) {
      throw new Error('BakeryUserService is required');
    }
    super(bakeryUserService);
  }

  async create(req, res) {
    try {
      console.log('Creating bakery user', req.body);
      const { email, password, role, name, phone } = req.body;
      console.log('Email:', email);
      console.log('Role:', role);
      console.log('Name:', name);
      console.log('Password:', password);
      console.log('Phone:', phone);

      // Validate required fields
      if (!email || !role || !name) {
        throw new BadRequestError('Email, role, and name are required');
      }

      // Validate bakery user role
      if (!['bakery_staff', 'bakery_customer', 'delivery_assistant', 'production_assistant'].includes(role)) {
        throw new BadRequestError('Invalid bakery user role');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new BadRequestError('Invalid email format');
      }

      // Continue with base controller create
      return super.create(req, res);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getAll(req, res) {
    return super.getAll(req, res);
  }

  async update(req, res) {
    try {
      const { id, bakeryId } = req.params;
      const updateData = req.body;

      // Get current user data to verify it's a bakery user
      const currentUser = await this.service.getById(id, bakeryId);
      if (!['bakery_staff', 'bakery_customer'].includes(currentUser.role)) {
        throw new BadRequestError('Invalid bakery user role');
      }

      // Validate role if it's being updated
      if (updateData.role && !['bakery_staff', 'bakery_customer'].includes(updateData.role)) {
        throw new BadRequestError('Cannot change to non-bakery user role');
      }

      // Validate email if it's being updated
      if (updateData.email !== currentUser.email) {
        throw new BadRequestError('Email cannot be updated');
      }

      return super.update(req, res);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async delete(req, res) {
    try {
      const { id, bakeryId } = req.params;

      // Verify user is a bakery user before deletion
      const user = await this.service.getById(id, bakeryId);
      if (!['bakery_staff', 'bakery_customer'].includes(user.role)) {
        throw new BadRequestError('Invalid bakery user role');
      }

      return super.delete(req, res);
    } catch (error) {
      this.handleError(res, error);
    }
  }
}

module.exports = BakeryUserController;
