const PayuToken = require('../models/PayuToken');
const createBaseService = require('./base/serviceFactory');
const { NotFoundError, BadRequestError } = require('../utils/errors');

const createPayuTokenService = () => {
  const baseService = createBaseService('payuTokens', PayuToken, 'bakeries/{bakeryId}');

  // PayU API Configuration
  const PAYU_CONFIG = {
    apiKey: process.env.PAYU_API_KEY || '4Vj8eK4rloUd272L48hsrarnUA',
    apiLogin: process.env.PAYU_API_LOGIN || 'pRRXKOl8ikMmt9u',
    testMode: process.env.NODE_ENV !== 'production',
    baseUrl: process.env.NODE_ENV === 'production'
      ? 'https://api.payulatam.com/payments-api/4.0/service.cgi'
      : 'https://sandbox.api.payulatam.com/payments-api/4.0/service.cgi',
  };

  // Utility function to detect card type
  const detectCardType = (cardNumber) => {
    const cleanNumber = cardNumber.replace(/\s/g, '');

    if (/^4/.test(cleanNumber)) return 'VISA';
    if (/^5[1-5]/.test(cleanNumber)) return 'MASTERCARD';
    if (/^3[47]/.test(cleanNumber)) return 'AMEX';
    if (/^30[0-5]/.test(cleanNumber) || /^36/.test(cleanNumber) || /^38/.test(cleanNumber)) return 'DINERS';

    return 'VISA'; // Default fallback
  };

  // Make PayU API request
  const makePayuRequest = async (requestData) => {
    try {
      const response = await fetch(PAYU_CONFIG.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('PayU API Error:', error.message);
      throw new BadRequestError(`PayU API Error: ${error.message}`);
    }
  };

  // Create a credit card token
  const createToken = async (cardData, bakeryId) => {
    try {
      const paymentMethod = detectCardType(cardData.cardNumber);

      const requestData = {
        language: 'es',
        command: 'CREATE_TOKEN',
        merchant: {
          apiLogin: PAYU_CONFIG.apiLogin,
          apiKey: PAYU_CONFIG.apiKey,
        },
        creditCardToken: {
          payerId: cardData.payerId,
          name: cardData.cardholderName,
          identificationNumber: cardData.identificationNumber,
          paymentMethod: paymentMethod,
          number: cardData.cardNumber,
          expirationDate: cardData.expirationDate,
        },
      };

      const response = await makePayuRequest(requestData);

      if (response.code === 'SUCCESS' && response.creditCardToken) {
        // Save token information to database
        const payuToken = new PayuToken({
          bakeryId,
          tokenId: response.creditCardToken.creditCardTokenId,
          maskedNumber: cardData.cardNumber.slice(-4), // Just store last 4 digits
          paymentMethod: response.creditCardToken.paymentMethod,
          cardholderName: response.creditCardToken.name,
          expirationDate: cardData.expirationDate,
          payerId: response.creditCardToken.payerId,
          payerIdentificationNumber: response.creditCardToken.identificationNumber,
          status: 'ACTIVE',
        });

        const saved = await baseService.create(payuToken, bakeryId);
        return saved.toClientObject();
      } else {
        throw new BadRequestError(`Token creation failed: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating token:', error);
      throw error;
    }
  };

  // Get all stored payment tokens for a bakery
  const getStoredTokens = async (bakeryId, query = {}) => {
    try {
      const filter = {
        ...query.filters,
        status: 'ACTIVE',
        isDeleted: false,
      };

      const results = await baseService.getAll(bakeryId, {
        ...query,
        filters: filter,
      });

      return {
        ...results,
        items: results.items.map(token => token.toClientObject()),
      };
    } catch (error) {
      console.error('Error getting stored tokens:', error);
      throw error;
    }
  };

  // Delete a stored token
  const deleteToken = async (cardId, bakeryId) => {
    try {
      // Get the token record by our database ID
      const token = await baseService.getById(cardId, bakeryId);

      if (!token || token.status !== 'ACTIVE') {
        throw new NotFoundError('Token not found or already deleted');
      }

      // Remove token from PayU
      const requestData = {
        language: 'es',
        command: 'REMOVE_TOKEN',
        merchant: {
          apiLogin: PAYU_CONFIG.apiLogin,
          apiKey: PAYU_CONFIG.apiKey,
        },
        removeCreditCardToken: {
          payerId: token.payerId,
          creditCardTokenId: token.tokenId, // Use the actual PayU token ID
        },
      };

      const response = await makePayuRequest(requestData);

      if (response.code === 'SUCCESS') {
        // Mark token as deleted in our database
        await baseService.patch(token.id, {
          status: 'DELETED',
          isDeleted: true,
        }, bakeryId);
        return { success: true, message: 'Token deleted successfully' };
      } else {
        throw new BadRequestError(`Token deletion failed: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting token:', error);
      throw error;
    }
  };

  return {
    ...baseService,
    createToken,
    getStoredTokens,
    deleteToken,
    detectCardType,
  };
};

// Export a singleton instance
module.exports = createPayuTokenService();
