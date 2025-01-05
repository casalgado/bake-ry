const orders = require('../data/export_orders.json');
const clients = require('../data/export_clientes.json');
const fs = require('fs');
const path = require('path');

// Helper functions
const normalizeString = (str) => {
  return str.toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
};

const isRecentOrder = (dateStr) => {
  const orderDate = new Date(dateStr);
  const year = orderDate.getFullYear();
  return year >= 2024;
};

const matchAndFilterClients = () => {
  const clientProfiles = {};
  const errorLog = {
    unmatchedClients: [],
    multipleMatches: [],
    processingErrors: [],
  };

  // First, create a normalized map of clients from export_clientes
  const normalizedClientsMap = {};
  Object.entries(clients).forEach(([clientId, clientData]) => {
    if (clientData.name) {
      const normalizedName = normalizeString(clientData.name);

      if (normalizedClientsMap[normalizedName]) {
        errorLog.multipleMatches.push({
          normalizedName,
          clients: [
            { id: normalizedClientsMap[normalizedName].id, name: normalizedClientsMap[normalizedName].name },
            { id: clientId, name: clientData.name },
          ],
        });
      }

      normalizedClientsMap[normalizedName] = {
        id: clientId,
        ...clientData,
      };
    }
  });

  // Process orders and match with clients
  Object.entries(orders).forEach(([orderId, order]) => {
    if (!order.client || !order.date) {
      errorLog.processingErrors.push({
        orderId,
        error: 'Invalid order data',
        orderData: order,
      });
      return;
    }

    const normalizedOrderClient = normalizeString(order.client);
    const matchedClient = normalizedClientsMap[normalizedOrderClient];

    if (!matchedClient) {
      errorLog.unmatchedClients.push({
        orderId,
        clientName: order.client,
      });
      return;
    }

    // Initialize client profile if not exists
    if (!clientProfiles[matchedClient.id]) {
      clientProfiles[matchedClient.id] = {
        id: matchedClient.id,
        personalInfo: {
          name: matchedClient.name,
          phone: matchedClient.phone || null,
          email: matchedClient.email || null,
          address: matchedClient.address || null,
          notes: matchedClient.notes || null,
          since: matchedClient.since || null,
        },
        orders: [],
      };
    }

    // Add order to client profile
    clientProfiles[matchedClient.id].orders.push({
      orderId,
      date: order.date,
      total: order.total,
      products: order.products,
    });
  });

  // Filter for clients with recent orders and sort orders by date
  const recentClientProfiles = {};
  Object.entries(clientProfiles).forEach(([clientId, profile]) => {
    // Sort orders by date
    profile.orders.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Check for recent orders
    const hasRecentOrders = profile.orders.some(order => isRecentOrder(order.date));

    if (hasRecentOrders) {
      // Add additional analytics
      const recentOrders = profile.orders.filter(order => isRecentOrder(order.date));
      const totalRecentRevenue = recentOrders.reduce((sum, order) => sum + (order.total || 0), 0);

      recentClientProfiles[clientId] = {
        ...profile,
        analytics: {
          totalRecentOrders: recentOrders.length,
          totalRecentRevenue,
          averageOrderValue: totalRecentRevenue / recentOrders.length,
          firstOrderDate: profile.orders[profile.orders.length - 1].date,
          lastOrderDate: profile.orders[0].date,
          recentOrders,
        },
      };
    }
  });

  return {
    clientProfiles: recentClientProfiles,
    summary: {
      totalClients: Object.keys(clientProfiles).length,
      recentClients: Object.keys(recentClientProfiles).length,
      errorMetrics: {
        unmatchedClients: errorLog.unmatchedClients.length,
        multipleMatches: errorLog.multipleMatches.length,
        processingErrors: errorLog.processingErrors.length,
      },
    },
    errorLog,
  };
};

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, '../data/processed_imports');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Execute the matching and filtering
const result = matchAndFilterClients();

// Save the results
fs.writeFileSync(
  path.join(outputDir, 'processedMatchClients_matched_recent_clients.json'),
  JSON.stringify(result.clientProfiles, null, 2),
);

fs.writeFileSync(
  path.join(outputDir, 'processedMatchClients_matched_clients_error_log.json'),
  JSON.stringify(result.errorLog, null, 2),
);

// Console output
console.log('\nProcessing Summary:');
console.log('------------------');
console.log('Success Metrics:');
console.log(`- Total matched clients: ${result.summary.totalClients}`);
console.log(`- Clients with recent orders: ${result.summary.recentClients}`);
console.log('\nError Metrics:');
console.log(`- Unmatched clients: ${result.summary.errorMetrics.unmatchedClients}`);
console.log(`- Multiple matches found: ${result.summary.errorMetrics.multipleMatches}`);
console.log(`- Processing errors: ${result.summary.errorMetrics.processingErrors}`);
console.log('\nDetailed results saved in processed_imports directory.');
