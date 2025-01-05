const fs = require('fs');
const path = require('path');

const processedImportsDir = path.join(__dirname, '../data/processed_imports');

// Read both files
const clientsBasic = require(path.join(processedImportsDir, 'processedMatchClients_recent_clients.json'));
const clientsDetailed = require(path.join(processedImportsDir, 'processedOrders_recent_customers.json'));

const results = {
  inBothFiles: [],
  onlyInBasic: [],
  onlyInDetailed: [],
  metadata: {
    totalBasicClients: Object.keys(clientsBasic).length,
    totalDetailedClients: Object.keys(clientsDetailed).length,
  },
};

// Helper to normalize names for comparison
const normalizeName = (name) => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z ]/g, '')         // Remove special characters
    .trim()
    .replace(/\s+/g, ' ');          // Normalize spaces
};

// Create set of normalized names from basic clients
const basicClientsSet = new Set();
Object.entries(clientsBasic).forEach(([id, client]) => {
  const normalizedName = normalizeName(client.name);
  basicClientsSet.add(normalizedName);

  // Track original data
  results.onlyInBasic.push({
    id,
    originalName: client.name,
    normalizedName,
    data: client,
  });
});

// Compare with detailed clients
Object.entries(clientsDetailed).forEach(([key, client]) => {
  const normalizedName = normalizeName(key);

  if (basicClientsSet.has(normalizedName)) {
    // Move from onlyInBasic to inBothFiles
    const basicClientIndex = results.onlyInBasic.findIndex(
      c => c.normalizedName === normalizedName,
    );

    if (basicClientIndex !== -1) {
      const basicClient = results.onlyInBasic[basicClientIndex];
      results.onlyInBasic.splice(basicClientIndex, 1);

      results.inBothFiles.push({
        basicId: basicClient.id,
        basicName: basicClient.originalName,
        detailedKey: key,
        normalizedName,
      });
    }
  } else {
    results.onlyInDetailed.push({
      key,
      normalizedName,
      data: client,
    });
  }
});

// Update metadata
results.metadata.totalMatches = results.inBothFiles.length;
results.metadata.totalUnmatched = results.onlyInBasic.length + results.onlyInDetailed.length;

// Save results
fs.writeFileSync(
  path.join(processedImportsDir, 'client_list_comparison.json'),
  JSON.stringify(results, null, 2),
);

// Console output
console.log('\nClient List Comparison:');
console.log('----------------------');
console.log('Clients in basic file:', results.metadata.totalBasicClients);
console.log('Clients in detailed file:', results.metadata.totalDetailedClients);
console.log('\nMatches found:', results.metadata.totalMatches);
console.log('Unmatched total:', results.metadata.totalUnmatched);
console.log('- Only in basic file:', results.onlyInBasic.length);
console.log('- Only in detailed file:', results.onlyInDetailed.length);
console.log('\nDetailed results saved to client_list_comparison.json');

// Log some examples if there are unmatched clients
if (results.onlyInBasic.length > 0) {
  console.log('\nExample unmatched clients from basic file:');
  results.onlyInBasic.slice(0, 3).forEach(client => {
    console.log(`- ${client.originalName} (normalized: ${client.normalizedName})`);
  });
}

if (results.onlyInDetailed.length > 0) {
  console.log('\nExample unmatched clients from detailed file:');
  results.onlyInDetailed.slice(0, 3).forEach(client => {
    console.log(`- ${client.key} (normalized: ${client.normalizedName})`);
  });
}
