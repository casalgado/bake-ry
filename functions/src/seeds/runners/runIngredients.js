const ingredients = require('../data/ingredients');
const { initializeFirebase } = require('../utils/seedUtils');
const seedIngredients = require('../methods/seedIngredients');

async function runIngredientsSeed() {
  try {
    console.log('Initializing Firebase...');
    initializeFirebase();

    console.log('Starting ingredients seed...');
    const createdIngredients = await seedIngredients(ingredients);

    console.log('\nIngredients created successfully!');
    console.log(`Created ${createdIngredients.length} ingredients`);

    // Log a few sample ingredients to verify
    if (createdIngredients.length > 0) {
      console.log('\nSample of created ingredients:');
      createdIngredients.slice(0, 3).forEach(ingredient => {
        console.log(`- ${ingredient.name} (${ingredient.id})`);
      });
    }

    return createdIngredients;
  } catch (error) {
    console.error('Failed to seed ingredients:', error);
    process.exit(1);
  }
}

// Allow this to be run directly or imported
if (require.main === module) {
  runIngredientsSeed();
} else {
  module.exports = runIngredientsSeed;
}
