const IngredientService = require('../../services/IngredientService');
const { BAKERY_ID } = require('../utils/constants');

const seedIngredients = async (ingredients) => {
  try {
    console.log('Creating ingredients...');

    const ingredientService = new IngredientService();
    const createdIngredients = [];

    for (const ingredient of ingredients) {
      console.log(`Creating ingredient: ${ingredient.name}`);

      const ingredientData = {
        ...ingredient,
        bakeryId: BAKERY_ID,
        isActive: true,
        usedInRecipes: [], // We can update this when seeding recipes
        customAttributes: ingredient.customAttributes || {},
      };

      const createdIngredient = await ingredientService.create(ingredientData, BAKERY_ID);
      createdIngredients.push(createdIngredient);
    }

    console.log(`Successfully created ${createdIngredients.length} ingredients`);
    return createdIngredients;
  } catch (error) {
    console.error('Error in seedIngredients:', error);
    throw error;
  }
};

module.exports = seedIngredients;
