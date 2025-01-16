const clients = require('./../data/seededUsers.json');

// Sample user data
const customers = Object.values(clients).map(e => {
  const cleanItem = { name: e.name };
  return cleanItem;
});

// Write created users to a file for reference
const fs = require('fs');
const path = require('path');

const seedDataDir = path.join(__dirname, '../data/processed_imports');
fs.writeFileSync(
  path.join(seedDataDir, 'extractedNames2.json'),
  JSON.stringify(customers, null, 2),
);
