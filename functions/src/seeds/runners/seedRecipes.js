const { BAKERY_ID } = require('../seedConfig');
const recipes = require('../data/recipes');
const recipeService = require('../../services/recipeService');
const { Recipe } = require('../../models/Recipe');
const seedIngredients = require('./seedIngredients');
const fs = require('fs');
const path = require('path');

async function seedRecipes() {
  try {
    console.log('Creating recipes...');
    console.log('Using BAKERY_ID:', BAKERY_ID);

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

    // Store created recipes with their IDs for reference
    const createdRecipes = [];

    // Create recipes through service
    for (const recipe of recipes) {
      try {
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

        createdRecipes.push({
          id: createdRecipe.id,
          ...createdRecipe,
        });

        console.log(`Created recipe: ${createdRecipe.name}, ${createdRecipe.id}`);
      } catch (error) {
        console.error(`Error creating recipe ${recipe.name}:`, error);
        // Continue with next recipe if one fails
        continue;
      }
    }

    // Write created recipes to a file for reference
    const seedDataDir = path.join(__dirname, '../data');
    fs.writeFileSync(
      path.join(seedDataDir, 'seededRecipes.json'),
      JSON.stringify(createdRecipes, null, 2),
    );

    console.log('Recipes seeded successfully');
    return createdRecipes;
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
