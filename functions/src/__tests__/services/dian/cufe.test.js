const { computeCufe, toAmount } = require('../../../services/dian/cufe');

describe('dian/cufe', () => {
  // Worked example from the DIAN annex v1.9, §11.2.1
  it('matches the DIAN annex example', () => {
    const cufe = computeCufe({
      number: '323200000129',
      issueDate: '2019-01-16',
      issueTime: '10:53:10-05:00',
      subtotal: 1500000,
      iva: 285000,
      total: 1785000,
      sellerNit: '700085371',
      buyerId: '800199436',
      technicalKey: '693ff6f2a553c3646a063436fd4dd9ded0311471',
      environment: '1',
    });

    expect(cufe).toBe(
      '8bb918b19ba22a694f1da11c643b5e9de39adf60311cf179179e9b33381030bcd4c3c3f156c506ed5908f9276f5bd9b4',
    );
  });

  describe('toAmount', () => {
    it('formats with two decimals', () => {
      expect(toAmount(1500000)).toBe('1500000.00');
      expect(toAmount(0)).toBe('0.00');
    });

    it('truncates instead of rounding', () => {
      expect(toAmount(2.999)).toBe('2.99');
    });

    it('is not fooled by float noise', () => {
      expect(toAmount(1.15)).toBe('1.15');
      expect(toAmount(0.29)).toBe('0.29');
    });
  });
});
