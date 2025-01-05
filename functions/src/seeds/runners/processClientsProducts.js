const clients = require('../data/export_clientes.json');
const { parseSpanishName } = require('../../utils/helpers.js');
const fs = require('fs');
const path = require('path');

// Track malformed data
const errorLog = {
  emptyOrders: [],
  malformedOrders: [],
  invalidProducts: [],
  orderValidationErrors: [],
};

// Helper function to calculate order total excluding delivery
const calculateOrderTotal = (products) => {
  if (!Array.isArray(products)) return 0;

  return products.reduce((total, product) => {
    if (!product || !product.name) return total;
    if (product.name.toLowerCase() !== 'domicilio') {
      return total + (Number(product.total) || 0);
    }
    return total;
  }, 0);
};

// Process customer data
const processCustomerAnalysis = () => {
  const customerAnalysis = {};

  Object.entries(clients).forEach(([userId, customer]) => {
    // Check for missing history
    if (!customer?.history) {
      errorLog.emptyOrders.push({
        userId,
        customerName: customer?.name || 'Unknown',
        error: 'No history found',
      });
      return;
    }

    if (Object.keys(customer.history).length === 0) {
      errorLog.emptyOrders.push({
        userId,
        customerName: customer.name,
        error: 'Empty history object',
      });
      return;
    }

    const orders = Object.entries(customer.history)
      .map(([orderId, order]) => {
        // Validate order structure
        if (!order || !order.date || !Array.isArray(order.products)) {
          errorLog.malformedOrders.push({
            userId,
            customerName: customer.name,
            orderId,
            orderData: order,
            error: 'Invalid order structure',
          });
          return null;
        }

        // Track invalid products
        const invalidProducts = order.products.filter(product =>
          !product || typeof product !== 'object' || !product.name,
        );

        if (invalidProducts.length > 0) {
          errorLog.invalidProducts.push({
            userId,
            customerName: customer.name,
            orderId,
            products: invalidProducts,
            error: 'Invalid product structure',
          });
        }

        const validProducts = order.products.filter(product =>
          product &&
          typeof product === 'object' &&
          product.name &&
          product.name.toLowerCase() !== 'domicilio',
        );

        return {
          date: order.date,
          total: calculateOrderTotal(order.products),
          items: validProducts.map(product => product.name),
        };
      })
      .filter(order => order !== null); // Remove invalid orders

    // Only add customer if they have valid orders
    if (orders.length > 0) {
      customerAnalysis[userId] = {
        ...parseSpanishName(customer.name),
        totalOrders: orders.length,
        orders: orders.sort((a, b) => new Date(b.date) - new Date(a.date)),
      };
    } else {
      errorLog.orderValidationErrors.push({
        userId,
        customerName: customer.name,
        error: 'No valid orders found after processing',
      });
    }
  });

  return customerAnalysis;
};

// Process product catalog
const processProductCatalog = () => {
  const uniqueProducts = new Set();

  Object.values(clients).forEach(customer => {
    if (!customer?.history) return;

    Object.values(customer.history).forEach(order => {
      if (!order?.products || !Array.isArray(order.products)) return;

      order.products.forEach(product => {
        if (product && product.name && product.name.toLowerCase() !== 'domicilio') {
          uniqueProducts.add(product.name);
        }
      });
    });
  });

  return {
    uniqueProducts: Array.from(uniqueProducts).sort(),
    metadata: {
      totalUniqueProducts: uniqueProducts.size,
      generatedAt: new Date().toISOString(),
    },
  };
};

// Create processed_imports directory if it doesn't exist
const processedImportsDir = path.join(__dirname, '../data/processed_imports');
if (!fs.existsSync(processedImportsDir)) {
  fs.mkdirSync(processedImportsDir, { recursive: true });
}

// Generate and save error log
const generateErrorSummary = () => {
  // Calculate success metrics
  const successMetrics = {
    totalProcessedClients: Object.keys(customerAnalysis).length,
    totalProcessedOrders: Object.values(customerAnalysis).reduce((sum, client) =>
      sum + client.totalOrders, 0,
    ),
  };

  return {
    successMetrics,
    errorMetrics: {
      totalEmptyOrders: errorLog.emptyOrders.length,
      totalMalformedOrders: errorLog.malformedOrders.length,
      totalInvalidProducts: errorLog.invalidProducts.length,
      totalOrderValidationErrors: errorLog.orderValidationErrors.length,
    },
    details: errorLog,
  };
};

// Generate and save all files
const customerAnalysis = processCustomerAnalysis();
const productCatalog = processProductCatalog();
const summary = generateErrorSummary();

// Save files
fs.writeFileSync(
  path.join(processedImportsDir, 'processedClientsProducts_customer_analysis.json'),
  JSON.stringify(customerAnalysis, null, 2),
);

fs.writeFileSync(
  path.join(processedImportsDir, 'processedClientsProducts_product_catalog.json'),
  JSON.stringify(productCatalog, null, 2),
);

fs.writeFileSync(
  path.join(processedImportsDir, 'processedClientsProducts_error_log.json'),
  JSON.stringify(summary, null, 2),
);

// Enhanced console output
console.log('\nProcessing Summary:');
console.log('------------------');
console.log('Success Metrics:');
console.log('- Successfully processed clients:', summary.successMetrics.totalProcessedClients);
console.log('- Successfully processed orders:', summary.successMetrics.totalProcessedOrders);
console.log('\nError Metrics:');
console.log('- Empty orders:', summary.errorMetrics.totalEmptyOrders);
console.log('- Malformed orders:', summary.errorMetrics.totalMalformedOrders);
console.log('- Invalid products:', summary.errorMetrics.totalInvalidProducts);
console.log('- Order validation errors:', summary.errorMetrics.totalOrderValidationErrors);
console.log('\nFiles saved in processed_imports directory.');
