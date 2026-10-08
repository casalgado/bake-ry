const seedBakery = require('./seedBakery');
const seedIngredients = require('./seedIngredients');
const seedProducts = require('./seedProducts');
const seedRecipes = require('./seedRecipes');
const seedStock = require('./seedStock');
const seedSystemAdmin = require('./seedSystemAdmin');

async function seedSetup() {
  await seedBakery();
  await seedIngredients();
  await seedProducts();
  await seedRecipes();
  await seedStock();
  await seedSystemAdmin();
}

seedSetup();
