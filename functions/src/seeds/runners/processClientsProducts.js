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

const isRecentOrder = (dateStr) => {
  const orderDate = new Date(dateStr);
  const year = orderDate.getFullYear();
  return year >= 2024;
};

const processCustomerAnalysis = () => {
  const customerAnalysis = {};
  const recentCustomers = {};

  Object.entries(clients).forEach(([userId, customer]) => {
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
      .filter(order => order !== null)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (orders.length > 0) {
      // Sort orders by date to find the first order
      const sortedOrders = [...orders].sort((a, b) => new Date(a.date) - new Date(b.date));
      const firstOrderDate = new Date(sortedOrders[0].date);
      const yearsAsClient = Math.round((new Date() - firstOrderDate) / (1000 * 60 * 60 * 24 * 365) * 10) / 10;

      const customerData = {
        ...parseSpanishName(customer.name),
        totalOrders: orders.length,
        totalRevenue: orders.reduce((total, order) => total + order.total, 0),
        averageOrderValue: Math.round(orders.reduce((total, order) => total + order.total, 0) / orders.length),
        clientFor: yearsAsClient,
        uniqueProducts: orders.map(order => order.items).flat().filter((item, index, self) => self.indexOf(item) === index),
        orders,
      };

      customerAnalysis[userId] = customerData;

      // Check if customer has recent orders
      const recentOrders = orders.filter(order => isRecentOrder(order.date));
      if (recentOrders.length > 0) {
        recentCustomers[userId] = {
          ...customerData,
          orders: recentOrders,
          totalOrders: recentOrders.length,
        };
      }
    } else {
      errorLog.orderValidationErrors.push({
        userId,
        customerName: customer.name,
        error: 'No valid orders found after processing',
      });
    }
  });

  // Sort customers by total orders (descending)
  const sortByOrders = (obj) => {
    return Object.fromEntries(
      Object.entries(obj).sort(([, a], [, b]) => b.totalOrders - a.totalOrders),
    );
  };

  return {
    customerAnalysis: sortByOrders(customerAnalysis),
    recentCustomers: sortByOrders(recentCustomers),
  };
};

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

const generateErrorSummary = (customerData) => {
  // Calculate total orders across all customers
  const totalOrders = Object.values(customerData.customerAnalysis)
    .reduce((sum, client) => sum + client.totalOrders, 0);

  // Calculate total recent orders
  const totalRecentOrders = Object.values(customerData.recentCustomers)
    .reduce((sum, client) => sum + client.totalOrders, 0);

  return {
    successMetrics: {
      totalProcessedClients: Object.keys(customerData.customerAnalysis).length,
      totalProcessedOrders: totalOrders,
      totalRecentCustomers: Object.keys(customerData.recentCustomers).length,
      totalRecentOrders: totalRecentOrders,
    },
    errorMetrics: {
      totalEmptyOrders: errorLog.emptyOrders.length,
      totalMalformedOrders: errorLog.malformedOrders.length,
      totalInvalidProducts: errorLog.invalidProducts.length,
      totalOrderValidationErrors: errorLog.orderValidationErrors.length,
    },
    details: errorLog,
  };
};

// Create processed_imports directory if it doesn't exist
const processedImportsDir = path.join(__dirname, '../data/processed_imports');
if (!fs.existsSync(processedImportsDir)) {
  fs.mkdirSync(processedImportsDir, { recursive: true });
}

// Generate all data
const { customerAnalysis, recentCustomers } = processCustomerAnalysis();
const productCatalog = processProductCatalog();
const summary = generateErrorSummary({ customerAnalysis, recentCustomers });

// Save files
fs.writeFileSync(
  path.join(processedImportsDir, 'processedClientsProducts_customer_analysis.json'),
  JSON.stringify(customerAnalysis, null, 2),
);

fs.writeFileSync(
  path.join(processedImportsDir, 'processedClientsProducts_recent_customers.json'),
  JSON.stringify(recentCustomers, null, 2),
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
console.log('- Total processed clients:', summary.successMetrics.totalProcessedClients);
console.log('- Total processed orders:', summary.successMetrics.totalProcessedOrders);
console.log('- Recent customers (2024-2025):', summary.successMetrics.totalRecentCustomers);
console.log('- Recent orders (2024-2025):', summary.successMetrics.totalRecentOrders);
console.log('\nError Metrics:');
console.log('- Empty orders:', summary.errorMetrics.totalEmptyOrders);
console.log('- Malformed orders:', summary.errorMetrics.totalMalformedOrders);
console.log('- Invalid products:', summary.errorMetrics.totalInvalidProducts);
console.log('- Order validation errors:', summary.errorMetrics.totalOrderValidationErrors);
console.log('\nFiles saved in processed_imports directory.');
