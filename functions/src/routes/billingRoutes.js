const express = require('express');
const BillingService = require('../services/billingService');
const {
  authenticateUser,
  requireSystemAdmin,
} = require('../middleware/userAccess');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateUser);

// Apply system admin requirement to all routes
router.use(requireSystemAdmin);

/**
 * POST /admin/billing/process
 * Process all subscriptions due for billing
 */
router.post('/admin/billing/process', async (req, res) => {
  try {
    console.log('Manual billing process triggered');
    const results = await BillingService.processAllDueBilling();

    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in manual billing process:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /admin/billing/due
 * Get all subscriptions due for billing (preview)
 */
router.get('/admin/billing/due', async (req, res) => {
  try {
    const subscriptionsDue = await BillingService.getSubscriptionsDueBilling();

    res.json({
      success: true,
      count: subscriptionsDue.length,
      subscriptions: subscriptionsDue.map(sub => ({
        bakeryId: sub.bakeryId,
        status: sub.subscription.status,
        tier: sub.subscription.tier,
        nextBillingDate: sub.nextBillingDate,
        consecutiveFailures: sub.subscription.consecutiveFailures || 0,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting subscriptions due:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /admin/billing/retry/:bakeryId
 * Retry billing for a specific bakery
 */
router.post('/admin/billing/retry/:bakeryId', async (req, res) => {
  try {
    const { bakeryId } = req.params;
    const { recurringPaymentId } = req.body;

    if (!recurringPaymentId) {
      return res.status(400).json({
        success: false,
        error: 'recurringPaymentId is required',
      });
    }

    const result = await BillingService.retrySubscriptionPayment(recurringPaymentId, bakeryId);

    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error retrying subscription payment:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
