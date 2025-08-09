const PayuTransaction = require('../models/PayuTransaction');
const createBaseService = require('./base/serviceFactory');
const { BadRequestError } = require('../utils/errors');
const { db } = require('../config/firebase');

const createPayuTransactionService = () => {
  const baseService = createBaseService('payuTransactions', PayuTransaction, 'bakeries/{bakeryId}');

  // PayU API Configuration
  const PAYU_CONFIG = {
    apiKey: process.env.PAYU_API_KEY || '4Vj8eK4rloUd272L48hsrarnUA',
    apiLogin: process.env.PAYU_API_LOGIN || 'pRRXKOl8ikMmt9u',
    accountId: process.env.PAYU_ACCOUNT_ID || '512321',
    merchantId: process.env.PAYU_MERCHANT_ID || '508029',
    testMode: process.env.NODE_ENV !== 'production',
    baseUrl: process.env.NODE_ENV === 'production'
      ? 'https://api.payulatam.com/payments-api/4.0/service.cgi'
      : 'https://sandbox.api.payulatam.com/payments-api/4.0/service.cgi',
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

  // Process a payment using a stored token
  const processPayment = async (paymentData, bakeryId) => {
    try {
      // Generate unique reference
      const reference = `${bakeryId}-${Date.now()}`;

      const requestData = {
        language: 'es',
        command: 'SUBMIT_TRANSACTION',
        merchant: {
          apiKey: PAYU_CONFIG.apiKey,
          apiLogin: PAYU_CONFIG.apiLogin,
        },
        transaction: {
          order: {
            accountId: PAYU_CONFIG.accountId,
            referenceCode: reference,
            description: paymentData.description,
            language: 'es',
            signature: generateSignature(reference, paymentData.amount, paymentData.currency),
            additionalValues: {
              TX_VALUE: {
                value: paymentData.amount,
                currency: paymentData.currency || 'COP',
              },
            },
          },
          creditCardTokenId: paymentData.tokenId,
          creditCard: {
            securityCode: paymentData.cvv,
          },
          type: 'AUTHORIZATION_AND_CAPTURE',
          paymentMethod: paymentData.paymentMethod,
          paymentCountry: 'CO',
        },
        test: PAYU_CONFIG.testMode,
      };

      const response = await makePayuRequest(requestData);

      // Save transaction record
      const payuTransactionData = {
        id: response.transactionResponse?.transactionId,
        bakeryId,
        payuTransactionId: response.transactionResponse?.transactionId,
        payuOrderId: response.transactionResponse?.orderId,
        payuState: response.transactionResponse?.state,
        payuResponseCode: response.transactionResponse?.responseCode,
        payuAuthorizationCode: response.transactionResponse?.authorizationCode,
        payuTrazabilityCode: response.transactionResponse?.trazabilityCode,
        tokenId: paymentData.tokenId,
        paymentMethod: paymentData.paymentMethod,
        amount: paymentData.amount,
        currency: paymentData.currency || 'COP',
        description: paymentData.description,
        reference: reference,
        paymentContext: paymentData.paymentContext || 'STANDALONE',
        relatedOrderId: paymentData.relatedOrderId,
        transactionType: 'AUTHORIZATION_AND_CAPTURE',
        status: mapPayuStateToStatus(response.transactionResponse?.state),
        processedAt: new Date(),
        extraParameters: response.transactionResponse?.extraParameters || {},
        additionalInfo: response.transactionResponse?.additionalInfo || {},
      };

      const saved = await baseService.create(payuTransactionData, bakeryId);
      return saved.toClientObject();
    } catch (error) {
      console.error('Error processing payment:', error);
      throw error;
    }
  };

  // Create recurring payment setup
  const createRecurringPayment = async (recurringData, bakeryId) => {
    try {
      // Create the parent recurring payment record
      const payuTransaction = new PayuTransaction({
        bakeryId,
        tokenId: recurringData.tokenId,
        paymentMethod: recurringData.paymentMethod,
        amount: recurringData.amount,
        currency: recurringData.currency || 'COP',
        description: recurringData.description,
        paymentContext: recurringData.paymentContext || 'SUBSCRIPTION',
        relatedOrderId: recurringData.relatedOrderId,
        isRecurring: true,
        recurringFrequency: recurringData.frequency,
        recurringStartDate: new Date(recurringData.startDate),
        status: 'PENDING',
      });

      const saved = await baseService.create(payuTransaction, bakeryId);
      return saved.toClientObject();
    } catch (error) {
      console.error('Error creating recurring payment:', error);
      throw error;
    }
  };

  // Process a recurring payment instance
  const processRecurringPayment = async (parentRecurringId, bakeryId) => {
    try {
      // Get parent recurring payment
      const parent = await baseService.getById(parentRecurringId, bakeryId);

      if (!parent.isRecurring) {
        throw new BadRequestError('Parent payment is not a recurring payment');
      }

      // Create payment data based on parent
      const paymentData = {
        tokenId: parent.tokenId,
        amount: parent.amount,
        currency: parent.currency,
        description: `Recurring: ${parent.description}`,
        paymentMethod: parent.paymentMethod,
        paymentContext: parent.paymentContext,
        relatedOrderId: parent.relatedOrderId,
      };

      // Process the payment
      const result = await processPayment(paymentData, bakeryId);

      // Update the result to link it to parent
      await baseService.patch(result.id, {
        parentRecurringId: parentRecurringId,
        isRecurring: false, // This is an instance, not the parent
      }, bakeryId);

      return result;
    } catch (error) {
      console.error('Error processing recurring payment:', error);
      throw error;
    }
  };

  // Query payment status from PayU
  const getPaymentStatus = async (transactionId, bakeryId) => {
    try {
      const transaction = await baseService.getById(transactionId, bakeryId);

      if (!transaction.payuOrderId) {
        throw new BadRequestError('Transaction does not have PayU order ID');
      }

      const requestData = {
        language: 'es',
        command: 'ORDER_DETAIL',
        merchant: {
          apiKey: PAYU_CONFIG.apiKey,
          apiLogin: PAYU_CONFIG.apiLogin,
        },
        details: {
          orderId: transaction.payuOrderId,
        },
      };

      const response = await makePayuRequest(requestData);

      if (response.code === 'SUCCESS' && response.result) {
        // Update local transaction status
        const newStatus = mapPayuStateToStatus(response.result.payload[0]?.state);
        if (newStatus !== transaction.status) {
          await baseService.patch(transactionId, {
            status: newStatus,
            payuState: response.result.payload[0]?.state,
          }, bakeryId);
          transaction.status = newStatus;
          transaction.payuState = response.result.payload[0]?.state;
        }
      }

      return transaction.toClientObject();
    } catch (error) {
      console.error('Error getting payment status:', error);
      throw error;
    }
  };

  // Get transactions with filters
  const getTransactions = async (bakeryId, query = {}) => {
    try {
      const results = await baseService.getAll(bakeryId, query);

      return {
        ...results,
        items: results.items.map(transaction => transaction.toClientObject()),
      };
    } catch (error) {
      console.error('Error getting transactions:', error);
      throw error;
    }
  };

  // Get recurring payment instances
  const getRecurringPaymentInstances = async (parentRecurringId, bakeryId, query = {}) => {
    try {
      const filter = {
        ...query.filters,
        parentRecurringId: parentRecurringId,
      };

      const results = await baseService.getAll(bakeryId, {
        ...query,
        filters: filter,
      });

      return {
        ...results,
        items: results.items.map(transaction => transaction.toClientObject()),
      };
    } catch (error) {
      console.error('Error getting recurring payment instances:', error);
      throw error;
    }
  };

  // Helper function to generate PayU signature
  const generateSignature = (reference, amount, currency = 'COP') => {
    const crypto = require('crypto');
    const stringToSign = `${PAYU_CONFIG.apiKey}~${PAYU_CONFIG.merchantId}~${reference}~${amount}~${currency}`;
    return crypto.createHash('md5').update(stringToSign).digest('hex');
  };

  // Helper function to map PayU state to our status
  const mapPayuStateToStatus = (payuState) => {
    switch (payuState) {
    case 'APPROVED':
      return 'APPROVED';
    case 'DECLINED':
      return 'DECLINED';
    case 'PENDING':
      return 'PENDING';
    case 'ERROR':
      return 'ERROR';
    case 'EXPIRED':
      return 'DECLINED';
    default:
      return 'PENDING';
    }
  };

  // Create subscription setup (parent recurring payment record)
  const createSubscriptionSetup = async (subscriptionData, bakeryId) => {
    try {
      const { savedCardId, tokenId, amount, currency = 'COP', description = 'Monthly Subscription' } = subscriptionData;

      // Generate unique reference for subscription
      const reference = `SUBSCRIPTION-${bakeryId}-${Date.now()}`;

      // Create the parent recurring payment record
      const payuTransactionData = {
        bakeryId,
        cardId: savedCardId,
        tokenId: tokenId,
        amount: amount,
        currency: currency,
        description: description,
        reference: reference,
        paymentContext: 'SUBSCRIPTION',
        isRecurring: true,
        recurringFrequency: 'MONTHLY',
        recurringStartDate: new Date(),
        status: 'PENDING', // Will become ACTIVE when first payment succeeds
        transactionType: 'AUTHORIZATION_AND_CAPTURE',
      };

      const saved = await baseService.create(payuTransactionData, bakeryId);
      console.log(`Created subscription setup for bakery ${bakeryId}: ${saved.id}`);

      return saved.toClientObject();
    } catch (error) {
      console.error('Error creating subscription setup:', error);
      throw error;
    }
  };

  // Process monthly billing for a subscription
  const processMonthlyBilling = async (recurringPaymentId, bakeryId) => {
    try {
      // Get parent recurring payment
      const parent = await baseService.getById(recurringPaymentId, bakeryId);

      if (!parent.isRecurring) {
        throw new BadRequestError('Payment is not a recurring subscription');
      }

      if (!parent.tokenId) {
        throw new BadRequestError('No payment method stored for subscription');
      }

      // Create payment data based on parent
      const paymentData = {
        tokenId: parent.tokenId,
        amount: parent.amount,
        currency: parent.currency,
        description: `Monthly Billing - ${parent.description}`,
        paymentMethod: parent.paymentMethod,
        paymentContext: 'SUBSCRIPTION',
        // Note: CVV is not required for stored token payments
      };

      // Process the payment using existing method
      const result = await processPayment(paymentData, bakeryId);

      console.log(`Processed payment for subscription ${recurringPaymentId}:`, result);

      // Update the result to link it to parent subscription
      await baseService.patch(result.id, {
        parentRecurringId: recurringPaymentId,
        isRecurring: false, // This is an instance, not the parent
        recurringStartDate: parent.recurringStartDate,
      }, bakeryId);

      // Update parent status based on payment result
      if (result.status === 'APPROVED') {
        await baseService.patch(recurringPaymentId, {
          status: 'ACTIVE',
          consecutiveFailures: 0,
        }, bakeryId);
      } else {
        // Increment failure counter
        const newFailureCount = (parent.consecutiveFailures || 0) + 1;
        await baseService.patch(recurringPaymentId, {
          consecutiveFailures: newFailureCount,
        }, bakeryId);
      }

      console.log(`Processed monthly billing for subscription ${recurringPaymentId}: ${result.status}`);
      return result;
    } catch (error) {
      console.error('Error processing monthly billing:', error);
      throw error;
    }
  };

  // Get all subscription payments for a recurring payment ID
  const getSubscriptionPayments = async (recurringPaymentId, bakeryId, query = {}) => {
    try {
      const filter = {
        ...query.filters,
        parentRecurringId: recurringPaymentId,
        paymentContext: 'SUBSCRIPTION',
      };

      const results = await baseService.getAll(bakeryId, {
        ...query,
        filters: filter,
      });

      return {
        ...results,
        items: results.items.map(transaction => transaction.toClientObject()),
      };
    } catch (error) {
      console.error('Error getting subscription payments:', error);
      throw error;
    }
  };

  // Get all subscriptions that need billing (for scheduled function)
  const getSubscriptionsDueForBilling = async () => {
    try {
      // This searches across all bakeries for recurring payments that need billing
      const results = [];

      // Get all bakeries (we need to search across all of them)
      const bakeriesSnapshot = await db.collection('bakeries').get();

      for (const bakeryDoc of bakeriesSnapshot.docs) {
        const bakeryId = bakeryDoc.id;

        try {
          // Get all recurring payments for this bakery
          const recurringPayments = await baseService.getAll(bakeryId, {
            filters: {
              isRecurring: true,
              paymentContext: 'SUBSCRIPTION',
            },
          });

          // Check each recurring payment to see if it needs billing
          for (const payment of recurringPayments.items) {
            // Check if this subscription needs billing by looking at the bakery settings
            try {
              const settingsRef = db
                .collection('bakeries')
                .doc(bakeryId)
                .collection('settings')
                .doc('default');

              const settingsDoc = await settingsRef.get();

              if (settingsDoc.exists) {
                const settings = settingsDoc.data();
                const subscription = settings.subscription;

                if (subscription &&
                    subscription.recurringPaymentId === payment.id &&
                    subscription.tier !== 'ALWAYS_FREE' &&
                    ['ACTIVE', 'TRIAL'].includes(subscription.status)) {

                  // Check if billing is due using the BakerySettings logic
                  const { BakerySettings } = require('../models/BakerySettings');
                  const bakerySettings = new BakerySettings({ ...settings, bakeryId });

                  if (bakerySettings.needsBilling()) {
                    results.push({
                      bakeryId,
                      recurringPaymentId: payment.id,
                      subscription: subscription,
                      nextBillingDate: bakerySettings.getNextBillingDate(),
                    });
                  }
                }
              }
            } catch (settingsError) {
              console.error(`Error checking settings for bakery ${bakeryId}:`, settingsError);
            }
          }
        } catch (bakeryError) {
          console.error(`Error processing bakery ${bakeryId}:`, bakeryError);
        }
      }

      console.log(`Found ${results.length} subscriptions due for billing`);
      return results;
    } catch (error) {
      console.error('Error getting subscriptions due for billing:', error);
      throw error;
    }
  };

  return {
    ...baseService,
    processPayment,
    createRecurringPayment,
    processRecurringPayment,
    getPaymentStatus,
    getTransactions,
    getRecurringPaymentInstances,
    // Subscription-specific methods
    createSubscriptionSetup,
    processMonthlyBilling,
    getSubscriptionPayments,
    getSubscriptionsDueForBilling,
  };
};

// Export a singleton instance
module.exports = createPayuTransactionService();
