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

const hasRecentOrders = (clientOrders) => {
  return Object.values(clientOrders).some(order => isRecentOrder(order.date));
};

const findRecentClients = () => {
  // Track unique clients from both sources
  const recentClients = {};
  const errorLog = {
    multipleMatches: [],
  };

  // First pass: Create normalized map of clients from export_clientes
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
        data: clientData,
      };
    }
  });

  // Second pass: Process orders to find clients with recent orders
  const ordersByClient = {};
  Object.entries(orders).forEach(([orderId, order]) => {
    if (!order.client || !order.date) return;

    const clientName = order.client;
    if (!ordersByClient[clientName]) {
      ordersByClient[clientName] = {};
    }
    ordersByClient[clientName][orderId] = order;
  });

  // Process each unique client from orders
  Object.entries(ordersByClient).forEach(([clientName, clientOrders]) => {
    if (!hasRecentOrders(clientOrders)) return;

    const normalizedName = normalizeString(clientName);
    const matchedClient = normalizedClientsMap[normalizedName];

    if (matchedClient) {
      // Client exists in export_clientes
      recentClients[matchedClient.id] = {
        id: matchedClient.id,
        name: matchedClient.data.name,
        phone: matchedClient.data.phone || null,
        email: matchedClient.data.email || null,
        address: matchedClient.data.address || null,
        notes: matchedClient.data.notes || null,
        since: matchedClient.data.since || null,
      };
    } else {
      // Client only exists in orders
      const sanitizedId = normalizedName.replace(/[^a-z0-9]/g, '_');
      recentClients[sanitizedId] = {
        id: sanitizedId,
        name: clientName,
        phone: null,
        email: null,
        address: null,
        notes: 'Client found only in orders data',
        since: null,
      };
    }
  });

  return {
    recentClients,
    summary: {
      totalRecentClients: Object.keys(recentClients).length,
      matchedClients: Object.values(recentClients).filter(c => c.notes !== 'Client found only in orders data').length,
      unmatchedClients: Object.values(recentClients).filter(c => c.notes === 'Client found only in orders data').length,
      multipleMatches: errorLog.multipleMatches.length,
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
const result = findRecentClients();

// Save the results
fs.writeFileSync(
  path.join(outputDir, 'processedMatchClients_recent_clients.json'),
  JSON.stringify(result.recentClients, null, 2),
);

fs.writeFileSync(
  path.join(outputDir, 'processedMatchClients_recent_clients_error_log.json'),
  JSON.stringify(result.errorLog, null, 2),
);

// Console output
console.log('\nProcessing Summary:');
console.log('------------------');
console.log(`- Total clients with recent orders: ${result.summary.totalRecentClients}`);
console.log(`- Matched with client database: ${result.summary.matchedClients}`);
console.log(`- Unmatched (orders only): ${result.summary.unmatchedClients}`);
console.log(`- Multiple matches found: ${result.summary.multipleMatches}`);
console.log('\nResults saved in processed_imports directory.');
