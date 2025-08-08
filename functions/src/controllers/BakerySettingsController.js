const createBaseController = require('./base/controllerFactory');
const bakerySettingsService = require('../services/bakerySettingsService');
const payuTransactionService = require('../services/payuTransactionService');
const payuCardService = require('../services/payuCardService');
const bakeryUserService = require('../services/bakeryUserService');
const { BadRequestError } = require('../utils/errors');

const validateSettingsData = (data) => {
  const errors = [];

  return errors;
};

const validateSubscriptionData = (subscription) => {
  const errors = [];

  if (!subscription) return errors;

  // Validate status
  const validStatuses = ['TRIAL', 'ACTIVE', 'CANCELLED', 'SUSPENDED', 'PAYMENT_FAILED'];
  if (subscription.status && !validStatuses.includes(subscription.status)) {
    errors.push(`Invalid subscription status: ${subscription.status}`);
  }

  // Validate tier
  const validTiers = ['ALWAYS_FREE', 'BASIC', 'PREMIUM'];
  if (subscription.tier && !validTiers.includes(subscription.tier)) {
    errors.push(`Invalid subscription tier: ${subscription.tier}`);
  }

  // Validate amount
  if (subscription.amount !== undefined && (typeof subscription.amount !== 'number' || subscription.amount < 0)) {
    errors.push('Subscription amount must be a non-negative number');
  }

  // Validate currency
  if (subscription.currency && subscription.currency !== 'COP') {
    errors.push('Only COP currency is supported');
  }

  // Validate consecutive failures
  if (subscription.consecutiveFailures !== undefined &&
      (typeof subscription.consecutiveFailures !== 'number' || subscription.consecutiveFailures < 0)) {
    errors.push('Consecutive failures must be a non-negative number');
  }

  return errors;
};

// Handle subscription-specific updates and actions
const handleSubscriptionUpdate = async (subscriptionData, bakeryId, user) => {
  // Validate subscription data
  const subscriptionErrors = validateSubscriptionData(subscriptionData);
  if (subscriptionErrors.length > 0) {
    throw new BadRequestError(`Subscription validation errors: ${subscriptionErrors.join(', ')}`);
  }

  // Handle special actions
  if (subscriptionData._action) {
    await handleSubscriptionAction(subscriptionData._action, subscriptionData, bakeryId, user);
    delete subscriptionData._action;
  }

  // If setting up a new subscription with a saved card
  if (subscriptionData.savedCardId && !subscriptionData.recurringPaymentId) {
    // Verify the card exists
    const card = await payuCardService.getById(subscriptionData.savedCardId, bakeryId);
    if (!card || !card.isActive()) {
      throw new BadRequestError('Invalid or inactive payment card');
    }

    // Create subscription setup
    const subscriptionSetup = await payuTransactionService.createSubscriptionSetup({
      savedCardId: subscriptionData.savedCardId,
      amount: subscriptionData.amount || 99000,
      currency: subscriptionData.currency || 'COP',
      description: 'Monthly Subscription',
    }, bakeryId);

    // Update subscription data with the recurring payment ID
    subscriptionData.recurringPaymentId = subscriptionSetup.id;
  }

  // If changing subscription status or tier, refresh JWT tokens for all bakery users
  const statusChanged = subscriptionData.status !== undefined;
  const tierChanged = subscriptionData.tier !== undefined;

  if (statusChanged || tierChanged) {
    console.log(`Subscription change detected for bakery ${bakeryId}, refreshing user tokens`);

    // Refresh JWT tokens in the background (don't block the response)
    setImmediate(async () => {
      try {
        await bakeryUserService.refreshAllBakeryUserTokens(bakeryId, {
          status: subscriptionData.status,
          tier: subscriptionData.tier,
        });
      } catch (error) {
        console.error(`Failed to refresh user tokens for bakery ${bakeryId}:`, error);
      }
    });
  }
};

// Handle subscription actions like retry payment
const handleSubscriptionAction = async (action, subscriptionData, bakeryId, user) => {
  switch (action) {
  case 'retry_payment': {
    if (!subscriptionData.recurringPaymentId) {
      throw new BadRequestError('No recurring payment ID found for subscription');
    }

    console.log(`Processing retry payment for subscription ${subscriptionData.recurringPaymentId}`);
    const paymentResult = await payuTransactionService.processMonthlyBilling(
      subscriptionData.recurringPaymentId,
      bakeryId,
    );

    // Update subscription status based on payment result
    if (paymentResult.status === 'APPROVED') {
      subscriptionData.status = 'ACTIVE';
      subscriptionData.consecutiveFailures = 0;
    } else {
      subscriptionData.consecutiveFailures = (subscriptionData.consecutiveFailures || 0) + 1;
      if (subscriptionData.consecutiveFailures >= 3) {
        subscriptionData.status = 'SUSPENDED';
      } else {
        subscriptionData.status = 'PAYMENT_FAILED';
      }
    }

    console.log(`Retry payment result: ${paymentResult.status}, new status: ${subscriptionData.status}`);
    break;
  }

  case 'cancel_subscription':
    subscriptionData.status = 'CANCELLED';
    console.log(`Cancelled subscription for bakery ${bakeryId}`);
    break;

  case 'reactivate_subscription':
    if (!subscriptionData.savedCardId) {
      throw new BadRequestError('Payment method required for reactivation');
    }
    subscriptionData.status = 'ACTIVE';
    subscriptionData.consecutiveFailures = 0;
    console.log(`Reactivated subscription for bakery ${bakeryId}`);
    break;

  default:
    throw new BadRequestError(`Unknown subscription action: ${action}`);
  }
};

const baseController = createBaseController(bakerySettingsService, validateSettingsData);

const bakerySettingsController = {
  ...baseController,

  async getStaffList(req, res) {
    try {
      const { bakeryId } = req.params;
      const staff = await bakerySettingsService.getStaffList(bakeryId);
      baseController.handleResponse(res, staff);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },

  async getB2bClientsList(req, res) {
    try {
      const { bakeryId } = req.params;
      const b2bClients = await bakerySettingsService.getB2bClientsList(bakeryId);
      baseController.handleResponse(res, b2bClients);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },

  // Override patch to handle subscription management and product categories
  async patch(req, res) {
    try {
      const { id, bakeryId } = req.params;
      const patchData = req.body;

      if (!id) throw new BadRequestError('ID parameter is required');
      if (!patchData || Object.keys(patchData).length === 0) {
        throw new BadRequestError('Patch data is required');
      }

      const immutableFields = ['id', 'createdAt'];
      const attemptedImmutableUpdate = immutableFields.find(field =>
        Object.prototype.hasOwnProperty.call(patchData, field),
      );

      if (attemptedImmutableUpdate) {
        throw new BadRequestError(`Cannot update immutable field: ${attemptedImmutableUpdate}`);
      }

      baseController.validateRequestData(patchData);

      // Handle subscription-specific logic
      if (patchData.subscription) {
        await handleSubscriptionUpdate(patchData.subscription, bakeryId, req.user);
      }

      const result = await bakerySettingsService.patch(id, patchData, bakeryId);
      baseController.handleResponse(res, result);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },
};

module.exports = bakerySettingsController;
