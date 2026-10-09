const { initializeFirebase, clearFirestoreData } = require('../setup/firebase');

// Conteo (M4). See zplanning/inventory/CONTEO-HANDOFF.md §4.
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
});
