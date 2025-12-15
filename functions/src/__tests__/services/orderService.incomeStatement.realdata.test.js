const { initializeFirebase, clearFirestoreData } = require('../setup/firebase');
const { Order } = require('../../models/Order');
const path = require('path');
const fs = require('fs');

// Load real data from JSON files
const ordersPath = path.join(__dirname, '../../..', 'zsandbox', 'all_orders.diana_lee.json');
const productsPath = path.join(__dirname, '../../..', 'zsandbox', 'all_products.diana_lee.json');

const allOrders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
const productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
const products = productsData;

describe('Income Statement Service Tests - Real Data', () => {
  let db;
  let orderService;
  let testBakeryId;

  beforeAll(() => {
    ({ db } = initializeFirebase());
    orderService = require('../../services/orderService');
    testBakeryId = 'diana_lee';
  });

  beforeEach(async () => {
    await clearFirestoreData(db);

    // Create settings document with default report filter
    const settingsRef = db
      .collection('bakeries')
      .doc(testBakeryId)
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

    // Create bakery document
    const bakeryRef = db.collection('bakeries').doc(testBakeryId);
    await bakeryRef.set({
      id: testBakeryId,
      name: 'Diana Lee',
    });

    // Load real products
    if (products.items) {
      for (const product of products.items) {
        const productRef = db.collection('bakeries').doc(testBakeryId).collection('products').doc(product.id);
        await productRef.set({
          id: product.id,
          bakeryId: testBakeryId,
          name: product.name,
          costPrice: product.costPrice || null,
          currentPrice: product.currentPrice || product.basePrice,
          basePrice: product.basePrice,
          variations: product.variations,
        });
      }
    }

    // Load real orders (sample for speed, or all for thoroughness)
    console.log(`Loading ${allOrders.items.length} orders into test database...`);
    let loadedCount = 0;
    for (const orderData of allOrders.items) {
      try {
        const orderWithId = {
          ...orderData,
          bakeryId: testBakeryId,
        };
        const createdOrder = await orderService.create(orderWithId, testBakeryId);
        loadedCount++;
        if (loadedCount % 100 === 0) {
          console.log(`Loaded ${loadedCount} orders...`);
        }
      } catch (error) {
        console.error(`Error creating order ${orderData.id}:`, error.message);
      }
    }
    console.log(`Total orders loaded: ${loadedCount}`);
  }, 120000);

  afterAll(async () => {
    await clearFirestoreData(db);
  }, 30000);

  describe('getIncomeStatement with real data', () => {
    it('should generate income statement for 2025', async () => {
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

      console.log('\n=== INCOME STATEMENT FOR 2025 ===');
      console.log(JSON.stringify(report, null, 2));

      // Verify report structure
      expect(report).toHaveProperty('revenue');
      expect(report).toHaveProperty('costs');
      expect(report).toHaveProperty('grossProfit');
      expect(report).toHaveProperty('coverage');
      expect(report).toHaveProperty('excludedProducts');

      // Verify revenue calculations
      expect(report.revenue.productSales).toBeGreaterThan(0);
      expect(report.revenue.totalRevenue).toBeGreaterThan(0);

      // Verify costs
      expect(report.costs.totalCosts).toBeGreaterThanOrEqual(0);

      // Verify gross profit
      expect(report.grossProfit.amount).toBeGreaterThan(0);
      expect(report.grossProfit.marginPercent).toBeGreaterThan(0);

      // Verify coverage
      expect(report.coverage.totalItems).toBeGreaterThan(0);
      console.log(`\nCoverage: ${report.coverage.itemsWithCost}/${report.coverage.totalItems} items (${report.coverage.percentCovered}%)`);
      console.log(`Products with cost: ${report.coverage.uniqueProductsWithCost}/${report.coverage.uniqueProductsTotal}`);

      // Check excluded products
      if (report.excludedProducts.length > 0) {
        console.log(`\nExcluded products: ${report.excludedProducts.length}`);
        console.log('Top 5 excluded:');
        report.excludedProducts.slice(0, 5).forEach(p => {
          console.log(`  - ${p.name}: ${p.totalQuantity} units in ${p.orderCount} orders`);
        });
      }
    }, 180000);

    it('should generate income statement with monthly breakdown for 2025', async () => {
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

      console.log('\n=== MONTHLY INCOME STATEMENT FOR 2025 ===');

      // Verify report structure
      expect(report).toHaveProperty('periods');
      expect(report).toHaveProperty('totals');
      expect(report).toHaveProperty('excludedProducts');

      // Display monthly summary
      if (report.periods.length > 0) {
        console.log('\nMonthly Summary:');
        console.log('Month\t\t\tRevenue\t\tCosts\t\tProfit\t\tMargin');
        console.log('─'.repeat(80));

        report.periods.forEach(period => {
          const revenue = (period.revenue.totalRevenue / 1000000).toFixed(2);
          const costs = (period.costs.totalCosts / 1000000).toFixed(2);
          const profit = (period.grossProfit.amount / 1000000).toFixed(2);
          const margin = period.grossProfit.marginPercent;
          console.log(
            `${period.label.padEnd(20)}\t$${revenue}M\t$${costs}M\t$${profit}M\t${margin}%`,
          );
        });

        console.log('─'.repeat(80));
        const totalRevenue = (report.totals.revenue.totalRevenue / 1000000).toFixed(2);
        const totalCosts = (report.totals.costs.totalCosts / 1000000).toFixed(2);
        const totalProfit = (report.totals.grossProfit.amount / 1000000).toFixed(2);
        const totalMargin = report.totals.grossProfit.marginPercent;
        console.log(
          `${'TOTAL'.padEnd(20)}\t$${totalRevenue}M\t$${totalCosts}M\t$${totalProfit}M\t${totalMargin}%`,
        );
      }

      expect(report.periods.length).toBeGreaterThan(0);
      expect(report.totals.revenue.totalRevenue).toBeGreaterThan(0);
    }, 180000);

    it('should show data quality metrics', async () => {
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

      console.log('\n=== DATA QUALITY METRICS ===');
      console.log(`Total items processed: ${report.coverage.totalItems}`);
      console.log(`Items with cost price: ${report.coverage.itemsWithCost} (${report.coverage.percentCovered}%)`);
      console.log(`Unique products total: ${report.coverage.uniqueProductsTotal}`);
      console.log(`Unique products with cost: ${report.coverage.uniqueProductsWithCost}`);

      const coveragePercentage = report.coverage.percentCovered;
      if (coveragePercentage >= 90) {
        console.log('✅ Excellent data coverage');
      } else if (coveragePercentage >= 50) {
        console.log('⚠️ Partial data coverage - some costs are missing');
      } else {
        console.log('❌ Poor data coverage - most costs are missing');
      }

      expect(report.coverage.percentCovered).toBeGreaterThanOrEqual(0);
      expect(report.coverage.percentCovered).toBeLessThanOrEqual(100);
    }, 180000);

    it('should compare dueDate vs paymentDate filtering', async () => {
      const dueDateQuery = {
        filters: {
          dateRange: {
            startDate: '2025-01-01',
            endDate: '2025-12-31',
          },
          groupBy: 'total',
          dateFilterType: 'dueDate',
        },
      };

      const paymentDateQuery = {
        filters: {
          dateRange: {
            startDate: '2025-01-01',
            endDate: '2025-12-31',
          },
          groupBy: 'total',
          dateFilterType: 'paymentDate',
        },
      };

      const dueDateReport = await orderService.getIncomeStatement(testBakeryId, dueDateQuery);
      const paymentDateReport = await orderService.getIncomeStatement(testBakeryId, paymentDateQuery);

      console.log('\n=== DATE FILTER COMPARISON ===');
      console.log('By Due Date:');
      console.log(`  Items: ${dueDateReport.coverage.totalItems}`);
      console.log(`  Revenue: $${(dueDateReport.revenue.totalRevenue / 1000000).toFixed(2)}M`);
      console.log(`  Profit: $${(dueDateReport.grossProfit.amount / 1000000).toFixed(2)}M`);

      console.log('\nBy Payment Date:');
      console.log(`  Items: ${paymentDateReport.coverage.totalItems}`);
      console.log(`  Revenue: $${(paymentDateReport.revenue.totalRevenue / 1000000).toFixed(2)}M`);
      console.log(`  Profit: $${(paymentDateReport.grossProfit.amount / 1000000).toFixed(2)}M`);

      // Both should have data
      expect(dueDateReport.coverage.totalItems).toBeGreaterThan(0);
      expect(paymentDateReport.coverage.totalItems).toBeGreaterThan(0);
    }, 180000);

    it('should handle January 2025 specifically', async () => {
      const query = {
        filters: {
          dateRange: {
            startDate: '2025-01-01',
            endDate: '2025-01-31',
          },
          groupBy: 'total',
        },
      };

      const report = await orderService.getIncomeStatement(testBakeryId, query);

      console.log('\n=== JANUARY 2025 INCOME STATEMENT ===');
      console.log(`Revenue: $${(report.revenue.totalRevenue / 1000).toFixed(0)}K`);
      console.log(`  - Product Sales: $${(report.revenue.productSales / 1000).toFixed(0)}K`);
      console.log(`  - Delivery Fees: $${(report.revenue.deliveryFees / 1000).toFixed(0)}K`);
      console.log(`  - Taxes Collected: $${(report.revenue.taxesCollected / 1000).toFixed(0)}K`);

      console.log(`\nCosts: $${(report.costs.totalCosts / 1000).toFixed(0)}K`);
      console.log(`  - COGS: $${(report.costs.cogs / 1000).toFixed(0)}K`);
      console.log(`  - Delivery Costs: $${(report.costs.deliveryCosts / 1000).toFixed(0)}K`);

      console.log(`\nGross Profit: $${(report.grossProfit.amount / 1000).toFixed(0)}K`);
      console.log(`Gross Margin: ${report.grossProfit.marginPercent}%`);

      console.log(`\nData Quality:`);
      console.log(`  Items: ${report.coverage.itemsWithCost}/${report.coverage.totalItems} (${report.coverage.percentCovered}%)`);

      expect(report.revenue.totalRevenue).toBeGreaterThanOrEqual(0);
    }, 180000);
  });
});
