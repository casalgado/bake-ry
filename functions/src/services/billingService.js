const payuTransactionService = require('./payuTransactionService');
const bakeryUserService = require('./bakeryUserService');
const bakerySettingsService = require('./bakerySettingsService');

/**
 * Service for handling subscription billing operations
 * This service provides reusable methods that can be called from any part of the system
 */
class BillingService {
  /**
   * Process all subscriptions that are due for billing
   * @returns {Promise<Object>} Results summary with counts and any errors
   */
  static async processAllDueBilling() {
    console.log('Starting billing process...');

    try {
      // Get all subscriptions that need billing
      const subscriptionsDue = await payuTransactionService.getSubscriptionsDueForBilling();

      if (subscriptionsDue.length === 0) {
        console.log('No subscriptions due for billing');
        return {
          processed: 0,
          successful: 0,
          failed: 0,
          suspended: 0,
          errors: [],
          message: 'No subscriptions due for billing',
        };
      }

      console.log(`Found ${subscriptionsDue.length} subscriptions due for billing`);

      const results = {
        processed: 0,
        successful: 0,
        failed: 0,
        suspended: 0,
        errors: [],
      };

      // Process each subscription
      for (const subscription of subscriptionsDue) {
        try {
          const result = await this.processSingleSubscription(subscription);

          results.processed++;

          if (result.success) {
            results.successful++;
          } else if (result.suspended) {
            results.suspended++;
          } else {
            results.failed++;
          }

        } catch (error) {
          console.error(`Error processing billing for bakery ${subscription.bakeryId}:`, error);
          results.errors.push({
            bakeryId: subscription.bakeryId,
            error: error.message,
          });
        }
      }

      // Log final results
      console.log('Billing process completed:');
      console.log(`  📊 Total processed: ${results.processed}`);
      console.log(`  ✅ Successful payments: ${results.successful}`);
      console.log(`  ⚠️ Failed payments: ${results.failed}`);
      console.log(`  ❌ Subscriptions suspended: ${results.suspended}`);
      console.log(`  🚫 Errors: ${results.errors.length}`);

      if (results.errors.length > 0) {
        console.error('Billing errors:');
        results.errors.forEach(error => {
          console.error(`  - Bakery ${error.bakeryId}: ${error.error}`);
        });
      }

      return results;

    } catch (error) {
      console.error('Fatal error in billing process:', error);
      throw error;
    }
  }

  /**
   * Process billing for a single subscription
   * @param {Object} subscription - The subscription object to process
   * @returns {Promise<Object>} Result of the billing operation
   */
  static async processSingleSubscription(subscription) {
    console.log(`Processing billing for bakery ${subscription.bakeryId}, subscription ${subscription.recurringPaymentId}`);

    // Process the monthly billing
    const paymentResult = await payuTransactionService.processMonthlyBilling(
      subscription.recurringPaymentId,
      subscription.bakeryId,
    );

    // Update subscription status based on payment result
    let newStatus = subscription.subscription.status;
    let consecutiveFailures = subscription.subscription.consecutiveFailures || 0;
    let success = false;
    let suspended = false;

    if (paymentResult.status === 'APPROVED') {
      newStatus = 'ACTIVE';
      consecutiveFailures = 0;
      success = true;
      console.log(`✅ Billing successful for bakery ${subscription.bakeryId}`);
    } else {
      consecutiveFailures++;

      if (consecutiveFailures >= 3) {
        newStatus = 'SUSPENDED';
        suspended = true;
        console.log(`❌ Subscription suspended for bakery ${subscription.bakeryId} after 3 failures`);
      } else {
        newStatus = 'PAYMENT_FAILED';
        console.log(`⚠️ Payment failed for bakery ${subscription.bakeryId} (${consecutiveFailures}/3)`);
      }
    }

    // Update bakery settings with new subscription status
    await bakerySettingsService.patch('default', {
      subscription: {
        status: newStatus,
        consecutiveFailures: consecutiveFailures,
        updatedAt: new Date(),
      },
    }, subscription.bakeryId);

    // Refresh JWT tokens for all bakery users to reflect status change
    if (newStatus !== subscription.subscription.status) {
      try {
        await bakeryUserService.refreshAllBakeryUserTokens(subscription.bakeryId, {
          status: newStatus,
          tier: subscription.subscription.tier,
        });
        console.log(`🔄 Updated JWT tokens for bakery ${subscription.bakeryId} users`);
      } catch (tokenError) {
        console.error(`Failed to refresh tokens for bakery ${subscription.bakeryId}:`, tokenError);
        // Don't fail the entire process if token refresh fails
      }
    }

    return {
      bakeryId: subscription.bakeryId,
      paymentResult,
      newStatus,
      consecutiveFailures,
      success,
      suspended,
    };
  }

  /**
   * Get all subscriptions that are due for billing
   * @returns {Promise<Array>} Array of subscriptions due for billing
   */
  static async getSubscriptionsDueBilling() {
    return await payuTransactionService.getSubscriptionsDueForBilling();
  }

  /**
   * Retry payment for a specific subscription
   * @param {string} recurringPaymentId - The recurring payment ID
   * @param {string} bakeryId - The bakery ID
   * @returns {Promise<Object>} Result of the retry operation
   */
  static async retrySubscriptionPayment(recurringPaymentId, bakeryId) {
    console.log(`Retrying payment for subscription ${recurringPaymentId}, bakery ${bakeryId}`);

    // Get current subscription info
    const settings = await bakerySettingsService.getById('default', bakeryId);

    if (!settings.subscription || settings.subscription.recurringPaymentId !== recurringPaymentId) {
      throw new Error('Invalid subscription or recurring payment ID');
    }

    // Create a mock subscription object for processing
    const mockSubscription = {
      bakeryId,
      recurringPaymentId,
      subscription: settings.subscription,
    };

    return await this.processSingleSubscription(mockSubscription);
  }

  /**
   * Handle payment failure for a subscription (called from Firestore triggers or webhooks)
   * @param {string} bakeryId - The bakery ID
   * @param {string} transactionId - The failed transaction ID
   * @param {Object} transactionData - The transaction data
   * @returns {Promise<void>}
   */
  static async handlePaymentFailure(bakeryId, transactionId, transactionData) {
    console.log(`Payment failure detected for bakery ${bakeryId}, transaction ${transactionId}`);

    try {
      // Get current bakery settings
      const settings = await bakerySettingsService.getById('default', bakeryId);

      if (!settings.subscription ||
          settings.subscription.recurringPaymentId !== transactionData.parentRecurringId) {
        return;
      }

      const consecutiveFailures = (settings.subscription.consecutiveFailures || 0) + 1;
      let newStatus = 'PAYMENT_FAILED';

      // Suspend after 3 consecutive failures
      if (consecutiveFailures >= 3) {
        newStatus = 'SUSPENDED';
        console.log(`Suspending subscription for bakery ${bakeryId} after ${consecutiveFailures} failures`);
      }

      // Update subscription status
      await bakerySettingsService.patch('default', {
        subscription: {
          status: newStatus,
          consecutiveFailures: consecutiveFailures,
          updatedAt: new Date(),
        },
      }, bakeryId);

      // Refresh JWT tokens for all bakery users
      await bakeryUserService.refreshAllBakeryUserTokens(bakeryId, {
        status: newStatus,
        tier: settings.subscription.tier,
      });

      console.log(`Updated subscription status to ${newStatus} for bakery ${bakeryId}`);

    } catch (error) {
      console.error(`Error handling payment failure for bakery ${bakeryId}:`, error);
      throw error;
    }
  }
}

module.exports = BillingService;
