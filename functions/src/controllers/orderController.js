const createBaseController = require('./base/controllerFactory');
const orderService = require('../services/orderService');

const validateOrderData = (data) => {
  const errors = [];
  // Add your validation logic here
  return errors;
};

const baseController = createBaseController(orderService, validateOrderData);

const orderController = {
  ...baseController,

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

      baseController.handleResponse(res, results);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },
};

module.exports = orderController;
