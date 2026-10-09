// Reads come from the factory. Writes are hand-written: a count changes one row
// at a time, and then closes or is discarded.
const createBaseController = require('./base/controllerFactory');
const stockCountService = require('../services/stockCountService');

const { getAll, getById, handleError } = createBaseController(stockCountService);

module.exports = {
  getAll,
  getById,

  async open(req, res) {
    try {
      res.status(200).json(await stockCountService.open(req.params.bakeryId, req.body || {}, req.user));
    } catch (error) {
      handleError(res, error);
    }
  },

  async setItem(req, res) {
    try {
      const { bakeryId, id, itemKey } = req.params;
      res.status(200).json(await stockCountService.setItem(bakeryId, id, itemKey, req.body || {}, req.user));
    } catch (error) {
      handleError(res, error);
    }
  },

  async close(req, res) {
    try {
      const { bakeryId, id } = req.params;
      res.status(200).json(await stockCountService.close(bakeryId, id, req.user));
    } catch (error) {
      handleError(res, error);
    }
  },

  async discard(req, res) {
    try {
      const { bakeryId, id } = req.params;
      res.status(200).json(await stockCountService.discard(bakeryId, id, req.user));
    } catch (error) {
      handleError(res, error);
    }
  },
};
