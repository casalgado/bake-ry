const { db, BAKERY_ID, timestamp } = require('../seedConfig');
const ingredients = require('../data/ingredients');

async function seedIngredients() {
  try {
    console.log('Creating ingredients...');

    const ingredientBatch = db.batch();
    ingredients.forEach((ingredient) => {
      const ref = db
        .collection(`bakeries/${BAKERY_ID}/ingredients`)
        .doc(ingredient.id);
      ingredientBatch.set(ref, {
        ...ingredient,
        createdAt: timestamp(),
        updatedAt: timestamp(),
      });
    });

    await ingredientBatch.commit();
    console.log('Ingredients seeded successfully');
  } catch (error) {
    console.error('Error seeding ingredients:', error);
    throw error;
  }
}

seedIngredients();
