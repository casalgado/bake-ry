const BaseController = require('./base/BaseController');
const { ForbiddenError, BadRequestError } = require('../utils/errors');

class BakeryController extends BaseController {
  /**
   * BakeryController constructor
   * @param {BakeryService} bakeryService - Instance of BakeryService
   */
  constructor(bakeryService) {
    if (!bakeryService) {
      throw new Error('BakeryService is required');
    }
    super(bakeryService);
  }

  /**
   * Create bakery - Override base create method to add bakery-specific logic
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   */
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

      // Validate required fields in request body
      const { name, address } = req.body;
      if (!name || !address) {
        throw new BadRequestError('Name and address are required');
      }

      // Prepare bakery data with owner ID
      const bakeryData = {
        ...req.body,
        ownerId: uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create bakery using service
      const result = await this.service.create(bakeryData);

      // Use base controller's response handler
      this.handleResponse(res, result, 201);
    } catch (error) {
      // Use base controller's error handler
      this.handleError(res, error);
    }
  }

}

module.exports = BakeryController;
