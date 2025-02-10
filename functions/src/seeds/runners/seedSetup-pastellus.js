const seedBakery = require('./seedBakery-pastellus');
const seedProducts = require('./seedProducts-pastellus');

async function seedSetup() {
  await seedBakery();
  await seedProducts();
}

seedSetup();
