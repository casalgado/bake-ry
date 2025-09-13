const BaseModel = require('./base/BaseModel');
const { generateId } = require('../utils/helpers');

class IngredientCategory {
  constructor({
    id = generateId(),
    name,
    description = '',
    displayOrder = 0,
    isActive = true,
  }) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.displayOrder = displayOrder;
    this.isActive = isActive;
  }

  toPlainObject() {
    const data = { ...this };
    Object.keys(data).forEach((key) => {
      if (data[key] === undefined) {
        delete data[key];
      }
    });
    return data;
  }
}

class BakerySettings extends BaseModel {

  // Subscription constants
  static SUBSCRIPTION_STATUSES = ['TRIAL', 'ACTIVE', 'CANCELLED', 'SUSPENDED', 'PAYMENT_FAILED'];
  static SUBSCRIPTION_TIERS = ['ALWAYS_FREE', 'BASIC', 'PREMIUM'];
  static SUBSCRIPTION_AMOUNT = 99000; // Monthly fee in COP
  static TRIAL_DAYS = 30;
  static GRACE_PERIOD_DAYS = 7;
  static DEFAULT_FEATURES = {
    order: {
      activePaymentMethods: ['cash', 'transfer', 'complimentary'],
      allowPartialPayment: false,
      defaultDate: 'production', // options are production or delivery
      timeOfDay: false, // if time of day is asked for orders
      offlineMode: false,
    },
    reports: {
      defaultReportFilter: 'dueDate',
      showMultipleReports: false,
    },
    users: {
      collectLegalName: false,
    },
    products: {
      useProductCost: false,
    },

  };

  constructor({
    id,
    bakeryId,
    ingredientCategories = [],
    theme = {},
    features,
    suggestedProductVariations = {},
    subscription = null,
    createdAt,
    updatedAt,
  }) {
    super({ id, createdAt, updatedAt });

    this.bakeryId = bakeryId;
    this.ingredientCategories = ingredientCategories.map((cat) =>
      cat instanceof IngredientCategory ? cat : new IngredientCategory(cat),
    );

    this.suggestedProductVariations = suggestedProductVariations;
    this.theme = theme;
    this.features = this.mergeWithDefaults(features, BakerySettings.DEFAULT_FEATURES);

    // Initialize subscription
    this.subscription = this.initializeSubscription(subscription);
  }

  getCategoryById(categoryId) {
    return this.ingredientCategories.find((cat) => cat.id === categoryId);
  }

  mergeWithDefaults(userFeatures, defaults) {
    if (!userFeatures) return { ...defaults };

    const merged = { ...defaults };

    for (const [key, value] of Object.entries(userFeatures)) {
      if (value && typeof value === 'object' && !Array.isArray(value) && defaults[key] && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
        merged[key] = { ...defaults[key], ...value };
      } else {
        merged[key] = value;
      }
    }

    return merged;
  }

  // Initialize subscription object with defaults
  initializeSubscription(subscription) {
    if (!subscription) {
      return {
        status: 'TRIAL',
        tier: 'BASIC',
        subscriptionStartDate: this.createdAt || new Date(),
        amount: BakerySettings.SUBSCRIPTION_AMOUNT,
        currency: 'COP',
        savedCardId: null,
        recurringPaymentId: null,
        consecutiveFailures: 0,
        createdAt: this.createdAt || new Date(),
        updatedAt: this.updatedAt || new Date(),
      };
    }

    // Ensure required fields exist
    return {
      status: subscription.status || 'TRIAL',
      tier: subscription.tier || 'BASIC',
      subscriptionStartDate: this.constructor.ensureDate(subscription.subscriptionStartDate) || this.createdAt || new Date(),
      amount: subscription.amount || BakerySettings.SUBSCRIPTION_AMOUNT,
      currency: subscription.currency || 'COP',
      savedCardId: subscription.savedCardId || null,
      recurringPaymentId: subscription.recurringPaymentId || null,
      consecutiveFailures: subscription.consecutiveFailures || 0,
      createdAt: this.constructor.ensureDate(subscription.createdAt) || this.createdAt || new Date(),
      updatedAt: this.constructor.ensureDate(subscription.updatedAt) || this.updatedAt || new Date(),
    };
  }

