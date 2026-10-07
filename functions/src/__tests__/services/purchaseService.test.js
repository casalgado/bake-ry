const { initializeFirebase, clearFirestoreData } = require('../setup/firebase');

// Ingreso: a purchase, its `purchase` movements and the opt-in cost updates
// commit in one transaction. See INVENTORY-BUILD-PLAN.md M1.4.
describe('Purchase service', () => {
  let db;
  let purchaseService;
  const bakeryId = 'test-bakery';
  const user = { uid: 'u1', email: 'staff@test.com', role: 'bakery_staff' };

  const col = (name) => db.collection(`bakeries/${bakeryId}/${name}`);

  const seedIngredient = (id, data = {}) =>
    col('ingredients').doc(id).set({
      name: id,
      unit: 'g',
      costPerUnit: 10,
      usedInRecipes: [],
      stockBehavior: 'stocked',
      isActive: true,
      isDeleted: false,
      ...data,
    });

  const seedProduct = (id, data = {}) =>
    col('products').doc(id).set({
      name: id,
      basePrice: 10000,
      costPrice: 0,
      costPriceSource: 'recipe',
      hasVariations: false,
      inventoryMode: 'unit',
      usedInRecipes: [],
      isActive: true,
      isDeleted: false,
      ...data,
    });

  const seedRecipe = (id, data = {}) =>
    col('recipes').doc(id).set({ name: id, ingredients: [], version: 1, isActive: true, ...data });

  const component = (id, quantity) => ({ type: 'ingredient', id, quantity, unit: 'g' });

  const ingredientLine = (id, qty, total, extra = {}) => ({
    item: { type: 'ingredient', id, combinationId: null },
    qty,
    total,
    ...extra,
  });

  const buy = (lines, extra = {}) =>
    purchaseService.create(
      { providerId: 'molinos', date: '2026-10-07', lines, ...extra },
      bakeryId,
      user,
    );

  const movementsOf = async (purchaseId) =>
    (await col('stockMovements').where('refs.purchaseId', '==', purchaseId).get()).docs
      .map((d) => d.data());

  const stockOf = async (itemKey) => {
    const doc = await col('stocks').doc(`${itemKey}__main`).get();
    return doc.exists ? doc.data().currentStock : null;
  };

  beforeAll(() => {
    ({ db } = initializeFirebase());
    purchaseService = require('../../services/purchaseService');
  });

  beforeEach(async () => {
    await clearFirestoreData(db);
    await col('settings').doc('default').set({
      features: {
        inventory: { enabled: true, warehouses: [{ id: 'main', name: 'Principal', isDefault: true }] },
      },
    });
    await col('providers').doc('molinos').set({ name: 'Molinos', isDeleted: false });
  });

  it('writes one purchase movement per line, with unitCost and refs.purchaseId', async () => {
    await seedIngredient('harina');
    await seedProduct('coke');

    const purchase = await buy([
      ingredientLine('harina', 1000, 5000),
      { item: { type: 'product', id: 'coke', combinationId: null }, qty: 12, total: 24000 },
    ]);

    const movements = await movementsOf(purchase.id);
    expect(movements).toHaveLength(2);
    expect(movements.every((m) => m.type === 'purchase')).toBe(true);
    expect(movements.find((m) => m.itemKey === 'ingredient_harina').unitCost).toBe(5);
    expect(movements.find((m) => m.itemKey === 'product_coke').unitCost).toBe(2000);

    // First purchase of each: the stock rows are born from the movement.
    expect(await stockOf('ingredient_harina')).toBe(1000);
    expect(await stockOf('product_coke')).toBe(12);

    const stored = (await col('purchases').doc(purchase.id).get()).data();
    expect(stored.total).toBe(29000);
    expect(stored.lines.map((l) => l.itemKey)).toEqual(['ingredient_harina', 'product_coke']);
  });

  it('writes nothing when any line is invalid', async () => {
    await seedIngredient('harina');

    await expect(
      buy([ingredientLine('harina', 1000, 5000), ingredientLine('missing', 1, 1)]),
    ).rejects.toThrow(/Línea 2/);

    expect((await col('purchases').get()).size).toBe(0);
    expect((await col('stockMovements').get()).size).toBe(0);
    expect(await stockOf('ingredient_harina')).toBeNull();
  });

  it('is idempotent: the same idempotencyKey twice is one purchase', async () => {
    await seedIngredient('harina');
    const lines = [ingredientLine('harina', 1000, 5000)];

    const first = await buy(lines, { idempotencyKey: 'abc123' });
    const second = await buy(lines, { idempotencyKey: 'abc123' });

    expect(second.id).toBe(first.id);
    expect((await col('purchases').get()).size).toBe(1);
    expect(await movementsOf(first.id)).toHaveLength(1);
    expect(await stockOf('ingredient_harina')).toBe(1000);
  });

  it('updates cost only on flagged lines, and propagates it to the recipe owner', async () => {
    await seedIngredient('harina', { costPerUnit: 10, usedInRecipes: ['r-torta'] });
    await seedIngredient('azucar', { costPerUnit: 2 });
    await seedProduct('torta', { inventoryMode: 'recipe', costPrice: 1000 });
    await seedRecipe('r-torta', { productId: 'torta', ingredients: [component('harina', 100)] });

    await buy([
      ingredientLine('harina', 1000, 20000, { updateCost: true }), // 20/g
      ingredientLine('azucar', 1000, 5000), // 5/g, not flagged
    ]);

    expect((await col('ingredients').doc('harina').get()).data().costPerUnit).toBe(20);
    expect((await col('ingredients').doc('azucar').get()).data().costPerUnit).toBe(2);
    expect((await col('products').doc('torta').get()).data().costPrice).toBe(2000);
  });

  it('re-costs a recipe fed by two purchased ingredients once, with both prices', async () => {
    await seedIngredient('harina', { costPerUnit: 10, usedInRecipes: ['r-torta'] });
    await seedIngredient('azucar', { costPerUnit: 2, usedInRecipes: ['r-torta'] });
    await seedProduct('torta', { inventoryMode: 'recipe', costPrice: 1100 });
    await seedRecipe('r-torta', {
      productId: 'torta',
      ingredients: [component('harina', 100), component('azucar', 50)],
    });

    await buy([
      ingredientLine('harina', 1000, 20000, { updateCost: true }), // 20/g
      ingredientLine('azucar', 1000, 4000, { updateCost: true }), // 4/g
    ]);

    const torta = col('products').doc('torta');
    expect((await torta.get()).data().costPrice).toBe(100 * 20 + 50 * 4);
    expect((await torta.collection('updateHistory').get()).size).toBe(1);
  });

  it('ignores updateCost on a preparación', async () => {
    await seedIngredient('masa', { costPerUnit: 7, recipeId: 'r-masa' });

    await buy([ingredientLine('masa', 1000, 20000, { updateCost: true })]);

    expect((await col('ingredients').doc('masa').get()).data().costPerUnit).toBe(7);
    expect(await stockOf('ingredient_masa')).toBe(1000);
  });

  it('never zeroes a cost from a $0 line', async () => {
    await seedIngredient('harina', { costPerUnit: 10 });

    await buy([ingredientLine('harina', 1000, 0, { updateCost: true })]);

    expect((await col('ingredients').doc('harina').get()).data().costPerUnit).toBe(10);
    expect(await stockOf('ingredient_harina')).toBe(1000);
  });

  it("tags the cost history entry with reason 'purchase'", async () => {
    await seedIngredient('harina', { costPerUnit: 10 });

    await buy([ingredientLine('harina', 1000, 20000, { updateCost: true })]);

    const history = await col('ingredients').doc('harina').collection('updateHistory').get();
    expect(history.size).toBe(1);
    expect(history.docs[0].data().reason).toBe('purchase');
    expect(history.docs[0].data().changes.costPerUnit).toEqual({ from: 10, to: 20 });
  });

  it('updates a resale product cost on a flagged line', async () => {
    await seedProduct('coke', { costPrice: 0, costPriceSource: 'manual' });

    await buy([{ item: { type: 'product', id: 'coke', combinationId: null }, qty: 12, total: 24000, updateCost: true }]);

    const coke = col('products').doc('coke');
    expect((await coke.get()).data().costPrice).toBe(2000);
    const history = await coke.collection('updateHistory').get();
    expect(history.docs[0].data().reason).toBe('purchase');
  });

  it("updates only the bought combination's cost", async () => {
    await seedProduct('coke', {
      hasVariations: true,
      variations: {
        combinations: [
          { id: 'c350', name: '350ml', costPrice: 1000, costPriceSource: 'manual' },
          { id: 'c1500', name: '1.5L', costPrice: 3000, costPriceSource: 'manual' },
        ],
      },
    });

    await buy([{ item: { type: 'product', id: 'coke', combinationId: 'c350' }, qty: 24, total: 36000, updateCost: true }]);

    const combos = (await col('products').doc('coke').get()).data().variations.combinations;
    expect(combos.find((c) => c.id === 'c350').costPrice).toBe(1500);
    expect(combos.find((c) => c.id === 'c1500').costPrice).toBe(3000);
  });

  it('never overwrites a recipe-costed product cost', async () => {
    await seedProduct('coke', { costPrice: 500, costPriceSource: 'recipe' });

    await buy([{ item: { type: 'product', id: 'coke', combinationId: null }, qty: 12, total: 24000, updateCost: true }]);

    expect((await col('products').doc('coke').get()).data().costPrice).toBe(500);
  });

  it("refuses a product that isn't resale", async () => {
    await seedProduct('croissant', { inventoryMode: 'recipe' });

    await expect(
      buy([{ item: { type: 'product', id: 'croissant', combinationId: null }, qty: 10, total: 1000 }]),
    ).rejects.toThrow(/reventa/);
  });

  it('refuses a deleted provider', async () => {
    await seedIngredient('harina');
    await col('providers').doc('molinos').update({ isDeleted: true });

    await expect(buy([ingredientLine('harina', 1, 1)])).rejects.toThrow(/proveedor/);
  });

  it("getLastPurchase returns the provider's newest purchase", async () => {
    await seedIngredient('harina');
    await seedIngredient('azucar');

    await buy([ingredientLine('harina', 1000, 5000)], { date: '2026-10-01' });
    await buy([ingredientLine('azucar', 500, 1500)], { date: '2026-10-05' });

    const last = await purchaseService.getLastPurchase(bakeryId, 'molinos');
    expect(last.lines.map((l) => l.item.id)).toEqual(['azucar']);
    expect(last.lines[0].unitCost).toBe(3);

    expect(await purchaseService.getLastPurchase(bakeryId, 'nobody')).toBeNull();
  });
});
