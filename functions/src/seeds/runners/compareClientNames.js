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

// Debug: Print first few entries from each file
console.log('\nDebug: Sample from basic file:');
Object.entries(clientsBasic).slice(0, 3).forEach(([id, client]) => {
  console.log(`- ID: ${id}, Name: ${client.name}`);
});

console.log('\nDebug: Sample from detailed file:');
Object.entries(clientsDetailed).slice(0, 3).forEach(([key, client]) => {
  console.log(`- Key: ${key}`);
});

// Helper to normalize names for comparison
const normalizeName = (name) => {
  const normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z ]/g, '')         // Remove special characters
    .trim()
    .replace(/\s+/g, ' ');          // Normalize spaces

  return normalized;
};

// Create maps with normalized names and track all unique normalized names
const basicClientsMap = new Map();
const detailedClientsMap = new Map();
const allNormalizedNames = new Set();

// Process basic clients
console.log('\nDebug: Processing basic clients...');
Object.entries(clientsBasic).forEach(([id, client]) => {
  const normalizedName = normalizeName(client.name);
  allNormalizedNames.add(normalizedName);

  if (basicClientsMap.has(normalizedName)) {
    console.log(`Warning: Duplicate normalized name in basic: ${normalizedName}`);
    console.log(`- Original names: "${client.name}" and "${basicClientsMap.get(normalizedName).originalName}"`);
  }

  basicClientsMap.set(normalizedName, {
    id,
    originalName: client.name,
    data: client,
  });
});

// Process detailed clients
console.log('\nDebug: Processing detailed clients...');
Object.entries(clientsDetailed).forEach(([key, client]) => {
  const normalizedName = normalizeName(key);
  allNormalizedNames.add(normalizedName);

  if (detailedClientsMap.has(normalizedName)) {
    console.log(`Warning: Duplicate normalized name in detailed: ${normalizedName}`);
    console.log(`- Original names: "${key}" and "${detailedClientsMap.get(normalizedName).key}"`);
  }

  detailedClientsMap.set(normalizedName, {
    key,
    data: client,
  });
});

console.log('\nDebug: Total unique normalized names:', allNormalizedNames.size);

// Find matches and differences
allNormalizedNames.forEach(normalizedName => {
  const basicClient = basicClientsMap.get(normalizedName);
  const detailedClient = detailedClientsMap.get(normalizedName);

  if (basicClient && detailedClient) {
    results.inBothFiles.push({
      basicId: basicClient.id,
      basicName: basicClient.originalName,
      detailedKey: detailedClient.key,
      normalizedName,
    });
  } else if (basicClient) {
    results.onlyInBasic.push({
      id: basicClient.id,
      originalName: basicClient.originalName,
      normalizedName,
      data: basicClient.data,
    });
  } else if (detailedClient) {
    results.onlyInDetailed.push({
      key: detailedClient.key,
      normalizedName,
      data: detailedClient.data,
    });
  }
});

// Sanity checks
console.log('\nDebug: Performing sanity checks...');
console.log('- Basic clients map size:', basicClientsMap.size);
console.log('- Detailed clients map size:', detailedClientsMap.size);
console.log('- Matches found:', results.inBothFiles.length);
console.log('- Only in basic:', results.onlyInBasic.length);
console.log('- Only in detailed:', results.onlyInDetailed.length);

const totalAccounted = results.inBothFiles.length + results.onlyInBasic.length + results.onlyInDetailed.length;
console.log('- Total unique names accounted for:', totalAccounted);
if (totalAccounted !== allNormalizedNames.size) {
  console.log('WARNING: Number of processed names doesn\'t match unique names count!');
}

// Update metadata
results.metadata.totalMatches = results.inBothFiles.length;
results.metadata.totalUnmatched = results.onlyInBasic.length + results.onlyInDetailed.length;
results.metadata.totalUniqueNames = allNormalizedNames.size;

// Sort arrays by name for easier reading
results.inBothFiles.sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));
results.onlyInBasic.sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));
results.onlyInDetailed.sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));

// Save results
fs.writeFileSync(
  path.join(processedImportsDir, 'client_list_comparison.json'),
  JSON.stringify(results, null, 2),
);

// Final output
console.log('\nClient List Comparison:');
console.log('----------------------');
console.log('Clients in basic file:', results.metadata.totalBasicClients);
console.log('Clients in detailed file:', results.metadata.totalDetailedClients);
console.log('Total unique normalized names:', results.metadata.totalUniqueNames);
console.log('\nMatches found:', results.metadata.totalMatches);
console.log('Unmatched total:', results.metadata.totalUnmatched);
console.log('- Only in basic file:', results.onlyInBasic.length);
console.log('- Only in detailed file:', results.onlyInDetailed.length);

if (results.onlyInDetailed.length > 0) {
  console.log('\nClients only in detailed file:');
  results.onlyInDetailed.forEach(client => {
    console.log(`- ${client.key} (normalized: ${client.normalizedName})`);
  });
}

console.log('\nDetailed results saved to client_list_comparison.json');
