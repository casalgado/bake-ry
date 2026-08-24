const { initializeFirebase, clearFirestoreData } = require('../setup/firebase');

// Phase 1A: recipe owner generalization, typed components, save-time guardrails
// and cost propagation. See INVENTORY-PLAN.md 1A.9.
describe('Recipe graph — owners, guardrails, costing', () => {
  let db;
  let recipeService;
  let ingredientService;
  let productService;
  const bakeryId = 'test-bakery';

  const col = (name) => db.collection(`bakeries/${bakeryId}/${name}`);

  const seedIngredient = (id, data = {}) =>
    col('ingredients').doc(id).set({
      name: id,
      type: 'manufactured',
      unit: 'g',
      costPerUnit: 10,
      usedInRecipes: [],
      stockBehavior: 'passThrough',
      isActive: true,
      ...data,
    });

  const seedProduct = (id, data = {}) =>
    col('products').doc(id).set({
      name: id,
      basePrice: 10000,
      costPrice: 0,
      costPriceSource: 'recipe',
      hasVariations: false,
      inventoryMode: 'recipe',
      usedInRecipes: [],
      isActive: true,
      ...data,
    });

  const seedRecipe = (id, data = {}) =>
    col('recipes').doc(id).set({
      name: id,
      ingredients: [],
      version: 1,
      isActive: true,
      ...data,
    });

  const component = (id, quantity, costPerUnit = 10) => ({
    type: 'ingredient',
    id,
    name: id,
    quantity,
    unit: 'g',
    costPerUnit,
  });

  beforeAll(() => {
    ({ db } = initializeFirebase());
    recipeService = require('../../services/recipeService');
    ingredientService = require('../../services/ingredientService');
    productService = require('../../services/productService');
  });

  beforeEach(async () => {
    await clearFirestoreData(db);
  });

  describe('owner validation (1A.3)', () => {
    it('rejects a recipe owned by both a product and an ingredient', async () => {
      await seedIngredient('harina');

      await expect(
        recipeService.create(
          {
            name: 'mixta',
            productId: 'p1',
            ingredientId: 'harina',
            ingredients: [{ id: 'harina', quantity: 1 }],
          },
          bakeryId,
        ),
      ).rejects.toThrow(/no a varios/);
    });

    it('requires a yield on an ingredient-owned recipe', async () => {
      await seedIngredient('harina');
      await seedIngredient('crema');

      await expect(
        recipeService.create(
          {
            name: 'crema pastelera',
            ingredientId: 'crema',
            ingredients: [{ id: 'harina', quantity: 100 }],
          },
          bakeryId,
        ),
      ).rejects.toThrow(/yield/);
    });

    it('forbids a yield on a product-owned recipe', async () => {
      await seedIngredient('harina');
      await seedProduct('torta');

      await expect(
        recipeService.create(
          {
            name: 'torta',
            productId: 'torta',
            yield: 500,
            ingredients: [{ id: 'harina', quantity: 100 }],
          },
          bakeryId,
        ),
      ).rejects.toThrow(/Solo las recetas de ingredientes/);
    });
  });

  describe('guardrails (1A.6)', () => {
    it('rejects a direct cycle (a product in its own recipe)', async () => {
      await seedProduct('torta');

      await expect(
        recipeService.create(
          {
            name: 'torta',
            productId: 'torta',
            ingredients: [{ type: 'product', id: 'torta', quantity: 1 }],
          },
          bakeryId,
        ),
      ).rejects.toThrow(/Ciclo detectado/);
    });

    it('rejects a three-hop cycle (A → B → C → A)', async () => {
      // C's recipe already points back at A; adding C to A's recipe closes it.
      await seedProduct('a', { recipeId: 'recipe-a' });
      await seedProduct('b', { recipeId: 'recipe-b' });
      await seedProduct('c', { recipeId: 'recipe-c' });

      await seedRecipe('recipe-b', {
        productId: 'b',
        ingredients: [{ type: 'product', id: 'c', quantity: 1 }],
      });
      await seedRecipe('recipe-c', {
        productId: 'c',
        ingredients: [{ type: 'product', id: 'a', quantity: 1 }],
      });

      await expect(
        recipeService.create(
          {
            name: 'a',
            productId: 'a',
            ingredients: [{ type: 'product', id: 'b', quantity: 1 }],
          },
          bakeryId,
        ),
      ).rejects.toThrow(/Ciclo detectado/);
    });

    it('rejects an expansion deeper than the cap', async () => {
      // p1 → p2 → … → p7, one product per level.
      const levels = 7;
      for (let i = 1; i <= levels; i += 1) {
        await seedProduct(`p${i}`, { recipeId: `recipe-p${i}` });
      }
      for (let i = 2; i <= levels; i += 1) {
        await seedRecipe(`recipe-p${i}`, {
          productId: `p${i}`,
          ingredients:
            i < levels ? [{ type: 'product', id: `p${i + 1}`, quantity: 1 }] : [],
        });
      }

      await expect(
        recipeService.create(
          {
            name: 'p1',
            productId: 'p1',
            ingredients: [{ type: 'product', id: 'p2', quantity: 1 }],
          },
          bakeryId,
        ),
      ).rejects.toThrow(/demasiado profunda/);
    });

    it('rejects a component whose unit does not match the source', async () => {
      await seedIngredient('harina', { unit: 'g' });
      await seedProduct('torta');

      await expect(
        recipeService.create(
          {
            name: 'torta',
            productId: 'torta',
            ingredients: [{ id: 'harina', quantity: 2, unit: 'kg' }],
          },
          bakeryId,
        ),
      ).rejects.toThrow(/No se hacen conversiones/);
    });

    it('requires a combination when the component product has variations', async () => {
      await seedProduct('torta');
      await seedProduct('base', {
        hasVariations: true,
        variations: {
          combinations: [
            { id: 'c500', name: '500g', costPrice: 1000, costPriceSource: 'manual' },
          ],
        },
      });

      await expect(
        recipeService.create(
          {
            name: 'torta',
            productId: 'torta',
            ingredients: [{ type: 'product', id: 'base', quantity: 1 }],
          },
          bakeryId,
        ),
      ).rejects.toThrow(/elige cuál/);
    });
  });

  describe('deletion guards (1A.7)', () => {
    it('blocks deleting a recipe owned by a combination', async () => {
      await seedRecipe('recipe-500', { productId: 'torta', combinationId: 'c500' });
      await seedProduct('torta', {
        hasVariations: true,
        variations: {
          combinations: [{ id: 'c500', name: '500g', recipeId: 'recipe-500' }],
        },
      });

      await expect(recipeService.remove('recipe-500', bakeryId)).rejects.toThrow(
        /torta 500g/,
      );
    });

    it('blocks deleting a recipe owned by an ingredient', async () => {
      await seedRecipe('recipe-crema', { ingredientId: 'crema', yield: 100 });
      await seedIngredient('crema', { recipeId: 'recipe-crema' });

      await expect(recipeService.remove('recipe-crema', bakeryId)).rejects.toThrow(
        /crema/,
      );
    });

    it('blocks deleting a product used as a recipe component', async () => {
      await seedProduct('pan', { usedInRecipes: ['recipe-combo'] });
      await seedRecipe('recipe-combo', { name: 'Combo' });

      await expect(productService.remove('pan', bakeryId)).rejects.toThrow(
        /Combo/,
      );
    });
  });

  describe('cost propagation (1A.8)', () => {
    // harina → crema (ingredient-owned recipe, yield) → torta (product recipe)
    const seedTwoHopChain = async () => {
      await seedIngredient('harina', {
        costPerUnit: 10,
        usedInRecipes: ['recipe-crema'],
      });
      await seedIngredient('crema', {
        costPerUnit: 5,
        recipeId: 'recipe-crema',
        usedInRecipes: ['recipe-torta'],
      });
      await seedRecipe('recipe-crema', {
        ingredientId: 'crema',
        yield: 100,
        ingredients: [component('harina', 50, 10)],
      });
      await seedRecipe('recipe-torta', {
        productId: 'torta',
        ingredients: [component('crema', 20, 5)],
      });
    };

    it('carries an ingredient cost change two hops to the product cost', async () => {
      await seedTwoHopChain();
      await seedProduct('torta', { costPrice: 100, costPriceSource: 'recipe' });

      // harina 10 → 20 ⇒ crema recipe 1000 / yield 100 = 10 per g
      //            ⇒ torta recipe 20 × 10 = 200
      await ingredientService.update('harina', { costPerUnit: 20 }, bakeryId);

      const crema = await col('ingredients').doc('crema').get();
      expect(crema.data().costPerUnit).toBe(10);

      const torta = await col('products').doc('torta').get();
      expect(torta.data().costPrice).toBe(200);
    });

    it('never overwrites a manually set cost', async () => {
      await seedTwoHopChain();
      await seedProduct('torta', { costPrice: 3500, costPriceSource: 'manual' });

      await ingredientService.update('harina', { costPerUnit: 20 }, bakeryId);

      const torta = await col('products').doc('torta').get();
      expect(torta.data().costPrice).toBe(3500);
    });
  });

  describe('typed components (1A.4)', () => {
    it('reads a legacy row (no type, ingredientId) as an ingredient component', async () => {
      await seedIngredient('harina');
      await seedRecipe('legacy', {
        productId: 'torta',
        ingredients: [
          { ingredientId: 'harina', name: 'harina', quantity: 50, unit: 'g', costPerUnit: 10 },
        ],
      });

      const recipe = await recipeService.getById('legacy', bakeryId);

      expect(recipe.ingredients[0].type).toBe('ingredient');
      expect(recipe.ingredients[0].id).toBe('harina');
      expect(recipe.totalCost).toBe(500);
    });
  });
});
