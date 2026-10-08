// Reads come from the factory. Writes are hand-written: a run is never edited
// as a whole, only line by line (receive, undo, cancel, edit the quantity).
const createBaseController = require('./base/controllerFactory');
const productionRunService = require('../services/productionRunService');

const { getAll, getById, handleError } = createBaseController(productionRunService);

module.exports = {
  getAll,
  getById,

  async create(req, res) {
    try {
      const run = await productionRunService.create(req.body || {}, req.params.bakeryId, req.user);
      res.status(201).json(run);
    } catch (error) {
      handleError(res, error);
    }
  },

  async preview(req, res) {
    try {
      const lines = await productionRunService.preview(req.params.bakeryId, req.body || {});
      res.status(200).json(lines);
    } catch (error) {
      handleError(res, error);
    }
  },

  async receiveLine(req, res) {
    try {
      const { bakeryId, id, lineId } = req.params;
      res.status(200).json(await productionRunService.receiveLine(bakeryId, id, lineId, req.user));
    } catch (error) {
      handleError(res, error);
    }
  },

  async undoLine(req, res) {
    try {
      const { bakeryId, id, lineId } = req.params;
      res.status(200).json(await productionRunService.undoLine(bakeryId, id, lineId, req.user));
    } catch (error) {
      handleError(res, error);
    }
  },

  async cancelLine(req, res) {
    try {
      const { bakeryId, id, lineId } = req.params;
      res.status(200).json(await productionRunService.cancelLine(bakeryId, id, lineId, req.user));
    } catch (error) {
      handleError(res, error);
    }
  },

  async updateLine(req, res) {
    try {
      const { bakeryId, id, lineId } = req.params;
      res.status(200).json(
        await productionRunService.updateLine(bakeryId, id, lineId, req.body || {}, req.user),
      );
    } catch (error) {
      handleError(res, error);
    }
  },
};
