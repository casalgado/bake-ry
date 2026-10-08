const { initializeFirebase, clearFirestoreData } = require('../setup/firebase');

// Orders move stock through one diff-based reconcile, and disponible is
// computed on read. See inventory-next-steps.md §3 / §6 and
// INVENTORY-BUILD-PLAN.md M3.2–M3.4.
describe('Order stock', () => {
  let db;
  let stockService;
  let orderService;
  const bakeryId = 'test-bakery';
  const editor = { uid: 'u1', email: 'admin@test.com', role: 'bakery_admin' };

  const col = (name) => db.collection(`bakeries/${bakeryId}/${name}`);

  const seedIngredient = (id) =>
    col('ingredients').doc(id).set({
      name: id, unit: 'g', costPerUnit: 1, usedInRecipes: [],
      stockBehavior: 'stocked', recipeId: null, isDeleted: false,
    });

  const seedProduct = (id, data = {}) =>
    col('products').doc(id).set({
      name: id, hasVariations: false, inventoryMode: 'recipe', recipeId: null, isDeleted: false, ...data,
    });

  const seedRecipe = (id, ingredients, data = {}) =>
    col('recipes').doc(id).set({ name: id, ingredients, isDeleted: false, ...data });

  const stockOf = async (itemKey) => {
    const doc = await col('stocks').doc(`${itemKey}__main`).get();
    return doc.exists ? doc.data().currentStock : 0;
  };

  const movementsOf = (orderId) => stockService.getOrderMovements(bakeryId, orderId);

  const line = (id, productId, quantity, fulfillmentSource = 'produce') => ({
    id, productId, productName: productId, collectionId: 'c', collectionName: 'C',
    quantity, basePrice: 1000, currentPrice: 1000, fulfillmentSource,
  });

  const createOrder = (orderItems, status = 0, extra = {}) =>
    orderService.create({
      userId: 'client-1',
      userName: 'Cliente',
      orderItems,
      status,
      dueDate: new Date(),
      preparationDate: new Date(),
      fulfillmentType: 'pickup',
      paymentMethod: 'cash',
      isPaid: false,
      ...extra,
    }, bakeryId);

  const setStatus = (id, status) => orderService.patch(id, { status }, bakeryId, editor);

  /* pan: recipe product (100 harina), sold from the vitrina or made to order.
   * torta: recipe product (200 harina). caja: a recipe product made of 6 pan.
   * coke: resale ('unit'). vela: untracked ('none'). */
  const seedCatalog = async () => {
    await seedIngredient('harina');
    await seedProduct('pan', { recipeId: 'r-pan' });
    await seedRecipe('r-pan', [{ type: 'ingredient', id: 'harina', quantity: 100 }], { productId: 'pan' });
    await seedProduct('torta', { recipeId: 'r-torta' });
    await seedRecipe('r-torta', [{ type: 'ingredient', id: 'harina', quantity: 200 }], { productId: 'torta' });
    await seedProduct('caja', { recipeId: 'r-caja' });
    await seedRecipe('r-caja', [{ type: 'product', id: 'pan', quantity: 6, combinationId: null }], { productId: 'caja' });
    await seedProduct('coke', { inventoryMode: 'unit' });
    await seedProduct('vela', { inventoryMode: 'none' });
  };

  beforeAll(() => {
    ({ db } = initializeFirebase());
    stockService = require('../../services/stockService');
    orderService = require('../../services/orderService');
  });

  beforeEach(async () => {
    await clearFirestoreData(db);
    await col('settings').doc('default').set({
      features: {
        inventory: { enabled: true, warehouses: [{ id: 'main', name: 'Principal', isDefault: true }] },
      },
    });
    await seedCatalog();
  });

  afterEach(() => jest.restoreAllMocks());

  describe('what each line deducts', () => {
    it('stock deducts the product, produce its ingredients, none nothing, unit itself', async () => {
      await createOrder([
        line('l1', 'pan', 4, 'stock'),
        line('l2', 'torta', 2, 'produce'),
        line('l3', 'vela', 5, 'stock'),
        line('l4', 'coke', 3, 'produce'),
      ], 2);

      expect(await stockOf('product_pan')).toBe(-4);
      expect(await stockOf('ingredient_harina')).toBe(-400);
      expect(await stockOf('product_torta')).toBe(0);
      expect(await stockOf('product_vela')).toBe(0);
      expect(await stockOf('product_coke')).toBe(-3);
    });

    it('a combo takes its product components from stock, next to a unit coke', async () => {
      await createOrder([line('l1', 'caja', 2), line('l2', 'coke', 1)], 3);

      expect(await stockOf('product_pan')).toBe(-12);
      expect(await stockOf('ingredient_harina')).toBe(0);
      expect(await stockOf('product_coke')).toBe(-1);
    });
  });

  describe('when the order deducts', () => {
    it('1 → 2 deducts', async () => {
      const order = await createOrder([line('l1', 'pan', 4, 'stock')], 1);
      expect(await stockOf('product_pan')).toBe(0);

      await setStatus(order.id, 2);
      expect(await stockOf('product_pan')).toBe(-4);
    });

    it('0 → 3 deducts', async () => {
      const order = await createOrder([line('l1', 'pan', 4, 'stock')], 0);
      await setStatus(order.id, 3);
      expect(await stockOf('product_pan')).toBe(-4);
    });

    it('2 → 3 writes nothing', async () => {
      const order = await createOrder([line('l1', 'pan', 4, 'stock')], 2);
      await setStatus(order.id, 3);

      expect(await movementsOf(order.id)).toHaveLength(1);
      expect(await stockOf('product_pan')).toBe(-4);
    });

    it('2 → 1 reverses exactly', async () => {
      const order = await createOrder([line('l1', 'torta', 3)], 2);
      await setStatus(order.id, 1);

      expect(await stockOf('ingredient_harina')).toBe(0);
      const movements = await movementsOf(order.id);
      expect(movements.map((m) => m.type).sort()).toEqual(['compensation', 'sale']);
    });

    it('ship → back → ship ends at one net deduction', async () => {
      const order = await createOrder([line('l1', 'pan', 4, 'stock')], 2);
      await setStatus(order.id, 1);
      await setStatus(order.id, 2);

      expect(await stockOf('product_pan')).toBe(-4);
      const types = (await movementsOf(order.id)).map((m) => m.type).sort();
      expect(types).toEqual(['compensation', 'sale', 'sale']);
    });
  });

  describe('edits', () => {
    it('a quantity edit while shipped writes only the delta', async () => {
      const order = await createOrder([line('l1', 'pan', 4, 'stock')], 2);
      await orderService.patch(order.id, { orderItems: [line('l1', 'pan', 5, 'stock')] }, bakeryId, editor);

      const movements = await movementsOf(order.id);
      expect(movements).toHaveLength(2);
      expect(movements.find((m) => m.type === 'compensation').qty).toBe(-1);
      expect(await stockOf('product_pan')).toBe(-5);
    });

    it('a removed line while shipped is put back', async () => {
      const order = await createOrder([line('l1', 'pan', 4, 'stock'), line('l2', 'coke', 2)], 2);
      await orderService.patch(order.id, { orderItems: [line('l2', 'coke', 2)] }, bakeryId, editor);

      expect(await stockOf('product_pan')).toBe(0);
      expect(await stockOf('product_coke')).toBe(-2);
    });

    it('a switch from produce to stock while shipped moves the deduction', async () => {
      const order = await createOrder([line('l1', 'pan', 2, 'produce')], 2);
      await orderService.patch(order.id, { orderItems: [line('l1', 'pan', 2, 'stock')] }, bakeryId, editor);

      expect(await stockOf('ingredient_harina')).toBe(0);
      expect(await stockOf('product_pan')).toBe(-2);
    });

    it('delete while shipped reverses', async () => {
      const order = await createOrder([line('l1', 'pan', 4, 'stock')], 3);
      await orderService.remove(order.id, bakeryId, editor);

      expect(await stockOf('product_pan')).toBe(0);
    });

    it('an edit before shipping writes nothing', async () => {
      const order = await createOrder([line('l1', 'pan', 4, 'stock')], 0);
      await orderService.patch(order.id, { orderItems: [line('l1', 'pan', 6, 'stock')] }, bakeryId, editor);

      expect(await movementsOf(order.id)).toHaveLength(0);
    });

    it('a payment, driver or notes patch does no stock work', async () => {
      const order = await createOrder([line('l1', 'pan', 4, 'stock')], 2);
      const spy = jest.spyOn(stockService, 'reconcileOrderStock');

      await orderService.patch(order.id, { isPaid: true }, bakeryId, editor);
      await orderService.patch(order.id, { internalNotes: 'sin azúcar' }, bakeryId, editor);

      expect(spy).not.toHaveBeenCalled();
    });

    it('patchAll shipping three orders reconciles each', async () => {
      const a = await createOrder([line('l1', 'pan', 1, 'stock')], 1);
      const b = await createOrder([line('l1', 'pan', 2, 'stock')], 1);
      const c = await createOrder([line('l1', 'coke', 3)], 1);

      await orderService.patchAll(bakeryId, [a, b, c].map(({ id }) => ({ id, data: { status: 2 } })), editor);

      expect(await stockOf('product_pan')).toBe(-3);
      expect(await stockOf('product_coke')).toBe(-3);
      for (const { id } of [a, b, c]) expect(await movementsOf(id)).toHaveLength(1);
    });

    it('reconciling twice on the same state writes nothing the second time', async () => {
      const order = await createOrder([line('l1', 'torta', 1)], 2);

      const again = await stockService.reconcileOrderStock(bakeryId, order.id);

      expect(again.written).toEqual([]);
      expect(await stockOf('ingredient_harina')).toBe(-200);
    });
  });

  describe('gaps', () => {
    it('a produce line with no recipe leaves a gap and the order still saves; a recipe clears it', async () => {
      await seedProduct('galleta');
      const order = await createOrder([line('l1', 'galleta', 2)], 2);

      const saved = await col('orders').doc(order.id).get();
      expect(saved.data().status).toBe(2);
      const gap = await col('stockGaps').doc(`${order.id}_l1`).get();
      expect(gap.exists).toBe(true);
      expect(gap.data().gaps[0].reason).toBe('missingRecipe');

      await seedRecipe('r-galleta', [{ type: 'ingredient', id: 'harina', quantity: 10 }], { productId: 'galleta' });
      await col('products').doc('galleta').update({ recipeId: 'r-galleta' });
      await stockService.reconcileOrderStock(bakeryId, order.id);

      expect((await col('stockGaps').doc(`${order.id}_l1`).get()).exists).toBe(false);
      expect(await stockOf('ingredient_harina')).toBe(-20);
    });
  });

  describe('availability on getStocks', () => {
    const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

    it('committed, incoming and available, and an order past the window is not committed', async () => {
      await stockService.writeMovements(bakeryId, [{
        item: { itemType: 'product', productId: 'pan' },
        warehouseId: 'main', qty: 10, type: 'adjustment', name: 'pan', unit: 'uds',
      }]);
      await createOrder([line('l1', 'pan', 4, 'stock')], 0);
      await createOrder([line('l1', 'pan', 2, 'produce')], 1); // produce never commits
      await createOrder([line('l1', 'pan', 5, 'stock')], 0, { dueDate: daysAgo(11) });
      await col('productionRuns').doc('run-1').set({
        status: 'open',
        warehouseId: 'main',
        isDeleted: false,
        lines: [{ id: 'rl1', item: { type: 'product', id: 'pan', combinationId: null }, plannedQty: 3, status: 'pending' }],
      });

      const rows = await stockService.getStocks(bakeryId, { itemKeys: ['product_pan'] });

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ currentStock: 10, committed: 4, incoming: 3, available: 9 });
    });

    it('a resale line counts as committed even when saved as produce', async () => {
      await stockService.writeMovements(bakeryId, [{
        item: { itemType: 'product', productId: 'coke' },
        warehouseId: 'main', qty: 5, type: 'adjustment', name: 'coke', unit: 'uds',
      }]);
      await createOrder([line('l1', 'coke', 1, 'produce')], 0);

      const rows = await stockService.getStocks(bakeryId, { itemKeys: ['product_coke'] });

      expect(rows[0]).toMatchObject({ currentStock: 5, committed: 1, available: 4 });
    });
  });
});
