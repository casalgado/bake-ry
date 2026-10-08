const { BAKERY_ID, ADMIN_USER_ID } = require('../seedConfig');
const bakery = require('../data/bakery');
const providers = require('../data/providers');
const providerService = require('../../services/providerService');
const purchaseService = require('../../services/purchaseService');
const ingredientService = require('../../services/ingredientService');
const productService = require('../../services/productService');

const norm = (text) => String(text).trim().toLowerCase();

// A name that does not resolve is a seed bug: stop, never skip the line.
const must = (found, what) => {
  if (!found) throw new Error(`Seed stock: ${what} not found`);
  return found;
};

async function seedStock() {
  console.log('Creating providers and opening stock...');

  const { items: ingredients } = await ingredientService.getAll(BAKERY_ID);
  const { items: products } = await productService.getAll(BAKERY_ID);

  // The seeded admin signs the purchases, as a signed-in user would.
  const user = { uid: ADMIN_USER_ID, email: bakery.email, role: bakery.role };

  const lineOf = (row) => {
    if (row.ingredient) {
      const ingredient = must(
        ingredients.find((i) => norm(i.name) === norm(row.ingredient)),
        `ingredient "${row.ingredient}"`,
      );
      return {
        item: { type: 'ingredient', id: ingredient.id, combinationId: null },
        qty: row.qty,
        total: row.qty * ingredient.costPerUnit,
      };
    }

    const [collection, name] = row.product;
    const product = must(
      products.find((p) => norm(p.collectionName) === norm(collection) && norm(p.name) === norm(name)),
      `product "${collection} / ${name}"`,
    );
    return {
      item: { type: 'product', id: product.id, combinationId: null },
      qty: row.qty,
      total: row.qty * row.unitCost,
    };
  };

  for (const { purchase, ...data } of providers) {
    const provider = await providerService.create({ ...data, bakeryId: BAKERY_ID }, BAKERY_ID);
    console.log(`Created provider: ${provider.name}, ${provider.id}`);

    const saved = await purchaseService.create(
      { providerId: provider.id, lines: purchase.map(lineOf) },
      BAKERY_ID,
      user,
    );
    console.log(`Created purchase: ${saved.lines.length} line(s), ${saved.id}`);
  }

  console.log('Providers and stock seeded successfully');
}

module.exports = seedStock;

if (require.main === module) {
  seedStock().catch((error) => {
    console.error('Error seeding stock:', error);
    process.exit(1);
  });
}
