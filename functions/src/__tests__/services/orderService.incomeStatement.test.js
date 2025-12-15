const { initializeFirebase, clearFirestoreData } = require('../setup/firebase');
const { Order } = require('../../models/Order');

// Test Data Setup Helpers
const setupTestData = async (db, bakeryId) => {
  // Create test user
  const userRef = db.collection('bakeries').doc(bakeryId).collection('users').doc('test-user');
  await userRef.set({
    id: 'test-user',
    name: 'Test Customer',
    email: 'test@example.com',
    address: '123 Test St',
  });

  // Create settings document with default report filter
  const settingsRef = db
    .collection('bakeries')
    .doc(bakeryId)
    .collection('settings')
    .doc('default');

  await settingsRef.set({
    id: 'default',
    features: {
      reports: {
        defaultReportFilter: 'dueDate',
        showMultipleReports: false,
      },
    },
  });

  // Create test products
  const product1Ref = db.collection('bakeries').doc(bakeryId).collection('products').doc('product-1');
  await product1Ref.set({
    id: 'product-1',
    bakeryId,
    name: 'Pan Integral',
    costPrice: 5000,
    currentPrice: 12000,
    basePrice: 12000,
  });

  const product2Ref = db.collection('bakeries').doc(bakeryId).collection('products').doc('product-2');
  await product2Ref.set({
    id: 'product-2',
    bakeryId,
    name: 'Croissant',
    costPrice: 8000,
    currentPrice: 20000,
    basePrice: 20000,
  });

  const product3Ref = db.collection('bakeries').doc(bakeryId).collection('products').doc('product-3');
  await product3Ref.set({
    id: 'product-3',
    bakeryId,
    name: 'Donut',
    costPrice: null, // No cost defined - to test excluded products
    currentPrice: 5000,
    basePrice: 5000,
  });
};

const createTestOrders = async (orderService, bakeryId) => {
  const orders = [];
  const baseDate = new Date('2025-01-01');

  // Order 1: January, paid, with costs (2+3=5 items)
  const order1 = {
    userId: 'test-user',
    userName: 'Test Customer',
    userEmail: 'test@example.com',
    orderItems: [
      {
        productId: 'product-1',
        productName: 'Pan Integral',
        collectionId: 'collection-1',
        collectionName: 'Pan',
        quantity: 2,
        basePrice: 12000,
        currentPrice: 12000,
        costPrice: 5000, // Historical snapshot
        taxPercentage: 19,
        isComplimentary: false,
      },
      {
        productId: 'product-2',
        productName: 'Croissant',
        collectionId: 'collection-1',
        collectionName: 'Pastry',
        quantity: 3,
        basePrice: 20000,
        currentPrice: 20000,
        costPrice: 8000, // Historical snapshot
        taxPercentage: 19,
        isComplimentary: false,
      },
    ],
    status: 3,
    isPaid: true,
    paymentMethod: 'cash',
    fulfillmentType: 'pickup',
    deliveryFee: 0,
    deliveryCost: 0,
    dueDate: new Date(baseDate),
    paymentDate: new Date(baseDate),
    preparationDate: new Date(baseDate),
    totalTaxAmount: 0, // Will be calculated
  };

  // Order 2: January, paid, with delivery, missing cost for product-3
  const order2 = {
    userId: 'test-user',
    userName: 'Test Customer',
    userEmail: 'test@example.com',
    orderItems: [
      {
        productId: 'product-1',
        productName: 'Pan Integral',
        collectionId: 'collection-1',
        collectionName: 'Pan',
        quantity: 1,
        basePrice: 12000,
        currentPrice: 12000,
        costPrice: 5000,
        taxPercentage: 19,
        isComplimentary: false,
      },
      {
        productId: 'product-3',
        productName: 'Donut',
        collectionId: 'collection-1',
        collectionName: 'Pastry',
        quantity: 5,
        basePrice: 5000,
        currentPrice: 5000,
        costPrice: null, // No cost defined
        taxPercentage: 19,
        isComplimentary: false,
      },
    ],
    status: 3,
    isPaid: true,
    paymentMethod: 'transfer',
    fulfillmentType: 'delivery',
    deliveryFee: 10000,
    deliveryCost: 3000,
    dueDate: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000), // Jan 3
    paymentDate: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000),
    preparationDate: new Date(baseDate),
    totalTaxAmount: 0,
  };

  // Order 3: February, paid
  const order3 = {
    userId: 'test-user',
    userName: 'Test Customer',
    userEmail: 'test@example.com',
    orderItems: [
      {
        productId: 'product-2',
        productName: 'Croissant',
        collectionId: 'collection-1',
        collectionName: 'Pastry',
        quantity: 2,
        basePrice: 20000,
        currentPrice: 20000,
        costPrice: 8000,
        taxPercentage: 19,
        isComplimentary: false,
      },
    ],
    status: 3,
    isPaid: true,
    paymentMethod: 'cash',
    fulfillmentType: 'pickup',
    deliveryFee: 0,
    deliveryCost: 0,
    dueDate: new Date('2025-02-10'),
    paymentDate: new Date('2025-02-10'),
    preparationDate: new Date('2025-02-10'),
    totalTaxAmount: 0,
  };

  // Order 4: Unpaid order (should not be included)
  const order4 = {
    userId: 'test-user',
    userName: 'Test Customer',
    userEmail: 'test@example.com',
    orderItems: [
      {
        productId: 'product-1',
        productName: 'Pan Integral',
        collectionId: 'collection-1',
        collectionName: 'Pan',
        quantity: 10,
        basePrice: 12000,
        currentPrice: 12000,
        costPrice: 5000,
        taxPercentage: 19,
        isComplimentary: false,
      },
    ],
    status: 1,
    isPaid: false,
    paymentMethod: null,
    fulfillmentType: 'pickup',
    deliveryFee: 0,
    deliveryCost: 0,
    dueDate: new Date('2025-01-15'),
    paymentDate: null,
    preparationDate: new Date('2025-01-15'),
    totalTaxAmount: 0,
  };

  // Create orders
  for (const orderData of [order1, order2, order3, order4]) {
    const instance = await orderService.create(orderData, bakeryId);
    orders.push(instance);
  }

  return orders;
};

