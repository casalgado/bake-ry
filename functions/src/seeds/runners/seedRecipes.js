const { BAKERY_ID } = require('../seedConfig');
const recipes = require('../data/recipes');
const recipeService = require('../../services/recipeService');
const ingredientService = require('../../services/ingredientService');
const productService = require('../../services/productService');

const norm = (text) => String(text).trim().toLowerCase();

// A name that does not resolve is a seed bug: stop, never skip the component.
const must = (found, what) => {
  if (!found) throw new Error(`Seed recipes: ${what} not found`);
  return found;
};

async function seedRecipes() {
  console.log('Creating recipes...');

  const { items: ingredients } = await ingredientService.getAll(BAKERY_ID);
  const { items: products } = await productService.getAll(BAKERY_ID);

  const ingredientId = (name) =>
    must(ingredients.find((i) => norm(i.name) === norm(name)), `ingredient "${name}"`).id;

  const productOf = ([collection, name]) =>
    must(
      products.find((p) => norm(p.collectionName) === norm(collection) && norm(p.name) === norm(name)),
      `product "${collection} / ${name}"`,
    );

  const combinationIdOf = (product, name) =>
    must(
      (product.variations?.combinations || []).find((c) => norm(c.name) === norm(name)),
      `combination "${name}" of "${product.collectionName} / ${product.name}"`,
    ).id;

  const component = (row) => {
    if (row.ingredient) {
      return { type: 'ingredient', id: ingredientId(row.ingredient), quantity: row.quantity };
    }
    const product = productOf(row.product);
    return {
      type: 'product',
      id: product.id,
      combinationId: row.combination ? combinationIdOf(product, row.combination) : null,
      quantity: row.quantity,
    };
  };

  const ownerFields = (owner) => {
    if (owner.ingredient) return { ingredientId: ingredientId(owner.ingredient) };
    const product = productOf(owner.product);
    return {
      productId: product.id,
      combinationId: owner.combination ? combinationIdOf(product, owner.combination) : null,
    };
  };

  const created = [];
  for (const { owner, ingredients: rows, ...recipe } of recipes) {
    // One at a time and in file order: each recipe's cost feeds the next.
    const saved = await recipeService.create(
      { ...recipe, ...ownerFields(owner), ingredients: rows.map(component) },
      BAKERY_ID,
    );
    created.push(saved);
    console.log(`Created recipe: ${saved.name}, ${saved.id}`);
  }

  console.log('Recipes seeded successfully');
  return created;
}

module.exports = seedRecipes;

if (require.main === module) {
  seedRecipes().catch((error) => {
    console.error('Error seeding recipes:', error);
    process.exit(1);
  });
}
