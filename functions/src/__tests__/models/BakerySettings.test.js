const { BakerySettings } = require('../../models/BakerySettings');

describe('BakerySettings - Feature Management', () => {
  let bakerySettings;

  beforeEach(() => {
    bakerySettings = new BakerySettings({
      id: 'test-settings',
      bakeryId: 'test-bakery',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-01T10:00:00Z'),
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
          // Missing 'reports' section that might have been added later
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
    });
  });
});
