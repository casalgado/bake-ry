const BaseController = require('./base/BaseController');
const { BadRequestError } = require('../utils/errors');

class AuthController extends BaseController {
  /**
   * AuthController constructor
   * @param {AuthService} authService - Instance of AuthService
   */
  constructor(authService) {
    if (!authService) {
      throw new Error('AuthService is required');
    }
    super(authService);
  }

  /**
   * Register new user
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   */
  async register(req, res) {
    try {
      const { email, password, role, name, bakeryId } = req.body;

      // Validate required fields
      if (!email || !password || !role || !name) {
        throw new BadRequestError('Email, password, role, and name are required');
      }

      // Validate role and bakeryId
      if (role !== 'system_admin' && role !== 'bakery_admin' && !bakeryId) {
        throw new BadRequestError('BakeryId is required for non-admin users');
      }

      const user = await this.service.register({
        email,
        password,
        role,
        name,
        bakeryId,
      });

      this.handleResponse(res, {
        message: 'User created successfully',
        user,
      }, 201);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Login user
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   */
  async login(req, res) {
    try {
      // Get the ID token from the Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new BadRequestError('No token provided');
      }

      const idToken = authHeader.split('Bearer ')[1];
      const { email } = req.body;

      if (!email) {
        throw new BadRequestError('Email is required');
      }

      const userData = await this.service.login(idToken, email);
      this.handleResponse(res, userData);
    } catch (error) {
      this.handleError(res, error);
    }
  }

}

module.exports = AuthController;