  // Calculate trial end date
  getTrialEndDate() {
    if (!this.subscription?.subscriptionStartDate) return null;
    const trialEnd = new Date(this.subscription.subscriptionStartDate);
    trialEnd.setDate(trialEnd.getDate() + BakerySettings.TRIAL_DAYS);
    return trialEnd;
  }

  // Calculate next billing date
  getNextBillingDate() {
    if (this.subscription?.tier === 'ALWAYS_FREE') return null;
    if (!this.subscription?.subscriptionStartDate) return null;

    const trialEnd = this.getTrialEndDate();
    const now = new Date();

    // If still in trial, next billing is at trial end
    if (now < trialEnd) {
      return trialEnd;
    }

    // Calculate next monthly billing date after trial end
    let nextBilling = new Date(trialEnd);

    // Keep adding months until we get to a future date
    while (nextBilling <= now) {
      nextBilling.setMonth(nextBilling.getMonth() + 1);
    }

    return nextBilling;
  }

  // Calculate grace period end date (from the last billing attempt)
  getGracePeriodEndDate() {
    if (this.subscription?.tier === 'ALWAYS_FREE') return null;
    if (!this.subscription?.subscriptionStartDate) return null;

    const trialEnd = this.getTrialEndDate();
    const now = new Date();

    // If still in trial, no grace period needed
    if (now < trialEnd) {
      return null;
    }

    // Find the last billing date that has passed
    let lastBilling = new Date(trialEnd);
    while (lastBilling.getMonth() < now.getMonth() || lastBilling.getFullYear() < now.getFullYear()) {
      const nextMonth = new Date(lastBilling);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      if (nextMonth <= now) {
        lastBilling = nextMonth;
      } else {
        break;
      }
    }

    // Grace period is 7 days after the last billing date
    const gracePeriodEnd = new Date(lastBilling);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + BakerySettings.GRACE_PERIOD_DAYS);
    return gracePeriodEnd;
  }

  // Check if subscription is in trial
  isInTrial() {
    if (this.subscription?.tier === 'ALWAYS_FREE') return false;
    const trialEnd = this.getTrialEndDate();
    return trialEnd && new Date() < trialEnd;
  }

  // Check if subscription allows write operations
  canWrite() {
    if (!this.subscription) return false;

    const { status, tier } = this.subscription;

    // ALWAYS_FREE tier can always write
    if (tier === 'ALWAYS_FREE') return true;

    // Active subscriptions and trials can write
    if (['TRIAL', 'ACTIVE', 'PAYMENT_FAILED'].includes(status)) {
      // During grace period, allow writes even with PAYMENT_FAILED
      if (status === 'PAYMENT_FAILED') {
        const gracePeriodEnd = this.getGracePeriodEndDate();
        return gracePeriodEnd && new Date() < gracePeriodEnd;
      }
      return true;
    }

    return false;
  }

  // Check if subscription needs billing
  needsBilling() {
    if (this.subscription?.tier === 'ALWAYS_FREE') return false;
    if (this.subscription?.status !== 'ACTIVE' && this.subscription?.status !== 'TRIAL') return false;

    const trialEnd = this.getTrialEndDate();
    const now = new Date();

    // If still in trial, no billing needed
    if (now < trialEnd) return false;

    // If trial has ended, billing is needed
    return true;
  }

  // Firestore data conversion
  toFirestore() {
    const data = super.toFirestore();
    data.ingredientCategories = this.ingredientCategories.map((cat) =>
      cat.toPlainObject(),
    );
    return data;
  }

  static fromFirestore(doc) {
    const data = doc.data();
    return new BakerySettings({
      id: doc.id,
      ...data,
    });
  }
}

module.exports = {
  BakerySettings,
  IngredientCategory,
};
