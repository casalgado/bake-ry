const BillingService = require('../../services/billingService');

// Mock the dependencies
jest.mock('../../services/payuTransactionService');
jest.mock('../../services/bakeryUserService');
jest.mock('../../services/bakerySettingsService');

const payuTransactionService = require('../../services/payuTransactionService');
const bakeryUserService = require('../../services/bakeryUserService');
const bakerySettingsService = require('../../services/bakerySettingsService');

describe('BillingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processAllDueBilling', () => {
    it('should handle no subscriptions due for billing', async () => {
      payuTransactionService.getSubscriptionsDueForBilling.mockResolvedValue([]);

      const result = await BillingService.processAllDueBilling();

      expect(result).toEqual({
        processed: 0,
        successful: 0,
        failed: 0,
        suspended: 0,
        errors: [],
        message: 'No subscriptions due for billing'
      });
    });

    it('should process multiple subscriptions successfully', async () => {
      const mockSubscriptions = [
        {
          bakeryId: 'bakery-1',
          recurringPaymentId: 'payment-1',
          subscription: {
            status: 'PAYMENT_FAILED',
            tier: 'BASIC',
            consecutiveFailures: 1,
          },
        },
        {
          bakeryId: 'bakery-2',
          recurringPaymentId: 'payment-2',
          subscription: {
            status: 'PAYMENT_FAILED',
            tier: 'BASIC',
            consecutiveFailures: 0,
          },
        },
      ];

      payuTransactionService.getSubscriptionsDueForBilling.mockResolvedValue(mockSubscriptions);
      
      // Mock successful payments
      payuTransactionService.processMonthlyBilling
        .mockResolvedValueOnce({ status: 'APPROVED', id: 'tx-1' })
        .mockResolvedValueOnce({ status: 'APPROVED', id: 'tx-2' });

      bakerySettingsService.patch.mockResolvedValue({});
      bakeryUserService.refreshAllBakeryUserTokens.mockResolvedValue();

      const result = await BillingService.processAllDueBilling();

      expect(result).toEqual({
        processed: 2,
        successful: 2,
        failed: 0,
        suspended: 0,
        errors: [],
      });

      expect(payuTransactionService.processMonthlyBilling).toHaveBeenCalledTimes(2);
      expect(bakerySettingsService.patch).toHaveBeenCalledTimes(2);
      expect(bakeryUserService.refreshAllBakeryUserTokens).toHaveBeenCalledTimes(2);
    });

    it('should handle payment failures correctly', async () => {
      const mockSubscription = {
        bakeryId: 'bakery-1',
        recurringPaymentId: 'payment-1',
        subscription: {
          status: 'ACTIVE',
          tier: 'BASIC',
          consecutiveFailures: 1,
        },
      };

      payuTransactionService.getSubscriptionsDueForBilling.mockResolvedValue([mockSubscription]);
      payuTransactionService.processMonthlyBilling.mockResolvedValue({ status: 'DECLINED', id: 'tx-1' });
      bakerySettingsService.patch.mockResolvedValue({});
      bakeryUserService.refreshAllBakeryUserTokens.mockResolvedValue();

      const result = await BillingService.processAllDueBilling();

      expect(result).toEqual({
        processed: 1,
        successful: 0,
        failed: 1,
        suspended: 0,
        errors: [],
      });

      expect(bakerySettingsService.patch).toHaveBeenCalledWith('default', {
        subscription: {
          status: 'PAYMENT_FAILED',
          consecutiveFailures: 2,
          updatedAt: expect.any(Date),
        },
      }, 'bakery-1');
    });

    it('should suspend subscription after 3 failures', async () => {
      const mockSubscription = {
        bakeryId: 'bakery-1',
        recurringPaymentId: 'payment-1',
        subscription: {
          status: 'PAYMENT_FAILED',
          tier: 'BASIC',
          consecutiveFailures: 2,
        },
      };

      payuTransactionService.getSubscriptionsDueForBilling.mockResolvedValue([mockSubscription]);
      payuTransactionService.processMonthlyBilling.mockResolvedValue({ status: 'DECLINED', id: 'tx-1' });
      bakerySettingsService.patch.mockResolvedValue({});
      bakeryUserService.refreshAllBakeryUserTokens.mockResolvedValue();

      const result = await BillingService.processAllDueBilling();

      expect(result).toEqual({
        processed: 1,
        successful: 0,
        failed: 0,
        suspended: 1,
        errors: [],
      });

      expect(bakerySettingsService.patch).toHaveBeenCalledWith('default', {
        subscription: {
          status: 'SUSPENDED',
          consecutiveFailures: 3,
          updatedAt: expect.any(Date),
        },
      }, 'bakery-1');
    });

    it('should handle errors gracefully', async () => {
      const mockSubscription = {
        bakeryId: 'bakery-1',
        recurringPaymentId: 'payment-1',
        subscription: {
          status: 'ACTIVE',
          tier: 'BASIC',
          consecutiveFailures: 0,
        },
      };

      payuTransactionService.getSubscriptionsDueForBilling.mockResolvedValue([mockSubscription]);
      payuTransactionService.processMonthlyBilling.mockRejectedValue(new Error('Payment processing failed'));

      const result = await BillingService.processAllDueBilling();

      expect(result).toEqual({
        processed: 0,
        successful: 0,
        failed: 0,
        suspended: 0,
        errors: [{
          bakeryId: 'bakery-1',
          error: 'Payment processing failed',
        }],
      });
    });
  });

  describe('processSingleSubscription', () => {
    it('should process successful payment', async () => {
      const mockSubscription = {
        bakeryId: 'bakery-1',
        recurringPaymentId: 'payment-1',
        subscription: {
          status: 'ACTIVE',
          tier: 'BASIC',
          consecutiveFailures: 1,
        },
      };

      payuTransactionService.processMonthlyBilling.mockResolvedValue({ status: 'APPROVED', id: 'tx-1' });
      bakerySettingsService.patch.mockResolvedValue({});
      bakeryUserService.refreshAllBakeryUserTokens.mockResolvedValue();

      const result = await BillingService.processSingleSubscription(mockSubscription);

      expect(result).toEqual({
        bakeryId: 'bakery-1',
        paymentResult: { status: 'APPROVED', id: 'tx-1' },
        newStatus: 'ACTIVE',
        consecutiveFailures: 0,
        success: true,
        suspended: false,
      });

      expect(bakerySettingsService.patch).toHaveBeenCalledWith('default', {
        subscription: {
          status: 'ACTIVE',
          consecutiveFailures: 0,
          updatedAt: expect.any(Date),
        },
      }, 'bakery-1');
    });

    it('should handle token refresh failures gracefully', async () => {
      const mockSubscription = {
        bakeryId: 'bakery-1',
        recurringPaymentId: 'payment-1',
        subscription: {
          status: 'PAYMENT_FAILED',
          tier: 'BASIC',
          consecutiveFailures: 0,
        },
      };

      payuTransactionService.processMonthlyBilling.mockResolvedValue({ status: 'APPROVED', id: 'tx-1' });
      bakerySettingsService.patch.mockResolvedValue({});
      bakeryUserService.refreshAllBakeryUserTokens.mockRejectedValue(new Error('Token refresh failed'));

      const result = await BillingService.processSingleSubscription(mockSubscription);

      expect(result.success).toBe(true);
      // Should not throw error even if token refresh fails
    });
  });

  describe('getSubscriptionsDueBilling', () => {
    it('should return subscriptions due for billing', async () => {
      const mockSubscriptions = [
        { bakeryId: 'bakery-1', recurringPaymentId: 'payment-1' },
        { bakeryId: 'bakery-2', recurringPaymentId: 'payment-2' },
      ];

      payuTransactionService.getSubscriptionsDueForBilling.mockResolvedValue(mockSubscriptions);

      const result = await BillingService.getSubscriptionsDueBilling();

      expect(result).toEqual(mockSubscriptions);
      expect(payuTransactionService.getSubscriptionsDueForBilling).toHaveBeenCalledTimes(1);
    });
  });

  describe('retrySubscriptionPayment', () => {
    it('should retry payment for specific subscription', async () => {
      const mockSettings = {
        subscription: {
          status: 'PAYMENT_FAILED',
          tier: 'BASIC',
          recurringPaymentId: 'payment-1',
          consecutiveFailures: 1,
        },
      };

      bakerySettingsService.getById.mockResolvedValue(mockSettings);
      payuTransactionService.processMonthlyBilling.mockResolvedValue({ status: 'APPROVED', id: 'tx-1' });
      bakerySettingsService.patch.mockResolvedValue({});
      bakeryUserService.refreshAllBakeryUserTokens.mockResolvedValue();

      const result = await BillingService.retrySubscriptionPayment('payment-1', 'bakery-1');

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('ACTIVE');
      expect(bakerySettingsService.getById).toHaveBeenCalledWith('default', 'bakery-1');
    });

    it('should throw error for invalid subscription', async () => {
      const mockSettings = {
        subscription: {
          recurringPaymentId: 'different-payment-id',
        },
      };

      bakerySettingsService.getById.mockResolvedValue(mockSettings);

      await expect(
        BillingService.retrySubscriptionPayment('payment-1', 'bakery-1')
      ).rejects.toThrow('Invalid subscription or recurring payment ID');
    });
  });

  describe('handlePaymentFailure', () => {
    it('should handle payment failure and update status', async () => {
      const mockSettings = {
        subscription: {
          status: 'ACTIVE',
          tier: 'BASIC',
          recurringPaymentId: 'payment-1',
          consecutiveFailures: 0,
        },
      };

      const transactionData = {
        parentRecurringId: 'payment-1',
        status: 'DECLINED',
      };

      bakerySettingsService.getById.mockResolvedValue(mockSettings);
      bakerySettingsService.patch.mockResolvedValue({});
      bakeryUserService.refreshAllBakeryUserTokens.mockResolvedValue();

      await BillingService.handlePaymentFailure('bakery-1', 'tx-1', transactionData);

      expect(bakerySettingsService.patch).toHaveBeenCalledWith('default', {
        subscription: {
          status: 'PAYMENT_FAILED',
          consecutiveFailures: 1,
          updatedAt: expect.any(Date),
        },
      }, 'bakery-1');
    });

    it('should suspend subscription after 3 failures', async () => {
      const mockSettings = {
        subscription: {
          status: 'PAYMENT_FAILED',
          tier: 'BASIC',
          recurringPaymentId: 'payment-1',
          consecutiveFailures: 2,
        },
      };

      const transactionData = {
        parentRecurringId: 'payment-1',
        status: 'DECLINED',
      };

      bakerySettingsService.getById.mockResolvedValue(mockSettings);
      bakerySettingsService.patch.mockResolvedValue({});
      bakeryUserService.refreshAllBakeryUserTokens.mockResolvedValue();

      await BillingService.handlePaymentFailure('bakery-1', 'tx-1', transactionData);

      expect(bakerySettingsService.patch).toHaveBeenCalledWith('default', {
        subscription: {
          status: 'SUSPENDED',
          consecutiveFailures: 3,
          updatedAt: expect.any(Date),
        },
      }, 'bakery-1');
    });

    it('should ignore unrelated payment failures', async () => {
      const mockSettings = {
        subscription: {
          recurringPaymentId: 'different-payment-id',
        },
      };

      const transactionData = {
        parentRecurringId: 'payment-1',
        status: 'DECLINED',
      };

      bakerySettingsService.getById.mockResolvedValue(mockSettings);

      await BillingService.handlePaymentFailure('bakery-1', 'tx-1', transactionData);

      expect(bakerySettingsService.patch).not.toHaveBeenCalled();
      expect(bakeryUserService.refreshAllBakeryUserTokens).not.toHaveBeenCalled();
    });
  });
});