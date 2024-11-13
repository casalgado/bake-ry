const { BAKERY_ID } = require('../seedConfig');
const ingredients = require('../data/ingredients');
const IngredientService = require('../../services/ingredientService');
const Ingredient = require('../../models/Ingredient');

const ingredientService = new IngredientService();

async function seedIngredients() {
  try {
    console.log('Creating ingredients...');

    // Store created ingredients with their IDs for reference
    const createdIngredients = [];

    // Create ingredients through service
    for (const ingredient of ingredients) {
      delete ingredient.id; // Remove ID from seed data
      const createdIngredient = await ingredientService.create(new Ingredient({
        ...ingredient,
        bakeryId: BAKERY_ID,
        categoryId: ingredient.categoryId || 'category-id',
        categoryName: ingredient.categoryName || 'category-name',
        notes: ingredient.notes || 'notes',
        preferredSupplierId: ingredient.preferredSupplierId || 'preferred-supplier-id',
        isResaleProduct: ingredient.isResaleProduct || false,
        isActive: ingredient.isActive || true,
        isDiscontinued: ingredient.isDiscontinued || false,
        customAttributes: ingredient.customAttributes || {},
      }).toFirestore(), BAKERY_ID);

      createdIngredients.push({
        id: createdIngredient.id,
        ...createdIngredient,
      });
      console.log(`Created ingredient: ${createdIngredient.name}`);
    }

    // Write created ingredients to a file for recipes to use
    const fs = require('fs');
    const path = require('path');

    const seedDataDir = path.join(__dirname, '../data');
    fs.writeFileSync(
      path.join(seedDataDir, 'seededIngredients.json'),
      JSON.stringify(createdIngredients, null, 2),
    );

    console.log('Ingredients seeded successfully');
    return createdIngredients;
  } catch (error) {
    console.error('Error seeding ingredients:', error);
    throw error;
  }
}

// Export the function so it can be used by recipe seeder
module.exports = seedIngredients;

// Only run if this is the main file being executed
if (require.main === module) {
  seedIngredients();
}
