// tests/unit/models/Order.test.js
const { Order, OrderItem } = require('../../models/Order');

describe('OrderItem', () => {
  describe('constructor', () => {
    it('should initialize with productDescription', () => {
      const item = new OrderItem({
        productId: '1',
        productName: 'Test Product',
        productDescription: 'A delicious test product',
        quantity: 1,
        currentPrice: 1000,
      });

      expect(item.productDescription).toBe('A delicious test product');
    });

    it('should default productDescription to empty string if not provided', () => {
      const item = new OrderItem({
        productId: '1',
        productName: 'Test Product',
        quantity: 1,
        currentPrice: 1000,
      });

      expect(item.productDescription).toBe('');
    });
  });

  describe('discount fields', () => {
    it('should set referencePrice from basePrice when basePrice > 0', () => {
      const item = new OrderItem({
        productId: '1',
        productName: 'Test Product',
        quantity: 1,
        basePrice: 1200,
        currentPrice: 1000,
      });

      expect(item.referencePrice).toBe(1200);
    });

    it('should set referencePrice from passed referencePrice when basePrice is 0', () => {
      const item = new OrderItem({
        productId: '1',
        productName: 'Test Product',
        quantity: 1,
        basePrice: 0,
        currentPrice: 1000,
        referencePrice: 1100,
      });

      expect(item.referencePrice).toBe(1100);
    });

    it('should fallback referencePrice to currentPrice when no basePrice or referencePrice', () => {
      const item = new OrderItem({
        productId: '1',
        productName: 'Test Product',
        quantity: 1,
        currentPrice: 1000,
      });

      expect(item.referencePrice).toBe(1000);
    });

    it('should initialize discountType and discountValue with defaults', () => {
      const item = new OrderItem({
        productId: '1',
        productName: 'Test Product',
        quantity: 1,
        currentPrice: 1000,
      });

      expect(item.discountType).toBeNull();
      expect(item.discountValue).toBe(0);
    });

    it('should accept discountType and discountValue', () => {
      const item = new OrderItem({
        productId: '1',
        productName: 'Test Product',
        quantity: 1,
        basePrice: 1200,
        currentPrice: 1000,
        discountType: 'percentage',
        discountValue: 10,
      });

      expect(item.discountType).toBe('percentage');
      expect(item.discountValue).toBe(10);
    });

    it('should include discount fields in toClientHistoryObject', () => {
      const item = new OrderItem({
        productId: '1',
        productName: 'Test Product',
        quantity: 1,
        basePrice: 1200,
        currentPrice: 1000,
        discountType: 'fixed',
        discountValue: 200,
      });

      const historyObject = item.toClientHistoryObject();

      expect(historyObject.referencePrice).toBe(1200);
      expect(historyObject.discountType).toBe('fixed');
      expect(historyObject.discountValue).toBe(200);
    });
  });

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

    it('should initialize with default invoice customizations', () => {
      const order = new Order({
        bakeryId: '123',
        userId: 'user123',
      });

      expect(order.invoiceCustomizations).toEqual({
        termsAndConditions: '',
        notes: '',
        customTitle: '',
      });
    });

    it('should accept custom invoice customizations', () => {
      const order = new Order({
        bakeryId: '123',
        userId: 'user123',
        invoiceCustomizations: {
          termsAndConditions: 'Custom terms',
          notes: 'Special notes',
          customTitle: 'Invoice Title',
        },
      });

      expect(order.invoiceCustomizations.termsAndConditions).toBe('Custom terms');
      expect(order.invoiceCustomizations.notes).toBe('Special notes');
      expect(order.invoiceCustomizations.customTitle).toBe('Invoice Title');
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

    it('should calculate preTaxSubtotal and postTaxSubtotal correctly', () => {
      // preTaxSubtotal: (840 * 2) + (500 * 1) = 2180
      expect(order.preTaxSubtotal).toBe(2180);
      // postTaxSubtotal: (1000 * 2) + (500 * 1) = 2500
      expect(order.postTaxSubtotal).toBe(2500);
    });

    it('should calculate total tax amount correctly', () => {
      // (1000 * 19/119) * 2 ≈ 319.33 rounded
      expect(order.totalTaxAmount).toBe(320);
    });

    it('should calculate taxBreakdown with only taxable items', () => {
      // Only Product 1 (19%) is taxable, Product 2 (0%) is excluded
      expect(order.taxBreakdown).toEqual([
        { taxPercentage: 19, quantity: 2, baseAmount: 1680, taxAmount: 320 },
      ]);
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

      expect(order.preTaxSubtotal).toBe(0);
      expect(order.postTaxSubtotal).toBe(0);
      expect(order.totalTaxAmount).toBe(0);
      expect(order.preTaxTotal).toBe(0);
      expect(order.total).toBe(0);
      expect(order.taxBreakdown).toEqual([]);
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

    it('should include invoiceCustomizations in Firestore data', () => {
      const order = new Order({
        bakeryId: '123',
        invoiceCustomizations: {
          termsAndConditions: 'Test terms',
          notes: 'Test notes',
          customTitle: 'Test title',
        },
      });

      const firestoreData = order.toFirestore();
      expect(firestoreData.invoiceCustomizations).toEqual({
        termsAndConditions: 'Test terms',
        notes: 'Test notes',
        customTitle: 'Test title',
      });
    });

    it('should include productDescription in order item plain objects', () => {
      const order = new Order({
        orderItems: [{
          productId: '1',
          productName: 'Test Product',
          productDescription: 'Test description',
          quantity: 1,
          currentPrice: 1000,
        }],
      });

      const firestoreData = order.toFirestore();
      expect(firestoreData.orderItems[0].productDescription).toBe('Test description');
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

    it('should include order discount fields', () => {
      const order = new Order({
        id: '123',
        bakeryId: 'bakery123',
        orderItems: [{
          productId: '1',
          productName: 'Test Product',
          quantity: 1,
          currentPrice: 1000,
        }],
        orderDiscountType: 'percentage',
        orderDiscountValue: 10,
      });

      const historyObject = order.toClientHistoryObject();

      expect(historyObject.orderDiscountType).toBe('percentage');
      expect(historyObject.orderDiscountValue).toBe(10);
      expect(historyObject.orderDiscountAmount).toBe(100);
      expect(historyObject.taxBreakdown).toEqual([]);
    });
  });

  describe('order-level discounts', () => {
    describe('calculateOrderDiscountAmount', () => {
      it('should return 0 when no discount type', () => {
        const order = new Order({
          orderItems: [{
            productId: '1',
            productName: 'Test Product',
            quantity: 1,
            currentPrice: 1000,
          }],
        });

        expect(order.orderDiscountAmount).toBe(0);
        expect(order.taxBreakdown).toEqual([]);
      });

      it('should return 0 when no discount value', () => {
        const order = new Order({
          orderItems: [{
            productId: '1',
            productName: 'Test Product',
            quantity: 1,
            currentPrice: 1000,
          }],
          orderDiscountType: 'percentage',
          orderDiscountValue: 0,
        });

        expect(order.orderDiscountAmount).toBe(0);
      });

      it('should calculate percentage discount correctly', () => {
        const order = new Order({
          orderItems: [{
            productId: '1',
            productName: 'Test Product',
            quantity: 1,
            currentPrice: 1000,
          }],
          orderDiscountType: 'percentage',
          orderDiscountValue: 10,
        });

        // 10% of 1000 = 100
        expect(order.orderDiscountAmount).toBe(100);
      });

      it('should calculate fixed discount correctly', () => {
        const order = new Order({
          orderItems: [{
            productId: '1',
            productName: 'Test Product',
            quantity: 1,
            currentPrice: 1000,
          }],
          orderDiscountType: 'fixed',
          orderDiscountValue: 250,
        });

        expect(order.orderDiscountAmount).toBe(250);
      });

      it('should cap fixed discount at subtotal', () => {
        const order = new Order({
          orderItems: [{
            productId: '1',
            productName: 'Test Product',
            quantity: 1,
            currentPrice: 1000,
          }],
          orderDiscountType: 'fixed',
          orderDiscountValue: 2000, // More than subtotal
        });

        expect(order.orderDiscountAmount).toBe(1000); // Capped at subtotal
      });

      it('should return 0 for invalid discount type', () => {
        const order = new Order({
          orderItems: [{
            productId: '1',
            productName: 'Test Product',
            quantity: 1,
            currentPrice: 1000,
          }],
          orderDiscountType: 'invalid',
          orderDiscountValue: 100,
        });

        expect(order.orderDiscountAmount).toBe(0);
      });
    });

    describe('total calculation with discount', () => {
      it('should subtract percentage discount from total', () => {
        const order = new Order({
          orderItems: [{
            productId: '1',
            productName: 'Test Product',
            quantity: 2,
            currentPrice: 1000,
          }],
          orderDiscountType: 'percentage',
          orderDiscountValue: 10,
          fulfillmentType: 'pickup',
        });

        // Subtotal: 2000, Discount: 200, Total: 1800
        expect(order.subtotal).toBe(2000);
        expect(order.orderDiscountAmount).toBe(200);
        expect(order.total).toBe(1800);
      });

      it('should subtract fixed discount from total', () => {
        const order = new Order({
          orderItems: [{
            productId: '1',
            productName: 'Test Product',
            quantity: 2,
            currentPrice: 1000,
          }],
          orderDiscountType: 'fixed',
          orderDiscountValue: 500,
          fulfillmentType: 'pickup',
        });

        // Subtotal: 2000, Discount: 500, Total: 1500
        expect(order.subtotal).toBe(2000);
        expect(order.orderDiscountAmount).toBe(500);
        expect(order.total).toBe(1500);
      });

      it('should apply discount before adding delivery fee', () => {
        const order = new Order({
          orderItems: [{
            productId: '1',
            productName: 'Test Product',
            quantity: 2,
            currentPrice: 1000,
          }],
          orderDiscountType: 'percentage',
          orderDiscountValue: 10,
          fulfillmentType: 'delivery',
          deliveryFee: 300,
        });

        // Subtotal: 2000, Discount: 200, Discounted: 1800, + Delivery: 2100
        expect(order.subtotal).toBe(2000);
        expect(order.orderDiscountAmount).toBe(200);
        expect(order.total).toBe(2100);
      });

      it('should handle 100% discount', () => {
        const order = new Order({
          orderItems: [{
            productId: '1',
            productName: 'Test Product',
            quantity: 1,
            currentPrice: 1000,
          }],
          orderDiscountType: 'percentage',
          orderDiscountValue: 100,
          fulfillmentType: 'pickup',
        });

        expect(order.orderDiscountAmount).toBe(1000);
        expect(order.total).toBe(0);
      });
    });

    describe('tax adjustment with discount', () => {
      it('should proportionally reduce tax when order discount applied', () => {
        const order = new Order({
          orderItems: [{
            productId: '1',
            productName: 'Test Product',
            quantity: 1,
            currentPrice: 1000,
            taxPercentage: 19,
          }],
          orderDiscountType: 'percentage',
          orderDiscountValue: 10,
        });

        // Item tax: 160 (1000 * 19 / 119)
        // Discount ratio: 100/1000 = 0.1
        // Adjusted tax: 160 * 0.9 = 144
        expect(order.totalTaxAmount).toBe(144);
        expect(order.taxBreakdown).toEqual([
          { taxPercentage: 19, quantity: 1, baseAmount: 756, taxAmount: 144 },
        ]);
      });

      it('should proportionally reduce preTaxTotal when order discount applied', () => {
        const order = new Order({
          orderItems: [{
            productId: '1',
            productName: 'Test Product',
            quantity: 1,
            currentPrice: 1000,
            taxPercentage: 19,
          }],
          orderDiscountType: 'percentage',
          orderDiscountValue: 10,
        });

        // Item preTax: 840 (1000 - 160)
        // Discount ratio: 0.1
        // Adjusted preTax: 840 * 0.9 = 756
        expect(order.preTaxTotal).toBe(756);
        expect(order.taxBreakdown).toEqual([
          { taxPercentage: 19, quantity: 1, baseAmount: 756, taxAmount: 144 },
        ]);
      });

      it('should not adjust tax when no discount', () => {
        const order = new Order({
          orderItems: [{
            productId: '1',
            productName: 'Test Product',
            quantity: 1,
            currentPrice: 1000,
            taxPercentage: 19,
          }],
        });

        expect(order.totalTaxAmount).toBe(160);
        expect(order.preTaxTotal).toBe(840);
        expect(order.taxBreakdown).toEqual([
          { taxPercentage: 19, quantity: 1, baseAmount: 840, taxAmount: 160 },
        ]);
      });
    });

    describe('exclusive tax mode with order discount', () => {
      it('should apply discount to preTaxSubtotal and compute correct total', () => {
        // Exclusive: currentPrice is pre-tax (1,000,000), tax 19% added on top
        const order = new Order({
          orderItems: [{
            productId: '1',
            productName: 'Bulk Order',
            quantity: 1,
            currentPrice: 1000000,
            taxPercentage: 19,
          }],
          taxMode: 'exclusive',
          orderDiscountType: 'fixed',
          orderDiscountValue: 200000,
          fulfillmentType: 'pickup',
        });

        // preTaxSubtotal = 1,000,000
        expect(order.preTaxSubtotal).toBe(1000000);
        // postTaxSubtotal = 1,000,000 + 190,000 = 1,190,000
        expect(order.postTaxSubtotal).toBe(1190000);
        // discountBase = preTaxSubtotal = 1,000,000 (exclusive)
        // discountAmount = min(200,000, 1,000,000) = 200,000
        expect(order.orderDiscountAmount).toBe(200000);
        // discountRatio = 200,000 / 1,000,000 = 0.20
        // preTaxTotal = round(1,000,000 * 0.80) = 800,000
        expect(order.preTaxTotal).toBe(800000);
        // totalTaxAmount = round(190,000 * 0.80) = 152,000
        expect(order.totalTaxAmount).toBe(152000);
        // total = 800,000 + 152,000 = 952,000
        expect(order.total).toBe(952000);
        expect(order.taxBreakdown).toEqual([
          { taxPercentage: 19, quantity: 1, baseAmount: 800000, taxAmount: 152000 },
        ]);
      });
    });

    describe('inclusive tax mode with order discount', () => {
      it('should apply discount to postTaxSubtotal and compute correct total', () => {
        // Inclusive: currentPrice includes tax (1,000,000 total for items)
        const order = new Order({
          orderItems: [{
            productId: '1',
            productName: 'Bulk Order',
            quantity: 1,
            currentPrice: 1000000,
            taxPercentage: 19,
          }],
          taxMode: 'inclusive',
          orderDiscountType: 'fixed',
          orderDiscountValue: 200000,
          fulfillmentType: 'pickup',
        });

        // postTaxSubtotal = 1,000,000
        expect(order.postTaxSubtotal).toBe(1000000);
        // preTaxSubtotal: taxAmount = round(1,000,000 * 19/119) = 159,664
        // preTaxPrice = 1,000,000 - 159,664 = 840,336
        expect(order.preTaxSubtotal).toBe(840336);
        // discountBase = postTaxSubtotal = 1,000,000 (inclusive)
        expect(order.orderDiscountAmount).toBe(200000);
        // discountRatio = 200,000 / 1,000,000 = 0.20
        // preTaxTotal = round(840,336 * 0.80) = 672,269
        expect(order.preTaxTotal).toBe(672269);
        // totalTaxAmount = round(159,664 * 0.80) = 127,731
        expect(order.totalTaxAmount).toBe(127731);
        // total = 1,000,000 - 200,000 = 800,000
        expect(order.total).toBe(800000);
        expect(order.taxBreakdown).toEqual([
          { taxPercentage: 19, quantity: 1, baseAmount: 672269, taxAmount: 127731 },
        ]);
      });
    });

    describe('mixed tax/no-tax items with discount', () => {
      it('exclusive mode: should discount from preTaxSubtotal with mixed tax items', () => {
        const order = new Order({
          orderItems: [
            { productId: '1', productName: 'Taxed Item', quantity: 1, currentPrice: 500000, taxPercentage: 19 },
            { productId: '2', productName: 'No Tax Item', quantity: 1, currentPrice: 300000, taxPercentage: 0 },
          ],
          taxMode: 'exclusive',
          orderDiscountType: 'fixed',
          orderDiscountValue: 200000,
          fulfillmentType: 'pickup',
        });

        expect(order.preTaxSubtotal).toBe(800000);
        expect(order.postTaxSubtotal).toBe(895000);
        expect(order.orderDiscountAmount).toBe(200000);
        expect(order.preTaxTotal).toBe(600000);
        expect(order.totalTaxAmount).toBe(71250);
        expect(order.total).toBe(671250);
        expect(order.taxBreakdown).toEqual([
          { taxPercentage: 19, quantity: 1, baseAmount: 375000, taxAmount: 71250 },
        ]);
      });

      it('inclusive mode: should discount from postTaxSubtotal with mixed tax items', () => {
        const order = new Order({
          orderItems: [
            { productId: '1', productName: 'Taxed Item', quantity: 1, currentPrice: 500000, taxPercentage: 19 },
            { productId: '2', productName: 'No Tax Item', quantity: 1, currentPrice: 300000, taxPercentage: 0 },
          ],
          taxMode: 'inclusive',
          orderDiscountType: 'fixed',
          orderDiscountValue: 200000,
          fulfillmentType: 'pickup',
        });

        expect(order.preTaxSubtotal).toBe(720168);
        expect(order.postTaxSubtotal).toBe(800000);
        expect(order.orderDiscountAmount).toBe(200000);
        expect(order.preTaxTotal).toBe(540126);
        expect(order.totalTaxAmount).toBe(59874);
        expect(order.total).toBe(600000);
        expect(order.taxBreakdown).toEqual([
          { taxPercentage: 19, quantity: 1, baseAmount: 315126, taxAmount: 59874 },
        ]);
      });
    });

    describe('different tax rates with percentage discount', () => {
      it('exclusive mode: should handle items with 19% and 10% tax', () => {
        const order = new Order({
          orderItems: [
            { productId: '1', productName: 'Item 19%', quantity: 1, currentPrice: 400000, taxPercentage: 19 },
            { productId: '2', productName: 'Item 10%', quantity: 1, currentPrice: 200000, taxPercentage: 10 },
          ],
          taxMode: 'exclusive',
          orderDiscountType: 'percentage',
          orderDiscountValue: 15,
          fulfillmentType: 'pickup',
        });

        expect(order.preTaxSubtotal).toBe(600000);
        expect(order.postTaxSubtotal).toBe(696000);
        expect(order.orderDiscountAmount).toBe(90000);
        expect(order.preTaxTotal).toBe(510000);
        expect(order.totalTaxAmount).toBe(81600);
        expect(order.total).toBe(591600);
        // Integer keys iterate in ascending numeric order
        expect(order.taxBreakdown).toHaveLength(2);
        expect(order.taxBreakdown).toEqual(expect.arrayContaining([
          { taxPercentage: 19, quantity: 1, baseAmount: 340000, taxAmount: 64600 },
          { taxPercentage: 10, quantity: 1, baseAmount: 170000, taxAmount: 17000 },
        ]));
      });

      it('inclusive mode: should handle items with 19% and 10% tax', () => {
        const order = new Order({
          orderItems: [
            { productId: '1', productName: 'Item 19%', quantity: 1, currentPrice: 400000, taxPercentage: 19 },
            { productId: '2', productName: 'Item 10%', quantity: 1, currentPrice: 200000, taxPercentage: 10 },
          ],
          taxMode: 'inclusive',
          orderDiscountType: 'percentage',
          orderDiscountValue: 15,
          fulfillmentType: 'pickup',
        });

        expect(order.preTaxSubtotal).toBe(517952);
        expect(order.postTaxSubtotal).toBe(600000);
        expect(order.orderDiscountAmount).toBe(90000);
        expect(order.preTaxTotal).toBe(440259);
        expect(order.totalTaxAmount).toBe(69741);
        expect(order.total).toBe(510000);
        expect(order.taxBreakdown).toHaveLength(2);
        expect(order.taxBreakdown).toEqual(expect.arrayContaining([
          { taxPercentage: 19, quantity: 1, baseAmount: 285714, taxAmount: 54286 },
          { taxPercentage: 10, quantity: 1, baseAmount: 154545, taxAmount: 15455 },
        ]));
      });
    });

    describe('item-level discounts without order discount', () => {
      it('exclusive mode: item discounts reflected in currentPrice', () => {
        const order = new Order({
          orderItems: [
            { productId: '1', productName: 'Discounted Item', quantity: 2, basePrice: 500000, currentPrice: 400000, taxPercentage: 19, discountType: 'fixed', discountValue: 100000 },
            { productId: '2', productName: 'Full Price Item', quantity: 1, basePrice: 300000, currentPrice: 300000, taxPercentage: 19 },
          ],
          taxMode: 'exclusive',
          fulfillmentType: 'pickup',
        });

        expect(order.preTaxSubtotal).toBe(1100000);
        expect(order.postTaxSubtotal).toBe(1309000);
        expect(order.orderDiscountAmount).toBe(0);
        expect(order.preTaxTotal).toBe(1100000);
        expect(order.totalTaxAmount).toBe(209000);
        expect(order.total).toBe(1309000);
        expect(order.taxBreakdown).toEqual([
          { taxPercentage: 19, quantity: 3, baseAmount: 1100000, taxAmount: 209000 },
        ]);
      });

      it('inclusive mode: item discounts reflected in currentPrice', () => {
        const order = new Order({
          orderItems: [
            { productId: '1', productName: 'Discounted Item', quantity: 2, basePrice: 500000, currentPrice: 400000, taxPercentage: 19, discountType: 'fixed', discountValue: 100000 },
            { productId: '2', productName: 'Full Price Item', quantity: 1, basePrice: 300000, currentPrice: 300000, taxPercentage: 19 },
          ],
          taxMode: 'inclusive',
          fulfillmentType: 'pickup',
        });

        expect(order.preTaxSubtotal).toBe(924369);
        expect(order.postTaxSubtotal).toBe(1100000);
        expect(order.orderDiscountAmount).toBe(0);
        expect(order.preTaxTotal).toBe(924369);
        expect(order.totalTaxAmount).toBe(175631);
        expect(order.total).toBe(1100000);
        expect(order.taxBreakdown).toEqual([
          { taxPercentage: 19, quantity: 3, baseAmount: 924369, taxAmount: 175631 },
        ]);
      });
    });

    describe('item-level discounts with order-level discount', () => {
      it('exclusive mode: order discount stacks on top of item discounts', () => {
        const order = new Order({
          orderItems: [
            { productId: '1', productName: 'Discounted Item', quantity: 2, basePrice: 500000, currentPrice: 400000, taxPercentage: 19, discountType: 'fixed', discountValue: 100000 },
            { productId: '2', productName: 'Full Price Item', quantity: 1, basePrice: 300000, currentPrice: 300000, taxPercentage: 19 },
          ],
          taxMode: 'exclusive',
          orderDiscountType: 'percentage',
          orderDiscountValue: 10,
          fulfillmentType: 'pickup',
        });

        expect(order.preTaxSubtotal).toBe(1100000);
        expect(order.postTaxSubtotal).toBe(1309000);
        expect(order.orderDiscountAmount).toBe(110000);
        expect(order.preTaxTotal).toBe(990000);
        expect(order.totalTaxAmount).toBe(188100);
        expect(order.total).toBe(1178100);
        expect(order.taxBreakdown).toEqual([
          { taxPercentage: 19, quantity: 3, baseAmount: 990000, taxAmount: 188100 },
        ]);
      });

      it('inclusive mode: order discount stacks on top of item discounts', () => {
        const order = new Order({
          orderItems: [
            { productId: '1', productName: 'Discounted Item', quantity: 2, basePrice: 500000, currentPrice: 400000, taxPercentage: 19, discountType: 'fixed', discountValue: 100000 },
            { productId: '2', productName: 'Full Price Item', quantity: 1, basePrice: 300000, currentPrice: 300000, taxPercentage: 19 },
          ],
          taxMode: 'inclusive',
          orderDiscountType: 'percentage',
          orderDiscountValue: 10,
          fulfillmentType: 'pickup',
        });

        expect(order.preTaxSubtotal).toBe(924369);
        expect(order.postTaxSubtotal).toBe(1100000);
        expect(order.orderDiscountAmount).toBe(110000);
        expect(order.preTaxTotal).toBe(831932);
        expect(order.totalTaxAmount).toBe(158068);
        expect(order.total).toBe(990000);
        expect(order.taxBreakdown).toEqual([
          { taxPercentage: 19, quantity: 3, baseAmount: 831932, taxAmount: 158068 },
        ]);
      });
    });

    describe('complimentary orders with discount fields', () => {
      it('should set orderDiscountAmount to 0 for complimentary orders', () => {
        const order = new Order({
          orderItems: [{
            productId: '1',
            productName: 'Test Product',
            quantity: 1,
            currentPrice: 1000,
          }],
          paymentMethod: 'complimentary',
          orderDiscountType: 'percentage',
          orderDiscountValue: 10,
        });

        expect(order.orderDiscountAmount).toBe(0);
        expect(order.total).toBe(0);
        expect(order.taxBreakdown).toEqual([]);
      });
    });
  });

  describe('item reordering', () => {
    describe('getSortedOrderItems', () => {
      it('should return items sorted by displayOrder', () => {
        const order = new Order({
          orderItems: [
            { productId: '1', productName: 'Product A', quantity: 1, currentPrice: 100, displayOrder: 2 },
            { productId: '2', productName: 'Product B', quantity: 1, currentPrice: 100, displayOrder: 0 },
            { productId: '3', productName: 'Product C', quantity: 1, currentPrice: 100, displayOrder: 1 },
          ],
        });

        const sorted = order.getSortedOrderItems();

        expect(sorted[0].productName).toBe('Product B');
        expect(sorted[1].productName).toBe('Product C');
        expect(sorted[2].productName).toBe('Product A');
      });

      it('should not modify original array', () => {
        const order = new Order({
          orderItems: [
            { productId: '1', productName: 'Product A', quantity: 1, currentPrice: 100, displayOrder: 1 },
            { productId: '2', productName: 'Product B', quantity: 1, currentPrice: 100, displayOrder: 0 },
          ],
        });

        order.getSortedOrderItems();

        expect(order.orderItems[0].productName).toBe('Product A');
      });
    });

    describe('normalizeItemDisplayOrders', () => {
      it('should reassign sequential displayOrder values', () => {
        const order = new Order({
          orderItems: [
            { productId: '1', productName: 'Product A', quantity: 1, currentPrice: 100, displayOrder: 5 },
            { productId: '2', productName: 'Product B', quantity: 1, currentPrice: 100, displayOrder: 2 },
            { productId: '3', productName: 'Product C', quantity: 1, currentPrice: 100, displayOrder: 10 },
          ],
        });

        order.normalizeItemDisplayOrders();

        // After normalization, sorted by original displayOrder, then reassigned 0,1,2
        const itemB = order.orderItems.find(i => i.productName === 'Product B');
        const itemA = order.orderItems.find(i => i.productName === 'Product A');
        const itemC = order.orderItems.find(i => i.productName === 'Product C');

        expect(itemB.displayOrder).toBe(0);
        expect(itemA.displayOrder).toBe(1);
        expect(itemC.displayOrder).toBe(2);
      });
    });

    describe('reorderItem', () => {
      let order;

      beforeEach(() => {
        order = new Order({
          orderItems: [
            { productId: '1', productName: 'Product A', quantity: 1, currentPrice: 100, displayOrder: 0 },
            { productId: '2', productName: 'Product B', quantity: 1, currentPrice: 100, displayOrder: 1 },
            { productId: '3', productName: 'Product C', quantity: 1, currentPrice: 100, displayOrder: 2 },
          ],
        });
      });

      it('should move item up', () => {
        const itemB = order.orderItems.find(i => i.productName === 'Product B');
        const result = order.reorderItem(itemB.id, 'up');

        expect(result).toBe(true);
        expect(itemB.displayOrder).toBe(0);

        const itemA = order.orderItems.find(i => i.productName === 'Product A');
        expect(itemA.displayOrder).toBe(1);
      });

      it('should move item down', () => {
        const itemB = order.orderItems.find(i => i.productName === 'Product B');
        const result = order.reorderItem(itemB.id, 'down');

        expect(result).toBe(true);
        expect(itemB.displayOrder).toBe(2);

        const itemC = order.orderItems.find(i => i.productName === 'Product C');
        expect(itemC.displayOrder).toBe(1);
      });

      it('should return false when moving first item up', () => {
        const itemA = order.orderItems.find(i => i.productName === 'Product A');
        const result = order.reorderItem(itemA.id, 'up');

        expect(result).toBe(false);
        expect(itemA.displayOrder).toBe(0);
      });

      it('should return false when moving last item down', () => {
        const itemC = order.orderItems.find(i => i.productName === 'Product C');
        const result = order.reorderItem(itemC.id, 'down');

        expect(result).toBe(false);
        expect(itemC.displayOrder).toBe(2);
      });

      it('should return false for non-existent item', () => {
        const result = order.reorderItem('non-existent-id', 'up');
        expect(result).toBe(false);
      });

      it('should auto-normalize legacy data with same displayOrder', () => {
        const legacyOrder = new Order({
          orderItems: [
            { productId: '1', productName: 'Product A', quantity: 1, currentPrice: 100, displayOrder: 0 },
            { productId: '2', productName: 'Product B', quantity: 1, currentPrice: 100, displayOrder: 0 },
            { productId: '3', productName: 'Product C', quantity: 1, currentPrice: 100, displayOrder: 0 },
          ],
        });

        const itemB = legacyOrder.orderItems.find(i => i.productName === 'Product B');
        legacyOrder.reorderItem(itemB.id, 'up');

        // Should have normalized first, then performed the swap
        const orders = legacyOrder.orderItems.map(i => i.displayOrder);
        expect(new Set(orders).size).toBe(3); // All unique
      });
    });

    describe('moveItemToPosition', () => {
      let order;

      beforeEach(() => {
        order = new Order({
          orderItems: [
            { productId: '1', productName: 'Product A', quantity: 1, currentPrice: 100, displayOrder: 0 },
            { productId: '2', productName: 'Product B', quantity: 1, currentPrice: 100, displayOrder: 1 },
            { productId: '3', productName: 'Product C', quantity: 1, currentPrice: 100, displayOrder: 2 },
          ],
        });
      });

      it('should move item to specific position (1-indexed)', () => {
        const itemA = order.orderItems.find(i => i.productName === 'Product A');
        const result = order.moveItemToPosition(itemA.id, 3); // Move to last position

        expect(result).toBe(true);

        const sorted = order.getSortedOrderItems();
        expect(sorted[0].productName).toBe('Product B');
        expect(sorted[1].productName).toBe('Product C');
        expect(sorted[2].productName).toBe('Product A');
      });

      it('should move item from end to beginning', () => {
        const itemC = order.orderItems.find(i => i.productName === 'Product C');
        const result = order.moveItemToPosition(itemC.id, 1);

        expect(result).toBe(true);

        const sorted = order.getSortedOrderItems();
        expect(sorted[0].productName).toBe('Product C');
        expect(sorted[1].productName).toBe('Product A');
        expect(sorted[2].productName).toBe('Product B');
      });

      it('should return false for invalid position (too low)', () => {
        const itemA = order.orderItems.find(i => i.productName === 'Product A');
        const result = order.moveItemToPosition(itemA.id, 0);

        expect(result).toBe(false);
      });

      it('should return false for invalid position (too high)', () => {
        const itemA = order.orderItems.find(i => i.productName === 'Product A');
        const result = order.moveItemToPosition(itemA.id, 5);

        expect(result).toBe(false);
      });

      it('should return false when moving to same position', () => {
        const itemB = order.orderItems.find(i => i.productName === 'Product B');
        const result = order.moveItemToPosition(itemB.id, 2); // Already at position 2

        expect(result).toBe(false);
      });

      it('should return false for non-existent item', () => {
        const result = order.moveItemToPosition('non-existent-id', 1);
        expect(result).toBe(false);
      });
    });
  });
});
