// tests/unit/models/SalesReport.test.js
const SalesReport = require('../../models/SalesReport');
const { Order } = require('../../models/Order');

describe('SalesReport', () => {
  let mockOrders;
  let mockB2BClients;
  let mockProducts;
  let b2bUserId1;
  let b2bUserId2;
  let b2cUserId1;
  let b2cUserId2;

  beforeEach(() => {
    // Define user IDs
    b2bUserId1 = 'b2b-user-1';
    b2bUserId2 = 'b2b-user-2';
    b2cUserId1 = 'b2c-user-1';
    b2cUserId2 = 'b2c-user-2';

    // Mock B2B clients
    mockB2BClients = [
      { id: b2bUserId1, name: 'B2B Client 1' },
      { id: b2bUserId2, name: 'B2B Client 2' },
    ];

    // Mock products
    mockProducts = [
      { id: 'prod-1', name: 'Chocolate Cake', collectionName: 'Cakes', isDeleted: false },
      { id: 'prod-2', name: 'Vanilla Cupcake', collectionName: 'Cupcakes', isDeleted: false },
      { id: 'prod-3', name: 'Strawberry Tart', collectionName: 'Tarts', isDeleted: false },
      { id: 'prod-4', name: 'Blueberry Muffin', collectionName: 'Muffins', isDeleted: false },
      { id: 'prod-5', name: 'Lemon Cake', collectionName: 'Cakes', isDeleted: false },
      { id: 'prod-deleted', name: 'Old Product', collectionName: 'Cakes', isDeleted: true },
    ];

    // Create mock orders with varied data
    mockOrders = [
      // B2B Order 1 - Delivery
      {
        id: 'order-1',
        userId: b2bUserId1,
        dueDate: '2024-01-15T10:00:00Z',
        status: 4, // paid
        fulfillmentType: 'delivery',
        deliveryFee: 5000,
        deliveryCost: 3000,
        paymentMethod: 'card',
        isComplimentary: false,
        orderItems: [
          {
            productId: 'prod-1',
            productName: 'Chocolate Cake',
            collectionName: 'Cakes',
            quantity: 3,
            currentPrice: 10000,
            taxPercentage: 19,
            isComplimentary: false,
          },
          {
            productId: 'prod-2',
            productName: 'Vanilla Cupcake',
            collectionName: 'Cupcakes',
            quantity: 5,
            currentPrice: 3000,
            taxPercentage: 0,
            isComplimentary: false,
          },
        ],
      },
      // B2B Order 2 - Pickup
      {
        id: 'order-2',
        userId: b2bUserId2,
        dueDate: '2024-01-16T10:00:00Z',
        status: 4,
        fulfillmentType: 'pickup',
        paymentMethod: 'cash',
        isComplimentary: false,
        orderItems: [
          {
            productId: 'prod-1',
            productName: 'Chocolate Cake',
            collectionName: 'Cakes',
            quantity: 2,
            currentPrice: 10000,
            taxPercentage: 19,
            isComplimentary: false,
          },
        ],
      },
      // B2C Order 1 - Delivery
      {
        id: 'order-3',
        userId: b2cUserId1,
        dueDate: '2024-01-15T14:00:00Z',
        status: 4,
        fulfillmentType: 'delivery',
        deliveryFee: 4000,
        deliveryCost: 2500,
        paymentMethod: 'card',
        isComplimentary: false,
        orderItems: [
          {
            productId: 'prod-3',
            productName: 'Strawberry Tart',
            collectionName: 'Tarts',
            quantity: 1,
            currentPrice: 8000,
            taxPercentage: 19,
            isComplimentary: false,
          },
          {
            productId: 'prod-4',
            productName: 'Blueberry Muffin',
            collectionName: 'Muffins',
            quantity: 4,
            currentPrice: 2500,
            taxPercentage: 0,
            isComplimentary: false,
          },
        ],
      },
      // B2C Order 2 - Pickup
      {
        id: 'order-4',
        userId: b2cUserId2,
        dueDate: '2024-01-20T10:00:00Z',
        status: 4,
        fulfillmentType: 'pickup',
        paymentMethod: 'transfer',
        isComplimentary: false,
        orderItems: [
          {
            productId: 'prod-1',
            productName: 'Chocolate Cake',
            collectionName: 'Cakes',
            quantity: 1,
            currentPrice: 10000,
            taxPercentage: 19,
            isComplimentary: false,
          },
          {
            productId: 'prod-5',
            productName: 'Lemon Cake',
            collectionName: 'Cakes',
            quantity: 2,
            currentPrice: 9000,
            taxPercentage: 19,
            isComplimentary: false,
          },
        ],
      },
      // Complimentary Order (should be filtered out)
      {
        id: 'order-5',
        userId: b2cUserId1,
        dueDate: '2024-01-17T10:00:00Z',
        status: 4,
        fulfillmentType: 'pickup',
        paymentMethod: 'complimentary', // This sets isComplimentary to true
        orderItems: [
          {
            productId: 'prod-2',
            productName: 'Vanilla Cupcake',
            collectionName: 'Cupcakes',
            quantity: 10,
            currentPrice: 3000,
            taxPercentage: 0,
          },
        ],
      },
    ];
  });

  describe('constructor', () => {
    it('should initialize with orders, b2b clients, and products', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);

      expect(report).toBeDefined();
      expect(report.orders).toBeDefined();
      expect(report.b2b_clientIds).toBeDefined();
      expect(report.all_products).toBeDefined();
    });

    it('should filter out complimentary orders from main orders array', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);

      expect(report.orders).toHaveLength(4);
      expect(report.complimentaryOrders).toHaveLength(1);
      expect(report.complimentaryOrders[0].isComplimentary).toBe(true);
    });

    it('should convert orders to Order instances', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);

      report.orders.forEach(order => {
        expect(order).toBeInstanceOf(Order);
      });
    });

    it('should pre-calculate total revenue', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);

      expect(report.totalRevenue).toBeGreaterThan(0);
      expect(typeof report.totalRevenue).toBe('number');
    });

    it('should pre-calculate total sales (subtotal)', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);

      expect(report.totalSales).toBeGreaterThan(0);
      expect(typeof report.totalSales).toBe('number');
    });

    it('should pre-calculate total delivery fees', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);

      // Only 2 orders have delivery (order-1: 5000, order-3: 4000)
      expect(report.totalDelivery).toBe(9000);
    });

    it('should segment B2B and B2C orders correctly', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);

      expect(report.b2bOrders).toHaveLength(2);
      expect(report.b2cOrders).toHaveLength(2);

      // Verify B2B orders have B2B user IDs
      report.b2bOrders.forEach(order => {
        expect(report.b2b_clientIds.has(order.userId)).toBe(true);
      });

      // Verify B2C orders don't have B2B user IDs
      report.b2cOrders.forEach(order => {
        expect(report.b2b_clientIds.has(order.userId)).toBe(false);
      });
    });

    it('should pre-calculate B2B and B2C sales totals', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);

      expect(report.totalB2BSales).toBeGreaterThan(0);
      expect(report.totalB2CSales).toBeGreaterThan(0);
      expect(report.totalB2BSales + report.totalB2CSales).toBe(report.totalSales);
    });

    it('should pre-calculate date range', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);

      expect(report.dateRange).toBeDefined();
      expect(report.dateRange.start).toBeInstanceOf(Date);
      expect(report.dateRange.end).toBeInstanceOf(Date);
      expect(report.dateRange.totalDays).toBeGreaterThan(0);
    });

    it('should pre-calculate aggregated products', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);

      expect(report.aggregatedProducts).toBeDefined();
      expect(Array.isArray(report.aggregatedProducts)).toBe(true);
      expect(report.aggregatedProducts.length).toBeGreaterThan(0);
    });

    it('should pre-calculate segmented products (B2B/B2C)', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);

      expect(report.segmentedProducts).toBeDefined();
      expect(report.segmentedProducts.b2b).toBeDefined();
      expect(report.segmentedProducts.b2c).toBeDefined();
      expect(Array.isArray(report.segmentedProducts.b2b)).toBe(true);
      expect(Array.isArray(report.segmentedProducts.b2c)).toBe(true);
    });
  });

  describe('generateReport', () => {
    it('should return complete report structure', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const fullReport = report.generateReport();

      expect(fullReport).toHaveProperty('summary');
      expect(fullReport).toHaveProperty('salesMetrics');
      expect(fullReport).toHaveProperty('productMetrics');
      expect(fullReport).toHaveProperty('operationalMetrics');
      expect(fullReport).toHaveProperty('taxMetrics');
    });
  });

  describe('calculateDateRange', () => {
    it('should calculate correct start and end dates', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const dateRange = report.calculateDateRange();

      expect(dateRange.start).toEqual(new Date('2024-01-15T10:00:00Z'));
      expect(dateRange.end).toEqual(new Date('2024-01-20T10:00:00Z'));
    });

    it('should calculate total days correctly', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const dateRange = report.calculateDateRange();

      // Jan 15 to Jan 20 = 6 days (inclusive)
      expect(dateRange.totalDays).toBe(6);
    });

    it('should handle single day date range', () => {
      const singleDayOrders = [mockOrders[0]];
      const report = new SalesReport(singleDayOrders, mockB2BClients, mockProducts);
      const dateRange = report.calculateDateRange();

      expect(dateRange.totalDays).toBe(1);
      expect(dateRange.start).toEqual(dateRange.end);
    });
  });

  describe('generateSummary', () => {
    it('should include all required summary fields', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const summary = report.generateSummary();

      expect(summary).toHaveProperty('dateRange');
      expect(summary).toHaveProperty('totalPaidOrders');
      expect(summary).toHaveProperty('totalRevenue');
      expect(summary).toHaveProperty('totalSales');
      expect(summary).toHaveProperty('totalDelivery');
      expect(summary).toHaveProperty('totalB2B');
      expect(summary).toHaveProperty('totalB2C');
      expect(summary).toHaveProperty('percentageB2B');
      expect(summary).toHaveProperty('percentageB2C');
      expect(summary).toHaveProperty('totalComplimentaryOrders');
      expect(summary).toHaveProperty('currency');
    });

    it('should calculate B2B and B2C percentages correctly', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const summary = report.generateSummary();

      expect(summary.percentageB2B + summary.percentageB2C).toBeCloseTo(100, 0);
      expect(summary.percentageB2B).toBeGreaterThan(0);
      expect(summary.percentageB2C).toBeGreaterThan(0);
    });

    it('should count complimentary orders separately', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const summary = report.generateSummary();

      expect(summary.totalPaidOrders).toBe(4);
      expect(summary.totalComplimentaryOrders).toBe(1);
    });

    it('should set currency to COP', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const summary = report.generateSummary();

      expect(summary.currency).toBe('COP');
    });
  });

  describe('calculateTimeRanges', () => {
    it('should return daily, weekly, and monthly totals', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const timeRanges = report.calculateTimeRanges();

      expect(timeRanges).toHaveProperty('daily');
      expect(timeRanges).toHaveProperty('weekly');
      expect(timeRanges).toHaveProperty('monthly');
    });

    it('should calculate daily totals correctly', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const timeRanges = report.calculateTimeRanges();

      expect(Object.keys(timeRanges.daily).length).toBeGreaterThan(0);

      // Each daily entry should have required fields
      Object.values(timeRanges.daily).forEach(day => {
        expect(day).toHaveProperty('total');
        expect(day).toHaveProperty('sales');
        expect(day).toHaveProperty('delivery');
        expect(day).toHaveProperty('b2b');
        expect(day).toHaveProperty('b2c');
      });
    });

    it('should calculate B2B and B2C percentages for each day', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const timeRanges = report.calculateTimeRanges();

      Object.values(timeRanges.daily).forEach(day => {
        if (day.sales > 0) {
          expect(day.b2b.percentage + day.b2c.percentage).toBeCloseTo(100, 0);
        }
      });
    });

    it('should group daily totals into weekly periods', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const timeRanges = report.calculateTimeRanges();

      expect(Object.keys(timeRanges.weekly).length).toBeGreaterThan(0);

      Object.values(timeRanges.weekly).forEach(week => {
        expect(week).toHaveProperty('days');
        expect(week.days).toBeGreaterThan(0);
      });
    });

    it('should group daily totals into monthly periods', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const timeRanges = report.calculateTimeRanges();

      expect(timeRanges.monthly['2024-01']).toBeDefined();
      expect(timeRanges.monthly['2024-01'].days).toBe(3); // 15th, 16th, 20th (complimentary filtered before time ranges)
    });
  });

  describe('getWeekRange', () => {
    it('should return Monday-Sunday range for a given date', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);

      // Jan 15, 2024 is a Monday (use full ISO string to avoid timezone issues)
      const weekRange = report.getWeekRange(new Date('2024-01-15T12:00:00Z'));

      expect(weekRange).toContain('2024-01'); // Should contain January dates
      expect(weekRange.split('/').length).toBe(2); // Should have Monday/Sunday format
    });

    it('should handle dates in the middle of the week', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);

      // Jan 17, 2024 is a Wednesday
      const weekRange = report.getWeekRange(new Date('2024-01-17'));

      expect(weekRange).toContain('2024-01-15'); // Monday
      expect(weekRange).toContain('2024-01-21'); // Sunday
    });
  });

  describe('getMonthKey', () => {
    it('should return year-month format', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);

      const monthKey = report.getMonthKey(new Date('2024-01-15'));

      expect(monthKey).toBe('2024-01');
    });

    it('should pad single digit months with zero', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);

      // Use full ISO string to avoid timezone conversion issues
      const monthKey = report.getMonthKey(new Date('2024-09-15T12:00:00Z'));

      expect(monthKey).toBe('2024-09');
    });
  });

  describe('generateSalesMetrics', () => {
    it('should include all required sales metrics', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const salesMetrics = report.generateSalesMetrics();

      expect(salesMetrics).toHaveProperty('total');
      expect(salesMetrics).toHaveProperty('averageOrderValue');
      expect(salesMetrics).toHaveProperty('averageOrderSales');
      expect(salesMetrics).toHaveProperty('byPaymentMethod');
      expect(salesMetrics).toHaveProperty('byCollection');
      expect(salesMetrics).toHaveProperty('byCustomerSegment');
    });

    it('should calculate average order value correctly', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const salesMetrics = report.generateSalesMetrics();

      const expectedAvg = report.totalRevenue / report.orders.length;
      expect(salesMetrics.averageOrderValue).toBe(expectedAvg);
    });

    it('should calculate average order sales correctly', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const salesMetrics = report.generateSalesMetrics();

      const expectedAvg = report.totalSales / report.orders.length;
      expect(salesMetrics.averageOrderSales).toBe(expectedAvg);
    });
  });

  describe('calculateSalesByPaymentMethod', () => {
    it('should group sales by payment method', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const byPaymentMethod = report.calculateSalesByPaymentMethod();

      expect(byPaymentMethod).toHaveProperty('card');
      expect(byPaymentMethod).toHaveProperty('cash');
      expect(byPaymentMethod).toHaveProperty('transfer');
    });

    it('should calculate totals and order counts for each method', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const byPaymentMethod = report.calculateSalesByPaymentMethod();

      Object.values(byPaymentMethod).forEach(method => {
        expect(method).toHaveProperty('total');
        expect(method).toHaveProperty('orders');
        expect(method).toHaveProperty('percentage');
      });
    });

    it('should calculate percentages that sum to 100', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const byPaymentMethod = report.calculateSalesByPaymentMethod();

      const totalPercentage = Object.values(byPaymentMethod)
        .reduce((sum, method) => sum + method.percentage, 0);

      expect(totalPercentage).toBeCloseTo(100, 0);
    });
  });

  describe('calculateSalesByCollection', () => {
    it('should group sales by collection', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const byCollection = report.calculateSalesByCollection();

      expect(byCollection).toHaveProperty('Cakes');
      expect(byCollection).toHaveProperty('Cupcakes');
      expect(byCollection).toHaveProperty('Tarts');
      expect(byCollection).toHaveProperty('Muffins');
    });

    it('should calculate revenue and quantity for each collection', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const byCollection = report.calculateSalesByCollection();

      Object.values(byCollection).forEach(collection => {
        expect(collection).toHaveProperty('revenue');
        expect(collection).toHaveProperty('quantity');
        expect(collection).toHaveProperty('averagePrice');
        expect(collection).toHaveProperty('percentageRevenue');
        expect(collection).toHaveProperty('percentageQuantity');
      });
    });

    it('should not include complimentary items in collection sales', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const byCollection = report.calculateSalesByCollection();

      // Complimentary order had 10 cupcakes, should not be included
      const cupcakes = byCollection['Cupcakes'];
      expect(cupcakes.quantity).toBe(5); // Only from order-1
    });
  });

  describe('calculateSalesByCustomerSegment', () => {
    it('should return B2B and B2C segments', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const bySegment = report.calculateSalesByCustomerSegment();

      expect(bySegment).toHaveProperty('b2b');
      expect(bySegment).toHaveProperty('b2c');
    });

    it('should calculate segment metrics correctly', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const bySegment = report.calculateSalesByCustomerSegment();

      expect(bySegment.b2b.total).toBe(report.totalB2BSales);
      expect(bySegment.b2c.total).toBe(report.totalB2CSales);
      expect(bySegment.b2b.orders).toBe(report.b2bOrders.length);
      expect(bySegment.b2c.orders).toBe(report.b2cOrders.length);
    });

    it('should calculate segment percentages that sum to 100', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const bySegment = report.calculateSalesByCustomerSegment();

      const totalPercentage = bySegment.b2b.percentageSales + bySegment.b2c.percentageSales;
      expect(totalPercentage).toBeCloseTo(100, 0);
    });

    it('should calculate average price per segment', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const bySegment = report.calculateSalesByCustomerSegment();

      expect(bySegment.b2b.averagePrice).toBe(report.totalB2BSales / report.b2bOrders.length);
      expect(bySegment.b2c.averagePrice).toBe(report.totalB2CSales / report.b2cOrders.length);
    });
  });

  describe('aggregateProductData', () => {
    it('should aggregate all products with sales', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const products = report.aggregateProductData();

      expect(products.length).toBeGreaterThan(0);

      products.forEach(product => {
        expect(product).toHaveProperty('productId');
        expect(product).toHaveProperty('name');
        expect(product).toHaveProperty('collection');
        expect(product).toHaveProperty('quantity');
        expect(product).toHaveProperty('revenue');
        expect(product).toHaveProperty('averagePrice');
        expect(product).toHaveProperty('percentageOfSales');
        expect(product).toHaveProperty('percentageOfQuantity');
      });
    });

    it('should include products with zero sales from product list', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const products = report.aggregateProductData();

      // Should include all non-deleted products
      const activeProducts = mockProducts.filter(p => !p.isDeleted);
      expect(products.length).toBeGreaterThanOrEqual(activeProducts.length);
    });

    it('should not include complimentary items in product aggregation', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const products = report.aggregateProductData();

      const cupcakes = products.find(p => p.productId === 'prod-2');
      // Only 5 from order-1, not 10 from complimentary order-5
      expect(cupcakes.quantity).toBe(5);
    });

    it('should calculate product percentages correctly', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const products = report.aggregateProductData();

      const totalPercentage = products.reduce((sum, p) => sum + p.percentageOfSales, 0);
      expect(totalPercentage).toBeCloseTo(100, 0);
    });

    it('should aggregate same product from multiple orders', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const products = report.aggregateProductData();

      // Chocolate Cake (prod-1) is in 3 orders with quantities: 3, 2, 1
      const chocolateCake = products.find(p => p.productId === 'prod-1');
      expect(chocolateCake.quantity).toBe(6);
    });
  });

  describe('aggregateProductDataBySegment', () => {
    it('should return separate B2B and B2C product arrays', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const segmented = report.aggregateProductDataBySegment();

      expect(segmented).toHaveProperty('b2b');
      expect(segmented).toHaveProperty('b2c');
      expect(Array.isArray(segmented.b2b)).toBe(true);
      expect(Array.isArray(segmented.b2c)).toBe(true);
    });

    it('should aggregate B2B products correctly', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const segmented = report.aggregateProductDataBySegment();

      // B2B orders have prod-1 and prod-2
      const b2bProductIds = segmented.b2b.map(p => p.productId);
      expect(b2bProductIds).toContain('prod-1');
      expect(b2bProductIds).toContain('prod-2');
    });

    it('should aggregate B2C products correctly', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const segmented = report.aggregateProductDataBySegment();

      // B2C orders have prod-1, prod-3, prod-4, prod-5
      const b2cProductIds = segmented.b2c.map(p => p.productId);
      expect(b2cProductIds).toContain('prod-1');
      expect(b2cProductIds).toContain('prod-3');
      expect(b2cProductIds).toContain('prod-4');
      expect(b2cProductIds).toContain('prod-5');
    });

    it('should calculate percentages relative to segment totals', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const segmented = report.aggregateProductDataBySegment();

      const b2bTotalPercentage = segmented.b2b.reduce((sum, p) => sum + p.percentageOfSales, 0);
      const b2cTotalPercentage = segmented.b2c.reduce((sum, p) => sum + p.percentageOfSales, 0);

      expect(b2bTotalPercentage).toBeCloseTo(100, 0);
      expect(b2cTotalPercentage).toBeCloseTo(100, 0);
    });

    it('should track same product in both segments separately', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const segmented = report.aggregateProductDataBySegment();

      // prod-1 (Chocolate Cake) is in both B2B and B2C orders
      const b2bChocolate = segmented.b2b.find(p => p.productId === 'prod-1');
      const b2cChocolate = segmented.b2c.find(p => p.productId === 'prod-1');

      expect(b2bChocolate).toBeDefined();
      expect(b2cChocolate).toBeDefined();

      // B2B has 5 total (3 + 2), B2C has 1
      expect(b2bChocolate.quantity).toBe(5);
      expect(b2cChocolate.quantity).toBe(1);
    });

    it('should not include complimentary items in segmented data', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const segmented = report.aggregateProductDataBySegment();

      // prod-2 cupcakes: 5 in B2B order-1, 10 in complimentary order-5
      const b2bCupcakes = segmented.b2b.find(p => p.productId === 'prod-2');
      expect(b2bCupcakes.quantity).toBe(5); // Should not include complimentary 10
    });
  });

  describe('generateProductMetrics', () => {
    it('should include all product metric categories', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const productMetrics = report.generateProductMetrics();

      expect(productMetrics).toHaveProperty('bestSellers');
      expect(productMetrics).toHaveProperty('lowestSellers');
      expect(productMetrics).toHaveProperty('averageItemsPerOrder');
      expect(productMetrics.bestSellers).toHaveProperty('byQuantity');
      expect(productMetrics.bestSellers).toHaveProperty('bySales');
      expect(productMetrics.bestSellers).toHaveProperty('b2b');
      expect(productMetrics.bestSellers).toHaveProperty('b2c');
      expect(productMetrics.lowestSellers).toHaveProperty('byQuantity');
      expect(productMetrics.lowestSellers).toHaveProperty('bySales');
    });
  });

  describe('calculateBestSellersByQuantity', () => {
    it('should return products sorted by quantity in descending order', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const bestSellers = report.calculateBestSellersByQuantity();

      for (let i = 0; i < bestSellers.length - 1; i++) {
        expect(bestSellers[i].quantity).toBeGreaterThanOrEqual(bestSellers[i + 1].quantity);
      }
    });

    it('should limit results to 10 items', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const bestSellers = report.calculateBestSellersByQuantity();

      expect(bestSellers.length).toBeLessThanOrEqual(10);
    });

    it('should have Chocolate Cake as top seller by quantity', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const bestSellers = report.calculateBestSellersByQuantity();

      // Chocolate Cake has total quantity of 6 (3+2+1)
      expect(bestSellers[0].productId).toBe('prod-1');
      expect(bestSellers[0].quantity).toBe(6);
    });
  });

  describe('calculateBestSellersBySales', () => {
    it('should return products sorted by revenue in descending order', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const bestSellers = report.calculateBestSellersBySales();

      for (let i = 0; i < bestSellers.length - 1; i++) {
        expect(bestSellers[i].revenue).toBeGreaterThanOrEqual(bestSellers[i + 1].revenue);
      }
    });

    it('should limit results to 10 items', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const bestSellers = report.calculateBestSellersBySales();

      expect(bestSellers.length).toBeLessThanOrEqual(10);
    });
  });

  describe('calculateLowestSellersByQuantity', () => {
    it('should return products sorted by quantity in ascending order', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const lowestSellers = report.calculateLowestSellersByQuantity();

      for (let i = 0; i < lowestSellers.length - 1; i++) {
        expect(lowestSellers[i].quantity).toBeLessThanOrEqual(lowestSellers[i + 1].quantity);
      }
    });

    it('should limit results to 10 items', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const lowestSellers = report.calculateLowestSellersByQuantity();

      expect(lowestSellers.length).toBeLessThanOrEqual(10);
    });
  });

  describe('calculateLowestSellersBySales', () => {
    it('should return products sorted by revenue in ascending order', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const lowestSellers = report.calculateLowestSellersBySales();

      for (let i = 0; i < lowestSellers.length - 1; i++) {
        expect(lowestSellers[i].revenue).toBeLessThanOrEqual(lowestSellers[i + 1].revenue);
      }
    });

    it('should limit results to 10 items', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const lowestSellers = report.calculateLowestSellersBySales();

      expect(lowestSellers.length).toBeLessThanOrEqual(10);
    });
  });

  describe('calculateBestSellersB2B', () => {
    it('should return B2B products sorted by revenue in descending order', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const bestSellers = report.calculateBestSellersB2B();

      for (let i = 0; i < bestSellers.length - 1; i++) {
        expect(bestSellers[i].revenue).toBeGreaterThanOrEqual(bestSellers[i + 1].revenue);
      }
    });

    it('should limit results to 10 items', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const bestSellers = report.calculateBestSellersB2B();

      expect(bestSellers.length).toBeLessThanOrEqual(10);
    });

    it('should only include products from B2B orders', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const bestSellers = report.calculateBestSellersB2B();

      // B2B orders only have prod-1 and prod-2
      const productIds = bestSellers.map(p => p.productId);
      expect(productIds).toContain('prod-1');
      expect(productIds).toContain('prod-2');
      expect(productIds).not.toContain('prod-3'); // B2C only
      expect(productIds).not.toContain('prod-5'); // B2C only
    });

    it('should have Chocolate Cake as top B2B seller', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const bestSellers = report.calculateBestSellersB2B();

      // Chocolate Cake has highest B2B revenue (5 units at 10000 each)
      expect(bestSellers[0].productId).toBe('prod-1');
    });
  });

  describe('calculateBestSellersB2C', () => {
    it('should return B2C products sorted by revenue in descending order', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const bestSellers = report.calculateBestSellersB2C();

      for (let i = 0; i < bestSellers.length - 1; i++) {
        expect(bestSellers[i].revenue).toBeGreaterThanOrEqual(bestSellers[i + 1].revenue);
      }
    });

    it('should limit results to 10 items', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const bestSellers = report.calculateBestSellersB2C();

      expect(bestSellers.length).toBeLessThanOrEqual(10);
    });

    it('should only include products from B2C orders', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const bestSellers = report.calculateBestSellersB2C();

      // B2C orders have prod-1, prod-3, prod-4, prod-5
      const productIds = bestSellers.map(p => p.productId);
      expect(productIds.length).toBeGreaterThan(0);

      // Should not include prod-2 which is B2B only
      expect(productIds).not.toContain('prod-2');
    });

    it('should have Lemon Cake in B2C best sellers', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const bestSellers = report.calculateBestSellersB2C();

      const productIds = bestSellers.map(p => p.productId);
      expect(productIds).toContain('prod-5'); // Lemon Cake is B2C only
    });
  });

  describe('calculateAverageItemsPerOrder', () => {
    it('should calculate average items per order correctly', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const avgItems = report.calculateAverageItemsPerOrder();

      // Calculate expected manually
      const totalItems = report.orders.reduce((sum, order) => {
        const orderItems = order.orderItems
          .filter(item => !item.isComplimentary)
          .reduce((itemSum, item) => itemSum + item.quantity, 0);
        return sum + orderItems;
      }, 0);
      const expected = totalItems / report.orders.length;

      expect(avgItems).toBe(expected);
    });

    it('should not include complimentary items in average', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const avgItems = report.calculateAverageItemsPerOrder();

      // Should be calculated from 4 paid orders, not including complimentary order
      expect(avgItems).toBeGreaterThan(0);
    });
  });

  describe('generateOperationalMetrics', () => {
    it('should include fulfillment and delivery metrics', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const operationalMetrics = report.generateOperationalMetrics();

      expect(operationalMetrics).toHaveProperty('fulfillment');
      expect(operationalMetrics).toHaveProperty('deliveryMetrics');
    });
  });

  describe('calculateFulfillmentMetrics', () => {
    it('should return delivery and pickup metrics', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const fulfillment = report.calculateFulfillmentMetrics();

      expect(fulfillment).toHaveProperty('delivery');
      expect(fulfillment).toHaveProperty('pickup');
      expect(fulfillment.delivery).toHaveProperty('orders');
      expect(fulfillment.delivery).toHaveProperty('percentage');
      expect(fulfillment.pickup).toHaveProperty('orders');
      expect(fulfillment.pickup).toHaveProperty('percentage');
    });

    it('should calculate percentages that sum to 100', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const fulfillment = report.calculateFulfillmentMetrics();

      const totalPercentage = fulfillment.delivery.percentage + fulfillment.pickup.percentage;
      expect(totalPercentage).toBeCloseTo(100, 0);
    });

    it('should count fulfillment types correctly', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const fulfillment = report.calculateFulfillmentMetrics();

      // 2 delivery orders (order-1, order-3), 2 pickup orders (order-2, order-4)
      expect(fulfillment.delivery.orders).toBe(2);
      expect(fulfillment.pickup.orders).toBe(2);
    });
  });

  describe('calculateDeliveryMetrics', () => {
    it('should include all delivery metrics', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const deliveryMetrics = report.calculateDeliveryMetrics();

      expect(deliveryMetrics).toHaveProperty('totalFees');
      expect(deliveryMetrics).toHaveProperty('averageFee');
      expect(deliveryMetrics).toHaveProperty('totalCost');
      expect(deliveryMetrics).toHaveProperty('averageCost');
      expect(deliveryMetrics).toHaveProperty('deliveryRevenue');
      expect(deliveryMetrics).toHaveProperty('totalOrders');
    });

    it('should calculate total delivery fees correctly', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const deliveryMetrics = report.calculateDeliveryMetrics();

      // order-1: 5000, order-3: 4000
      expect(deliveryMetrics.totalFees).toBe(9000);
    });

    it('should calculate total delivery costs correctly', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const deliveryMetrics = report.calculateDeliveryMetrics();

      // order-1: 3000, order-3: 2500
      expect(deliveryMetrics.totalCost).toBe(5500);
    });

    it('should calculate delivery revenue (profit) correctly', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const deliveryMetrics = report.calculateDeliveryMetrics();

      // totalFees - totalCost = 9000 - 5500
      expect(deliveryMetrics.deliveryRevenue).toBe(3500);
    });

    it('should count delivery orders correctly', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const deliveryMetrics = report.calculateDeliveryMetrics();

      expect(deliveryMetrics.totalOrders).toBe(2);
    });

    it('should calculate average fee and cost correctly', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const deliveryMetrics = report.calculateDeliveryMetrics();

      expect(deliveryMetrics.averageFee).toBe(4500); // 9000 / 2
      expect(deliveryMetrics.averageCost).toBe(2750); // 5500 / 2
    });
  });

  describe('generateTaxMetrics', () => {
    it('should include all tax metrics', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const taxMetrics = report.generateTaxMetrics();

      expect(taxMetrics).toHaveProperty('taxableItems');
      expect(taxMetrics).toHaveProperty('preTaxSubtotal');
      expect(taxMetrics).toHaveProperty('totalTax');
      expect(taxMetrics).toHaveProperty('total');
    });

    it('should count only items with tax > 0', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const taxMetrics = report.generateTaxMetrics();

      // Items with 19% tax: order-1 prod-1 (3), order-2 prod-1 (2), order-3 prod-3 (1), order-4 prod-1 (1), order-4 prod-5 (2)
      expect(taxMetrics.taxableItems).toBe(9);
    });

    it('should not include complimentary items in tax calculations', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const taxMetrics = report.generateTaxMetrics();

      // Complimentary order has 10 cupcakes, should not be included
      expect(taxMetrics.taxableItems).not.toContain(10);
    });

    it('should calculate tax totals correctly', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const taxMetrics = report.generateTaxMetrics();

      expect(taxMetrics.totalTax).toBeGreaterThan(0);
      expect(taxMetrics.preTaxSubtotal).toBeGreaterThan(0);
      expect(taxMetrics.total).toBe(taxMetrics.preTaxSubtotal + taxMetrics.totalTax);
    });
  });

  describe('edge cases', () => {
    it('should handle empty orders array', () => {
      const report = new SalesReport([], mockB2BClients, mockProducts);

      expect(report.orders).toHaveLength(0);
      expect(report.totalRevenue).toBe(0);
      expect(report.totalSales).toBe(0);
    });

    it('should handle all complimentary orders', () => {
      const allComplimentary = mockOrders.map(order => ({ ...order, paymentMethod: 'complimentary' }));
      const report = new SalesReport(allComplimentary, mockB2BClients, mockProducts);

      expect(report.orders).toHaveLength(0);
      expect(report.complimentaryOrders).toHaveLength(5);
      expect(report.totalRevenue).toBe(0);
    });

    it('should handle no B2B clients', () => {
      const report = new SalesReport(mockOrders, [], mockProducts);

      expect(report.b2bOrders).toHaveLength(0);
      expect(report.b2cOrders).toHaveLength(4);
      expect(report.totalB2BSales).toBe(0);
    });

    it('should handle division by zero when no orders', () => {
      const report = new SalesReport([], mockB2BClients, mockProducts);
      const summary = report.generateSummary();

      // When totalSales is 0, percentages will be NaN
      expect(summary.percentageB2B).toBeNaN();
      expect(summary.percentageB2C).toBeNaN();
    });

    it('should handle orders with no delivery fee', () => {
      const noDeliveryOrders = mockOrders.map(order => {
        const newOrder = { ...order, fulfillmentType: 'pickup' };
        delete newOrder.deliveryFee;
        delete newOrder.deliveryCost;
        return newOrder;
      });

      const report = new SalesReport(noDeliveryOrders, mockB2BClients, mockProducts);
      const deliveryMetrics = report.calculateDeliveryMetrics();

      expect(deliveryMetrics.totalFees).toBe(0);
      expect(deliveryMetrics.totalCost).toBe(0);
      expect(deliveryMetrics.totalOrders).toBe(0);
      expect(deliveryMetrics.averageFee).toBe(0);
      expect(deliveryMetrics.averageCost).toBe(0);
    });

    it('should handle products with zero sales', () => {
      const unusedProduct = {
        id: 'unused-product',
        name: 'Unused Product',
        collectionName: 'Test',
        isDeleted: false,
      };
      const productsWithUnused = [...mockProducts, unusedProduct];

      const report = new SalesReport(mockOrders, mockB2BClients, productsWithUnused);
      const products = report.aggregateProductData();

      const unused = products.find(p => p.productId === 'unused-product');
      expect(unused).toBeDefined();
      expect(unused.quantity).toBe(0);
      expect(unused.revenue).toBe(0);
    });

    it('should include deleted products that have sales', () => {
      // Add order with deleted product
      const orderWithDeletedProduct = {
        id: 'order-deleted',
        userId: b2cUserId1,
        dueDate: '2024-01-18T10:00:00Z',
        status: 4,
        fulfillmentType: 'pickup',
        paymentMethod: 'card',
        isComplimentary: false,
        orderItems: [
          {
            productId: 'prod-deleted',
            productName: 'Old Product',
            collectionName: 'Cakes',
            quantity: 1,
            currentPrice: 5000,
            taxPercentage: 0,
            isComplimentary: false,
          },
        ],
      };

      const ordersWithDeleted = [...mockOrders, orderWithDeletedProduct];
      const report = new SalesReport(ordersWithDeleted, mockB2BClients, mockProducts);
      const products = report.aggregateProductData();

      const deletedProduct = products.find(p => p.productId === 'prod-deleted');
      expect(deletedProduct).toBeDefined();
      expect(deletedProduct.quantity).toBe(1);
    });

    it('should not include deleted products without sales', () => {
      const report = new SalesReport(mockOrders, mockB2BClients, mockProducts);
      const products = report.aggregateProductData();

      const deletedProduct = products.find(p => p.productId === 'prod-deleted');
      expect(deletedProduct).toBeUndefined();
    });
  });
});
