// Note: ForbiddenError not needed since we use res.status().json() directly

/**
 * Middleware to check subscription status for write operations
 * Uses JWT token data for zero-latency validation
 *
 * @param {Array} allowedOperations - Array of operations to allow (default: ['read'])
 * @returns {Function} Express middleware function
 */
const requireActiveSubscription = (allowedOperations = ['read']) => {
  return (req, res, next) => {
    try {
      const user = req.user; // From JWT token
      const method = req.method.toLowerCase();

      // Extract subscription info from JWT token (added during authentication)
      const subscriptionStatus = user.subscriptionStatus;
      const subscriptionTier = user.subscriptionTier;

      // ALWAYS_FREE tier bypasses all subscription checks
      if (subscriptionTier === 'ALWAYS_FREE') {
        return next();
      }

      // Allow read operations for all subscription statuses
      if (method === 'get' || allowedOperations.includes('read')) {
        return next();
      }

      // Block write operations for suspended/cancelled subscriptions
      if (['SUSPENDED', 'CANCELLED'].includes(subscriptionStatus)) {
        res.status(403).json({
          error: 'Active subscription required for this operation',
          subscriptionStatus: subscriptionStatus,
          subscriptionTier: subscriptionTier,
          code: 'SUBSCRIPTION_REQUIRED',
        });
        return;
      }

      // Allow operations for active statuses (TRIAL, ACTIVE, PAYMENT_FAILED during grace period)
      next();
    } catch (error) {
      console.error('Error in subscription access middleware:', error);
      res.status(403).json({
        error: 'Unable to verify subscription access',
        code: 'SUBSCRIPTION_CHECK_ERROR',
      });
    }
  };
};

/**
 * Middleware specifically for operations that require an active paid subscription
 * Blocks TRIAL users as well as suspended/cancelled
 */
const requirePaidSubscription = (req, res, next) => {
  try {
    const user = req.user;
    const subscriptionStatus = user.subscriptionStatus;
    const subscriptionTier = user.subscriptionTier;

    // ALWAYS_FREE tier bypasses paid subscription requirement
    if (subscriptionTier === 'ALWAYS_FREE') {
      return next();
    }

    // Only allow ACTIVE status for paid-only features
    if (subscriptionStatus !== 'ACTIVE') {
      res.status(403).json({
        error: 'Paid subscription required for this feature',
        subscriptionStatus: subscriptionStatus,
        subscriptionTier: subscriptionTier,
        code: 'PAID_SUBSCRIPTION_REQUIRED',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Error in paid subscription middleware:', error);
    res.status(403).json({
      error: 'Unable to verify paid subscription access',
      code: 'SUBSCRIPTION_CHECK_ERROR',
    });
  }
};

/**
 * Middleware to add subscription information to response headers
 * Useful for frontend to understand current subscription state
 */
const addSubscriptionHeaders = (req, res, next) => {
  try {
    const user = req.user;

    if (user.subscriptionStatus && user.subscriptionTier) {
      res.set('X-Subscription-Status', user.subscriptionStatus);
      res.set('X-Subscription-Tier', user.subscriptionTier);
    }

    next();
  } catch (error) {
    // Don't fail the request if headers can't be set
    console.warn('Could not set subscription headers:', error);
    next();
  }
};

module.exports = {
  requireActiveSubscription,
  requirePaidSubscription,
  addSubscriptionHeaders,
};
