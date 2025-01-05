const fs = require('fs');
const path = require('path');
const _ = require('lodash');

const processedImportsDir = path.join(__dirname, '../data/processed_imports');

// Read both files
const ordersAnalysis = require(path.join(processedImportsDir, '../processed_imports/processedOrders_customer_analysis.json'));
const clientsAnalysis = require(path.join(processedImportsDir, '../processed_imports/processedClientsProducts_customer_analysis.json'));

const differences = {
  onlyInOrders: [],
  onlyInClients: [],
  differentValues: {},
  metadata: {
    totalClientsOrders: Object.keys(ordersAnalysis).length,
    totalClientsClients: Object.keys(clientsAnalysis).length,
    totalDifferences: 0,
  },
};

// Helper to create a client key
const createClientKey = (client) => {
  return `${client.firstName?.toLowerCase()}_${client.lastName?.toLowerCase()}`;
};

// Create mappings of name to ID for both datasets
const ordersMap = new Map();
const clientsMap = new Map();

Object.entries(ordersAnalysis).forEach(([id, client]) => {
  const key = createClientKey(client);
  if (!ordersMap.has(key)) {
    ordersMap.set(key, []);
  }
  ordersMap.get(key).push({ id, data: client });
});

Object.entries(clientsAnalysis).forEach(([id, client]) => {
  const key = createClientKey(client);
  if (!clientsMap.has(key)) {
    clientsMap.set(key, []);
  }
  clientsMap.get(key).push({ id, data: client });
});

// Helper to calculate difference based on type
const calculateDifference = (ordersValue, clientsValue, field) => {
  if (Array.isArray(ordersValue)) {
    const added = _.difference(ordersValue, clientsValue);
    const removed = _.difference(clientsValue, ordersValue);
    return {
      added,
      removed,
      magnitude: added.length + removed.length, // for sorting
    };
  }

  if (field.includes('date')) {
    const diffDays = Math.abs(
      (new Date(ordersValue) - new Date(clientsValue)) / (1000 * 60 * 60 * 24),
    );
    return {
      value: `${diffDays} days`,
      magnitude: diffDays,
    };
  }

  if (typeof ordersValue === 'number' || !isNaN(parseFloat(ordersValue))) {
    const diff = Number(ordersValue.toString().replace(/,/g, '')) -
                Number(clientsValue.toString().replace(/,/g, ''));
    return {
      value: field.includes('Revenue') || field.includes('Value') ?
        formatMoney(Math.abs(diff)) :
        Math.abs(diff),
      magnitude: Math.abs(diff),
    };
  }

  return {
    value: 'different',
    magnitude: 0,
  };
};

// Helper to format money
const formatMoney = (amount) => {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

// Process differences and group by field
const processFieldDifference = (field, ordersValue, clientsValue, clientName) => {
  const diff = calculateDifference(ordersValue, clientsValue, field);

  if (!differences.differentValues[field]) {
    differences.differentValues[field] = [];
  }

  const entry = {
    name: clientName,
    ordersValue,
    clientsValue,
    difference: Array.isArray(ordersValue) ? diff : diff.value,
  };

  differences.differentValues[field].push({
    ...entry,
    _sortMagnitude: diff.magnitude, // for sorting, will be removed before saving
  });
};

// Compare individual clients
const compareClients = (ordersClient, clientsClient) => {
  const keysToCompare = new Set([
    ...Object.keys(ordersClient || {}),
    ...Object.keys(clientsClient || {}),
  ]);

  const clientName = `${ordersClient.firstName} ${ordersClient.lastName}`;

  keysToCompare.forEach(key => {
    // Skip ID-related or redundant fields
    if (['id', 'firstName', 'lastName', 'name', 'orders'].includes(key)) return;

    const ordersValue = ordersClient?.[key];
    const clientsValue = clientsClient?.[key];

    // Compare and track differences
    if (!_.isEqual(ordersValue, clientsValue)) {
      processFieldDifference(key, ordersValue, clientsValue, clientName);
    }
  });
};

// Process all unique client names
const allClientNames = new Set([...ordersMap.keys(), ...clientsMap.keys()]);

allClientNames.forEach(clientKey => {
  const ordersClients = ordersMap.get(clientKey) || [];
  const clientsClients = clientsMap.get(clientKey) || [];

  if (ordersClients.length === 0) {
    clientsClients.forEach(({ id, data }) => {
      differences.onlyInClients.push({
        clientId: id,
        name: `${data.firstName} ${data.lastName}`,
        data,
      });
    });
    return;
  }

  if (clientsClients.length === 0) {
    ordersClients.forEach(({ id, data }) => {
      differences.onlyInOrders.push({
        clientId: id,
        name: `${data.firstName} ${data.lastName}`,
        data,
      });
    });
    return;
  }

  // Compare first matches
  compareClients(ordersClients[0].data, clientsClients[0].data);

  // Log multiple matches
  if (ordersClients.length > 1 || clientsClients.length > 1) {
    console.log(`Warning: Multiple matches found for client ${clientKey}`);
    console.log(`- Orders matches: ${ordersClients.length}`);
    console.log(`- Clients matches: ${clientsClients.length}`);
  }
});

// Sort differences by magnitude and remove sorting field
Object.keys(differences.differentValues).forEach(field => {
  differences.differentValues[field].sort((a, b) => b._sortMagnitude - a._sortMagnitude);
  differences.differentValues[field].forEach(item => delete item._sortMagnitude);
});

// Update metadata
differences.metadata.totalDifferences =
  differences.onlyInOrders.length +
  differences.onlyInClients.length +
  Object.values(differences.differentValues)
    .reduce((sum, arr) => sum + arr.length, 0);

differences.metadata.exactMatches =
  differences.metadata.totalClientsOrders -
  differences.onlyInOrders.length -
  Object.values(differences.differentValues)
    .reduce((sum, arr) => sum + arr.length, 0);

// Save comparison results
fs.writeFileSync(
  path.join(processedImportsDir, 'analysis_comparison.json'),
  JSON.stringify(differences, null, 2),
);

// Console output
console.log('\nComparison Summary:');
console.log('-------------------');
console.log('Total clients in Orders analysis:', differences.metadata.totalClientsOrders);
console.log('Total clients in Clients analysis:', differences.metadata.totalClientsClients);
console.log('\nDifferences found:');
console.log('- Clients only in Orders:', differences.onlyInOrders.length);
console.log('- Clients only in Clients:', differences.onlyInClients.length);
Object.entries(differences.differentValues).forEach(([field, diffs]) => {
  console.log(`- Clients with different ${field}:`, diffs.length);
});
console.log('- Exact matches:', differences.metadata.exactMatches);
console.log('\nTotal differences:', differences.metadata.totalDifferences);
console.log('\nDetailed comparison saved to analysis_comparison.json');
