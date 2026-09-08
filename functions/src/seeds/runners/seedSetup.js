const seedBakery = require('./seedBakery');
const seedIngredients = require('./seedIngredients');
const seedProducts = require('./seedProducts');
const seedSystemAdmin = require('./seedSystemAdmin');

async function seedSetup() {
  await seedBakery();
  await seedIngredients();
  await seedProducts();
  await seedSystemAdmin();
}

seedSetup();
