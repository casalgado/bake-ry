const seedBakery = require('./seedBakery');
const seedIngredients = require('./seedIngredients');
const seedRecipes = require('./seedRecipes');

async function seedAll() {
  await seedBakery();
  await seedIngredients();
  await seedRecipes();
}

seedAll();
