// Only reads come from the factory: a confirmed purchase is immutable, so there
// is no update or delete endpoint.
const createBaseController = require('./base/controllerFactory');
const purchaseService = require('../services/purchaseService');

const { getAll, getById, handleError } = createBaseController(purchaseService);

module.exports = {
  getAll,
  getById,

  async create(req, res) {
    try {
      const purchase = await purchaseService.create(
        req.body || {},
        req.params.bakeryId,
        req.user,
      );
      res.status(201).json(purchase);
    } catch (error) {
      handleError(res, error);
    }
  },

  async getLastPurchase(req, res) {
    try {
      const { bakeryId, id } = req.params;
      res.status(200).json(await purchaseService.getLastPurchase(bakeryId, id));
    } catch (error) {
      handleError(res, error);
    }
  },
};
