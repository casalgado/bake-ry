const { BakerySettings } = require('../../models/BakerySettings');

describe('BakerySettings - Subscription Functionality', () => {
  let bakerySettings;

  beforeEach(() => {
    bakerySettings = new BakerySettings({
      id: 'test-settings',
      bakeryId: 'test-bakery',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-01T10:00:00Z'),
    });
  });

  describe('subscription initialization', () => {
    it('should initialize subscription with default values when none provided', () => {
      expect(bakerySettings.subscription).toBeDefined();
      expect(bakerySettings.subscription.status).toBe('TRIAL');
      expect(bakerySettings.subscription.tier).toBe('BASIC');
      expect(bakerySettings.subscription.amount).toBe(99000);
      expect(bakerySettings.subscription.currency).toBe('COP');
      expect(bakerySettings.subscription.consecutiveFailures).toBe(0);
    });

    it('should use provided subscription values', () => {
      const customSubscription = {
        status: 'ACTIVE',
        tier: 'PREMIUM',
        amount: 150000,
        savedCardId: 'card-123',
        consecutiveFailures: 2,
      };

      const settings = new BakerySettings({
        bakeryId: 'test',
        subscription: customSubscription,
      });

      expect(settings.subscription.status).toBe('ACTIVE');
      expect(settings.subscription.tier).toBe('PREMIUM');
      expect(settings.subscription.amount).toBe(150000);
      expect(settings.subscription.savedCardId).toBe('card-123');
      expect(settings.subscription.consecutiveFailures).toBe(2);
    });
  });

  describe('trial calculations', () => {
    it('should calculate trial end date correctly', () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      bakerySettings.subscription.subscriptionStartDate = startDate;

      const trialEnd = bakerySettings.getTrialEndDate();
      const expectedEnd = new Date('2024-01-31T00:00:00Z');

      expect(trialEnd.getTime()).toBe(expectedEnd.getTime());
    });

    it('should return null trial end date if no start date', () => {
      bakerySettings.subscription.subscriptionStartDate = null;
      expect(bakerySettings.getTrialEndDate()).toBeNull();
    });

    it('should correctly identify if subscription is in trial', () => {
      // Set start date to 20 days ago
      const twentyDaysAgo = new Date();
      twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
      bakerySettings.subscription.subscriptionStartDate = twentyDaysAgo;

      expect(bakerySettings.isInTrial()).toBe(true);

      // Set start date to 40 days ago (past trial period)
      const fortyDaysAgo = new Date();
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);
      bakerySettings.subscription.subscriptionStartDate = fortyDaysAgo;

      expect(bakerySettings.isInTrial()).toBe(false);
    });

    it('should return false for trial if tier is ALWAYS_FREE', () => {
      bakerySettings.subscription.tier = 'ALWAYS_FREE';
      expect(bakerySettings.isInTrial()).toBe(false);
    });
  });

  describe('billing date calculations', () => {
    it('should return trial end as next billing date during trial', () => {
      // Set start date to 10 days ago (still in trial)
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      bakerySettings.subscription.subscriptionStartDate = tenDaysAgo;

      const nextBilling = bakerySettings.getNextBillingDate();
      const trialEnd = bakerySettings.getTrialEndDate();

      expect(nextBilling.getTime()).toBe(trialEnd.getTime());
    });

    it('should return null for ALWAYS_FREE tier', () => {
      bakerySettings.subscription.tier = 'ALWAYS_FREE';
      expect(bakerySettings.getNextBillingDate()).toBeNull();
    });

    it('should calculate next billing date after trial period', () => {
      // Set start date to 40 days ago (past trial)
      const fortyDaysAgo = new Date();
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);
      bakerySettings.subscription.subscriptionStartDate = fortyDaysAgo;

      const nextBilling = bakerySettings.getNextBillingDate();
      expect(nextBilling).toBeDefined();
      expect(nextBilling > new Date()).toBe(true);
    });
  });

  describe('grace period calculations', () => {
    it('should return null grace period during trial', () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      bakerySettings.subscription.subscriptionStartDate = tenDaysAgo;

      const gracePeriodEnd = bakerySettings.getGracePeriodEndDate();
      expect(gracePeriodEnd).toBeNull(); // Should be null during trial
    });

    it('should return null grace period for ALWAYS_FREE tier', () => {
      bakerySettings.subscription.tier = 'ALWAYS_FREE';
      expect(bakerySettings.getGracePeriodEndDate()).toBeNull();
    });

    it('should calculate grace period end date after trial', () => {
      // Set subscription to have ended trial and be in first billing cycle
      const fortyDaysAgo = new Date();
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);
      bakerySettings.subscription.subscriptionStartDate = fortyDaysAgo;

      const gracePeriodEnd = bakerySettings.getGracePeriodEndDate();
      expect(gracePeriodEnd).toBeDefined();
      expect(gracePeriodEnd instanceof Date).toBe(true);
    });
  });

  describe('write permissions', () => {
    it('should allow writes for ALWAYS_FREE tier', () => {
      bakerySettings.subscription.tier = 'ALWAYS_FREE';
      bakerySettings.subscription.status = 'SUSPENDED'; // Even if suspended
      expect(bakerySettings.canWrite()).toBe(true);
    });

    it('should allow writes for TRIAL status', () => {
      bakerySettings.subscription.status = 'TRIAL';
      expect(bakerySettings.canWrite()).toBe(true);
    });

    it('should allow writes for ACTIVE status', () => {
      bakerySettings.subscription.status = 'ACTIVE';
      expect(bakerySettings.canWrite()).toBe(true);
    });

    it('should allow writes for PAYMENT_FAILED during grace period', () => {
      // Set subscription to have ended trial but be within grace period
      const thirtyFiveDaysAgo = new Date();
      thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35); // Just past trial
      bakerySettings.subscription.subscriptionStartDate = thirtyFiveDaysAgo;
      bakerySettings.subscription.status = 'PAYMENT_FAILED';

      expect(bakerySettings.canWrite()).toBe(true);
    });

    it('should block writes for PAYMENT_FAILED after grace period', () => {
      // Set dates so we're past grace period
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      bakerySettings.subscription.subscriptionStartDate = sixtyDaysAgo;
      bakerySettings.subscription.status = 'PAYMENT_FAILED';

      expect(bakerySettings.canWrite()).toBe(false);
    });

    it('should block writes for SUSPENDED status', () => {
      bakerySettings.subscription.status = 'SUSPENDED';
      expect(bakerySettings.canWrite()).toBe(false);
    });

    it('should block writes for CANCELLED status', () => {
      bakerySettings.subscription.status = 'CANCELLED';
      expect(bakerySettings.canWrite()).toBe(false);
    });
  });

  describe('billing necessity', () => {
    it('should return false for ALWAYS_FREE tier', () => {
      bakerySettings.subscription.tier = 'ALWAYS_FREE';
      bakerySettings.subscription.status = 'ACTIVE';
      expect(bakerySettings.needsBilling()).toBe(false);
    });

    it('should return false for SUSPENDED status', () => {
      bakerySettings.subscription.status = 'SUSPENDED';
      expect(bakerySettings.needsBilling()).toBe(false);
    });

    it('should return false during trial period', () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      bakerySettings.subscription.subscriptionStartDate = tenDaysAgo;
      bakerySettings.subscription.status = 'TRIAL';

      expect(bakerySettings.needsBilling()).toBe(false);
    });

    it('should return true when billing date has passed', () => {
      // Set start date so trial ended and billing is due
      const fortyDaysAgo = new Date();
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);
      bakerySettings.subscription.subscriptionStartDate = fortyDaysAgo;
      bakerySettings.subscription.status = 'ACTIVE';

      expect(bakerySettings.needsBilling()).toBe(true);
    });
  });

  describe('constants', () => {
    it('should have correct subscription constants', () => {
      expect(BakerySettings.SUBSCRIPTION_STATUSES).toEqual([
        'TRIAL', 'ACTIVE', 'CANCELLED', 'SUSPENDED', 'PAYMENT_FAILED',
      ]);
      expect(BakerySettings.SUBSCRIPTION_TIERS).toEqual([
        'ALWAYS_FREE', 'BASIC', 'PREMIUM',
      ]);
      expect(BakerySettings.SUBSCRIPTION_AMOUNT).toBe(99000);
      expect(BakerySettings.TRIAL_DAYS).toBe(30);
      expect(BakerySettings.GRACE_PERIOD_DAYS).toBe(7);
    });
  });

  describe('feature merging', () => {
    it('should use default features when no features provided', () => {
      const settings = new BakerySettings({
        bakeryId: 'test',
      });

      expect(settings.features).toEqual(BakerySettings.DEFAULT_FEATURES);
    });

    it('should merge existing features with defaults', () => {
      const existingFeatures = {
        order: {
          activePaymentMethods: ['card', 'cash'], // Custom value
        },
      };

      const settings = new BakerySettings({
        bakeryId: 'test',
        features: existingFeatures,
      });

      expect(settings.features.order.activePaymentMethods).toEqual(['card', 'cash']);
      expect(settings.features.order.allowPartialPayment).toBe(false); // Default value
      expect(settings.features.order.defaultDate).toBe('production'); // Default value
      expect(settings.features.reports).toEqual(BakerySettings.DEFAULT_FEATURES.reports); // Default section
    });

    it('should preserve existing nested feature values while adding new defaults', () => {
      const existingFeatures = {
        order: {
          activePaymentMethods: ['custom_method'],
          allowPartialPayment: true, // Custom value
        },
        reports: {
          defaultReportFilter: 'customFilter', // Custom value
        },
      };

      const settings = new BakerySettings({
        bakeryId: 'test',
        features: existingFeatures,
      });

      // Preserved custom values
      expect(settings.features.order.activePaymentMethods).toEqual(['custom_method']);
      expect(settings.features.order.allowPartialPayment).toBe(true);
      expect(settings.features.reports.defaultReportFilter).toBe('customFilter');

      // Added default values
      expect(settings.features.order.defaultDate).toBe('production');
      expect(settings.features.order.timeOfDay).toBe(false);
      expect(settings.features.reports.showMultipleReports).toBe(false);
      expect(settings.features.users).toEqual(BakerySettings.DEFAULT_FEATURES.users);
      expect(settings.features.products).toEqual(BakerySettings.DEFAULT_FEATURES.products);
    });

    it('should handle array values correctly in features', () => {
      const existingFeatures = {
        order: {
          activePaymentMethods: ['bank_transfer'], // Array value
        },
      };

      const settings = new BakerySettings({
        bakeryId: 'test',
        features: existingFeatures,
      });

      expect(settings.features.order.activePaymentMethods).toEqual(['bank_transfer']);
      expect(Array.isArray(settings.features.order.activePaymentMethods)).toBe(true);
    });

    it('should add completely new feature sections', () => {
      const existingFeatures = {
        order: {
          activePaymentMethods: ['cash'],
        },
      };

      const settings = new BakerySettings({
        bakeryId: 'test',
        features: existingFeatures,
      });

      // Should have all default sections even if not in existing features
      expect(settings.features.reports).toBeDefined();
      expect(settings.features.users).toBeDefined();
      expect(settings.features.products).toBeDefined();
    });

    it('should simulate fromFirestore scenario with partial features', () => {
      // Simulate what might be stored in Firestore (missing new features)
      const firestoreData = {
        id: 'test-settings',
        bakeryId: 'test-bakery',
        features: {
          order: {
            activePaymentMethods: ['cash', 'transfer'],
            allowPartialPayment: true,
          },
          // Missing 'reports', 'users', 'products' sections that might have been added later
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      // Simulate fromFirestore creating a new instance
      const settings = new BakerySettings(firestoreData);

      // Should preserve existing custom values
      expect(settings.features.order.activePaymentMethods).toEqual(['cash', 'transfer']);
      expect(settings.features.order.allowPartialPayment).toBe(true);

      // Should add new default features that weren't in Firestore
      expect(settings.features.order.defaultDate).toBe('production'); // New default
      expect(settings.features.order.timeOfDay).toBe(false); // New default
      expect(settings.features.reports).toEqual(BakerySettings.DEFAULT_FEATURES.reports); // Entire new section
      expect(settings.features.users).toEqual(BakerySettings.DEFAULT_FEATURES.users); // Entire new section
      expect(settings.features.products).toEqual(BakerySettings.DEFAULT_FEATURES.products); // Entire new section
    });
  });
});
