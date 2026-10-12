const { Order } = require('../../../models/Order');
const { buildInvoiceData, CONSUMIDOR_FINAL } = require('../../../services/dian/invoiceData');

// 19% item at 11,900 (10,000 + 1,900 tax) x2, and an untaxed item at 5,000.
const makeOrder = (overrides = {}) => new Order({
  bakeryId: 'b1',
  userId: 'u1',
  dueDate: new Date('2026-10-20T15:00:00Z'),
  orderItems: [
    { productId: 'p1', productName: 'Torta', quantity: 2, basePrice: 11900, currentPrice: 11900, taxPercentage: 19 },
    { productId: 'p2', productName: 'Pan', quantity: 1, basePrice: 5000, currentPrice: 5000, taxPercentage: 0 },
  ],
  ...overrides,
});

describe('dian/invoiceData', () => {
  it('maps lines and totals so they match the order total', () => {
    const order = makeOrder();
    const data = buildInvoiceData(order);

    expect(data.lines.map((l) => l.base)).toEqual([20000, 5000]);
    expect(data.lines.map((l) => l.taxAmount)).toEqual([3800, 0]);
    expect(data.totals).toEqual({ lineExtension: 25000, taxTotal: 3800, payable: 28800 });
    expect(data.totals.payable).toBe(order.total);
    expect(data.buyer).toBe(CONSUMIDOR_FINAL);
  });

  it('groups taxes by rate', () => {
    const { taxes } = buildInvoiceData(makeOrder());
    expect(taxes).toEqual([
      { rate: 19, base: 20000, amount: 3800 },
      { rate: 0, base: 5000, amount: 0 },
    ]);
  });

  it('adds delivery as an untaxed line', () => {
    const order = makeOrder({ fulfillmentType: 'delivery', deliveryFee: 3000 });
    const data = buildInvoiceData(order);

    expect(data.lines).toHaveLength(3);
    expect(data.lines[2]).toMatchObject({ description: 'Domicilio', base: 3000, taxAmount: 0 });
    expect(data.totals.payable).toBe(31800);
  });

  it('spreads an order discount into lines and taxes', () => {
    const order = makeOrder({ orderDiscountType: 'percentage', orderDiscountValue: 10 });
    const data = buildInvoiceData(order);

    expect(data.lines.map((l) => l.base)).toEqual([18000, 4500]);
    expect(data.lines[0].taxAmount).toBe(3420);
    expect(data.totals.payable).toBe(25920);
    expect(data.totals.payable).toBe(order.total);
  });

  it('sends complimentary items as free lines with their reference price', () => {
    const order = makeOrder({
      orderItems: [
        { productId: 'p1', productName: 'Torta', quantity: 1, basePrice: 11900, currentPrice: 11900, taxPercentage: 19 },
        { productId: 'p3', productName: 'Galleta', quantity: 1, basePrice: 2000, currentPrice: 2000, taxPercentage: 0, isComplimentary: true },
      ],
    });
    const data = buildInvoiceData(order);

    expect(data.lines[1]).toMatchObject({ free: true, base: 0, taxAmount: 0, referencePrice: 2000 });
    expect(data.totals.payable).toBe(11900);
  });

  it('marks unpaid orders as credit and paid ones as cash', () => {
    expect(buildInvoiceData(makeOrder({ isPaid: false })).payment)
      .toMatchObject({ form: '2', meansCode: '47', dueDate: '2026-10-20' });
    expect(buildInvoiceData(makeOrder({ isPaid: true, paymentMethod: 'cash' })).payment)
      .toMatchObject({ form: '1', meansCode: '10' });
  });

  it('refuses a credit sale without a due date, but not a cash sale', () => {
    expect(() => buildInvoiceData(makeOrder({ isPaid: false, dueDate: null }))).toThrow('fecha de vencimiento');
    expect(buildInvoiceData(makeOrder({ isPaid: true, dueDate: null })).payment.dueDate).toBeNull();
  });

  it('refuses an order with nothing to bill', () => {
    expect(() => buildInvoiceData(makeOrder({ orderItems: [] }))).toThrow('no tiene líneas');
  });
});
