// __tests__/models/ProductReport.realData.test.js
//
// Real data validation tests for ProductReport using actual orders and products
// This test validates ProductReport calculations against manually calculated expected values

const ProductReport = require("../../models/ProductReport");
const { Order } = require("../../models/Order");
const fs = require('fs');
const path = require('path');

describe("ProductReport Real Data Validation", () => {
  let realOrders, realB2BClients, realProducts;

  beforeAll(() => {
    // Load real test data
    const ordersPath = path.join(__dirname, '../test_data/orders.es-alimento.march.json');
    const clientsPath = path.join(__dirname, '../test_data/b2bclients.es-alimento.march.json');
    const productsPath = path.join(__dirname, '../test_data/products.es-alimento.march.json');

    const ordersData = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
    const clientsData = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
    const productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8'));

    realOrders = ordersData.items.map(order => new Order(order));
    realB2BClients = clientsData;
    realProducts = productsData.items;

    console.log(`\n=== REAL DATA LOADED ===`);
    console.log(`Orders: ${realOrders.length}`);
    console.log(`B2B Clients: ${realB2BClients.length}`);
    console.log(`Products: ${realProducts.length}`);
  });

  describe("Manual Calculation Validation", () => {

    it("should validate B2B vs B2C classification from real data", () => {
      const report = new ProductReport(realOrders, realB2BClients, realProducts, {
        detailLevel: 'product',
        segment: 'all',
        metrics: 'both'
      });

      const result = report.generateReport();

      // Manual calculation: Count B2B clients in real data
      const b2bClientIds = new Set(realB2BClients.map(client => client.id));

      let manualB2BRevenue = 0;
      let manualB2CRevenue = 0;
      let manualB2BQuantity = 0;
      let manualB2CQuantity = 0;

      // Calculate manually from order data
      realOrders
        .filter(order => !order.isComplimentary) // Filter complimentary orders
        .forEach(order => {
          const isB2B = b2bClientIds.has(order.userId);

          order.orderItems
            .filter(item => !item.isComplimentary) // Filter complimentary items
            .forEach(item => {
              if (isB2B) {
                manualB2BRevenue += item.subtotal;
                manualB2BQuantity += item.quantity;
              } else {
                manualB2CRevenue += item.subtotal;
                manualB2CQuantity += item.quantity;
              }
            });
        });

      // Sum all products from report
      const reportTotalB2BRevenue = result.products.reduce((sum, p) => sum + (p.b2bIngresos || 0), 0);
      const reportTotalB2CRevenue = result.products.reduce((sum, p) => sum + (p.b2cIngresos || 0), 0);
      const reportTotalB2BQuantity = result.products.reduce((sum, p) => sum + (p.b2bCantidad || 0), 0);
      const reportTotalB2CQuantity = result.products.reduce((sum, p) => sum + (p.b2cCantidad || 0), 0);

      console.log(`\n=== B2B/B2C VALIDATION ===`);
      console.log(`Manual B2B Revenue: ${manualB2BRevenue}`);
      console.log(`Report B2B Revenue: ${reportTotalB2BRevenue}`);
      console.log(`Manual B2C Revenue: ${manualB2CRevenue}`);
      console.log(`Report B2C Revenue: ${reportTotalB2CRevenue}`);
      console.log(`Manual B2B Quantity: ${manualB2BQuantity}`);
      console.log(`Report B2B Quantity: ${reportTotalB2BQuantity}`);
      console.log(`Manual B2C Quantity: ${manualB2CQuantity}`);
      console.log(`Report B2C Quantity: ${reportTotalB2CQuantity}`);

      // Validate calculations match
      expect(reportTotalB2BRevenue).toBe(manualB2BRevenue);
      expect(reportTotalB2CRevenue).toBe(manualB2CRevenue);
      expect(reportTotalB2BQuantity).toBe(manualB2BQuantity);
      expect(reportTotalB2CQuantity).toBe(manualB2CQuantity);
    });

    it("should validate specific product calculations", () => {
      const report = new ProductReport(realOrders, realB2BClients, realProducts, {
        detailLevel: 'product',
        segment: 'all',
        metrics: 'both'
      });

      const result = report.generateReport();

      // Let's manually validate one specific product from the real data
      // Looking at the data, we can see "integral" product (tfTjV8pOp1ZDVg4ZQ99R)
      const targetProductId = "tfTjV8pOp1ZDVg4ZQ99R"; // integral sourdough
      const b2bClientIds = new Set(realB2BClients.map(client => client.id));

      let manualProductRevenue = 0;
      let manualProductQuantity = 0;
      let manualProductB2BRevenue = 0;
      let manualProductB2CRevenue = 0;
      let manualProductB2BQuantity = 0;
      let manualProductB2CQuantity = 0;

      realOrders
        .filter(order => !order.isComplimentary)
        .forEach(order => {
          const isB2B = b2bClientIds.has(order.userId);

          order.orderItems
            .filter(item => !item.isComplimentary && item.productId === targetProductId)
            .forEach(item => {
              manualProductRevenue += item.subtotal;
              manualProductQuantity += item.quantity;

              if (isB2B) {
                manualProductB2BRevenue += item.subtotal;
                manualProductB2BQuantity += item.quantity;
              } else {
                manualProductB2CRevenue += item.subtotal;
                manualProductB2CQuantity += item.quantity;
              }
            });
        });

      const reportProduct = result.products.find(p => p.productId === targetProductId);

      console.log(`\n=== SPECIFIC PRODUCT VALIDATION (${targetProductId}) ===`);
      console.log(`Manual Total Revenue: ${manualProductRevenue}`);
      console.log(`Report Total Revenue: ${reportProduct?.totalIngresos || 0}`);
      console.log(`Manual Total Quantity: ${manualProductQuantity}`);
      console.log(`Report Total Quantity: ${reportProduct?.totalCantidad || 0}`);
      console.log(`Manual B2B Revenue: ${manualProductB2BRevenue}`);
      console.log(`Report B2B Revenue: ${reportProduct?.b2bIngresos || 0}`);
      console.log(`Manual B2C Revenue: ${manualProductB2CRevenue}`);
      console.log(`Report B2C Revenue: ${reportProduct?.b2cIngresos || 0}`);

      if (reportProduct) {
        expect(reportProduct.totalIngresos).toBe(manualProductRevenue);
        expect(reportProduct.totalCantidad).toBe(manualProductQuantity);
        expect(reportProduct.b2bIngresos).toBe(manualProductB2BRevenue);
        expect(reportProduct.b2cIngresos).toBe(manualProductB2CRevenue);
        expect(reportProduct.b2bCantidad).toBe(manualProductB2BQuantity);
        expect(reportProduct.b2cCantidad).toBe(manualProductB2CQuantity);
      }
    });

    it("should validate combination-level calculations", () => {
      const report = new ProductReport(realOrders, realB2BClients, realProducts, {
        detailLevel: 'combination',
        segment: 'all',
        metrics: 'both'
      });

      const result = report.generateReport();

      // Let's find the first combination that actually exists in the data
      const combinationToTest = result.products.find(p =>
        p.combinationId !== null && p.totalIngresos > 0
      );

      console.log(`\n=== COMBINATION VALIDATION ===`);
      if (combinationToTest) {
        console.log(`Testing combination: ${combinationToTest.productName} - ${combinationToTest.combinationName}`);
        console.log(`Product ID: ${combinationToTest.productId}, Combination ID: ${combinationToTest.combinationId}`);

        // Let's find what raw combination IDs in orders map to this normalized combination
        const b2bClientIds = new Set(realB2BClients.map(client => client.id));
        const rawCombinationIds = new Set();
        let manualComboRevenue = 0;
        let manualComboQuantity = 0;
        let manualComboB2BRevenue = 0;
        let manualComboB2CRevenue = 0;

        // First pass: collect all raw combination IDs that could map to our target
        realOrders
          .filter(order => !order.isComplimentary)
          .forEach(order => {
            order.orderItems
              .filter(item => !item.isComplimentary && item.productId === combinationToTest.productId)
              .forEach(item => {
                const rawCombinationId = item.combination?.id || null;

                // Test normalization using ProductReport's logic
                const normalizedId = report.normalizeCombinationId(
                  item.productId,
                  rawCombinationId,
                  item.combination?.name || null
                );

                if (normalizedId === combinationToTest.combinationId) {
                  rawCombinationIds.add(rawCombinationId);
                  console.log(`Raw combo ID "${rawCombinationId}" normalizes to "${normalizedId}"`);
                }
              });
          });

        console.log(`Raw combination IDs that map to ${combinationToTest.combinationId}:`, Array.from(rawCombinationIds));

        // Second pass: calculate revenue for all raw combinations that normalize to our target
        realOrders
          .filter(order => !order.isComplimentary)
          .forEach(order => {
            const isB2B = b2bClientIds.has(order.userId);

            order.orderItems
              .filter(item =>
                !item.isComplimentary &&
                item.productId === combinationToTest.productId &&
                rawCombinationIds.has(item.combination?.id || null)
              )
              .forEach(item => {
                console.log(`Adding item: ${item.combination?.name} (${item.combination?.id || null}) - $${item.subtotal} x ${item.quantity}`);
                manualComboRevenue += item.subtotal;
                manualComboQuantity += item.quantity;

                if (isB2B) {
                  manualComboB2BRevenue += item.subtotal;
                } else {
                  manualComboB2CRevenue += item.subtotal;
                }
              });
          });

        console.log(`Manual Combo Revenue (normalized): ${manualComboRevenue}`);
        console.log(`Report Combo Revenue: ${combinationToTest.totalIngresos}`);
        console.log(`Manual Combo Quantity (normalized): ${manualComboQuantity}`);
        console.log(`Report Combo Quantity: ${combinationToTest.totalCantidad}`);
        console.log(`Manual Combo B2B Revenue (normalized): ${manualComboB2BRevenue}`);
        console.log(`Report Combo B2B Revenue: ${combinationToTest.b2bIngresos}`);

        expect(combinationToTest.totalIngresos).toBe(manualComboRevenue);
        expect(combinationToTest.totalCantidad).toBe(manualComboQuantity);
        expect(combinationToTest.b2bIngresos).toBe(manualComboB2BRevenue);
        expect(combinationToTest.b2cIngresos).toBe(manualComboB2CRevenue);
      }

      expect(combinationToTest).toBeTruthy();
    });

    it("should validate category filtering", () => {
      // Test filtering by sourdough category
      const sourdoughCategoryId = "GRzDxeAWOj2HBhmlObSy";

      const reportWithFilter = new ProductReport(realOrders, realB2BClients, realProducts, {
        detailLevel: 'product',
        segment: 'none',
        metrics: 'both',
        categories: [sourdoughCategoryId]
      });

      const reportWithoutFilter = new ProductReport(realOrders, realB2BClients, realProducts, {
        detailLevel: 'product',
        segment: 'none',
        metrics: 'both',
        categories: null
      });

      const filteredResult = reportWithFilter.generateReport();
      const unfilteredResult = reportWithoutFilter.generateReport();

      // Manual calculation: Count items in sourdough category
      let manualSourdoughRevenue = 0;
      let manualTotalRevenue = 0;

      realOrders
        .filter(order => !order.isComplimentary)
        .forEach(order => {
          order.orderItems
            .filter(item => !item.isComplimentary)
            .forEach(item => {
              manualTotalRevenue += item.subtotal;

              if (item.collectionId === sourdoughCategoryId) {
                manualSourdoughRevenue += item.subtotal;
              }
            });
        });

      const filteredTotalRevenue = filteredResult.products.reduce((sum, p) => sum + p.totalIngresos, 0);
      const unfilteredTotalRevenue = unfilteredResult.products.reduce((sum, p) => sum + p.totalIngresos, 0);

      console.log(`\n=== CATEGORY FILTERING VALIDATION ===`);
      console.log(`Manual Sourdough Revenue: ${manualSourdoughRevenue}`);
      console.log(`Filtered Report Revenue: ${filteredTotalRevenue}`);
      console.log(`Manual Total Revenue: ${manualTotalRevenue}`);
      console.log(`Unfiltered Report Revenue: ${unfilteredTotalRevenue}`);
      console.log(`Filtered Products Count: ${filteredResult.products.length}`);
      console.log(`Unfiltered Products Count: ${unfilteredResult.products.length}`);

      // Validate category filtering worked correctly
      expect(filteredTotalRevenue).toBe(manualSourdoughRevenue);
      expect(unfilteredTotalRevenue).toBe(manualTotalRevenue);
      expect(filteredResult.products.length).toBeLessThan(unfilteredResult.products.length);

      // All filtered products should be from the sourdough category
      filteredResult.products.forEach(product => {
        expect(product.categoryId).toBe(sourdoughCategoryId);
      });
    });

    it("should validate segment filtering options", () => {
      const baseOptions = {
        detailLevel: 'product',
        metrics: 'both',
        categories: null
      };

      // Test all segment options
      const reportAll = new ProductReport(realOrders, realB2BClients, realProducts, {
        ...baseOptions,
        segment: 'all'
      });

      const reportB2B = new ProductReport(realOrders, realB2BClients, realProducts, {
        ...baseOptions,
        segment: 'b2b'
      });

      const reportB2C = new ProductReport(realOrders, realB2BClients, realProducts, {
        ...baseOptions,
        segment: 'b2c'
      });

      const reportNone = new ProductReport(realOrders, realB2BClients, realProducts, {
        ...baseOptions,
        segment: 'none'
      });

      const resultAll = reportAll.generateReport();
      const resultB2B = reportB2B.generateReport();
      const resultB2C = reportB2C.generateReport();
      const resultNone = reportNone.generateReport();

      // Get totals
      const allTotalRevenue = resultAll.products.reduce((sum, p) => sum + p.totalIngresos, 0);
      const b2bTotalRevenue = resultB2B.products.reduce((sum, p) => sum + p.totalIngresos, 0);
      const b2cTotalRevenue = resultB2C.products.reduce((sum, p) => sum + p.totalIngresos, 0);
      const noneTotalRevenue = resultNone.products.reduce((sum, p) => sum + p.totalIngresos, 0);

      const allB2BRevenue = resultAll.products.reduce((sum, p) => sum + (p.b2bIngresos || 0), 0);
      const allB2CRevenue = resultAll.products.reduce((sum, p) => sum + (p.b2cIngresos || 0), 0);

      console.log(`\n=== SEGMENT FILTERING VALIDATION ===`);
      console.log(`All Total Revenue: ${allTotalRevenue}`);
      console.log(`All B2B Breakdown: ${allB2BRevenue}`);
      console.log(`All B2C Breakdown: ${allB2CRevenue}`);
      console.log(`B2B Only Revenue: ${b2bTotalRevenue}`);
      console.log(`B2C Only Revenue: ${b2cTotalRevenue}`);
      console.log(`None Total Revenue: ${noneTotalRevenue}`);

      // Validate relationships
      expect(allTotalRevenue).toBe(allB2BRevenue + allB2CRevenue);
      expect(b2bTotalRevenue).toBe(allB2BRevenue);
      expect(b2cTotalRevenue).toBe(allB2CRevenue);
      expect(noneTotalRevenue).toBe(allTotalRevenue);

      // Check field presence
      const allProduct = resultAll.products[0];
      const b2bProduct = resultB2B.products[0];
      const noneProduct = resultNone.products[0];

      expect(allProduct).toHaveProperty('b2bIngresos');
      expect(allProduct).toHaveProperty('b2cIngresos');
      expect(b2bProduct).not.toHaveProperty('b2bIngresos'); // Should be filtered to main fields
      expect(noneProduct).not.toHaveProperty('b2bIngresos');
    });

    it("should validate metrics filtering options", () => {
      const baseOptions = {
        detailLevel: 'product',
        segment: 'all',
        categories: null
      };

      const reportBoth = new ProductReport(realOrders, realB2BClients, realProducts, {
        ...baseOptions,
        metrics: 'both'
      });

      const reportIngresos = new ProductReport(realOrders, realB2BClients, realProducts, {
        ...baseOptions,
        metrics: 'ingresos'
      });

      const reportCantidad = new ProductReport(realOrders, realB2BClients, realProducts, {
        ...baseOptions,
        metrics: 'cantidad'
      });

      const resultBoth = reportBoth.generateReport();
      const resultIngresos = reportIngresos.generateReport();
      const resultCantidad = reportCantidad.generateReport();

      console.log(`\n=== METRICS FILTERING VALIDATION ===`);
      console.log(`Both metrics products: ${resultBoth.products.length}`);
      console.log(`Ingresos only products: ${resultIngresos.products.length}`);
      console.log(`Cantidad only products: ${resultCantidad.products.length}`);

      // Check field presence
      const bothProduct = resultBoth.products[0];
      const ingresosProduct = resultIngresos.products[0];
      const cantidadProduct = resultCantidad.products[0];

      // Both should have all fields
      expect(bothProduct).toHaveProperty('totalIngresos');
      expect(bothProduct).toHaveProperty('totalCantidad');
      expect(bothProduct).toHaveProperty('avgPrice');

      // Ingresos only should have revenue fields only
      expect(ingresosProduct).toHaveProperty('totalIngresos');
      expect(ingresosProduct).not.toHaveProperty('totalCantidad');
      expect(ingresosProduct).not.toHaveProperty('avgPrice');

      // Cantidad only should have quantity fields only
      expect(cantidadProduct).not.toHaveProperty('totalIngresos');
      expect(cantidadProduct).toHaveProperty('totalCantidad');
      expect(cantidadProduct).not.toHaveProperty('avgPrice');
    });
  });

  describe("Data Quality Validation", () => {
    it("should verify no data loss in processing pipeline", () => {
      const report = new ProductReport(realOrders, realB2BClients, realProducts, {
        detailLevel: 'product',
        segment: 'none',
        metrics: 'both'
      });

      const result = report.generateReport();

      // Manual total from raw orders
      let manualTotalRevenue = 0;
      let manualTotalQuantity = 0;
      let totalItems = 0;

      realOrders
        .filter(order => !order.isComplimentary)
        .forEach(order => {
          order.orderItems
            .filter(item => !item.isComplimentary)
            .forEach(item => {
              manualTotalRevenue += item.subtotal;
              manualTotalQuantity += item.quantity;
              totalItems++;
            });
        });

      const reportTotalRevenue = result.products.reduce((sum, p) => sum + p.totalIngresos, 0);
      const reportTotalQuantity = result.products.reduce((sum, p) => sum + p.totalCantidad, 0);

      console.log(`\n=== DATA INTEGRITY VALIDATION ===`);
      console.log(`Raw order items processed: ${totalItems}`);
      console.log(`Manual total revenue: ${manualTotalRevenue}`);
      console.log(`Report total revenue: ${reportTotalRevenue}`);
      console.log(`Manual total quantity: ${manualTotalQuantity}`);
      console.log(`Report total quantity: ${reportTotalQuantity}`);
      console.log(`Products in report: ${result.products.length}`);

      // Verify no data loss
      expect(reportTotalRevenue).toBe(manualTotalRevenue);
      expect(reportTotalQuantity).toBe(manualTotalQuantity);
      expect(result.products.length).toBeGreaterThan(0);
    });

    it("should verify summary calculations", () => {
      const report = new ProductReport(realOrders, realB2BClients, realProducts, {
        detailLevel: 'product',
        segment: 'all',
        metrics: 'both'
      });

      const result = report.generateReport();

      // Validate summary totals match product totals
      const productTotalRevenue = result.products.reduce((sum, p) => sum + p.totalIngresos, 0);
      const productTotalQuantity = result.products.reduce((sum, p) => sum + p.totalCantidad, 0);
      const productB2BRevenue = result.products.reduce((sum, p) => sum + (p.b2bIngresos || 0), 0);
      const productB2CRevenue = result.products.reduce((sum, p) => sum + (p.b2cIngresos || 0), 0);

      console.log(`\n=== SUMMARY VALIDATION ===`);
      console.log(`Summary total revenue: ${result.summary.totals.totalIngresos}`);
      console.log(`Products total revenue: ${productTotalRevenue}`);
      console.log(`Summary total quantity: ${result.summary.totals.totalCantidad}`);
      console.log(`Products total quantity: ${productTotalQuantity}`);
      console.log(`Summary B2B revenue: ${result.summary.totals.b2bIngresos || 'N/A'}`);
      console.log(`Products B2B revenue: ${productB2BRevenue}`);

      expect(result.summary.totals.totalIngresos).toBe(productTotalRevenue);
      expect(result.summary.totals.totalCantidad).toBe(productTotalQuantity);

      if (result.summary.totals.b2bIngresos !== undefined) {
        expect(result.summary.totals.b2bIngresos).toBe(productB2BRevenue);
        expect(result.summary.totals.b2cIngresos).toBe(productB2CRevenue);
      }
    });
  });

  describe("Specific Values Validation", () => {
    it("should validate actual ingresos and cantidades for specific orders", () => {
      // Let's manually check specific orders from the real data
      const report = new ProductReport(realOrders, realB2BClients, realProducts, {
        detailLevel: 'combination',
        segment: 'all',
        metrics: 'both'
      });

      const result = report.generateReport();

      // Find the top 2 combinations by revenue to test
      const sortedCombos = result.products
        .filter(p => p.combinationId !== null)
        .sort((a, b) => b.totalIngresos - a.totalIngresos)
        .slice(0, 2);

      console.log(`\n=== SPECIFIC VALUES VALIDATION ===`);
      sortedCombos.forEach((combo, index) => {
        console.log(`${index + 1}. ${combo.productName} (${combo.combinationName}) - Revenue: ${combo.totalIngresos}, Quantity: ${combo.totalCantidad}`);
        console.log(`   B2B: ${combo.b2bIngresos}, B2C: ${combo.b2cIngresos}`);

        // These should have substantial values
        expect(combo.totalIngresos).toBeGreaterThan(0);
        expect(combo.totalCantidad).toBeGreaterThan(0);
        expect(combo.b2bIngresos + combo.b2cIngresos).toBe(combo.totalIngresos);
        expect(combo.b2bCantidad + combo.b2cCantidad).toBe(combo.totalCantidad);
      });

      expect(sortedCombos.length).toBeGreaterThanOrEqual(2);
    });

    it("should validate specific B2B order calculations", () => {
      const report = new ProductReport(realOrders, realB2BClients, realProducts, {
        detailLevel: 'combination',
        segment: 'all',
        metrics: 'both'
      });

      const result = report.generateReport();

      // Find combinations with the highest B2B revenue
      const b2bCombinations = result.products
        .filter(p => p.b2bIngresos > 0)
        .sort((a, b) => b.b2bIngresos - a.b2bIngresos)
        .slice(0, 3);

      console.log(`\n=== B2B ORDER VALIDATION ===`);
      b2bCombinations.forEach((combo, index) => {
        console.log(`${index + 1}. ${combo.productName} (${combo.combinationName || 'base'}) - Total Revenue: ${combo.totalIngresos}`);
        console.log(`   B2B Revenue: ${combo.b2bIngresos}, B2C Revenue: ${combo.b2cIngresos}`);
        console.log(`   Total Quantity: ${combo.totalCantidad}, B2B Quantity: ${combo.b2bCantidad}`);

        // These B2B combinations should have valid B2B metrics
        expect(combo.b2bIngresos).toBeGreaterThan(0);
        expect(combo.b2bCantidad).toBeGreaterThan(0);
        expect(combo.totalIngresos).toBeGreaterThanOrEqual(combo.b2bIngresos);
        expect(combo.totalCantidad).toBeGreaterThanOrEqual(combo.b2bCantidad);
      });

      expect(b2bCombinations.length).toBeGreaterThanOrEqual(1);
    });

    it("should validate largest revenue items", () => {
      const report = new ProductReport(realOrders, realB2BClients, realProducts, {
        detailLevel: 'combination',
        segment: 'none',
        metrics: 'ingresos'
      });

      const result = report.generateReport();

      // Sort by revenue to see top performers
      const sortedProducts = [...result.products].sort((a, b) => b.totalIngresos - a.totalIngresos);

      console.log(`\n=== TOP REVENUE COMBINATIONS ===`);
      sortedProducts.slice(0, 5).forEach((product, index) => {
        console.log(`${index + 1}. ${product.productName} (${product.combinationName || 'base'}) - $${product.totalIngresos}`);
      });

      // Top item should have substantial revenue
      expect(sortedProducts[0].totalIngresos).toBeGreaterThan(0);
      expect(sortedProducts.length).toBeGreaterThan(10); // Should have many combinations
    });
  });

  describe("Period Aggregation Validation", () => {
    it("should validate daily period keys and data", () => {
      const report = new ProductReport(realOrders, realB2BClients, realProducts, {
        detailLevel: 'product',
        segment: 'all',
        metrics: 'both',
        period: 'daily',
        categories: ['GRzDxeAWOj2HBhmlObSy'] // sourdough only for cleaner output
      });

      const result = report.generateReport();

      // Find a product with period data
      const productWithPeriods = result.products.find(p => p.periods && Object.keys(p.periods).length > 0);

      console.log(`\n=== DAILY PERIODS VALIDATION ===`);
      if (productWithPeriods) {
        console.log(`Product: ${productWithPeriods.productName}`);
        console.log(`Total Revenue: ${productWithPeriods.totalIngresos}`);
        console.log(`Total Quantity: ${productWithPeriods.totalCantidad}`);

        const periodKeys = Object.keys(productWithPeriods.periods);
        console.log(`Period keys: ${periodKeys.join(', ')}`);

        // Show first few periods
        periodKeys.slice(0, 3).forEach(periodKey => {
          const period = productWithPeriods.periods[periodKey];
          console.log(`  ${periodKey}: revenue=${period.ingresos}, qty=${period.cantidad}, b2b=${period.b2bIngresos || 0}, b2c=${period.b2cIngresos || 0}`);
        });

        // Validate period key format (should be YYYY-MM-DD for daily)
        periodKeys.forEach(key => {
          expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        // Validate period totals add up to product totals
        let totalPeriodRevenue = 0;
        let totalPeriodQuantity = 0;
        let totalPeriodB2B = 0;
        let totalPeriodB2C = 0;

        Object.values(productWithPeriods.periods).forEach(period => {
          totalPeriodRevenue += period.ingresos;
          totalPeriodQuantity += period.cantidad;
          totalPeriodB2B += period.b2bIngresos || 0;
          totalPeriodB2C += period.b2cIngresos || 0;
        });

        expect(totalPeriodRevenue).toBe(productWithPeriods.totalIngresos);
        expect(totalPeriodQuantity).toBe(productWithPeriods.totalCantidad);
        expect(totalPeriodB2B).toBe(productWithPeriods.b2bIngresos);
        expect(totalPeriodB2C).toBe(productWithPeriods.b2cIngresos);
      }

      expect(productWithPeriods).toBeTruthy();
    });

    it("should validate weekly period keys and aggregation", () => {
      const report = new ProductReport(realOrders, realB2BClients, realProducts, {
        detailLevel: 'product',
        segment: 'none',
        metrics: 'both',
        period: 'weekly',
        categories: ['GRzDxeAWOj2HBhmlObSy'] // sourdough only
      });

      const result = report.generateReport();

      const productWithPeriods = result.products.find(p => p.periods && Object.keys(p.periods).length > 0);

      console.log(`\n=== WEEKLY PERIODS VALIDATION ===`);
      if (productWithPeriods) {
        const periodKeys = Object.keys(productWithPeriods.periods);
        console.log(`Weekly period keys: ${periodKeys.join(', ')}`);

        // Show period data
        periodKeys.forEach(periodKey => {
          const period = productWithPeriods.periods[periodKey];
          console.log(`  ${periodKey}: revenue=${period.ingresos}, qty=${period.cantidad}`);
        });

        // Validate weekly period key format (should be YYYY-MM-DD/YYYY-MM-DD)
        periodKeys.forEach(key => {
          expect(key).toMatch(/^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/);
        });

        // Validate that each week starts on Monday
        periodKeys.forEach(key => {
          const [startDate] = key.split('/');
          const date = new Date(startDate + 'T12:00:00Z');
          const dayOfWeek = date.getUTCDay();
          expect(dayOfWeek).toBe(1); // Monday is 1
        });
      }

      expect(productWithPeriods).toBeTruthy();
    });

    it("should validate monthly period keys and aggregation", () => {
      const report = new ProductReport(realOrders, realB2BClients, realProducts, {
        detailLevel: 'product',
        segment: 'none',
        metrics: 'both',
        period: 'monthly',
        categories: ['GRzDxeAWOj2HBhmlObSy']
      });

      const result = report.generateReport();

      const productWithPeriods = result.products.find(p => p.periods && Object.keys(p.periods).length > 0);

      console.log(`\n=== MONTHLY PERIODS VALIDATION ===`);
      if (productWithPeriods) {
        const periodKeys = Object.keys(productWithPeriods.periods);
        console.log(`Monthly period keys: ${periodKeys.join(', ')}`);

        // Show period data
        periodKeys.forEach(periodKey => {
          const period = productWithPeriods.periods[periodKey];
          console.log(`  ${periodKey}: revenue=${period.ingresos}, qty=${period.cantidad}`);
        });

        // Validate monthly period key format (should be YYYY-MM)
        periodKeys.forEach(key => {
          expect(key).toMatch(/^\d{4}-\d{2}$/);
        });

        // Since our data is from March 2026, we should have 2026-03
        expect(periodKeys).toContain('2026-03');
      }

      expect(productWithPeriods).toBeTruthy();
    });

    it("should validate period data with specific dates from real orders", () => {
      // Orders have dates like "2026-03-02T12:00:00.000Z" for dueDate
      const report = new ProductReport(realOrders, realB2BClients, realProducts, {
        detailLevel: 'combination',
        segment: 'all',
        metrics: 'both',
        period: 'daily',
        dateField: 'dueDate'
      });

      const result = report.generateReport();

      // Find any combination with period data
      const comboWithPeriods = result.products.find(p =>
        p.periods && Object.keys(p.periods).length > 0 && p.totalIngresos > 0
      );

      console.log(`\n=== SPECIFIC DATE VALIDATION ===`);
      if (comboWithPeriods && comboWithPeriods.periods) {
        console.log(`Product: ${comboWithPeriods.productName} (${comboWithPeriods.combinationName || 'base'})`);
        console.log(`Period keys:`, Object.keys(comboWithPeriods.periods));

        // Check the first few periods with data
        const periodsWithData = Object.keys(comboWithPeriods.periods).filter(key =>
          comboWithPeriods.periods[key].ingresos > 0
        );

        periodsWithData.slice(0, 3).forEach(periodKey => {
          const periodData = comboWithPeriods.periods[periodKey];
          console.log(`${periodKey}: revenue=${periodData.ingresos}, qty=${periodData.cantidad}, b2b=${periodData.b2bIngresos || 0}`);
        });

        // Should have at least one period with data
        expect(periodsWithData.length).toBeGreaterThan(0);

        // Validate period data adds up to totals
        let totalPeriodRevenue = 0;
        Object.values(comboWithPeriods.periods).forEach(period => {
          totalPeriodRevenue += period.ingresos;
        });
        expect(totalPeriodRevenue).toBe(comboWithPeriods.totalIngresos);
      }

      expect(comboWithPeriods).toBeTruthy();
    });

    it("should validate period metrics filtering works correctly", () => {
      const reportIngresos = new ProductReport(realOrders, realB2BClients, realProducts, {
        detailLevel: 'product',
        segment: 'all',
        metrics: 'ingresos',
        period: 'daily',
        categories: ['GRzDxeAWOj2HBhmlObSy']
      });

      const reportCantidad = new ProductReport(realOrders, realB2BClients, realProducts, {
        detailLevel: 'product',
        segment: 'all',
        metrics: 'cantidad',
        period: 'daily',
        categories: ['GRzDxeAWOj2HBhmlObSy']
      });

      const resultIngresos = reportIngresos.generateReport();
      const resultCantidad = reportCantidad.generateReport();

      const ingresosProduct = resultIngresos.products.find(p => p.periods && Object.keys(p.periods).length > 0);
      const cantidadProduct = resultCantidad.products.find(p => p.periods && Object.keys(p.periods).length > 0);

      console.log(`\n=== PERIOD METRICS FILTERING ===`);
      if (ingresosProduct && ingresosProduct.periods) {
        const firstPeriodKey = Object.keys(ingresosProduct.periods)[0];
        const firstPeriod = ingresosProduct.periods[firstPeriodKey];
        console.log(`Ingresos period fields:`, Object.keys(firstPeriod));

        // Should have revenue fields but not quantity fields
        expect(firstPeriod).toHaveProperty('ingresos');
        expect(firstPeriod).toHaveProperty('b2bIngresos');
        expect(firstPeriod).toHaveProperty('b2cIngresos');
        expect(firstPeriod).not.toHaveProperty('cantidad');
        expect(firstPeriod).not.toHaveProperty('b2bCantidad');
        expect(firstPeriod).not.toHaveProperty('b2cCantidad');
      }

      if (cantidadProduct && cantidadProduct.periods) {
        const firstPeriodKey = Object.keys(cantidadProduct.periods)[0];
        const firstPeriod = cantidadProduct.periods[firstPeriodKey];
        console.log(`Cantidad period fields:`, Object.keys(firstPeriod));

        // Should have quantity fields but not revenue fields
        expect(firstPeriod).not.toHaveProperty('ingresos');
        expect(firstPeriod).not.toHaveProperty('b2bIngresos');
        expect(firstPeriod).not.toHaveProperty('b2cIngresos');
        expect(firstPeriod).toHaveProperty('cantidad');
        expect(firstPeriod).toHaveProperty('b2bCantidad');
        expect(firstPeriod).toHaveProperty('b2cCantidad');
      }

      expect(ingresosProduct).toBeTruthy();
      expect(cantidadProduct).toBeTruthy();
    });
  });

  describe("Edge Cases with Real Data", () => {
    it("should handle complimentary orders and items correctly", () => {
      // Find complimentary items in real data
      let complimentaryOrders = 0;
      let complimentaryItems = 0;
      let totalOrders = 0;
      let totalItems = 0;

      realOrders.forEach(order => {
        totalOrders++;
        if (order.isComplimentary) complimentaryOrders++;

        order.orderItems.forEach(item => {
          totalItems++;
          if (item.isComplimentary) complimentaryItems++;
        });
      });

      const report = new ProductReport(realOrders, realB2BClients, realProducts);

      console.log(`\n=== COMPLIMENTARY DATA VALIDATION ===`);
      console.log(`Total orders: ${totalOrders}`);
      console.log(`Complimentary orders: ${complimentaryOrders}`);
      console.log(`Total items: ${totalItems}`);
      console.log(`Complimentary items: ${complimentaryItems}`);
      console.log(`Non-complimentary orders in report: ${report.allOrders.length}`);

      // Report should exclude complimentary orders
      expect(report.allOrders.length).toBe(totalOrders - complimentaryOrders);
    });

    it("should handle products with missing combinations correctly", () => {
      const report = new ProductReport(realOrders, realB2BClients, realProducts, {
        detailLevel: 'combination',
        segment: 'none',
        metrics: 'both'
      });

      const result = report.generateReport();

      // Check that products without combinations are handled
      const productsWithNullCombination = result.products.filter(p => p.combinationId === null);
      const productsWithCombination = result.products.filter(p => p.combinationId !== null);

      console.log(`\n=== COMBINATION HANDLING VALIDATION ===`);
      console.log(`Products with null combination: ${productsWithNullCombination.length}`);
      console.log(`Products with combinations: ${productsWithCombination.length}`);
      console.log(`Total combination products: ${result.products.length}`);

      expect(result.products.length).toBeGreaterThan(0);
      expect(productsWithNullCombination.length + productsWithCombination.length).toBe(result.products.length);
    });
  });
});