const seedBakery = require('./seedBakery');
const seedIngredients = require('./seedIngredients');
const seedRecipes = require('./seedRecipes');
const seedProducts = require('./seedProducts');
const seedUsers = require('./seedUsers');
const seedOrders = require('./seedOrders');

async function seedAll() {
  await seedBakery();
  await seedIngredients();
  await seedRecipes();
  await seedProducts();
  await seedUsers();
  await seedOrders();
}

seedAll();
