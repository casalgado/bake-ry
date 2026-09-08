const { initializeFirebase, clearFirestoreData } = require('../setup/firebase');

// Recipe owners, save-time guardrails, typed components, and cost propagation.
// See docs/recipe-costing.md.
describe('Recipe graph — owners, guardrails, costing', () => {
  let db;
  let recipeService;
  let ingredientService;
  let productService;
  let recipeGraph;
  const bakeryId = 'test-bakery';

  const col = (name) => db.collection(`bakeries/${bakeryId}/${name}`);

  const seedIngredient = (id, data = {}) =>
    col('ingredients').doc(id).set({
      name: id,
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

  // A stored recipe row is pure structure — cost comes from the seeded
  // ingredient/product's own doc, read live by computeRecipeCost.
  const component = (id, quantity) => ({
    type: 'ingredient',
    id,
    quantity,
    unit: 'g',
  });

  beforeAll(() => {
    ({ db } = initializeFirebase());
    recipeService = require('../../services/recipeService');
    ingredientService = require('../../services/ingredientService');
    productService = require('../../services/productService');
    recipeGraph = require('../../services/recipeGraph');
  });

  beforeEach(async () => {
    await clearFirestoreData(db);
  });

  describe('owner validation', () => {
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

  describe('guardrails', () => {
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

  describe('deletion guards', () => {
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

  describe('cost propagation', () => {
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
        ingredients: [component('harina', 50)],
      });
      await seedRecipe('recipe-torta', {
        productId: 'torta',
        ingredients: [component('crema', 20)],
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

    it('costs a manually priced component at its stored price, mid-walk', async () => {
      // combo uses harina directly AND a torta, whose cost is set by hand. The
      // walk reaches recipe-torta first and computes 1000 for it, but torta is
      // 'manual' at 3500 — that is the price combo must be costed with.
      await seedIngredient('harina', {
        costPerUnit: 10,
        usedInRecipes: ['recipe-torta', 'recipe-combo'],
      });
      await seedProduct('torta', {
        costPrice: 3500,
        costPriceSource: 'manual',
        usedInRecipes: ['recipe-combo'],
      });
      await seedProduct('combo', { costPrice: 0, costPriceSource: 'recipe' });
      await seedRecipe('recipe-torta', {
        productId: 'torta',
        ingredients: [component('harina', 50)],
      });
      await seedRecipe('recipe-combo', {
        productId: 'combo',
        ingredients: [
          component('harina', 10),
          { type: 'product', id: 'torta', quantity: 1, unit: 'unidad' },
        ],
      });

      await ingredientService.update('harina', { costPerUnit: 20 }, bakeryId);

      // 10 × 20 harina + 1 × 3500 torta — not torta's 1000 recipe total
      const combo = await col('products').doc('combo').get();
      expect(combo.data().costPrice).toBe(3700);
    });

    it('writes an updateHistory entry on each owner whose cost moved', async () => {
      await seedTwoHopChain();
      await seedProduct('torta', { costPrice: 100, costPriceSource: 'recipe' });

      await ingredientService.update('harina', { costPerUnit: 20 }, bakeryId);

      const tortaHistory = await col('products')
        .doc('torta')
        .collection('updateHistory')
        .get();
      expect(tortaHistory.size).toBe(1);
      expect(tortaHistory.docs[0].data().changes.costPrice).toEqual({
        from: 100,
        to: 200,
      });

      const cremaHistory = await col('ingredients')
        .doc('crema')
        .collection('updateHistory')
        .get();
      // one for the direct edit is on harina; crema gets the propagated one
      expect(
        cremaHistory.docs.some((d) => d.data().changes.costPerUnit?.to === 10),
      ).toBe(true);
    });

    it('previews an ingredient cost change without committing it', async () => {
      await seedTwoHopChain();
      await seedProduct('torta', { costPrice: 100, costPriceSource: 'recipe' });

      const impact = await recipeGraph.previewIngredientCostImpact(
        bakeryId,
        'harina',
        20,
      );

      const tortaChange = impact.find((c) => c.path.endsWith('/products/torta'));
      expect(tortaChange.changes.costPrice.to).toBe(200);

      const torta = await col('products').doc('torta').get();
      expect(torta.data().costPrice).toBe(100);
    });

    it('reconciles a drifted owner cost and tags the history entry', async () => {
      await seedIngredient('harina', {
        costPerUnit: 10,
        usedInRecipes: ['recipe-torta'],
      });
      await seedRecipe('recipe-torta', {
        productId: 'torta',
        ingredients: [component('harina', 50)],
      });
      // cached cost is wrong: live recompute is 50 × 10 = 500
      await seedProduct('torta', {
        costPrice: 999,
        costPriceSource: 'recipe',
        recipeId: 'recipe-torta',
      });

      const result = await recipeGraph.reconcileOwnerCost(bakeryId, {
        type: 'product',
        id: 'torta',
      });

      expect(result.changed).toBe(true);

      const torta = await col('products').doc('torta').get();
      expect(torta.data().costPrice).toBe(500);

      const history = await col('products')
        .doc('torta')
        .collection('updateHistory')
        .get();
      expect(history.docs.map((d) => d.data().reason)).toContain('reconciliation');
    });

    it('reports no change when the owner cost is already correct', async () => {
      await seedIngredient('harina', {
        costPerUnit: 10,
        usedInRecipes: ['recipe-torta'],
      });
      await seedRecipe('recipe-torta', {
        productId: 'torta',
        ingredients: [component('harina', 50)],
      });
      await seedProduct('torta', {
        costPrice: 500,
        costPriceSource: 'recipe',
        recipeId: 'recipe-torta',
      });

      const result = await recipeGraph.reconcileOwnerCost(bakeryId, {
        type: 'product',
        id: 'torta',
      });

      expect(result.changed).toBe(false);
    });
  });

  describe('typed components', () => {
    it('defaults an untyped row to an ingredient component', async () => {
      await seedIngredient('harina');
      await seedRecipe('untyped', {
        productId: 'torta',
        ingredients: [
          { id: 'harina', name: 'harina', quantity: 50, unit: 'g', costPerUnit: 10 },
        ],
      });

      const recipe = await recipeService.getById('untyped', bakeryId);

      expect(recipe.ingredients[0].type).toBe('ingredient');
      expect(recipe.ingredients[0].id).toBe('harina');

      // Cost is a live, transactional read — computeRecipeCost, not a getter.
      const cost = await db.runTransaction((t) =>
        recipeGraph.computeRecipeCost(t, bakeryId, recipe.ingredients),
      );
      expect(cost).toBe(500);
    });
  });

  describe('owner link on create', () => {
    it('stamps recipeId, costPriceSource and costPrice onto a plain product', async () => {
      await seedIngredient('harina', { costPerUnit: 10 });
      await seedProduct('torta', { costPrice: 0, costPriceSource: 'manual' });

      const { id: recipeId } = await recipeService.create(
        {
          name: 'torta',
          productId: 'torta',
          ingredients: [component('harina', 50)],
        },
        bakeryId,
      );

      const torta = (await col('products').doc('torta').get()).data();
      expect(torta.recipeId).toBe(recipeId);
      expect(torta.costPriceSource).toBe('recipe');
      expect(torta.costPrice).toBe(500);
    });

    it('stamps the matching combination only, leaving siblings untouched', async () => {
      await seedIngredient('harina', { costPerUnit: 10 });
      await seedProduct('torta', {
        hasVariations: true,
        variations: {
          combinations: [
            { id: 'c500', name: '500g', costPrice: 0, costPriceSource: 'manual' },
            { id: 'c1000', name: '1kg', costPrice: 999, costPriceSource: 'manual' },
          ],
        },
      });

      const { id: recipeId } = await recipeService.create(
        {
          name: 'torta 500g',
          productId: 'torta',
          combinationId: 'c500',
          ingredients: [component('harina', 50)],
        },
        bakeryId,
      );

      const combos = (await col('products').doc('torta').get()).data()
        .variations.combinations;
      const c500 = combos.find((c) => c.id === 'c500');
      const c1000 = combos.find((c) => c.id === 'c1000');

      expect(c500).toMatchObject({ recipeId, costPriceSource: 'recipe', costPrice: 500 });
      expect(c1000).toMatchObject({ costPriceSource: 'manual', costPrice: 999 });
    });

    it('rejects a combinationId that does not exist on the product', async () => {
      await seedIngredient('harina');
      await seedProduct('torta', {
        hasVariations: true,
        variations: { combinations: [] },
      });

      await expect(
        recipeService.create(
          {
            name: 'torta 500g',
            productId: 'torta',
            combinationId: 'missing',
            ingredients: [component('harina', 50)],
          },
          bakeryId,
        ),
      ).rejects.toThrow(/Combination not found/);
    });

    it('stamps recipeId onto an ingredient-owned recipe', async () => {
      await seedIngredient('harina', { costPerUnit: 10 });
      await seedIngredient('crema', { costPerUnit: 0 });

      const { id: recipeId } = await recipeService.create(
        {
          name: 'crema pastelera',
          ingredientId: 'crema',
          yield: 100,
          ingredients: [component('harina', 50)],
        },
        bakeryId,
      );

      const crema = (await col('ingredients').doc('crema').get()).data();
      expect(crema.recipeId).toBe(recipeId);
      // 50 × 10 / 100 yield
      expect(crema.costPerUnit).toBe(5);
    });

    it('refuses a second production recipe for the same ingredient', async () => {
      await seedIngredient('harina', { costPerUnit: 10 });
      await seedIngredient('crema', { recipeId: 'recipe-crema' });

      await expect(
        recipeService.create(
          {
            name: 'crema pastelera v2',
            ingredientId: 'crema',
            yield: 100,
            ingredients: [component('harina', 50)],
          },
          bakeryId,
        ),
      ).rejects.toThrow(/ya tiene una receta/);
    });
  });
});
