const createBaseController = require('./base/controllerFactory');
const orderService = require('../services/orderService');
const QueryParser = require('../utils/queryParser');

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

  async getSalesReport(req, res) {
    try {
      const { bakeryId } = req.params;
      const queryParser = new QueryParser(req);
      const query = queryParser.getQuery();

      const report = await orderService.getSalesReport(bakeryId, query);
      console.log('report', report);
      baseController.handleResponse(res, report);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },

  async getHistory(req, res) {
    try {
      const { id, bakeryId } = req.params;
      const history = await orderService.getHistory(bakeryId, id);
      baseController.handleResponse(res, history);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },
};

module.exports = orderController;
