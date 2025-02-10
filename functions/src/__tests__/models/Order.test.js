// tests/unit/models/Order.test.js
const { Order, OrderItem } = require('../../models/Order');

describe('OrderItem', () => {
  describe('calculations', () => {
    it('should calculate tax amount correctly', () => {
      const item = new OrderItem({
        productId: '1',
        productName: 'Test Product',
        quantity: 2,
        currentPrice: 1000, // 10.00
        taxPercentage: 19,
      });

      // With 19% tax rate: 1000 * 19 / 119 ≈ 159.66 rounded
      expect(item.taxAmount).toBe(160);
    });

    it('should calculate pre-tax price correctly', () => {
      const item = new OrderItem({
        productId: '1',
        productName: 'Test Product',
        quantity: 2,
        currentPrice: 1000,
        taxPercentage: 19,
      });

      // 1000 - 160 = 840
      expect(item.preTaxPrice).toBe(840);
    });

    it('should calculate subtotal correctly', () => {
      const item = new OrderItem({
        productId: '1',
        productName: 'Test Product',
        quantity: 2,
        currentPrice: 1000,
        taxPercentage: 19,
      });

      // quantity * currentPrice = 2 * 1000
      expect(item.subtotal).toBe(2000);
    });

    it('should handle complimentary items with zero values', () => {
      const item = new OrderItem({
        productId: '1',
        productName: 'Test Product',
        quantity: 2,
        currentPrice: 1000,
        taxPercentage: 19,
        isComplimentary: true,
      });

      expect(item.taxAmount).toBe(0);
      expect(item.preTaxPrice).toBe(0);
      expect(item.subtotal).toBe(0);
    });
  });
});

describe('Order', () => {
  describe('constructor', () => {
    it('should initialize with basic properties', () => {
      const order = new Order({
        bakeryId: '123',
        userId: 'user123',
        status: 0,
      });

      expect(order.bakeryId).toBe('123');
      expect(order.userId).toBe('user123');
      expect(order.status).toBe(0);
      expect(order.orderItems).toEqual([]);
    });

    it('should convert order items to OrderItem instances', () => {
      const order = new Order({
        orderItems: [{
          productId: '1',
          productName: 'Test Product',
          quantity: 1,
          currentPrice: 1000,
        }],
      });

      expect(order.orderItems[0]).toBeInstanceOf(OrderItem);
    });
  });

  describe('price calculations', () => {
    let order;

    beforeEach(() => {
      order = new Order({
        orderItems: [
          {
            productId: '1',
            productName: 'Product 1',
            quantity: 2,
            currentPrice: 1000,
            taxPercentage: 19,
          },
          {
            productId: '2',
            productName: 'Product 2',
            quantity: 1,
            currentPrice: 500,
            taxPercentage: 0,
          },
        ],
        fulfillmentType: 'delivery',
        deliveryFee: 300,
      });
    });

    it('should calculate taxable and non-taxable subtotals correctly', () => {
      expect(order.taxableSubtotal).toBe(2000); // 2 * 1000
      expect(order.nonTaxableSubtotal).toBe(500); // 1 * 500
    });

    it('should calculate total tax amount correctly', () => {
      // (1000 * 19/119) * 2 ≈ 319.33 rounded
      expect(order.totalTaxAmount).toBe(320);
    });

    it('should calculate pre-tax total correctly', () => {
      // subtotal - totalTaxAmount = 2500 - 320
      expect(order.preTaxTotal).toBe(2180);
    });

    it('should include delivery fee in total for delivery orders', () => {
      // subtotal + deliveryFee = 2500 + 300
      expect(order.total).toBe(2800);
    });

    it('should not include delivery fee in total for pickup orders', () => {
      order.fulfillmentType = 'pickup';
      order.calculatePricing();
      expect(order.total).toBe(2500);
    });

    it('should handle complimentary orders with zero values', () => {
      order.isComplimentary = true;
      order.calculatePricing();

      expect(order.taxableSubtotal).toBe(0);
      expect(order.nonTaxableSubtotal).toBe(0);
      expect(order.totalTaxAmount).toBe(0);
      expect(order.preTaxTotal).toBe(0);
      expect(order.total).toBe(0);
    });
  });

  describe('toFirestore', () => {
    it('should convert order items to plain objects', () => {
      const order = new Order({
        orderItems: [{
          productId: '1',
          productName: 'Test Product',
          quantity: 1,
          currentPrice: 1000,
        }],
      });

      const firestoreData = order.toFirestore();
      expect(firestoreData.orderItems[0]).toEqual(
        expect.objectContaining({
          productId: '1',
          productName: 'Test Product',
        }),
      );
    });
  });

  describe('toClientHistoryObject', () => {
    it('should create simplified object for client history', () => {
      const order = new Order({
        id: '123',
        bakeryId: 'bakery123',
        orderItems: [{
          productId: '1',
          productName: 'Test Product',
          quantity: 1,
          currentPrice: 1000,
        }],
        fulfillmentType: 'delivery',
        deliveryFee: 300,
      });

      const historyObject = order.toClientHistoryObject();

      expect(historyObject).toEqual(
        expect.objectContaining({
          id: '123',
          bakeryId: 'bakery123',
          fulfillmentType: 'delivery',
          deliveryFee: 300,
        }),
      );
      expect(historyObject.orderItems).toHaveLength(1);
    });
  });
});
