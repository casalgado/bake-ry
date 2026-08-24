// controllers/stockController.js
//
// Hand-written on purpose: the controller factory would generate update and
// delete endpoints, and movements are append-only (§8.2). There is no way to
// edit or remove a movement through the API, by design.
const stockService = require('../services/stockService');
const createBaseController = require('./base/controllerFactory');
const { BadRequestError } = require('../utils/errors');

// Only the error mapper is borrowed from the factory — the generated CRUD
// handlers are exactly what this controller must not expose.
const { handleError } = createBaseController(stockService);

const stockController = {
  async getAll(req, res) {
    try {
      const { bakeryId } = req.params;
      const { itemType, search } = req.query;

      const stocks = await stockService.getStocks(bakeryId, { itemType, search });
      res.status(200).json(stocks);
    } catch (error) {
      handleError(res, error);
    }
  },

  async getMovements(req, res) {
    try {
      const { bakeryId, itemKey } = req.params;
      const { limit, startAfter } = req.query;

      const movements = await stockService.getItemMovements(bakeryId, itemKey, {
        limit: limit || 50,
        startAfter,
      });
      res.status(200).json(movements);
    } catch (error) {
      handleError(res, error);
    }
  },

  async getOrderMovements(req, res) {
    try {
      const { bakeryId } = req.params;
      const { orderId } = req.query;

      if (!orderId) throw new BadRequestError('orderId is required');

      const movements = await stockService.getOrderMovements(bakeryId, orderId);
      res.status(200).json(movements);
    } catch (error) {
      handleError(res, error);
    }
  },

  async adjust(req, res) {
    try {
      const { bakeryId, itemKey } = req.params;
      const { qty, reason } = req.body;

      if (qty === undefined) throw new BadRequestError('qty is required');

      const movement = await stockService.adjust(bakeryId, itemKey, {
        qty,
        reason,
        editor: {
          userId: req.user?.uid,
          email: req.user?.email,
          role: req.user?.role,
        },
      });

      res.status(201).json(movement);
    } catch (error) {
      handleError(res, error);
    }
  },
};

module.exports = stockController;
