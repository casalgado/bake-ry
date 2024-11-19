const seedBakery = require('./seedBakery');
const seedIngredients = require('./seedIngredients');
const seedRecipes = require('./seedRecipes');
const seedUsers = require('./seedUsers');

async function seedAll() {
  await seedBakery();
  await seedIngredients();
  await seedRecipes();
  await seedUsers();
}

seedAll();
