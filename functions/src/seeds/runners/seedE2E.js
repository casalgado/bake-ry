// Two small bakeries for the front-end e2e suites. `seed:setup` stays the inventory bakery.
//   e2e-users   empty, for the users / products / collections specs (they create what they touch)
//   e2e-orders  a tiny read-only baseline: 2 collections, 3 products, 2 clients. Specs may read
//               it but write only their own orders; anything they must mutate they create.
//               Also a delivery_assistant: driver-orders@e2e.test / driver.
// Inventory stays off (BakerySettings default).
const { db, auth, timestamp } = require('../seedConfig');
const { BakerySettings } = require('../../models/BakerySettings');
const Product = require('../../models/Product');
const productCollectionService = require('../../services/productCollectionService');
const productService = require('../../services/productService');
const bakeryUserService = require('../../services/bakeryUserService');

const BAKERIES = [
  { id: 'e2e-users', email: 'admin-users@e2e.test', password: 'e2e-users', name: 'E2E Users Admin' },
  { id: 'e2e-orders', email: 'admin-orders@e2e.test', password: 'e2e-orders', name: 'E2E Orders Admin' },
];

const size = (id, name, value, basePrice, displayOrder) => ({
  id, name, value, basePrice, isWholeGrain: false, unit: '', type: 'SIZE', displayOrder,
});

const COLLECTIONS = [{ name: 'Panadería', displayOrder: 1 }, { name: 'Café', displayOrder: 2 }];

const PRODUCTS = [
  { collection: 'Panadería', name: 'Pan Campesino', basePrice: 10000, variations: [] },
  {
    collection: 'Panadería',
    name: 'Croissant',
    variations: [size('croissant-pequeno', 'pequeño', 60, 4000, 1), size('croissant-grande', 'grande', 120, 7000, 2)],
  },
  { collection: 'Café', name: 'Cold Brew', basePrice: 8000, variations: [] },
];

const CLIENTS = [
  { name: 'Cliente Persona', email: 'persona@e2e.test', phone: '3000000001', category: 'B2C' },
  { name: 'Cliente Empresa', email: 'empresa@e2e.test', phone: '3000000002', category: 'B2B', invoiceGracePeriod: 30 },
];

async function seedBakery({ id, email, password, name }) {
  const uid = `${id}-admin`;
  await auth.createUser({ uid, email, password });
  await auth.setCustomUserClaims(uid, { role: 'bakery_admin', bakeryId: id });

  await db.collection('bakeries').doc(id).set({
    name, ownerId: uid, createdAt: timestamp(), updatedAt: timestamp(), isActive: true,
  });
  await db.collection('users').doc(uid).set({
    email, name, role: 'bakery_admin', bakeryId: id, createdAt: timestamp(), updatedAt: timestamp(),
  });
  await db.collection(`bakeries/${id}/settings`).doc('default')
    .set(new BakerySettings({ bakeryId: id }).toFirestore());
}

async function seedOrdersBaseline(bakeryId) {
  const collections = {};
  for (const c of COLLECTIONS) {
    collections[c.name] = await productCollectionService.create(c, bakeryId);
  }
  for (const { collection, ...p } of PRODUCTS) {
    await productService.create(new Product({
      ...p,
      bakeryId,
      collectionId: collections[collection].id,
      collectionName: collection,
      taxPercentage: 0,
      customAttributes: {},
    }), bakeryId);
  }
  for (const client of CLIENTS) {
    await bakeryUserService.create({ ...client, role: 'bakery_customer' }, bakeryId);
  }
  // Staff passwords are derived from the first name: "Driver" logs in with "driver".
  await bakeryUserService.create({
    name: 'Driver', email: 'driver-orders@e2e.test', phone: '3000000003', role: 'delivery_assistant',
  }, bakeryId);
}

async function seedE2E() {
  for (const bakery of BAKERIES) {
    console.log(`Seeding ${bakery.id}...`);
    await seedBakery(bakery);
  }
  await seedOrdersBaseline('e2e-orders');
  console.log('Done:', BAKERIES.map(({ id, email, password }) => ({ id, email, password })));
}

module.exports = seedE2E;

if (require.main === module) {
  seedE2E().catch((error) => {
    console.error('Error seeding e2e bakeries:', error);
    process.exit(1);
  });
}
