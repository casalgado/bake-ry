// Reads come from the factory. Issuing and sending are hand-written: they talk
// to the DIAN and move the invoice through its statuses.
const createBaseController = require('./base/controllerFactory');
const einvoiceService = require('../services/einvoiceService');

const { getAll, getById, handleError } = createBaseController(einvoiceService);

module.exports = {
  getAll,
  getById,

  /** Issues the order's invoice (or rebuilds a rejected one) and sends it. */
  async issueAndSend(req, res) {
    try {
      const { bakeryId, orderId } = req.params;
      const issued = await einvoiceService.issue(bakeryId, orderId, req.user);
      const einvoice = issued.status === 'signed'
        ? await einvoiceService.send(bakeryId, orderId, req.user)
        : issued;
      res.status(200).json(einvoice);
    } catch (error) {
      handleError(res, error);
    }
  },

  /** Asks the DIAN how a sent invoice did. */
  async checkStatus(req, res) {
    try {
      const { bakeryId, orderId } = req.params;
      res.status(200).json(await einvoiceService.checkStatus(bakeryId, orderId, req.user));
    } catch (error) {
      handleError(res, error);
    }
  },
};
