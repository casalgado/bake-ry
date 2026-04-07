const { getDateInColombia } = require('../../utils/dateUtils');

describe('dateUtils', () => {
  describe('getDateInColombia', () => {
    it('should convert UTC midnight to Colombia date', () => {
      // UTC midnight should be previous day in Colombia (UTC-5)
      const result = getDateInColombia('2026-04-01T00:00:00.000Z');
      expect(result).toBe('2026-03-31');
    });

    it('should convert UTC noon to same Colombia date', () => {
      // UTC noon should be same day in Colombia
      const result = getDateInColombia('2026-04-01T12:00:00.000Z');
      expect(result).toBe('2026-04-01');
    });

    it('should handle Date objects', () => {
      const date = new Date('2026-04-01T12:00:00.000Z');
      const result = getDateInColombia(date);
      expect(result).toBe('2026-04-01');
    });

    it('should return null for invalid dates', () => {
      expect(getDateInColombia('invalid-date')).toBeNull();
      expect(getDateInColombia(null)).toBeNull();
      expect(getDateInColombia(undefined)).toBeNull();
    });
  });
});