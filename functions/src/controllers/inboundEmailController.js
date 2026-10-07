// controllers/inboundEmailController.js
const crypto = require('crypto');
const createBaseController = require('./base/controllerFactory');
const inboundEmailService = require('../services/inboundEmailService');
const { AuthenticationError, BadRequestError } = require('../utils/errors');

const baseController = createBaseController(inboundEmailService);

const isValidSecret = (provided = '') => {
  const expected = Buffer.from(process.env.INBOUND_EMAIL_SECRET || '');
  const given = Buffer.from(provided);
  // An unset secret must never match an empty header.
  return expected.length > 0 && given.length === expected.length && crypto.timingSafeEqual(given, expected);
};

const inboundEmailController = {
  async receive(req, res) {
    try {
      if (!isValidSecret(req.get('X-Inbound-Secret'))) {
        throw new AuthenticationError('Invalid inbound secret');
      }

      // Cloud Functions pre-reads the body into rawBody; locally express.raw fills req.body.
      const raw = req.rawBody || req.body;
      if (!Buffer.isBuffer(raw) || !raw.length) {
        throw new BadRequestError('Expected a raw message/rfc822 body');
      }

      const { id, status, reason } = await inboundEmailService.receive(raw);
      baseController.handleResponse(res, { id, status, reason });
    } catch (error) {
      baseController.handleError(res, error);
    }
  },
};

module.exports = inboundEmailController;
