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
  differentValues: [],
  metadata: {
    totalClientsOrders: Object.keys(ordersAnalysis).length,
    totalClientsClients: Object.keys(clientsAnalysis).length,
    totalDifferences: 0,
  },
};

// Helper to compare arrays
const compareArrays = (arr1, arr2) => {
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  const diff1 = [...set1].filter(x => !set2.has(x));
  const diff2 = [...set2].filter(x => !set1.has(x));
  return diff1.length === 0 && diff2.length === 0;
};

// Helper to format difference
const formatDifference = (key, ordersValue, clientsValue) => {
  if (Array.isArray(ordersValue) && Array.isArray(clientsValue)) {
    const onlyInOrders = _.difference(ordersValue, clientsValue);
    const onlyInClients = _.difference(clientsValue, ordersValue);
    return {
      field: key,
      onlyInOrders,
      onlyInClients,
    };
  }

  return {
    field: key,
    ordersValue,
    clientsValue,
  };
};

// Compare individual clients
const compareClients = (clientId, ordersClient, clientsClient) => {
  const differences = [];

  const keysToCompare = new Set([
    ...Object.keys(ordersClient || {}),
    ...Object.keys(clientsClient || {}),
  ]);

  keysToCompare.forEach(key => {
    const ordersValue = ordersClient?.[key];
    const clientsValue = clientsClient?.[key];

    // Skip orders array comparison for now - it's too detailed
    if (key === 'orders') return;

    // Compare arrays (like uniqueProducts)
    if (Array.isArray(ordersValue) && Array.isArray(clientsValue)) {
      if (!compareArrays(ordersValue, clientsValue)) {
        differences.push(formatDifference(key, ordersValue, clientsValue));
      }
      return;
    }

    // Compare everything else
    if (!_.isEqual(ordersValue, clientsValue)) {
      differences.push(formatDifference(key, ordersValue, clientsValue));
    }
  });

  return differences;
};

// Process all clients
const allClientIds = new Set([
  ...Object.keys(ordersAnalysis),
  ...Object.keys(clientsAnalysis),
]);

allClientIds.forEach(clientId => {
  const ordersClient = ordersAnalysis[clientId];
  const clientsClient = clientsAnalysis[clientId];

  if (!ordersClient) {
    differences.onlyInClients.push({
      clientId,
      data: clientsClient,
    });
    return;
  }

  if (!clientsClient) {
    differences.onlyInOrders.push({
      clientId,
      data: ordersClient,
    });
    return;
  }

  const clientDiffs = compareClients(clientId, ordersClient, clientsClient);
  if (clientDiffs.length > 0) {
    differences.differentValues.push({
      clientId,
      differences: clientDiffs,
    });
  }
});

// Update metadata
differences.metadata.totalDifferences =
  differences.onlyInOrders.length +
  differences.onlyInClients.length +
  differences.differentValues.length;

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
console.log('- Clients with different values:', differences.differentValues.length);
console.log('\nTotal differences:', differences.metadata.totalDifferences);
console.log('\nDetailed comparison saved to analysis_comparison.json');
