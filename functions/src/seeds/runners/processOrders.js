const orders = require('../data/export_orders.json');
const { parseSpanishName } = require('../../utils/helpers.js');
const fs = require('fs');
const path = require('path');

// Track processing errors
const errorLog = {
  invalidOrders: [], // Orders missing critical data
  malformedProducts: [], // Products missing name/total
  invalidProducts: [], // Products with invalid structure
  clientValidationErrors: [], // Issues with client data
};

// Utility functions
const formatMoney = (amount) => {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
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

// Transform orders into client-centric data structure
const transformOrdersToClientData = () => {
  const clientsMap = {};

  Object.entries(orders).forEach(([orderId, order]) => {
    // Validate order structure
    if (!order || !order.client || !order.date || !Array.isArray(order.products)) {
      errorLog.invalidOrders.push({
        orderId,
        orderData: order,
        error: 'Invalid order structure',
      });
      return;
    }

    const clientName = order.client.toLowerCase().trim();

    if (!clientsMap[clientName]) {
      clientsMap[clientName] = {
        name: order.client,
        history: {},
      };
    }

    // Validate products
    const invalidProducts = order.products.filter(product =>
      !product || typeof product !== 'object' || !product.name,
    );

    if (invalidProducts.length > 0) {
      errorLog.malformedProducts.push({
        orderId,
        clientName: order.client,
        products: invalidProducts,
        error: 'Invalid product structure',
      });
    }

    clientsMap[clientName].history[orderId] = {
      date: order.date,
      products: order.products,
    };
  });

  return clientsMap;
};

const processCustomerAnalysis = () => {
  const clientsData = transformOrdersToClientData();
  const customerAnalysis = {};
  const recentCustomers = {};

  Object.entries(clientsData).forEach(([clientId, client]) => {
    if (!client?.history) {
      errorLog.clientValidationErrors.push({
        clientId,
        customerName: client?.name || 'Unknown',
        error: 'No history found',
      });
      return;
    }

    const orders = Object.entries(client.history)
      .map(([orderId, order]) => {
        if (!order || !order.date || !Array.isArray(order.products)) {
          errorLog.invalidOrders.push({
            orderId,
            clientName: client.name,
            orderData: order,
            error: 'Invalid order structure',
          });
          return null;
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
      const firstOrderDate = sortedOrders[0].date.split('T')[0];
      const lastOrderDate = sortedOrders[sortedOrders.length - 1].date.split('T')[0];
      const yearsAsClient = Math.round((new Date(lastOrderDate) - new Date(firstOrderDate)) / (1000 * 60 * 60 * 24 * 365) * 10) / 10;
      const totalRevenue = orders.reduce((total, order) => total + order.total, 0);

      const customerData = {
        ...parseSpanishName(client.name),
        totalOrders: orders.length,
        totalRevenue: formatMoney(totalRevenue),
        rawTotalRevenue: totalRevenue,
        averageOrderValue: formatMoney(totalRevenue / orders.length),
        clientFor: yearsAsClient,
        yearlyRevenue: yearsAsClient < 1 ? formatMoney(totalRevenue / yearsAsClient) : formatMoney(totalRevenue),
        firstOrderDate: firstOrderDate,
        lastOrderDate: lastOrderDate,
        uniqueProducts: orders.map(order => order.items).flat().filter((item, index, self) => self.indexOf(item) === index),
        orders,
      };

      customerAnalysis[clientId] = customerData;

      // Check if customer has recent orders
      const recentOrders = orders.filter(order => isRecentOrder(order.date));
      if (recentOrders.length > 0) {
        recentCustomers[clientId] = {
          ...customerData,
          orders: recentOrders,
          totalOrders: recentOrders.length,
        };
      }
    }
  });

  // Sort customers by total revenue (descending)
  const sortByRevenue = (obj) => {
    return Object.fromEntries(
      Object.entries(obj).sort(([, a], [, b]) => b.rawTotalRevenue - a.rawTotalRevenue),
    );
  };

  return {
    customerAnalysis: sortByRevenue(customerAnalysis),
    recentCustomers: sortByRevenue(recentCustomers),
  };
};

const processProductCatalog = () => {
  const uniqueProducts = new Set();

  Object.values(orders).forEach(order => {
    if (!order?.products || !Array.isArray(order.products)) return;

    order.products.forEach(product => {
      if (product && product.name && product.name.toLowerCase() !== 'domicilio') {
        uniqueProducts.add(product.name);
      }
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
      totalInvalidOrders: errorLog.invalidOrders.length,
      totalMalformedProducts: errorLog.malformedProducts.length,
      totalInvalidProducts: errorLog.invalidProducts.length,
      totalClientValidationErrors: errorLog.clientValidationErrors.length,
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
  path.join(processedImportsDir, 'processedOrders_customer_analysis.json'),
  JSON.stringify(customerAnalysis, null, 2),
);

fs.writeFileSync(
  path.join(processedImportsDir, 'processedOrders_recent_customers.json'),
  JSON.stringify(recentCustomers, null, 2),
);

fs.writeFileSync(
  path.join(processedImportsDir, 'processedOrders_product_catalog.json'),
  JSON.stringify(productCatalog, null, 2),
);

fs.writeFileSync(
  path.join(processedImportsDir, 'processedOrders_error_log.json'),
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
console.log('- Invalid orders:', summary.errorMetrics.totalInvalidOrders);
console.log('- Malformed products:', summary.errorMetrics.totalMalformedProducts);
console.log('- Invalid products:', summary.errorMetrics.totalInvalidProducts);
console.log('- Client validation errors:', summary.errorMetrics.totalClientValidationErrors);
console.log('\nFiles saved in processed_imports directory.');
