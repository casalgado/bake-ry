const { BAKERY_ID } = require('../seedConfig');
const recipes = require('../data/recipes');
const RecipeService = require('../../services/RecipeService');
const { Recipe } = require('../../models/Recipe');
const seedIngredients = require('./seedIngredients');

const recipeService = new RecipeService();

async function seedRecipes() {
  try {
    console.log('Creating recipes...');
    console.log('Using BAKERY_ID:', BAKERY_ID); //

    // First, ensure ingredients exist by either reading from file or creating them
    let ingredients;
    try {
      ingredients = require('../data/seededIngredients.json');
    } catch (error) {
      console.log(error);
      console.log('No seeded ingredients found, creating ingredients first...');
      ingredients = await seedIngredients();
    }

    // Create ingredient ID mapping for easy reference
    const ingredientMap = ingredients.reduce((map, ingredient) => {
      map[ingredient.name] = ingredient.id;
      return map;
    }, {});

    // Create recipes through service
    for (const recipe of recipes) {
      // Map ingredient names to their IDs
      const recipeIngredients = recipe.ingredients.map(ingredient => ({
        ...ingredient,
        ingredientId: ingredientMap[ingredient.name],
      })).filter(ingredient => ingredient.ingredientId);
      delete recipe.id; // Remove ID from seed data

      const newRecipe = new Recipe({
        ...recipe,
        ingredients: recipeIngredients,
        bakeryId: BAKERY_ID,
        isActive: recipe.isActive || true,
        isDiscontinued: recipe.isDiscontinued || false,
        customAttributes: recipe.customAttributes || {},
      }).toFirestore();

      const createdRecipe = await recipeService.create(newRecipe, BAKERY_ID);

      console.log(`Created recipe: ${createdRecipe.name}`);

    }

    console.log('Recipes seeded successfully');
  } catch (error) {
    console.error('Error seeding recipes:', error);
    throw error;
  }
}

// Only run if this is the main file being executed
if (require.main === module) {
  seedRecipes();
}

module.exports = seedRecipes;
