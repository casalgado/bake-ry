const BaseModel = require('./base/BaseModel');

class SystemSettings extends BaseModel {
  static DEFAULT_SETTINGS = {
    maintenanceMode: false,
    allowNewRegistrations: true,
    systemNotification: {
      message: '',
      isActive: false,
      type: 'info', // 'info', 'warning', 'error', 'success'
    },
    globalFeatureFlags: {
      enablePayments: true,
      enableSubscriptions: true,
      enableReports: true,
    },
    systemLimits: {
      maxBakeriesPerUser: 5,
      maxOrdersPerDay: 1000,
      maxUsersPerBakery: 50,
    },
  };

  constructor({
    id = 'default',
    maintenanceMode = false,
    allowNewRegistrations = true,
    systemNotification = SystemSettings.DEFAULT_SETTINGS.systemNotification,
    globalFeatureFlags = SystemSettings.DEFAULT_SETTINGS.globalFeatureFlags,
    systemLimits = SystemSettings.DEFAULT_SETTINGS.systemLimits,
    createdAt,
    updatedAt,
  }) {
    super({ id, createdAt, updatedAt });

    this.maintenanceMode = maintenanceMode;
    this.allowNewRegistrations = allowNewRegistrations;
    this.systemNotification = { ...SystemSettings.DEFAULT_SETTINGS.systemNotification, ...systemNotification };
    this.globalFeatureFlags = { ...SystemSettings.DEFAULT_SETTINGS.globalFeatureFlags, ...globalFeatureFlags };
    this.systemLimits = { ...SystemSettings.DEFAULT_SETTINGS.systemLimits, ...systemLimits };
  }

  // Check if system is in maintenance mode
  isInMaintenanceMode() {
    return this.maintenanceMode;
  }

  // Check if new registrations are allowed
  areNewRegistrationsAllowed() {
    return this.allowNewRegistrations && !this.maintenanceMode;
  }

  // Get active system notification
  getActiveNotification() {
    return this.systemNotification?.isActive ? this.systemNotification : null;
  }

  // Check if a global feature is enabled
  isFeatureEnabled(featureName) {
    return this.globalFeatureFlags?.[featureName] === true;
  }

  // Get system limit value
  getSystemLimit(limitName) {
    return this.systemLimits?.[limitName];
  }

  // Firestore data conversion
  static fromFirestore(doc) {
    const data = doc.data();
    return new SystemSettings({
      id: doc.id,
      ...data,
    });
  }
}

module.exports = SystemSettings;
