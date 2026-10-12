const { initializeFirebase, clearFirestoreData } = require('../setup/firebase');

// Conteo. See bake-ry-front zplanning/inventory/INVENTORY.md §4.5.
describe('Stock counts', () => {
  let db;
  let stockService;
  let countService;
  const bakeryId = 'test-bakery';
  const MAIN = 'main';
  const ana = { uid: 'ana', email: 'ana@test.com', role: 'bakery_staff' };

  const col = (name) => db.collection(`bakeries/${bakeryId}/${name}`);

  const flour = { itemType: 'ingredient', ingredientId: 'harina' };
  const sugar = { itemType: 'ingredient', ingredientId: 'azucar' };
  const coke = { itemType: 'product', productId: 'coke' };

  const keyOf = (item) => stockService.buildItemKey(item);
  const docIdOf = (item) => stockService.buildStockDocId(keyOf(item), MAIN);

  const anHourAgo = () => new Date(Date.now() - 60 * 60 * 1000);

  const seedStock = (item, qty) =>
    col('stocks').doc(docIdOf(item)).set({
      itemKey: keyOf(item),
      warehouseId: MAIN,
      itemType: item.itemType,
      ...(item.ingredientId
        ? { ingredientId: item.ingredientId }
        : { productId: item.productId, combinationId: null }),
      name: keyOf(item),
      unit: 'g',
      currentStock: qty,
      baselineQty: qty,
      baselineAt: anHourAgo(),
    });

  const readStock = async (item) => (await col('stocks').doc(docIdOf(item)).get()).data();

  const countMovements = async (countId) =>
    (await col('stockMovements').where('refs.countId', '==', countId).get()).docs.map((d) => d.data());

  beforeAll(() => {
    ({ db } = initializeFirebase());
    stockService = require('../../services/stockService');
    countService = require('../../services/stockCountService');
  });

  beforeEach(async () => {
    await clearFirestoreData(db);
    await col('settings').doc('default').set({
      features: { inventory: { enabled: true, warehouses: [{ id: MAIN, name: 'Principal', isDefault: true }] } },
    });
    await col('users').doc('ana').set({ name: 'Ana' });
    await col('ingredients').doc('harina').set({ name: 'harina', costPerUnit: 2 });
    await col('ingredients').doc('azucar').set({ name: 'azucar', costPerUnit: 1 });
    await col('products').doc('coke').set({ name: 'coke', hasVariations: false, costPrice: 3000 });
    await seedStock(flour, 1000);
    await seedStock(sugar, 500);
    await seedStock(coke, 24);
  });

  describe('open', () => {
    it('joins the open count instead of starting a second one', async () => {
      const first = await countService.open(bakeryId, {}, ana);
      const second = await countService.open(bakeryId, {}, ana);

      expect(second.id).toBe(first.id);
      expect(first).toMatchObject({ warehouseId: MAIN, status: 'open', createdBy: { userId: 'ana', name: 'Ana' } });
    });
  });

  describe('setItem', () => {
    it('sets a row with who counted it, and clears it with null', async () => {
      const { id } = await countService.open(bakeryId, {}, ana);

      await countService.setItem(bakeryId, id, keyOf(flour), { qty: 950 }, ana);
      let count = await countService.getById(id, bakeryId);
      expect(count.items[keyOf(flour)]).toMatchObject({ qty: 950, by: { userId: 'ana', name: 'Ana' } });

      await countService.setItem(bakeryId, id, keyOf(flour), { qty: null }, ana);
      count = await countService.getById(id, bakeryId);
      expect(count.items[keyOf(flour)]).toBeUndefined();
    });

    it('refuses a negative or missing quantity, and an item outside the bodega', async () => {
      const { id } = await countService.open(bakeryId, {}, ana);

      await expect(countService.setItem(bakeryId, id, keyOf(flour), { qty: -1 }, ana)).rejects.toThrow();
      await expect(countService.setItem(bakeryId, id, keyOf(flour), {}, ana)).rejects.toThrow();
      await expect(countService.setItem(bakeryId, id, 'ingredient_nope', { qty: 1 }, ana)).rejects.toThrow();
    });

    it('refuses a row on a closed count', async () => {
      const { id } = await countService.open(bakeryId, {}, ana);
      await countService.close(bakeryId, id, ana);

      await expect(countService.setItem(bakeryId, id, keyOf(flour), { qty: 1 }, ana)).rejects.toThrow('no está abierto');
    });
  });

  describe('close', () => {
    it('sets the baseline to what was counted and writes only the difference', async () => {
      // Since the last baseline: a sale of 10 and a baja of 5. currentStock 985.
      await stockService.writeMovements(bakeryId, [
        { item: flour, warehouseId: MAIN, qty: -10, type: 'sale', refs: { orderId: 'o1' } },
        { item: flour, warehouseId: MAIN, qty: -5, type: 'waste', reason: 'damaged' },
      ]);
      const { id } = await countService.open(bakeryId, {}, ana);
      await countService.setItem(bakeryId, id, keyOf(flour), { qty: 950 }, ana);
      await countService.setItem(bakeryId, id, keyOf(coke), { qty: 24 }, ana);

      const closed = await countService.close(bakeryId, id, ana);

      expect(closed.status).toBe('closed');
      expect(closed.totalItems).toBe(3);
      expect(closed.items[keyOf(flour)]).toMatchObject({
        qty: 950, expectedQty: 985, diffQty: -35, unitCost: 2, wasteSinceBaseline: -5,
      });

      const flourStock = await readStock(flour);
      expect(flourStock.currentStock).toBe(950);
      expect(flourStock.baselineQty).toBe(950);
      expect(flourStock.baselineAt.toDate().getTime()).toBe(closed.closedAt.getTime());

      // Zero difference: verified (new baseline), but no movement.
      const cokeStock = await readStock(coke);
      expect(cokeStock).toMatchObject({ currentStock: 24, baselineQty: 24 });
      expect(cokeStock.baselineAt.toDate().getTime()).toBe(closed.closedAt.getTime());

      const movements = await countMovements(id);
      expect(movements).toHaveLength(1);
      expect(movements[0]).toMatchObject({ itemKey: keyOf(flour), qty: -35, type: 'count' });

      // Not counted: untouched.
      const sugarStock = await readStock(sugar);
      expect(sugarStock).toMatchObject({ currentStock: 500, baselineQty: 500 });
      expect(sugarStock.baselineAt.toDate().getTime()).toBeLessThan(closed.closedAt.getTime());
    });

    it('leaves verify clean: the count movement sits just before the new baseline', async () => {
      await stockService.writeMovements(bakeryId, [
        { item: flour, warehouseId: MAIN, qty: -10, type: 'sale', refs: { orderId: 'o1' } },
      ]);
      const { id } = await countService.open(bakeryId, {}, ana);
      await countService.setItem(bakeryId, id, keyOf(flour), { qty: 900 }, ana);

      const closed = await countService.close(bakeryId, id, ana);

      const [movement] = await countMovements(id);
      expect(movement.timestamp.toDate().getTime()).toBe(closed.closedAt.getTime() - 1);
      expect(await stockService.verify(bakeryId)).toEqual([]);
    });

    it('refuses to close twice', async () => {
      const { id } = await countService.open(bakeryId, {}, ana);
      await countService.setItem(bakeryId, id, keyOf(flour), { qty: 900 }, ana);
      await countService.close(bakeryId, id, ana);

      await expect(countService.close(bakeryId, id, ana)).rejects.toThrow('no está abierto');
      expect(await countMovements(id)).toHaveLength(1);
      expect((await readStock(flour)).currentStock).toBe(900);
    });
  });

  describe('discard', () => {
    it('ends the count for everyone, keeps its rows and moves nothing', async () => {
      const { id } = await countService.open(bakeryId, {}, ana);
      await countService.setItem(bakeryId, id, keyOf(flour), { qty: 1 }, ana);

      const discarded = await countService.discard(bakeryId, id, ana);

      expect(discarded).toMatchObject({ status: 'discarded', closedBy: { userId: 'ana', name: 'Ana' } });
      expect(discarded.items[keyOf(flour)].qty).toBe(1);
      expect(await countMovements(id)).toEqual([]);
      expect((await readStock(flour)).currentStock).toBe(1000);

      // A new Empezar starts a fresh count.
      const next = await countService.open(bakeryId, {}, ana);
      expect(next.id).not.toBe(id);
    });

    it('refuses to discard or close a count that is not open', async () => {
      const { id } = await countService.open(bakeryId, {}, ana);
      await countService.discard(bakeryId, id, ana);

      await expect(countService.discard(bakeryId, id, ana)).rejects.toThrow('no está abierto');
      await expect(countService.close(bakeryId, id, ana)).rejects.toThrow('no está abierto');
    });
  });

  describe('closing in chunks', () => {
    it('closes a count larger than one chunk and leaves verify clean', async () => {
      const items = Array.from({ length: 450 }, (_, i) => ({ itemType: 'ingredient', ingredientId: `i${i}` }));
      const batch = db.batch();
      items.forEach((item) => batch.set(col('stocks').doc(docIdOf(item)), {
        itemKey: keyOf(item),
        warehouseId: MAIN,
        itemType: 'ingredient',
        ingredientId: item.ingredientId,
        name: item.ingredientId,
        unit: 'g',
        currentStock: 10,
        baselineQty: 10,
        baselineAt: anHourAgo(),
      }));
      await batch.commit();

      const { id } = await countService.open(bakeryId, {}, ana);
      const rows = Object.fromEntries(items.map((item) => [
        keyOf(item), { qty: 11, by: { userId: 'ana', name: 'Ana' }, at: new Date() },
      ]));
      await col('stockCounts').doc(id).update({ items: rows });

      const closed = await countService.close(bakeryId, id, ana);

      expect(closed.status).toBe('closed');
      expect(Object.keys(closed.items)).toHaveLength(450);
      expect(Object.values(closed.items).every((row) => row.diffQty === 1 && row.expectedQty === 10)).toBe(true);
      expect(await countMovements(id)).toHaveLength(450);
      expect((await readStock(items[0])).currentStock).toBe(11);
      expect((await readStock(items[449])).currentStock).toBe(11);
      expect(await stockService.verify(bakeryId)).toEqual([]);
    }, 120000);

    it('finishes a close that stopped half way without repeating what was done', async () => {
      const { id } = await countService.open(bakeryId, {}, ana);
      await countService.setItem(bakeryId, id, keyOf(flour), { qty: 950 }, ana);
      await countService.setItem(bakeryId, id, keyOf(sugar), { qty: 400 }, ana);

      // The first chunk ran: flour is baselined, its movement written, its row frozen.
      const closedAt = new Date();
      await stockService.writeMovements(bakeryId, [{
        id: `count_${id}_${keyOf(flour)}`,
        item: flour,
        warehouseId: MAIN,
        qty: -50,
        type: 'count',
        refs: { countId: id },
        timestamp: new Date(closedAt.getTime() - 1),
      }], { stockFields: { [docIdOf(flour)]: { baselineQty: 950, baselineAt: closedAt } } });
      await col('stockCounts').doc(id).update({
        status: 'closing',
        closedAt,
        closedBy: { userId: 'ana', name: 'Ana' },
        [`items.${keyOf(flour)}.expectedQty`]: 1000,
        [`items.${keyOf(flour)}.diffQty`]: -50,
        [`items.${keyOf(flour)}.unitCost`]: 2,
        [`items.${keyOf(flour)}.wasteSinceBaseline`]: 0,
      });

      const closed = await countService.close(bakeryId, id, ana);

      expect(closed.status).toBe('closed');
      expect(closed.items[keyOf(flour)]).toMatchObject({ expectedQty: 1000, diffQty: -50 });
      expect(closed.items[keyOf(sugar)]).toMatchObject({ expectedQty: 500, diffQty: -100 });
      expect(await countMovements(id)).toHaveLength(2);
      expect((await readStock(flour)).currentStock).toBe(950);
      expect((await readStock(sugar)).currentStock).toBe(400);
      expect(await stockService.verify(bakeryId)).toEqual([]);
    });

    it('takes no more typing and no discard while closing', async () => {
      const { id } = await countService.open(bakeryId, {}, ana);
      await col('stockCounts').doc(id).update({ status: 'closing', closedAt: new Date() });

      await expect(countService.setItem(bakeryId, id, keyOf(flour), { qty: 1 }, ana)).rejects.toThrow('no está abierto');
      await expect(countService.discard(bakeryId, id, ana)).rejects.toThrow('no está abierto');
    });
  });

  describe('opening and listing', () => {
    it('two people pressing Empezar at once land on one count', async () => {
      const [first, second] = await Promise.all([
        countService.open(bakeryId, {}, ana),
        countService.open(bakeryId, {}, ana),
      ]);

      expect(second.id).toBe(first.id);
      expect((await col('stockCounts').get()).size).toBe(1);
    });

    it('lists summaries without rows: counted, who counted and, once closed, the money moved', async () => {
      const { id } = await countService.open(bakeryId, {}, ana);
      await countService.setItem(bakeryId, id, keyOf(flour), { qty: 950 }, ana);
      await countService.setItem(bakeryId, id, keyOf(coke), { qty: 24 }, ana);

      let [summary] = await countService.getAll(bakeryId);
      expect(summary).toMatchObject({ id, status: 'open', counted: 2, counters: ['Ana'], netValue: null });
      expect(summary.items).toBeUndefined();

      await countService.close(bakeryId, id, ana);

      [summary] = await countService.getAll(bakeryId);
      // flour: 950 counted against 1000 at 2 each; coke matched.
      expect(summary).toMatchObject({ status: 'closed', counted: 2, netValue: -100 });
    });
  });
});
