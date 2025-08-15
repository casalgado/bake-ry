const seedBakery = require('./seedBakery');
const seedIngredients = require('./seedIngredients');
const seedRecipes = require('./seedRecipes');
const seedProducts = require('./seedProducts');
const seedSystemAdmin = require('./seedSystemAdmin');
const seedSystemSettings = require('./seedSystemSettings');

async function seedSetup() {
  await seedBakery();
  await seedIngredients();
  await seedRecipes();
  await seedProducts();
  await seedSystemAdmin();
  await seedSystemSettings();

}

seedSetup();
