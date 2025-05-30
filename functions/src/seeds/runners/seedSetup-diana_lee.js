const seedBakery = require('./seedBakery-diana_lee');
const seedProducts = require('./seedProducts-diana_lee');

async function seedSetup() {
  await seedBakery();
  await seedProducts();
}

seedSetup();