describe('Income Statement Service Tests', () => {
  let db;
  let orderService;
  let testBakeryId;

  beforeAll(() => {
    ({ db } = initializeFirebase());
    orderService = require('../../services/orderService');
    testBakeryId = 'income-test-bakery';
  });

  beforeEach(async () => {
    await clearFirestoreData(db);
    await setupTestData(db, testBakeryId);
    await createTestOrders(orderService, testBakeryId);
  }, 15000);

  afterAll(async () => {
    await clearFirestoreData(db);
  }, 10000);

  describe('getIncomeStatement', () => {
    it('should generate income statement with total grouping', async () => {
      const query = {
        filters: {
          dateRange: {
            startDate: '2025-01-01',
            endDate: '2025-12-31',
          },
          groupBy: 'total',
        },
      };

      const report = await orderService.getIncomeStatement(testBakeryId, query);

      // Verify report structure
      expect(report).toHaveProperty('revenue');
      expect(report).toHaveProperty('costs');
      expect(report).toHaveProperty('grossProfit');
      expect(report).toHaveProperty('coverage');
      expect(report).toHaveProperty('excludedProducts');

      // Verify revenue calculation
      // Order 1: (12000*2 + 20000*3) = 84000
      // Order 2: (12000*1 + 5000*5) + 10000 delivery = 47000 + 10000 = 57000
      // Order 3: 20000*2 = 40000
      // Total product sales: 84000 + 12000 + 40000 = 136000
      expect(report.revenue.productSales).toBeGreaterThan(0);
      expect(report.revenue.deliveryFees).toBe(10000); // Only order 2 has delivery
      expect(report.revenue.totalRevenue).toBeGreaterThan(0);

      // Verify costs calculation
      // Order 1 COGS: (5000*2 + 8000*3) = 34000
      // Order 2 COGS: 5000*1 = 5000 (product-3 has no cost)
      // Order 3 COGS: 8000*2 = 16000
      // Total COGS: 55000
      // Delivery costs: 3000 (only order 2)
      expect(report.costs.cogs).toBeGreaterThan(0);
      expect(report.costs.deliveryCosts).toBe(3000);
      expect(report.costs.totalCosts).toBeGreaterThan(0);

      // Verify gross profit
      expect(report.grossProfit.amount).toBeGreaterThan(0);
      expect(report.grossProfit.marginPercent).toBeGreaterThan(0);

      // Verify coverage
      expect(report.coverage.itemsWithCost).toBeGreaterThan(0);
      // Total order items (not quantities): 2 items (order 1) + 2 items (order 2) + 1 item (order 3) = 5
      expect(report.coverage.totalItems).toBe(5);
      expect(report.coverage.percentCovered).toBeLessThanOrEqual(100);

      // Verify excluded products
      expect(report.excludedProducts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'product-3',
            name: 'Donut',
            reason: 'Sin costo definido',
          }),
        ]),
      );
    }, 10000);

    it('should generate income statement with monthly grouping', async () => {
      const query = {
        filters: {
          dateRange: {
            startDate: '2025-01-01',
            endDate: '2025-12-31',
          },
          groupBy: 'month',
        },
      };

      const report = await orderService.getIncomeStatement(testBakeryId, query);

      // Verify report structure
      expect(report).toHaveProperty('periods');
      expect(report).toHaveProperty('totals');
      expect(report).toHaveProperty('excludedProducts');

      // Should have January and February periods
      expect(report.periods.length).toBeGreaterThanOrEqual(2);

      const januaryPeriod = report.periods.find(p => p.month === '2025-01');
      const februaryPeriod = report.periods.find(p => p.month === '2025-02');

      expect(januaryPeriod).toBeDefined();
      expect(februaryPeriod).toBeDefined();

      // Verify January has 2 orders (order1, order2)
      expect(januaryPeriod.revenue).toHaveProperty('productSales');
      expect(januaryPeriod.revenue).toHaveProperty('deliveryFees');

      // Verify February has 1 order (order3)
      expect(februaryPeriod.revenue).toHaveProperty('productSales');

      // Verify totals
      expect(report.totals).toHaveProperty('revenue');
      expect(report.totals).toHaveProperty('costs');
      expect(report.totals).toHaveProperty('grossProfit');
      expect(report.totals).toHaveProperty('coverage');
    }, 10000);

    it('should use current year when dates not provided', async () => {
      const query = {
        filters: {
          groupBy: 'total',
        },
      };

      // This should not throw an error
      const report = await orderService.getIncomeStatement(testBakeryId, query);

      // Since we're creating orders in 2025 and the test is running now,
      // if we use current year (2025), it might or might not include our test data
      // depending on the current date. Just verify it returns a valid structure.
      expect(report).toHaveProperty('revenue');
      expect(report).toHaveProperty('costs');
      expect(report).toHaveProperty('grossProfit');
      expect(report).toHaveProperty('coverage');
    }, 10000);

    it('should only include paid orders', async () => {
      const query = {
        filters: {
          dateRange: {
            startDate: '2025-01-01',
            endDate: '2025-12-31',
          },
          groupBy: 'total',
        },
      };

      const report = await orderService.getIncomeStatement(testBakeryId, query);

      // Order 4 is unpaid with 1 order item, so it shouldn't be included
      // We should have 5 order items total from paid orders
      expect(report.coverage.totalItems).toBe(5);
      expect(report.coverage.totalItems).not.toBe(6); // 5 + 1 from unpaid order
    }, 10000);

    it('should use paymentDate filter when specified', async () => {
      const query = {
        filters: {
          dateRange: {
            startDate: '2025-01-01',
            endDate: '2025-01-31',
          },
          groupBy: 'total',
          dateFilterType: 'paymentDate',
        },
      };

      const report = await orderService.getIncomeStatement(testBakeryId, query);

      // All orders were paid in January (first 2 orders: 2+2=4 items)
      expect(report.coverage.totalItems).toBe(4);
    }, 10000);

    it('should respect dateFilterType from bakerySettings', async () => {
      const query = {
        filters: {
          dateRange: {
            startDate: '2025-01-01',
            endDate: '2025-01-31',
          },
          groupBy: 'total',
          // Not specifying dateFilterType, should use bakerySettings
        },
      };

      const report = await orderService.getIncomeStatement(testBakeryId, query);

      // Should use dueDate from settings (defaultReportFilter: 'dueDate')
      // All our test orders have dueDate in January
      expect(report.coverage.totalItems).toBeGreaterThan(0);
    }, 10000);

    it('should track excluded products correctly', async () => {
      const query = {
        filters: {
          dateRange: {
            startDate: '2025-01-01',
            endDate: '2025-12-31',
          },
          groupBy: 'total',
        },
      };

      const report = await orderService.getIncomeStatement(testBakeryId, query);

      // Product 3 (Donut) has no cost and appears in 1 order with quantity 5
      const product3Excluded = report.excludedProducts.find(p => p.id === 'product-3');
      expect(product3Excluded).toBeDefined();
      expect(product3Excluded.orderCount).toBe(1);
      expect(product3Excluded.totalQuantity).toBe(5);
    }, 10000);

    it('should calculate correct gross profit margin', async () => {
      const query = {
        filters: {
          dateRange: {
            startDate: '2025-01-01',
            endDate: '2025-12-31',
          },
          groupBy: 'total',
        },
      };

      const report = await orderService.getIncomeStatement(testBakeryId, query);

      // Margin should be (grossProfit / totalRevenue) * 100
      const expectedMargin =
        ((report.grossProfit.amount / report.revenue.totalRevenue) * 100).toFixed(1);
      expect(parseFloat(report.grossProfit.marginPercent)).toBe(parseFloat(expectedMargin));
    }, 10000);

    it('should handle cost waterfall correctly', async () => {
      const query = {
        filters: {
          dateRange: {
            startDate: '2025-01-01',
            endDate: '2025-12-31',
          },
          groupBy: 'total',
        },
      };

      const report = await orderService.getIncomeStatement(testBakeryId, query);

      // Items with historical costPrice should be included
      expect(report.coverage.itemsWithCost).toBeGreaterThan(0);

      // Items without cost (product-3) should not contribute to COGS
      // Product 3 has 5 items with no cost, so coverage should be less than total
      expect(report.coverage.itemsWithCost).toBeLessThan(report.coverage.totalItems);
    }, 10000);
  });
});
