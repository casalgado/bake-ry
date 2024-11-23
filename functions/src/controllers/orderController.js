const BaseController = require('./base/BaseController');
const OrderService = require('../services/OrderService');

class OrderController extends BaseController {
  constructor() {
    super(new OrderService());
  }

  /**
   * Validate order data
   */
  validateOrderData(data) {
    const errors = [];

    // Required fields
    const requiredFields = ['userId', 'items', 'dueDate'];
    requiredFields.forEach(field => {
      if (!data[field]) {
        errors.push(`${field} is required`);
      }
    });

    // Validate items array
    if (data.items && Array.isArray(data.items)) {
      data.items.forEach((item, index) => {
        if (!item.productId || !item.quantity || !item.unitPrice) {
          errors.push(`Item at index ${index} is missing required fields`);
        }
        if (item.quantity <= 0) {
          errors.push(`Item at index ${index} must have quantity greater than 0`);
        }
      });
    }

    // Validate dates
    const currentDate = new Date();
    const dueDate = new Date(data.dueDate);

    if (dueDate < currentDate) {
      errors.push('Required date must be in the future');
    }

    return errors;
  }

  /**
   * Validate order updates
   */
  validateOrderUpdate(data) {
    const errors = [];

    // Validate immutable fields
    if (data.bakeryId !== undefined) {
      errors.push('Cannot change bakeryId');
    }

    // Validate status
    if (data.status !== undefined) {
      if (!Number.isInteger(data.status) || data.status < 0 || data.status > 4) {
        errors.push('Invalid status value');
      }
    }

    // Validate dates if provided
    if (data.dueDate) {
      const currentDate = new Date();
      const dueDate = new Date(data.dueDate);

      // Set both dates to start of day for comparison
      currentDate.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < currentDate) {
        errors.push('Due date cannot be in the past');
      }
    }

    return errors;
  }

  /**
   * Create order
   */
  async create(req, res) {
    try {
      const orderData = req.body;
      const { bakeryId } = req.params;

      // // Validate data
      // const errors = this.validateOrderData(orderData);
      // if (errors.length > 0) {
      //   throw new BadRequestError(errors.join('. '));
      // }

      const order = await this.service.create(orderData, bakeryId);
      this.handleResponse(res, order, 201);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Update order
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const { bakeryId } = req.params;
      const updateData = req.body;
      const editor = req.user; // Added by auth middleware

      // // Validate update data
      // const errors = this.validateOrderUpdate(updateData);
      // if (errors.length > 0) {
      //   throw new BadRequestError(errors.join('. '));
      // }

      const order = await this.service.update(id, updateData, bakeryId, editor);
      this.handleResponse(res, order);
    } catch (error) {
      this.handleError(res, error);
    }
  }

}

module.exports = OrderController;
