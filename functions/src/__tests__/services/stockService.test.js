const { initializeFirebase, clearFirestoreData } = require('../setup/firebase');

// Phase 1B: the ledger foundation. See INVENTORY-PLAN.md 1B.6.
// These cover the primitive every later phase trusts — get them right here and
// deduction, counts and purchases inherit correctness.
describe('Stock ledger', () => {
  let db;
  let stockService;
  let productService;
  let ingredientService;
  const bakeryId = 'test-bakery';

  const col = (name) => db.collection(`bakeries/${bakeryId}/${name}`);

  const flourItem = { itemType: 'ingredient', ingredientId: 'harina' };
  const cokeItem = { itemType: 'product', productId: 'coke' };

  const seedStock = (item, currentStock = 0, extra = {}) =>
    col('stocks').doc(stockService.buildItemKey(item)).set({
      itemKey: stockService.buildItemKey(item),
      itemType: item.itemType,
      ...(item.ingredientId
        ? { ingredientId: item.ingredientId }
        : { productId: item.productId, combinationId: item.combinationId || null }),
      name: 'seeded',
      unit: 'g',
      currentStock,
      baselineQty: currentStock,
      baselineAt: new Date(),
      ...extra,
    });

  const readStock = async (item) => {
    const doc = await col('stocks').doc(stockService.buildItemKey(item)).get();
    return doc.exists ? doc.data() : null;
  };

  beforeAll(() => {
    ({ db } = initializeFirebase());
    stockService = require('../../services/stockService');
    productService = require('../../services/productService');
    ingredientService = require('../../services/ingredientService');
  });

  beforeEach(async () => {
    await clearFirestoreData(db);
  });

  describe('itemKey (invariant 7)', () => {
    it('builds one key shape per item kind', () => {
      expect(stockService.buildItemKey(flourItem)).toBe('ingredient_harina');
      expect(stockService.buildItemKey(cokeItem)).toBe('product_coke');
      expect(
        stockService.buildItemKey({ ...cokeItem, combinationId: 'c350' }),
      ).toBe('product_coke_c350');
    });

    it('refuses an item it cannot key', () => {
      expect(() => stockService.buildItemKey({ itemType: 'nonsense' })).toThrow();
      expect(() => stockService.buildItemKey({ itemType: 'ingredient' })).toThrow();
    });
  });

  describe('writeMovements', () => {
    it('appends the movement and moves the cache together', async () => {
      await seedStock(flourItem, 1000);

      await stockService.writeMovements(bakeryId, [
        { item: flourItem, qty: -250, type: 'sale', refs: { orderId: 'o1' } },
      ]);

      expect((await readStock(flourItem)).currentStock).toBe(750);

      const movements = await col('stockMovements').get();
      expect(movements.size).toBe(1);
      expect(movements.docs[0].data()).toMatchObject({
        itemKey: 'ingredient_harina',
        qty: -250,
        type: 'sale',
      });
    });

    it('is a structural no-op when a deterministic id is written twice', async () => {
      await seedStock(flourItem, 1000);

      const movement = {
        id: 'o1_item9_ingredient_harina',
        item: flourItem,
        qty: -250,
        type: 'sale',
      };

      await stockService.writeMovements(bakeryId, [movement]);
      const second = await stockService.writeMovements(bakeryId, [movement]);

      expect(second).toEqual([]);
      expect((await readStock(flourItem)).currentStock).toBe(750);
      expect((await col('stockMovements').get()).size).toBe(1);
    });

    it('nets multiple movements against the same item into one cache write', async () => {
      await seedStock(flourItem, 1000);

      await stockService.writeMovements(bakeryId, [
        { item: flourItem, qty: -100, type: 'sale' },
        { item: flourItem, qty: -50, type: 'sale' },
      ]);

      expect((await readStock(flourItem)).currentStock).toBe(850);
      expect((await col('stockMovements').get()).size).toBe(2);
    });

    it('creates a missing stocks doc rather than losing the movement', async () => {
      await stockService.writeMovements(bakeryId, [
        { item: flourItem, qty: 500, type: 'purchase', name: 'harina', unit: 'g' },
      ]);

      const stock = await readStock(flourItem);
      expect(stock).toMatchObject({ currentStock: 500, name: 'harina', unit: 'g' });
    });

    it('lets stock go negative instead of blocking (§12.4)', async () => {
      await seedStock(flourItem, 100);

      await stockService.writeMovements(bakeryId, [
        { item: flourItem, qty: -300, type: 'sale' },
      ]);

      expect((await readStock(flourItem)).currentStock).toBe(-200);
    });

    it('writes nothing at all when one movement is invalid', async () => {
      await seedStock(flourItem, 1000);

      await expect(
        stockService.writeMovements(bakeryId, [
          { item: flourItem, qty: -100, type: 'sale' },
          { item: flourItem, qty: -50, type: 'not-a-type' },
        ]),
      ).rejects.toThrow(/Unknown movement type/);

      expect((await readStock(flourItem)).currentStock).toBe(1000);
      expect((await col('stockMovements').get()).size).toBe(0);
    });

    it('enlists in an outer transaction (what phase 2 needs)', async () => {
      await seedStock(flourItem, 1000);

      await db.runTransaction(async (transaction) => {
        await stockService.writeMovements(
          bakeryId,
          [{ item: flourItem, qty: -400, type: 'sale' }],
          { transaction },
        );
      });

      expect((await readStock(flourItem)).currentStock).toBe(600);
    });
  });

  describe('adjustments (1B.4)', () => {
    it('records a signed adjustment with its reason', async () => {
      await seedStock(flourItem, 1000);

      await stockService.adjust(bakeryId, 'ingredient_harina', {
        qty: -30,
        reason: 'se cayó un saco',
        editor: { userId: 'u1' },
      });

      expect((await readStock(flourItem)).currentStock).toBe(970);

      const movement = (await col('stockMovements').get()).docs[0].data();
      expect(movement.type).toBe('adjustment');
      expect(movement.reason).toBe('se cayó un saco');
    });

    it('refuses an adjustment with no reason', async () => {
      await seedStock(flourItem, 1000);

      await expect(
        stockService.adjust(bakeryId, 'ingredient_harina', { qty: -30, reason: '  ' }),
      ).rejects.toThrow(/motivo/);
    });
  });

  describe('stocks doc lifecycle (1B.2)', () => {
    it('gives a unit-mode product one stocks doc per combination', async () => {
      await productService.create(
        {
          id: 'coke',
          name: 'coca cola',
          basePrice: 5000,
          inventoryMode: 'unit',
          hasVariations: true,
          variations: {
            combinations: [
              { id: 'c350', name: '350ml', basePrice: 5000 },
              { id: 'c1l', name: '1L', basePrice: 9000 },
            ],
          },
        },
        bakeryId,
      );

      const stocks = await stockService.getStocks(bakeryId);
      expect(stocks.map((s) => s.itemKey).sort()).toEqual([
        'product_coke_c1l',
        'product_coke_c350',
      ]);
    });

    it('creates no stocks doc for a none-mode product (silence is the feature)', async () => {
      await productService.create(
        { id: 'torta', name: 'torta', basePrice: 20000 },
        bakeryId,
      );

      expect(await stockService.getStocks(bakeryId)).toEqual([]);
    });

    it('creates a stocks doc when an ingredient becomes stocked', async () => {
      await col('ingredients').doc('crema').set({
        name: 'crema',
        type: 'manufactured',
        unit: 'g',
        costPerUnit: 5,
        stockBehavior: 'passThrough',
        usedInRecipes: [],
        isActive: true,
      });

      expect(await stockService.getStocks(bakeryId)).toEqual([]);

      await ingredientService.update('crema', { stockBehavior: 'stocked' }, bakeryId);

      const stocks = await stockService.getStocks(bakeryId);
      expect(stocks).toHaveLength(1);
      expect(stocks[0]).toMatchObject({ itemKey: 'ingredient_crema', unit: 'g' });
    });
  });

  describe('read paths (1B.3)', () => {
    it('returns an order\'s movements', async () => {
      await seedStock(flourItem, 1000);

      await stockService.writeMovements(bakeryId, [
        { item: flourItem, qty: -10, type: 'sale', refs: { orderId: 'o1' } },
        { item: flourItem, qty: -20, type: 'sale', refs: { orderId: 'o2' } },
      ]);

      const movements = await stockService.getOrderMovements(bakeryId, 'o1');
      expect(movements).toHaveLength(1);
      expect(movements[0].qty).toBe(-10);
    });
  });
});
