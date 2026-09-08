const { BAKERY_ID } = require('../seedConfig');
const ingredients = require('../data/ingredients');
const ingredientService = require('../../services/ingredientService');
const Ingredient = require('../../models/Ingredient');
const fs = require('fs');
const path = require('path');

async function seedIngredients() {
  console.log('Creating ingredients...');

  const createdIngredients = [];

  for (const ingredient of ingredients) {
    const created = await ingredientService.create(
      {
        ...ingredient,
        bakeryId: BAKERY_ID,
        // Raw materials are bought and held, so deduction stops at them.
        stockBehavior: Ingredient.STOCK_BEHAVIORS.STOCKED,
      },
      BAKERY_ID,
    );

    createdIngredients.push(created);
    console.log(`Created ingredient: ${created.name}, ${created.id}`);
  }

  // Recipe seeder reads this to map ingredient names to ids.
  fs.writeFileSync(
    path.join(__dirname, '../data/seededIngredients.json'),
    JSON.stringify(createdIngredients, null, 2),
  );

  console.log('Ingredients seeded successfully');
  return createdIngredients;
}

module.exports = seedIngredients;

if (require.main === module) {
  seedIngredients().catch((error) => {
    console.error('Error seeding ingredients:', error);
    process.exit(1);
  });
}
