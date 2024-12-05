const BaseController = require('./base/BaseController');
const OrderService = require('../services/OrderService');

class OrderController extends BaseController {
  constructor() {
    super(new OrderService(), validateOrderData);
  }

  async patchAll(req, res) {
    try {
      const { bakeryId } = req.params;
      const updates = req.body.updates;

      const results = await this.service.patchAll(
        bakeryId,
        updates,
        req.user,
      );

      this.handleResponse(res, results);
    } catch (error) {
      this.handleError(res, error);
    }
  }

}

/**
 * Validate order data
 */
function validateOrderData(data) {
  const errors = [];
  console.log('order validation');
  // // Required fields
  // const requiredFields = ['userId', 'orderItems', 'dueDate'];
  // requiredFields.forEach(field => {
  //   if (!data[field]) {
  //     errors.push(`${field} is required`);
  //   }
  // });

  // // Validate orderItems array
  // if (data.orderItems && Array.isArray(data.orderItems)) {
  //   data.orderItems.forEach((item, index) => {
  //     if (!item.productId || !item.quantity || !item.unitPrice) {
  //       errors.push(`Item at index ${index} is missing required fields`);
  //     }
  //     if (item.quantity <= 0) {
  //       errors.push(`Item at index ${index} must have quantity greater than 0`);
  //     }
  //   });
  // }

  // // Validate dates
  // const currentDate = new Date();
  // const dueDate = new Date(data.dueDate);

  // if (dueDate < currentDate) {
  //   errors.push('Required date must be in the future');
  // }

  // FOR PATCH ALL
  //       // Validate input structure
  //       if (!Array.isArray(updates)) {
  //         throw new BadRequestError('Request body must be an array of updates');
  //       }

  //       // Validate each update object
  //       updates.forEach((update, index) => {
  //         if (!update.id || typeof update.status !== 'number') {
  //           throw new BadRequestError(
  //             `Invalid update at index ${index}. Each update must have id and status`,
  //           );
  //         }
  //       });

  return errors;
}

module.exports = OrderController;
