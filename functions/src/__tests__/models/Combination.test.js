const Combination = require('../../models/Combination');

describe('Combination Model', () => {
  describe('constructor', () => {
    it('should create a combination with default values', () => {
      const combination = new Combination();

      expect(combination.id).toBeDefined();
      expect(combination.selection).toEqual([]);
      expect(combination.name).toBe('');
      expect(combination.basePrice).toBe(0);
      expect(combination.currentPrice).toBe(0);
      expect(combination.costPrice).toBe(0);
      expect(combination.isWholeGrain).toBe(false);
      expect(combination.isActive).toBe(true);
    });

    it('should create a combination with provided data', () => {
      const data = {
        id: 'test-id',
        selection: ['vanilla', 'chocolate'],
        name: 'vanilla chocolate',
        basePrice: 100,
        currentPrice: 120,
        costPrice: 80,
        isWholeGrain: true,
        isActive: false,
      };

      const combination = new Combination(data);

      expect(combination.id).toBe('test-id');
      expect(combination.selection).toEqual(['Vanilla', 'Chocolate']);
      expect(combination.name).toBe('Vanilla Chocolate');
      expect(combination.basePrice).toBe(100);
      expect(combination.currentPrice).toBe(120);
      expect(combination.costPrice).toBe(80);
      expect(combination.isWholeGrain).toBe(true);
      expect(combination.isActive).toBe(false);
    });

    it('should fallback currentPrice to basePrice when not provided', () => {
      const data = {
        basePrice: 150,
      };

      const combination = new Combination(data);

      expect(combination.basePrice).toBe(150);
      expect(combination.currentPrice).toBe(150);
    });
  });

  describe('fromLegacyVariation', () => {
    it('should convert legacy variation with all parameters', () => {
      const variation = {
        id: 'legacy-id',
        name: 'completo',
        value: 12,
        isWholeGrain: false,
        unit: '',
      };

      const combination = Combination.fromLegacyVariation(variation, 198000, 180000);

      expect(combination.id).toBe('legacy-id');
      expect(combination.selection).toEqual(['Completo']);
      expect(combination.name).toBe('Completo');
      expect(combination.basePrice).toBe(180000);
      expect(combination.currentPrice).toBe(198000);
      expect(combination.isWholeGrain).toBe(false);
      expect(combination.isActive).toBe(true);
    });

    it('should handle legacy variation with null basePrice parameter', () => {
      const variation = {
        id: 'legacy-id',
        name: 'vanilla villain',
        basePrice: 150000,
      };

      const combination = Combination.fromLegacyVariation(variation, 198000, null);

      expect(combination.basePrice).toBe(150000); // Should fallback to variation.basePrice
      expect(combination.currentPrice).toBe(198000);
    });

    it('should handle legacy variation without basePrice in both parameters and variation', () => {
      const variation = {
        id: 'legacy-id',
        name: 'test cake',
      };

      const combination = Combination.fromLegacyVariation(variation, 100000, null);

      expect(combination.basePrice).toBe(0); // Should fallback to 0
      expect(combination.currentPrice).toBe(100000);
    });

    it('should handle legacy variation without currentPrice', () => {
      const variation = {
        id: 'legacy-id',
        name: 'test cake',
        basePrice: 120000,
      };

      const combination = Combination.fromLegacyVariation(variation, null, 100000);

      expect(combination.basePrice).toBe(100000);
      expect(combination.currentPrice).toBe(120000); // Should fallback to variation.basePrice
    });

    it('should handle legacy variation without name by finding first truthy property', () => {
      const variation = {
        id: 'legacy-id',
        size: 'large',
        flavor: 'chocolate',
      };

      const combination = Combination.fromLegacyVariation(variation, 150000, 130000);

      expect(combination.name).toBe('Size'); // Should pick first truthy property key
      expect(combination.selection).toEqual(['Size']);
    });

    it('should handle legacy variation with completely empty data', () => {
      const variation = {
        id: 'legacy-id',
      };

      const combination = Combination.fromLegacyVariation(variation, 100000, 90000);

      expect(combination.name).toBe('Unknown');
      expect(combination.selection).toEqual(['Unknown']);
      expect(combination.basePrice).toBe(90000);
      expect(combination.currentPrice).toBe(100000);
    });

    it('should generate ID when variation has no ID', () => {
      const variation = {
        name: 'test',
      };

      const combination = Combination.fromLegacyVariation(variation, 100000, 90000);

      expect(combination.id).toBeDefined();
      expect(combination.id).not.toBe('');
    });

    it('should handle real-world migration case from your database', () => {
      // This is the exact variation structure from your database
      const variation = {
        id: 'MCgDthGe4Z9Zu36C',
        isWholeGrain: false,
        name: 'completo',
        unit: '',
        value: 12,
      };

      // Base price from order item was 198000, current price was also 198000
      const combination = Combination.fromLegacyVariation(variation, 198000, 198000);

      expect(combination.id).toBe('MCgDthGe4Z9Zu36C');
      expect(combination.name).toBe('Completo');
      expect(combination.selection).toEqual(['Completo']);
      expect(combination.basePrice).toBe(198000);
      expect(combination.currentPrice).toBe(198000);
      expect(combination.isWholeGrain).toBe(false);
      expect(combination.isActive).toBe(true);
    });
  });

  describe('getTotalPrice', () => {
    it('should calculate total price with quantity', () => {
      const combination = new Combination({
        currentPrice: 100,
      });

      expect(combination.getTotalPrice(3)).toBe(300);
    });

    it('should default to quantity 1', () => {
      const combination = new Combination({
        currentPrice: 150,
      });

      expect(combination.getTotalPrice()).toBe(150);
    });
  });

  describe('getDisplayName', () => {
    it('should return name when available', () => {
      const combination = new Combination({
        name: 'Custom Name',
        selection: ['Vanilla', 'Chocolate'],
      });

      expect(combination.getDisplayName()).toBe('Custom Name');
    });

    it('should return joined selection when no name', () => {
      const combination = new Combination({
        selection: ['Vanilla', 'Chocolate', 'Strawberry'],
      });

      expect(combination.getDisplayName()).toBe('Vanilla + Chocolate + Strawberry');
    });

    it('should return empty string when no name or selection', () => {
      const combination = new Combination();

      expect(combination.getDisplayName()).toBe('');
    });
  });

  describe('isLegacyVariation', () => {
    it('should return true for single selection (legacy)', () => {
      const combination = new Combination({
        selection: ['Vanilla'],
      });

      expect(combination.isLegacyVariation()).toBe(true);
    });

    it('should return false for multiple selections', () => {
      const combination = new Combination({
        selection: ['Vanilla', 'Chocolate'],
      });

      expect(combination.isLegacyVariation()).toBe(false);
    });

    it('should return false for empty selection', () => {
      const combination = new Combination();

      expect(combination.isLegacyVariation()).toBe(false);
    });
  });

  describe('toFirestore', () => {
    it('should return clean object for Firestore', () => {
      const combination = new Combination({
        id: 'test-id',
        selection: ['Vanilla', null, 'Chocolate', undefined],
        name: 'Test Combo',
        basePrice: 100,
        currentPrice: 120,
        costPrice: 80,
        isWholeGrain: true,
        isActive: false,
      });

      const result = combination.toFirestore();

      expect(result).toEqual({
        id: 'test-id',
        selection: ['Vanilla', 'Chocolate'], // Should filter out null/undefined
        name: 'Test Combo',
        basePrice: 100,
        currentPrice: 120,
        costPrice: 80,
        isWholeGrain: true,
        isActive: false,
      });
    });
  });

  describe('toPlainObject', () => {
    it('should return clean plain object', () => {
      const combination = new Combination({
        id: 'test-id',
        selection: ['Vanilla', null, 'Chocolate'],
        name: 'Test Combo',
        basePrice: 100,
        currentPrice: 120,
      });

      const result = combination.toPlainObject();

      expect(result).toEqual({
        id: 'test-id',
        selection: ['Vanilla', 'Chocolate'], // Should filter out null/undefined
        name: 'Test Combo',
        basePrice: 100,
        currentPrice: 120,
        costPrice: 0,
        isWholeGrain: false,
        isActive: true,
      });
    });
  });
});
