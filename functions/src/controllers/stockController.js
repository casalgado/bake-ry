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

const editorOf = (req) => ({
  userId: req.user?.uid,
  email: req.user?.email,
  role: req.user?.role,
});

const stockController = {
  async getAll(req, res) {
    try {
      const { bakeryId } = req.params;
      const { itemType, search, warehouseId } = req.query;

      const stocks = await stockService.getStocks(bakeryId, {
        itemType,
        search,
        warehouseId,
      });
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
      const { qty, reason, warehouseId, idempotencyKey } = req.body;

      const movement = await stockService.adjust(bakeryId, itemKey, {
        qty,
        reason,
        warehouseId,
        idempotencyKey,
        editor: editorOf(req),
      });

      res.status(201).json(movement);
    } catch (error) {
      handleError(res, error);
    }
  },

  // Sibling of adjust, deliberately not the same endpoint: a baja is a real
  // loss, an adjustment is a correction, and the ledger keeps them apart (§3).
  async waste(req, res) {
    try {
      const { bakeryId, itemKey } = req.params;
      const { qty, reason, note, warehouseId, idempotencyKey } = req.body;

      const movement = await stockService.waste(bakeryId, itemKey, {
        qty,
        reason,
        note,
        warehouseId,
        idempotencyKey,
        editor: editorOf(req),
      });

      res.status(201).json(movement);
    } catch (error) {
      handleError(res, error);
    }
  },

  async transfer(req, res) {
    try {
      const { bakeryId, itemKey } = req.params;
      const { qty, fromWarehouseId, toWarehouseId, idempotencyKey } = req.body;

      const movements = await stockService.transfer(bakeryId, itemKey, {
        qty,
        fromWarehouseId,
        toWarehouseId,
        idempotencyKey,
        editor: editorOf(req),
      });

      res.status(201).json(movements);
    } catch (error) {
      handleError(res, error);
    }
  },
};

module.exports = stockController;
