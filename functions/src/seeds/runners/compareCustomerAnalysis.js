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
const compareClients = (ordersClient, clientsClient) => {
  const differences = [];

  const keysToCompare = new Set([
    ...Object.keys(ordersClient || {}),
    ...Object.keys(clientsClient || {}),
  ]);

  keysToCompare.forEach(key => {
    // Skip ID-related or redundant fields
    if (['id', 'firstName', 'lastName', 'name', 'orders'].includes(key)) return;

    const ordersValue = ordersClient?.[key];
    const clientsValue = clientsClient?.[key];

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

  // If we have matches, compare them
  // Note: Currently comparing first match, but could be extended to handle multiple matches
  const clientDiffs = compareClients(ordersClients[0].data, clientsClients[0].data);
  if (clientDiffs.length > 0) {
    differences.differentValues.push({
      ordersId: ordersClients[0].id,
      clientsId: clientsClients[0].id,
      name: `${ordersClients[0].data.firstName} ${ordersClients[0].data.lastName}`,
      differences: clientDiffs,
    });
  }

  // Log if we have multiple matches (potential duplicates)
  if (ordersClients.length > 1 || clientsClients.length > 1) {
    console.log(`Warning: Multiple matches found for client ${clientKey}`);
    console.log(`- Orders matches: ${ordersClients.length}`);
    console.log(`- Clients matches: ${clientsClients.length}`);
  }
});

// Update metadata
differences.metadata.totalDifferences =
  differences.onlyInOrders.length +
  differences.onlyInClients.length +
  differences.differentValues.length;

// Add summary of matches/mismatches to metadata
differences.metadata.exactMatches =
  differences.metadata.totalClientsOrders -
  differences.onlyInOrders.length -
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
console.log('- Exact matches:', differences.metadata.exactMatches);
console.log('\nTotal differences:', differences.metadata.totalDifferences);
console.log('\nDetailed comparison saved to analysis_comparison.json');
