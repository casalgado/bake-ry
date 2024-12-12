const createBaseController = require('./base/controllerFactory');
const OrderService = require('../services/OrderService');

const validateOrderData = (data) => {
  const errors = [];
  // Add your validation logic here
  return errors;
};

const orderService = new OrderService();

const orderController = {
  ...createBaseController(orderService, validateOrderData),

  // Custom method override
  async patchAll(req, res) {
    try {
      const { bakeryId } = req.params;
      const updates = req.body.updates;

      const results = await orderService.patchAll(
        bakeryId,
        updates,
        req.user,
      );

      this.handleResponse(res, results);
    } catch (error) {
      this.handleError(res, error);
    }
  },
};

module.exports = orderController;
