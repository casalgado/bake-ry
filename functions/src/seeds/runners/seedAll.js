const seedBakery = require('./seedBakery');
const seedIngredients = require('./seedIngredients');
const seedRecipes = require('./seedRecipes');
const seedProducts = require('./seedProducts');

async function seedAll() {
  await seedBakery();
  await seedIngredients();
  await seedRecipes();
  await seedProducts();
}

seedAll();
