const seedBakery = require('./seedBakery');
const seedIngredients = require('./seedIngredients');
const seedRecipes = require('./seedRecipes');
const seedProducts = require('./seedProducts');
const seedSystemAdmin = require('./seedSystemAdmin');

async function seedSetup() {
  await seedBakery();
  await seedIngredients();
  await seedRecipes();
  await seedProducts();
  await seedSystemAdmin();
}

seedSetup();
