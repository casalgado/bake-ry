const { initializeFirebase, clearFirestoreData } = require('../setup/firebase');

// Orders move stock through one diff-based reconcile, and disponible is
// computed on read. See bake-ry-front zplanning/inventory/INVENTORY.md §4.3.
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

  describe('combinations, bodegas and what cannot be followed', () => {
    const comboLine = (id, productId, combinationId, quantity) => ({
      ...line(id, productId, quantity),
      variation: null,
      combination: { id: combinationId, name: combinationId, selection: [combinationId], basePrice: 1000 },
    });

    it("a combination takes its own recipe and never falls back to the product's", async () => {
      // The product itself has a recipe (200 harina); only c1000 has its own.
      await seedProduct('tortaV', {
        hasVariations: true,
        recipeId: 'r-torta',
        variations: {
          combinations: [
            { id: 'c500', name: '500g', recipeId: null },
            { id: 'c1000', name: '1kg', recipeId: 'r-c1000' },
          ],
        },
      });
      await seedRecipe(
        'r-c1000',
        [{ type: 'ingredient', id: 'harina', quantity: 400 }],
        { productId: 'tortaV', combinationId: 'c1000' },
      );

      const order = await createOrder(
        [comboLine('l1', 'tortaV', 'c500', 2), comboLine('l2', 'tortaV', 'c1000', 1)],
        2,
      );

      expect(await stockOf('ingredient_harina')).toBe(-400);
      const gap = await col('stockGaps').doc(`${order.id}_l1`).get();
      expect(gap.data().gaps[0].reason).toBe('missingRecipe');
      expect((await col('stockGaps').doc(`${order.id}_l2`).get()).exists).toBe(false);
    });

    it('a stock line leaves from the bodega it names', async () => {
      await col('settings').doc('default').set({
        features: {
          inventory: {
            enabled: true,
            warehouses: [
              { id: 'main', name: 'Principal', isDefault: true },
              { id: 'branch', name: 'Sucursal' },
            ],
          },
        },
      });

      await createOrder([{ ...line('l1', 'pan', 4, 'stock'), sourceWarehouseId: 'branch' }], 2);

      const branch = await col('stocks').doc('product_pan__branch').get();
      expect(branch.data().currentStock).toBe(-4);
      expect((await col('stocks').doc('product_pan__main').get()).exists).toBe(false);
    });

    it('a product that no longer exists leaves a gap and the order still ships', async () => {
      const order = await createOrder([line('l1', 'fantasma', 1, 'stock')], 2);

      expect((await col('orders').doc(order.id).get()).data().status).toBe(2);
      const gap = await col('stockGaps').doc(`${order.id}_l1`).get();
      expect(gap.data().gaps[0].reason).toBe('missingItem');
    });

    it('a bulk ship with one order missing fails that one and ships the rest', async () => {
      const real = await createOrder([line('l1', 'pan', 1, 'stock')], 1);

      const results = await orderService.patchAll(bakeryId, [
        { id: real.id, data: { status: 2 } },
        { id: 'no-such-order', data: { status: 2 } },
      ], editor);

      expect(results.success.map((r) => r.id)).toEqual([real.id]);
      expect(results.failed.map((r) => r.id)).toEqual(['no-such-order']);
      expect(await stockOf('product_pan')).toBe(-1);
    });
  });

  describe('the inventory switch', () => {
    const settings = () => col('settings').doc('default');

    it('a bakery that never turned inventory on keeps the ledger untouched', async () => {
      await settings().set({ features: { inventory: { enabled: false } } });

      const order = await createOrder([line('l1', 'coke', 3)], 2);

      expect(await movementsOf(order.id)).toHaveLength(0);
      expect(await stockOf('product_coke')).toBe(0);
    });

    it('turning it off after it was live does not pause the ledger', async () => {
      await createOrder([line('l1', 'pan', 4, 'stock')], 2); // first sight of the switch on: goes live
      await settings().set({ features: { inventory: { enabled: false } } }, { merge: true });

      const order = await createOrder([line('l1', 'coke', 3)], 2);

      expect(await movementsOf(order.id)).toHaveLength(1);
      expect(await stockOf('product_coke')).toBe(-3);
    });

    it('records when it went live, once', async () => {
      const first = await stockService.getInventoryStart(bakeryId);
      const second = await stockService.getInventoryStart(bakeryId);

      expect(first).toBeInstanceOf(Date);
      expect(second.getTime()).toBe(first.getTime());
    });
  });

  describe('shippedAt', () => {
    const shippedAtOf = async (id) => (await col('orders').doc(id).get()).data().shippedAt;

    it('is stamped on shipping, kept on going back, stamped anew on shipping again', async () => {
      const order = await createOrder([line('l1', 'pan', 1, 'stock')], 0);
      expect(await shippedAtOf(order.id)).toBeNull();

      await setStatus(order.id, 2);
      const first = (await shippedAtOf(order.id)).toDate().getTime();

      await setStatus(order.id, 1);
      expect((await shippedAtOf(order.id)).toDate().getTime()).toBe(first);

      await new Promise((resolve) => setTimeout(resolve, 5));
      await setStatus(order.id, 3);
      expect((await shippedAtOf(order.id)).toDate().getTime()).toBeGreaterThan(first);
    });

    it('keeps its first moment through 2 → 3 and ignores one sent by a client', async () => {
      const order = await createOrder([line('l1', 'pan', 1, 'stock')], 2);
      const first = (await shippedAtOf(order.id)).toDate().getTime();

      await orderService.patch(order.id, { status: 3, shippedAt: new Date('2020-01-01') }, bakeryId, editor);

      expect((await shippedAtOf(order.id)).toDate().getTime()).toBe(first);
    });

    it('is stamped on an order created already shipped', async () => {
      const order = await createOrder([line('l1', 'pan', 1, 'stock')], 3);
      expect(await shippedAtOf(order.id)).not.toBeNull();
    });
  });

  describe('orders shipped before inventory went live', () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    it('editing one does not deduct what it ever held', async () => {
      await col('settings').doc('default').set({ features: { inventory: { enabled: false } } });
      const old = await createOrder([line('l1', 'pan', 4, 'stock')], 2);

      await wait(5);
      await col('settings').doc('default').set({ features: { inventory: { enabled: true } } });
      await orderService.patch(old.id, { orderItems: [line('l1', 'pan', 5, 'stock')] }, bakeryId, editor);

      expect(await movementsOf(old.id)).toHaveLength(0);
      expect(await stockOf('product_pan')).toBe(0);
    });

    it('moving one back and shipping it again is a normal deduction', async () => {
      await col('settings').doc('default').set({ features: { inventory: { enabled: false } } });
      const old = await createOrder([line('l1', 'pan', 4, 'stock')], 2);

      await wait(5);
      await col('settings').doc('default').set({ features: { inventory: { enabled: true } } });
      await setStatus(old.id, 1);
      await setStatus(old.id, 2);

      expect(await stockOf('product_pan')).toBe(-4);
    });

    it('an order shipped after it went live whose reconcile failed is still owed its deduction', async () => {
      await stockService.getInventoryStart(bakeryId);
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(stockService, 'reconcileOrderStock').mockRejectedValueOnce(new Error('boom'));

      const order = await createOrder([line('l1', 'pan', 4, 'stock')], 2);
      expect(await movementsOf(order.id)).toHaveLength(0);

      await orderService.patch(order.id, { orderItems: [line('l1', 'pan', 5, 'stock')] }, bakeryId, editor);

      expect(await stockOf('product_pan')).toBe(-5);
    });
  });

  describe('finding and repairing orders that never reconciled', () => {
    it('lists a shipped order whose reconcile failed, then repairs it', async () => {
      await stockService.getInventoryStart(bakeryId);
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(stockService, 'reconcileOrderStock').mockRejectedValueOnce(new Error('boom'));

      const failed = await createOrder([line('l1', 'pan', 4, 'stock')], 2);
      await createOrder([line('l1', 'coke', 1)], 2); // reconciles normally

      const found = await stockService.findUnreconciledOrders(bakeryId);
      expect(found).toEqual([{ orderId: failed.id, diffs: [{ id: 'product_pan__main', diff: -4 }] }]);

      const result = await stockService.reconcileUnreconciledOrders(bakeryId);
      expect(result).toEqual({ repaired: [failed.id], failed: [] });
      expect(await stockOf('product_pan')).toBe(-4);
      expect(await stockService.findUnreconciledOrders(bakeryId)).toEqual([]);
    });

    it('lists a deleted order whose reversal failed', async () => {
      await stockService.getInventoryStart(bakeryId);
      const order = await createOrder([line('l1', 'pan', 4, 'stock')], 2);
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(stockService, 'reconcileOrderStock').mockRejectedValueOnce(new Error('boom'));

      await orderService.remove(order.id, bakeryId, editor);

      const found = await stockService.findUnreconciledOrders(bakeryId);
      expect(found).toEqual([{ orderId: order.id, diffs: [{ id: 'product_pan__main', diff: 4 }] }]);
    });

    it('lists an order moved back whose reversal failed', async () => {
      await stockService.getInventoryStart(bakeryId);
      const order = await createOrder([line('l1', 'pan', 4, 'stock')], 2);
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(stockService, 'reconcileOrderStock').mockRejectedValueOnce(new Error('boom'));

      await setStatus(order.id, 1);

      const found = await stockService.findUnreconciledOrders(bakeryId);
      expect(found).toEqual([{ orderId: order.id, diffs: [{ id: 'product_pan__main', diff: 4 }] }]);
    });

    it('ignores orders shipped before inventory went live', async () => {
      await col('settings').doc('default').set({ features: { inventory: { enabled: false } } });
      await createOrder([line('l1', 'pan', 4, 'stock')], 2);

      await new Promise((resolve) => setTimeout(resolve, 5));
      await col('settings').doc('default').set({ features: { inventory: { enabled: true } } });

      expect(await stockService.findUnreconciledOrders(bakeryId)).toEqual([]);
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
