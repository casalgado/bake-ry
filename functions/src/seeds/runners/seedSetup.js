const seedBakery = require('./seedBakery');
const seedProducts = require('./seedProducts');
const seedSystemAdmin = require('./seedSystemAdmin');

async function seedSetup() {
  await seedBakery();
  await seedProducts();
  await seedSystemAdmin();
}

seedSetup();
