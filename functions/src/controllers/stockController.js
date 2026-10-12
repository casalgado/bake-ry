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

// A window in days. Absent means the service's default; anything else must be a
// positive number, or a negative one would quietly push the window into the future.
const parseDays = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const days = Number(value);
  if (!Number.isFinite(days) || days <= 0) {
    throw new BadRequestError('days debe ser un número mayor a 0');
  }
  return days;
};

const stockController = {
  async getAll(req, res) {
    try {
      const { bakeryId } = req.params;
      const { itemType, search, warehouseId, itemKeys } = req.query;

      const stocks = await stockService.getStocks(bakeryId, {
        itemType,
        search,
        warehouseId,
        // ?itemKeys=a&itemKeys=b arrives as an array; String() joins it with commas.
        itemKeys: itemKeys && String(itemKeys).split(','),
      });
      res.status(200).json(stocks);
    } catch (error) {
      handleError(res, error);
    }
  },

  async verify(req, res) {
    try {
      res.status(200).json(await stockService.verify(req.params.bakeryId));
    } catch (error) {
      handleError(res, error);
    }
  },

  // Shipped orders whose movements differ from what they should have deducted.
  async verifyOrders(req, res) {
    try {
      const days = parseDays(req.query.days);
      res.status(200).json(
        await stockService.findUnreconciledOrders(req.params.bakeryId, { days }),
      );
    } catch (error) {
      handleError(res, error);
    }
  },

  // Brings those orders back in line, one at a time.
  async reconcileOrders(req, res) {
    try {
      const days = parseDays(req.body?.days);
      res.status(200).json(
        await stockService.reconcileUnreconciledOrders(req.params.bakeryId, {
          days,
          editor: editorOf(req),
        }),
      );
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
