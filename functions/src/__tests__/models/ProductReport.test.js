// tests/unit/models/ProductReport.test.js
const ProductReport = require('../../models/ProductReport');
const { Order } = require('../../models/Order');

describe('ProductReport', () => {
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
      { id: 'prod-1', name: 'Original Sourdough', collectionId: 'col-sourdough', collectionName: 'sourdough', isDeleted: false },
      { id: 'prod-2', name: 'Zaatar Sourdough', collectionId: 'col-sourdough', collectionName: 'sourdough', isDeleted: false },
      { id: 'prod-3', name: 'Pan Hamburguesa', collectionId: 'col-panaderia', collectionName: 'panaderia tradicional', isDeleted: false },
      { id: 'prod-4', name: 'Baguette Original', collectionId: 'col-baguette', collectionName: 'baguette', isDeleted: false },
      { id: 'prod-5', name: 'Mermelada Fresa', collectionId: 'col-untables', collectionName: 'untables', isDeleted: false },
      { id: 'prod-deleted', name: 'Old Product', collectionId: 'col-sourdough', collectionName: 'sourdough', isDeleted: true },
    ];

    // Create mock orders with varied data across different dates
    mockOrders = [
      // B2B Order 1 - January 15 - Delivery
      {
        id: 'order-1',
        userId: b2bUserId1,
        dueDate: '2024-01-15T10:00:00Z',
        status: 3,
        fulfillmentType: 'delivery',
        deliveryFee: 6000,
        deliveryCost: 4000,
        paymentMethod: 'transfer',
        isComplimentary: false,
        orderItems: [
          {
            productId: 'prod-1',
            productName: 'Original Sourdough',
            collectionId: 'col-sourdough',
            collectionName: 'sourdough',
            quantity: 2,
            currentPrice: 22000,
            taxPercentage: 0,
            isComplimentary: false,
          },
          {
            productId: 'prod-3',
            productName: 'Pan Hamburguesa',
            collectionId: 'col-panaderia',
            collectionName: 'panaderia tradicional',
            quantity: 30,
            currentPrice: 1200,
            taxPercentage: 0,
            isComplimentary: false,
          },
        ],
      },
      // B2B Order 2 - January 22 - Pickup
      {
        id: 'order-2',
        userId: b2bUserId2,
        dueDate: '2024-01-22T10:00:00Z',
        status: 3,
        fulfillmentType: 'pickup',
        paymentMethod: 'cash',
        isComplimentary: false,
        orderItems: [
          {
            productId: 'prod-1',
            productName: 'Original Sourdough',
            collectionId: 'col-sourdough',
            collectionName: 'sourdough',
            quantity: 4,
            currentPrice: 23925,
            taxPercentage: 0,
            isComplimentary: false,
          },
        ],
      },
      // B2C Order 1 - January 20 - Delivery
      {
        id: 'order-3',
        userId: b2cUserId1,
        dueDate: '2024-01-20T14:00:00Z',
        status: 3,
        fulfillmentType: 'delivery',
        deliveryFee: 7000,
        deliveryCost: 5000,
        paymentMethod: 'transfer',
        isComplimentary: false,
        orderItems: [
          {
            productId: 'prod-2',
            productName: 'Zaatar Sourdough',
            collectionId: 'col-sourdough',
            collectionName: 'sourdough',
            quantity: 1,
            currentPrice: 22000,
            taxPercentage: 0,
            isComplimentary: false,
          },
          {
            productId: 'prod-4',
            productName: 'Baguette Original',
            collectionId: 'col-baguette',
            collectionName: 'baguette',
            quantity: 5,
            currentPrice: 9900,
            taxPercentage: 0,
            isComplimentary: false,
          },
        ],
      },
      // B2C Order 2 - February 5 - Pickup
      {
        id: 'order-4',
        userId: b2cUserId2,
        dueDate: '2024-02-05T10:00:00Z',
        status: 3,
        fulfillmentType: 'pickup',
        paymentMethod: 'transfer',
        isComplimentary: false,
        orderItems: [
          {
            productId: 'prod-1',
            productName: 'Original Sourdough',
            collectionId: 'col-sourdough',
            collectionName: 'sourdough',
            quantity: 1,
            currentPrice: 19800,
            taxPercentage: 0,
            isComplimentary: false,
          },
          {
            productId: 'prod-5',
            productName: 'Mermelada Fresa',
            collectionId: 'col-untables',
            collectionName: 'untables',
            quantity: 2,
            currentPrice: 18000,
            taxPercentage: 0,
            isComplimentary: false,
          },
        ],
      },
      // Complimentary Order (should be filtered out)
      {
        id: 'order-5',
        userId: b2cUserId1,
        dueDate: '2024-01-17T10:00:00Z',
        status: 3,
        fulfillmentType: 'pickup',
        paymentMethod: 'complimentary',
        orderItems: [
          {
            productId: 'prod-2',
            productName: 'Zaatar Sourdough',
            collectionId: 'col-sourdough',
            collectionName: 'sourdough',
            quantity: 10,
            currentPrice: 22000,
            taxPercentage: 0,
          },
        ],
      },
    ];
  });

  describe('constructor', () => {
    it('should initialize with orders, b2b clients, products, and default options', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts);

      expect(report).toBeDefined();
      expect(report.options).toBeDefined();
      expect(report.options.categories).toBeNull();
      expect(report.options.period).toBeNull();
      expect(report.options.metrics).toBe('both');
      expect(report.options.segment).toBe('none');
      expect(report.options.dateField).toBe('dueDate');
    });

    it('should filter out complimentary orders', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts);

      expect(report.orders).toHaveLength(4);
    });

    it('should accept custom options', () => {
      const options = {
        categories: ['col-sourdough'],
        period: 'monthly',
        metrics: 'ingresos',
        segment: 'b2b',
        dateField: 'paymentDate',
      };
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, options);

      expect(report.options.categories).toEqual(['col-sourdough']);
      expect(report.options.period).toBe('monthly');
      expect(report.options.metrics).toBe('ingresos');
      expect(report.options.segment).toBe('b2b');
      expect(report.options.dateField).toBe('paymentDate');
    });
  });

  describe('filterOrdersBySegment', () => {
    it('should return all orders when segment is "none"', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, { segment: 'none' });

      expect(report.orders).toHaveLength(4);
    });

    it('should return all orders when segment is "all"', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, { segment: 'all' });

      expect(report.orders).toHaveLength(4);
    });

    it('should return only B2B orders when segment is "b2b"', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, { segment: 'b2b' });

      expect(report.orders).toHaveLength(2);
      report.orders.forEach(order => {
        expect(report.b2b_clientIds.has(order.userId)).toBe(true);
      });
    });

    it('should return only B2C orders when segment is "b2c"', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, { segment: 'b2c' });

      expect(report.orders).toHaveLength(2);
      report.orders.forEach(order => {
        expect(report.b2b_clientIds.has(order.userId)).toBe(false);
      });
    });
  });

  describe('generateReport', () => {
    it('should return complete report structure', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts);
      const fullReport = report.generateReport();

      expect(fullReport).toHaveProperty('metadata');
      expect(fullReport).toHaveProperty('products');
      expect(fullReport).toHaveProperty('summary');
    });
  });

  describe('generateMetadata', () => {
    it('should include all required metadata fields', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts);
      const metadata = report.generateMetadata();

      expect(metadata).toHaveProperty('options');
      expect(metadata).toHaveProperty('totalOrders');
      expect(metadata).toHaveProperty('dateRange');
      expect(metadata).toHaveProperty('totalProducts');
      expect(metadata).toHaveProperty('currency');
    });

    it('should calculate date range from orders', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts);
      const metadata = report.generateMetadata();

      expect(metadata.dateRange.start).toBeInstanceOf(Date);
      expect(metadata.dateRange.end).toBeInstanceOf(Date);
    });

    it('should count orders correctly', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts);
      const metadata = report.generateMetadata();

      expect(metadata.totalOrders).toBe(4);
    });
  });

  describe('generateProductTable', () => {
    it('should return array of products with required fields', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts);
      const products = report.generateProductTable();

      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBeGreaterThan(0);

      products.forEach(product => {
        expect(product).toHaveProperty('categoryId');
        expect(product).toHaveProperty('categoryName');
        expect(product).toHaveProperty('productId');
        expect(product).toHaveProperty('productName');
        expect(product).toHaveProperty('avgPrice');
      });
    });

    it('should include both metrics when metrics option is "both"', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, { metrics: 'both' });
      const products = report.generateProductTable();

      products.forEach(product => {
        expect(product).toHaveProperty('totalIngresos');
        expect(product).toHaveProperty('totalCantidad');
      });
    });

    it('should include only ingresos when metrics option is "ingresos"', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, { metrics: 'ingresos' });
      const products = report.generateProductTable();

      products.forEach(product => {
        expect(product).toHaveProperty('totalIngresos');
        expect(product).not.toHaveProperty('totalCantidad');
      });
    });

    it('should include only cantidad when metrics option is "cantidad"', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, { metrics: 'cantidad' });
      const products = report.generateProductTable();

      products.forEach(product => {
        expect(product).not.toHaveProperty('totalIngresos');
        expect(product).toHaveProperty('totalCantidad');
      });
    });

    it('should include B2B/B2C breakdown when segment is "all"', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, { segment: 'all' });
      const products = report.generateProductTable();

      products.forEach(product => {
        expect(product).toHaveProperty('totalIngresos');
        expect(product).toHaveProperty('totalCantidad');
        expect(product).toHaveProperty('b2bIngresos');
        expect(product).toHaveProperty('b2bCantidad');
        expect(product).toHaveProperty('b2cIngresos');
        expect(product).toHaveProperty('b2cCantidad');
      });
    });

    it('should sort products by category then by product name', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts);
      const products = report.generateProductTable();

      for (let i = 0; i < products.length - 1; i++) {
        const catCompare = (products[i].categoryName || '').localeCompare(products[i + 1].categoryName || '');
        if (catCompare === 0) {
          expect((products[i].productName || '').localeCompare(products[i + 1].productName || '')).toBeLessThanOrEqual(0);
        } else {
          expect(catCompare).toBeLessThanOrEqual(0);
        }
      }
    });
  });

  describe('generateProductTable with periods', () => {
    it('should include period data when period option is set', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, { period: 'monthly' });
      const products = report.generateProductTable();

      const productsWithSales = products.filter(p => p.totalCantidad > 0);
      productsWithSales.forEach(product => {
        expect(product).toHaveProperty('periods');
        expect(typeof product.periods).toBe('object');
      });
    });

    it('should create monthly period keys in correct format', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, { period: 'monthly' });
      const products = report.generateProductTable();

      const productWithPeriods = products.find(p => p.periods && Object.keys(p.periods).length > 0);
      if (productWithPeriods) {
        Object.keys(productWithPeriods.periods).forEach(key => {
          expect(key).toMatch(/^\d{4}-\d{2}$/); // YYYY-MM format
        });
      }
    });

    it('should create weekly period keys in correct format', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, { period: 'weekly' });
      const products = report.generateProductTable();

      const productWithPeriods = products.find(p => p.periods && Object.keys(p.periods).length > 0);
      if (productWithPeriods) {
        Object.keys(productWithPeriods.periods).forEach(key => {
          expect(key).toMatch(/^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD/YYYY-MM-DD format
        });
      }
    });

    it('should create daily period keys in correct format', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, { period: 'daily' });
      const products = report.generateProductTable();

      const productWithPeriods = products.find(p => p.periods && Object.keys(p.periods).length > 0);
      if (productWithPeriods) {
        Object.keys(productWithPeriods.periods).forEach(key => {
          expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
        });
      }
    });

    it('should only include requested metrics in period data', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, {
        period: 'monthly',
        metrics: 'ingresos',
      });
      const products = report.generateProductTable();

      const productWithPeriods = products.find(p => p.periods && Object.keys(p.periods).length > 0);
      if (productWithPeriods) {
        Object.values(productWithPeriods.periods).forEach(periodData => {
          expect(periodData).toHaveProperty('ingresos');
          expect(periodData).not.toHaveProperty('cantidad');
        });
      }
    });
  });

  describe('generateSummary', () => {
    it('should include totals and byCategory', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts);
      const summary = report.generateSummary();

      expect(summary).toHaveProperty('totals');
      expect(summary).toHaveProperty('byCategory');
    });

    it('should calculate overall totals correctly', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts);
      const summary = report.generateSummary();

      expect(summary.totals.totalIngresos).toBeGreaterThan(0);
      expect(summary.totals.totalCantidad).toBeGreaterThan(0);
    });

    it('should include B2B/B2C breakdown when segment is "all"', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, { segment: 'all' });
      const summary = report.generateSummary();

      expect(summary.totals).toHaveProperty('b2bIngresos');
      expect(summary.totals).toHaveProperty('b2cIngresos');
      expect(summary.totals).toHaveProperty('b2bCantidad');
      expect(summary.totals).toHaveProperty('b2cCantidad');
    });

    it('should calculate totals by category', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts);
      const summary = report.generateSummary();

      expect(Array.isArray(summary.byCategory)).toBe(true);
      summary.byCategory.forEach(cat => {
        expect(cat).toHaveProperty('categoryId');
        expect(cat).toHaveProperty('categoryName');
        expect(cat).toHaveProperty('totalIngresos');
        expect(cat).toHaveProperty('totalCantidad');
      });
    });
  });

  describe('aggregateProductData', () => {
    it('should aggregate products with sales', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts);

      expect(report.aggregatedData.length).toBeGreaterThan(0);
    });

    it('should include products with zero sales', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts);

      // prod-5 (Mermelada) only has sales in one order
      // All non-deleted products should be included
      const activeProducts = mockProducts.filter(p => !p.isDeleted);
      expect(report.aggregatedData.length).toBeGreaterThanOrEqual(activeProducts.length);
    });

    it('should not include complimentary items', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts);

      // Zaatar (prod-2) has 1 in order-3, 10 in complimentary order-5
      const zaatar = report.aggregatedData.find(p => p.productId === 'prod-2');
      expect(zaatar.totalCantidad).toBe(1); // Only from order-3
    });

    it('should aggregate same product from multiple orders', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts);

      // Original Sourdough (prod-1) is in orders 1, 2, 4 with quantities 2, 4, 1
      const original = report.aggregatedData.find(p => p.productId === 'prod-1');
      expect(original.totalCantidad).toBe(7);
    });

    it('should calculate correct average price', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts);

      // Original Sourdough: (22000*2 + 23925*4 + 19800*1) / 7 = 159500 / 7 ≈ 22785.71
      const original = report.aggregatedData.find(p => p.productId === 'prod-1');
      const expectedAvg = (22000 * 2 + 23925 * 4 + 19800 * 1) / 7;
      expect(original.avgPrice).toBeCloseTo(expectedAvg, 2);
    });

    it('should calculate B2B/B2C breakdown when segment is "all"', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, { segment: 'all' });

      // prod-1 is in B2B (orders 1, 2) and B2C (order 4)
      const original = report.aggregatedData.find(p => p.productId === 'prod-1');
      expect(original.b2bCantidad).toBe(6); // 2 + 4
      expect(original.b2cCantidad).toBe(1);
    });
  });

  describe('category filtering', () => {
    it('should filter products by category when categories option is set', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, {
        categories: ['col-sourdough'],
      });
      const products = report.generateProductTable();

      products.filter(p => p.totalCantidad > 0).forEach(product => {
        expect(product.categoryId).toBe('col-sourdough');
      });
    });

    it('should include multiple categories when specified', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, {
        categories: ['col-sourdough', 'col-baguette'],
      });
      const products = report.generateProductTable();

      const categoryIds = [...new Set(products.filter(p => p.totalCantidad > 0).map(p => p.categoryId))];
      expect(categoryIds.every(id => ['col-sourdough', 'col-baguette'].includes(id))).toBe(true);
    });

    it('should return all categories when categories option is null', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, {
        categories: null,
      });
      const products = report.generateProductTable();

      const categoryIds = [...new Set(products.filter(p => p.totalCantidad > 0).map(p => p.categoryId))];
      expect(categoryIds.length).toBeGreaterThan(1);
    });
  });

  describe('getPeriodKey', () => {
    it('should return correct monthly key', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, { period: 'monthly' });
      const key = report.getPeriodKey(new Date('2024-01-15T12:00:00Z'));

      expect(key).toBe('2024-01');
    });

    it('should return correct daily key', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, { period: 'daily' });
      const key = report.getPeriodKey(new Date('2024-01-15T12:00:00Z'));

      expect(key).toBe('2024-01-15');
    });

    it('should return null when period is not set', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts);
      const key = report.getPeriodKey(new Date('2024-01-15T12:00:00Z'));

      expect(key).toBeNull();
    });
  });

  describe('getWeekRange', () => {
    it('should return Monday-Sunday range', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, { period: 'weekly' });

      // Jan 17, 2024 is a Wednesday
      const weekRange = report.getWeekRange(new Date('2024-01-17'));

      expect(weekRange).toContain('2024-01-15'); // Monday
      expect(weekRange).toContain('2024-01-21'); // Sunday
    });

    it('should handle dates that are already Monday', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, { period: 'weekly' });

      // Jan 15, 2024 is a Monday - use full ISO string to avoid timezone issues
      const weekRange = report.getWeekRange(new Date('2024-01-15T12:00:00Z'));

      expect(weekRange).toContain('2024-01-15'); // Same Monday
      expect(weekRange).toContain('2024-01-21'); // Sunday
    });
  });

  describe('getMonthKey', () => {
    it('should return year-month format', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts);
      const monthKey = report.getMonthKey(new Date('2024-01-15'));

      expect(monthKey).toBe('2024-01');
    });

    it('should pad single digit months with zero', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts);
      const monthKey = report.getMonthKey(new Date('2024-09-15T12:00:00Z'));

      expect(monthKey).toBe('2024-09');
    });
  });

  describe('edge cases', () => {
    it('should handle empty orders array', () => {
      const report = new ProductReport([], mockB2BClients, mockProducts);
      const fullReport = report.generateReport();

      expect(report.orders).toHaveLength(0);
      expect(fullReport.metadata.totalOrders).toBe(0);
      expect(fullReport.summary.totals.totalIngresos).toBe(0);
    });

    it('should handle all complimentary orders', () => {
      const allComplimentary = mockOrders.map(order => ({ ...order, paymentMethod: 'complimentary' }));
      const report = new ProductReport(allComplimentary, mockB2BClients, mockProducts);

      expect(report.orders).toHaveLength(0);
    });

    it('should handle no B2B clients', () => {
      const report = new ProductReport(mockOrders, [], mockProducts, { segment: 'b2b' });

      expect(report.orders).toHaveLength(0);
    });

    it('should handle empty products list', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, []);
      const products = report.generateProductTable();

      // Should still aggregate products from orders
      expect(products.length).toBeGreaterThan(0);
    });

    it('should handle products with zero sales', () => {
      const unusedProduct = {
        id: 'unused-product',
        name: 'Unused Product',
        collectionId: 'col-test',
        collectionName: 'test',
        isDeleted: false,
      };
      const productsWithUnused = [...mockProducts, unusedProduct];

      const report = new ProductReport(mockOrders, mockB2BClients, productsWithUnused);
      const products = report.generateProductTable();

      const unused = products.find(p => p.productId === 'unused-product');
      expect(unused).toBeDefined();
      expect(unused.totalCantidad).toBe(0);
      expect(unused.totalIngresos).toBe(0);
    });

    it('should include deleted products that have sales', () => {
      const orderWithDeletedProduct = {
        id: 'order-deleted',
        userId: b2cUserId1,
        dueDate: '2024-01-18T10:00:00Z',
        status: 3,
        fulfillmentType: 'pickup',
        paymentMethod: 'transfer',
        isComplimentary: false,
        orderItems: [
          {
            productId: 'prod-deleted',
            productName: 'Old Product',
            collectionId: 'col-sourdough',
            collectionName: 'sourdough',
            quantity: 1,
            currentPrice: 15000,
            taxPercentage: 0,
            isComplimentary: false,
          },
        ],
      };

      const ordersWithDeleted = [...mockOrders, orderWithDeletedProduct];
      const report = new ProductReport(ordersWithDeleted, mockB2BClients, mockProducts);
      const products = report.generateProductTable();

      const deletedProduct = products.find(p => p.productId === 'prod-deleted');
      expect(deletedProduct).toBeDefined();
      expect(deletedProduct.totalCantidad).toBe(1);
    });

    it('should not include deleted products without sales', () => {
      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts);
      const products = report.generateProductTable();

      const deletedProduct = products.find(p => p.productId === 'prod-deleted');
      expect(deletedProduct).toBeUndefined();
    });

    it('should handle null date in dateField', () => {
      const ordersWithNullDate = mockOrders.map(order => ({
        ...order,
        paymentDate: null,
      }));

      const report = new ProductReport(ordersWithNullDate, mockB2BClients, mockProducts, {
        dateField: 'paymentDate',
        period: 'monthly',
      });

      // Should not throw error
      expect(() => report.generateReport()).not.toThrow();
    });
  });

  describe('real data simulation', () => {
    it('should handle typical bakery order data', () => {
      // Simulate real bakery data from es-alimento
      const realOrders = [
        {
          id: 'sNye2ffNFlm5fnuPokvP',
          userId: 'ksRLss9xFBTdct68Oio2QdqOsEy2',
          dueDate: '2025-01-20T12:00:00.000Z',
          status: 2,
          fulfillmentType: 'delivery',
          deliveryFee: 6000,
          deliveryCost: 5000,
          paymentMethod: 'transfer',
          orderItems: [{
            productId: 'xJpCPiTpzkJvpw3hGwkK',
            productName: 'zaatar',
            collectionId: 'GRzDxeAWOj2HBhmlObSy',
            collectionName: 'sourdough',
            quantity: 1,
            currentPrice: 22000,
            taxPercentage: 0,
            isComplimentary: false,
          }],
        },
        {
          id: 'G7af7toUqlEmyJZ74PhQ',
          userId: 'qjqQsjEE3WP3drG2KVDHHk9Nw693',
          dueDate: '2025-01-20T12:00:00.000Z',
          status: 2,
          fulfillmentType: 'pickup',
          paymentMethod: 'transfer',
          orderItems: [
            {
              productId: 'zXHgfeYE4dqWP6XuqV34',
              productName: 'original',
              collectionId: 'GRzDxeAWOj2HBhmlObSy',
              collectionName: 'sourdough',
              quantity: 1,
              currentPrice: 18000,
              taxPercentage: 0,
              isComplimentary: false,
            },
            {
              productId: 'GV4N5DadSlhPFY4Oqrgj',
              productName: 'mermelada de fresa',
              collectionId: 'HvG0VIiluQ3ULrgp7QSN',
              collectionName: 'untables',
              quantity: 1,
              currentPrice: 18000,
              taxPercentage: 0,
              isComplimentary: false,
            },
          ],
        },
      ];

      const realProducts = [
        { id: 'xJpCPiTpzkJvpw3hGwkK', name: 'zaatar', collectionId: 'GRzDxeAWOj2HBhmlObSy', collectionName: 'sourdough', isDeleted: false },
        { id: 'zXHgfeYE4dqWP6XuqV34', name: 'original', collectionId: 'GRzDxeAWOj2HBhmlObSy', collectionName: 'sourdough', isDeleted: false },
        { id: 'GV4N5DadSlhPFY4Oqrgj', name: 'mermelada de fresa', collectionId: 'HvG0VIiluQ3ULrgp7QSN', collectionName: 'untables', isDeleted: false },
      ];

      const report = new ProductReport(realOrders, [], realProducts);
      const fullReport = report.generateReport();

      expect(fullReport.metadata.totalOrders).toBe(2);
      expect(fullReport.products.length).toBe(3);
      expect(fullReport.summary.totals.totalIngresos).toBe(58000); // 22000 + 18000 + 18000
      expect(fullReport.summary.totals.totalCantidad).toBe(3);
    });
  });
});
