const clients = require('./../data/export_clientes.json');
const { parseSpanishName } = require('../../utils/helpers.js');

// Sample user data
const customers = Object.values(clients).filter(e => {
  if (!e.history) return false;
  if (Object.values(e.history).length === 0) return false;
  if (e.address == '' && e.phone == '') return false;
  return true;
}).map(e => {
  if (e.email == '' || e.email == null || e.email == undefined || e.email == ' ' || e.email == 'no lo dio') e.email = `placeholder@${e.name.split(' ').join('').toLowerCase()}.com`;
  e.category = Math.floor(Math.random()) > .9 ? 'B2B' : 'B2C';
  if (e.address == '') e.address = 'direccion';
  const cleanItem = { name: e.name, ...parseSpanishName(e.name) };
  delete cleanItem.history;
  return cleanItem;
});

// Write created users to a file for reference
const fs = require('fs');
const path = require('path');

const seedDataDir = path.join(__dirname, '../data/processed_imports');
fs.writeFileSync(
  path.join(seedDataDir, 'extractedNames.json'),
  JSON.stringify(customers, null, 2),
);
