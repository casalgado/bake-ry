const functions = require('firebase-functions');
const payuTransactionService = require('../services/payuTransactionService');
const bakeryUserService = require('../services/bakeryUserService');
const bakerySettingsService = require('../services/bakerySettingsService');

/**
 * Scheduled function to process monthly billing for subscriptions
 * Runs daily at 9:00 AM Colombia time to check for subscriptions due for billing
 */
exports.processBilling = functions
  .region('us-central1')
  .pubsub
  .schedule('0 9 * * *') // Daily at 9 AM
  .timeZone('America/Bogota')
  .onRun(async (context) => {
    console.log('Starting scheduled billing process...');

    try {
      // Get all subscriptions that need billing
      const subscriptionsDue = await payuTransactionService.getSubscriptionsDueForBilling();

      if (subscriptionsDue.length === 0) {
        console.log('No subscriptions due for billing');
        return null;
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
          console.log(`Processing billing for bakery ${subscription.bakeryId}, subscription ${subscription.recurringPaymentId}`);

          // Process the monthly billing
          const paymentResult = await payuTransactionService.processMonthlyBilling(
            subscription.recurringPaymentId,
            subscription.bakeryId,
          );

          results.processed++;

          // Update subscription status based on payment result
          let newStatus = subscription.subscription.status;
          let consecutiveFailures = subscription.subscription.consecutiveFailures || 0;

          if (paymentResult.status === 'APPROVED') {
            newStatus = 'ACTIVE';
            consecutiveFailures = 0;
            results.successful++;
            console.log(`✅ Billing successful for bakery ${subscription.bakeryId}`);
          } else {
            consecutiveFailures++;

            if (consecutiveFailures >= 3) {
              newStatus = 'SUSPENDED';
              results.suspended++;
              console.log(`❌ Subscription suspended for bakery ${subscription.bakeryId} after 3 failures`);
            } else {
              newStatus = 'PAYMENT_FAILED';
              results.failed++;
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

        } catch (error) {
          console.error(`Error processing billing for bakery ${subscription.bakeryId}:`, error);
          results.errors.push({
            bakeryId: subscription.bakeryId,
            error: error.message,
          });
        }
      }

      // Log final results
      console.log('Scheduled billing process completed:');
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
      console.error('Fatal error in scheduled billing process:', error);
      throw error;
    }
  });

/**
 * Manual trigger function for processing billing (for testing/admin use)
 * Can be called via HTTP or Cloud Console
 */
exports.triggerBilling = functions
  .region('us-central1')
  .https
  .onRequest(async (req, res) => {
    try {
      // Basic security check - only allow POST requests with a simple token
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      // You can add additional security checks here if needed
      const authToken = req.headers.authorization;
      if (!authToken || !authToken.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      console.log('Manual billing trigger requested');

      // Run the same logic as the scheduled function
      const subscriptionsDue = await payuTransactionService.getSubscriptionsDueForBilling();

      if (subscriptionsDue.length === 0) {
        return res.json({
          message: 'No subscriptions due for billing',
          processed: 0,
        });
      }

      // For manual trigger, we'll just return the count and let the scheduled function handle actual processing
      // This prevents accidental double-billing
      res.json({
        message: `Found ${subscriptionsDue.length} subscriptions due for billing`,
        subscriptions: subscriptionsDue.map(sub => ({
          bakeryId: sub.bakeryId,
          nextBillingDate: sub.nextBillingDate,
          status: sub.subscription.status,
          tier: sub.subscription.tier,
        })),
      });

    } catch (error) {
      console.error('Error in manual billing trigger:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
      });
    }
  });

/**
 * Function to handle subscription status changes due to failed payments
 * This can be called by other parts of the system when payments fail
 */
exports.handlePaymentFailure = functions
  .region('us-central1')
  .firestore
  .document('bakeries/{bakeryId}/payuTransactions/{transactionId}')
  .onUpdate(async (change, context) => {
    const { bakeryId, transactionId } = context.params;
    const before = change.before.data();
    const after = change.after.data();

    // Only process if this is a subscription payment that just failed
    if (after.paymentContext !== 'SUBSCRIPTION' ||
        before.status === after.status ||
        after.status !== 'DECLINED') {
      return null;
    }

    console.log(`Payment failure detected for bakery ${bakeryId}, transaction ${transactionId}`);

    try {
      // Get current bakery settings
      const settings = await bakerySettingsService.getById('default', bakeryId);

      if (!settings.subscription ||
          settings.subscription.recurringPaymentId !== after.parentRecurringId) {
        return null;
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
    }
  });
