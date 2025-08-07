const createBaseController = require('./base/controllerFactory');
const payuTokenService = require('../services/payuTokenService');
const payuTransactionService = require('../services/payuTransactionService');
const { BadRequestError } = require('../utils/errors');

const validatePayuData = (data) => {
  const errors = [];
  // Add your validation logic here for PayU payments
  return errors;
};

const validateTokenData = (data) => {
  const errors = [];

  if (!data.cardNumber) {
    errors.push('Card number is required');
  } else if (data.cardNumber.replace(/\s/g, '').length < 13) {
    errors.push('Card number must be at least 13 digits');
  }

  if (!data.expirationDate) {
    errors.push('Expiration date is required');
  } else if (!/^\d{4}\/\d{2}$/.test(data.expirationDate)) {
    errors.push('Expiration date must be in YYYY/MM format');
  }

  if (!data.cvv) {
    errors.push('CVV is required');
  } else if (data.cvv.length < 3 || data.cvv.length > 4) {
    errors.push('CVV must be 3 or 4 digits');
  }

  if (!data.cardholderName) {
    errors.push('Cardholder name is required');
  }

  if (!data.identificationNumber) {
    errors.push('Identification number is required');
  }

  return errors;
};

const validatePaymentData = (data) => {
  const errors = [];

  if (!data.tokenId) {
    errors.push('Token ID is required');
  }

  if (!data.amount || data.amount <= 0) {
    errors.push('Amount must be greater than 0');
  }

  if (!data.description) {
    errors.push('Payment description is required');
  }

  if (!data.cvv) {
    errors.push('CVV is required for payment processing');
  }

  return errors;
};

const baseController = createBaseController(payuTransactionService, validatePayuData);

const payuController = {
  ...baseController,

  // Create a new credit card token
  async createToken(req, res) {
    try {
      const { bakeryId } = req.params;
      const cardData = req.body;

      if (!cardData) {
        throw new BadRequestError('Card data is required');
      }

      const errors = validateTokenData(cardData);
      if (errors.length > 0) {
        return res.status(400).json({ error: errors.join('. ') });
      }

      // Add payerId if not provided (use user ID)
      if (!cardData.payerId) {
        cardData.payerId = req.user?.uid || 'default_payer';
      }

      const result = await payuTokenService.createToken(cardData, bakeryId);
      baseController.handleResponse(res, result, 201);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },

  // Get all stored payment tokens
  async getTokens(req, res) {
    try {
      const { bakeryId } = req.params;
      const QueryParser = require('../utils/queryParser');
      // Here: req.query = {}
      const queryParser = new QueryParser(req);
      const query = queryParser.getQuery();

      const result = await payuTokenService.getStoredTokens(bakeryId, query);
      baseController.handleResponse(res, result);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },

  // Delete a stored card token
  async deleteToken(req, res) {
    try {
      const { tokenId, bakeryId } = req.params;

      if (!tokenId) {
        throw new BadRequestError('Token ID is required');
      }

      const result = await payuTokenService.deleteToken(tokenId, bakeryId);
      baseController.handleResponse(res, result);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },

  // Process a payment using a stored token
  async processPayment(req, res) {
    try {
      const { bakeryId } = req.params;
      const paymentData = req.body;

      if (!paymentData) {
        throw new BadRequestError('Payment data is required');
      }

      const errors = validatePaymentData(paymentData);
      if (errors.length > 0) {
        return res.status(400).json({ error: errors.join('. ') });
      }

      const result = await payuTransactionService.processPayment(paymentData, bakeryId);
      baseController.handleResponse(res, result, 201);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },

  // Create recurring payment
  async createRecurringPayment(req, res) {
    try {
      const { bakeryId } = req.params;
      const recurringData = req.body;

      if (!recurringData) {
        throw new BadRequestError('Recurring payment data is required');
      }

      // Validate recurring payment data
      const errors = [];
      if (!recurringData.tokenId) errors.push('Token ID is required');
      if (!recurringData.amount || recurringData.amount <= 0) errors.push('Amount must be greater than 0');
      if (!recurringData.frequency) errors.push('Frequency is required');
      if (!recurringData.startDate) errors.push('Start date is required');
      if (!recurringData.description) errors.push('Description is required');

      if (errors.length > 0) {
        return res.status(400).json({ error: errors.join('. ') });
      }

      const result = await payuTransactionService.createRecurringPayment(recurringData, bakeryId);
      baseController.handleResponse(res, result, 201);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },

  // Get payment status from PayU
  async getPaymentStatus(req, res) {
    try {
      const { id, bakeryId } = req.params;

      if (!id) {
        throw new BadRequestError('Payment ID is required');
      }

      const result = await payuTransactionService.getPaymentStatus(id, bakeryId);
      baseController.handleResponse(res, result);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },

  // Utility endpoint to detect card type
  async detectCardType(req, res) {
    try {
      const { cardNumber } = req.body;

      if (!cardNumber) {
        throw new BadRequestError('Card number is required');
      }

      const cardType = payuTokenService.detectCardType(cardNumber);
      baseController.handleResponse(res, { cardType });
    } catch (error) {
      baseController.handleError(res, error);
    }
  },

  // Custom method override for getAll - filter for payment records only
  async getAll(req, res) {
    try {
      const { bakeryId } = req.params;
      const QueryParser = require('../utils/queryParser');
      const queryParser = new QueryParser(req);
      const query = queryParser.getQuery();

      const results = await payuTransactionService.getTransactions(bakeryId, query);

      baseController.handleResponse(res, results);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },

  // Custom method override for getById
  async getById(req, res) {
    try {
      const { id, bakeryId } = req.params;

      if (!id) {
        throw new BadRequestError('ID parameter is required');
      }

      const result = await payuTransactionService.getById(id, bakeryId);
      baseController.handleResponse(res, result.toClientObject());
    } catch (error) {
      baseController.handleError(res, error);
    }
  },
};

module.exports = payuController;
