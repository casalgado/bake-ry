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

  // Every bakery has this one without a migration (CORRECTIONS §1.1).
  const MAIN = 'main';
  const BRANCH = 'sucursal';

  const docIdOf = (item, warehouseId = MAIN) =>
    stockService.buildStockDocId(stockService.buildItemKey(item), warehouseId);

  const seedStock = (item, currentStock = 0, warehouseId = MAIN, extra = {}) =>
    col('stocks').doc(docIdOf(item, warehouseId)).set({
      itemKey: stockService.buildItemKey(item),
      warehouseId,
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

  const readStock = async (item, warehouseId = MAIN) => {
    const doc = await col('stocks').doc(docIdOf(item, warehouseId)).get();
    return doc.exists ? doc.data() : null;
  };

  beforeAll(() => {
    ({ db } = initializeFirebase());
    stockService = require('../../services/stockService');
    productService = require('../../services/productService');
    ingredientService = require('../../services/ingredientService');
  });

  // The entry points refuse a warehouse the bakery has not declared, so the
  // two-warehouse tests need settings that declare both.
  const seedWarehouses = (...ids) =>
    col('settings').doc('default').set({
      features: {
        inventory: {
          enabled: true,
          warehouses: ids.map((id) => ({ id, name: id, isDefault: id === MAIN })),
        },
      },
    });

  beforeEach(async () => {
    await clearFirestoreData(db);
    await seedWarehouses(MAIN, BRANCH);
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

  describe('stock doc id (item × warehouse)', () => {
    it('separates the item identity from the warehouse it sits in', () => {
      expect(stockService.buildStockDocId('ingredient_harina', 'main')).toBe(
        'ingredient_harina__main',
      );
      // Item keys use single underscores, so `__` never collides with one.
      expect(stockService.buildStockDocId('product_coke_c350', 'sucursal')).toBe(
        'product_coke_c350__sucursal',
      );
    });

    it('refuses to build an id without a warehouse', () => {
      expect(() => stockService.buildStockDocId('ingredient_harina')).toThrow();
    });

    it('falls back to main for settings that predate the warehouses field', async () => {
      await col('settings').doc('default').set({ features: { inventory: { enabled: true } } });

      expect(await stockService.getDefaultWarehouseId(bakeryId)).toBe(MAIN);
    });

    it('reads the default warehouse out of settings', async () => {
      await col('settings').doc('default').set({
        features: {
          inventory: {
            enabled: true,
            warehouses: [
              { id: MAIN, name: 'Principal', isDefault: false },
              { id: BRANCH, name: 'Sucursal', isDefault: true },
            ],
          },
        },
      });

      expect(await stockService.getDefaultWarehouseId(bakeryId)).toBe(BRANCH);
    });

    it('refuses a warehouse the bakery never declared', async () => {
      await expect(
        stockService.resolveWarehouseId(bakeryId, 'bodega-fantasma'),
      ).rejects.toThrow(/Bodega desconocida/);
    });
  });

  describe('writeMovements', () => {
    it('appends the movement and moves the cache together', async () => {
      await seedStock(flourItem, 1000);

      await stockService.writeMovements(bakeryId, [
        {
          item: flourItem,
          warehouseId: MAIN,
          qty: -250,
          type: 'sale',
          refs: { orderId: 'o1' },
        },
      ]);

      expect((await readStock(flourItem)).currentStock).toBe(750);

      const movements = await col('stockMovements').get();
      expect(movements.size).toBe(1);
      expect(movements.docs[0].data()).toMatchObject({
        itemKey: 'ingredient_harina',
        warehouseId: MAIN,
        qty: -250,
        type: 'sale',
      });
    });

    it('refuses a movement with no warehouse — explicit always, never "means main"', async () => {
      await seedStock(flourItem, 1000);

      await expect(
        stockService.writeMovements(bakeryId, [
          { item: flourItem, qty: -250, type: 'sale' },
        ]),
      ).rejects.toThrow(/warehouseId/);

      expect((await readStock(flourItem)).currentStock).toBe(1000);
      expect((await col('stockMovements').get()).size).toBe(0);
    });

    it('is a structural no-op when a deterministic id is written twice', async () => {
      await seedStock(flourItem, 1000);

      const movement = {
        id: 'o1_item9_ingredient_harina',
        item: flourItem,
        warehouseId: MAIN,
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
        { item: flourItem, warehouseId: MAIN, qty: -100, type: 'sale' },
        { item: flourItem, warehouseId: MAIN, qty: -50, type: 'sale' },
      ]);

      expect((await readStock(flourItem)).currentStock).toBe(850);
      expect((await col('stockMovements').get()).size).toBe(2);
    });

    it('keeps the same item in two warehouses on separate docs', async () => {
      await seedStock(flourItem, 1000, MAIN);
      await seedStock(flourItem, 40, BRANCH);

      await stockService.writeMovements(bakeryId, [
        { item: flourItem, warehouseId: MAIN, qty: -100, type: 'sale' },
        { item: flourItem, warehouseId: BRANCH, qty: -10, type: 'sale' },
      ]);

      expect((await readStock(flourItem, MAIN)).currentStock).toBe(900);
      expect((await readStock(flourItem, BRANCH)).currentStock).toBe(30);
    });

    it('creates a missing stocks doc rather than losing the movement', async () => {
      await stockService.writeMovements(bakeryId, [
        {
          item: flourItem,
          warehouseId: BRANCH,
          qty: 500,
          type: 'purchase',
          name: 'harina',
          unit: 'g',
        },
      ]);

      const stock = await readStock(flourItem, BRANCH);
      expect(stock).toMatchObject({
        currentStock: 500,
        name: 'harina',
        unit: 'g',
        warehouseId: BRANCH,
      });
    });

    it('lets stock go negative instead of blocking (§12.4)', async () => {
      await seedStock(flourItem, 100);

      await stockService.writeMovements(bakeryId, [
        { item: flourItem, warehouseId: MAIN, qty: -300, type: 'sale' },
      ]);

      expect((await readStock(flourItem)).currentStock).toBe(-200);
    });

    it('writes nothing at all when one movement is invalid', async () => {
      await seedStock(flourItem, 1000);

      await expect(
        stockService.writeMovements(bakeryId, [
          { item: flourItem, warehouseId: MAIN, qty: -100, type: 'sale' },
          { item: flourItem, warehouseId: MAIN, qty: -50, type: 'not-a-type' },
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
          [{ item: flourItem, warehouseId: MAIN, qty: -400, type: 'sale' }],
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

    it('deducts once when the same retry key arrives twice', async () => {
      await seedStock(flourItem, 1000);

      const body = { qty: -30, reason: 'conteo', idempotencyKey: 'form-open-xyz' };

      const first = await stockService.adjust(bakeryId, 'ingredient_harina', body);
      const retry = await stockService.adjust(bakeryId, 'ingredient_harina', body);

      expect((await readStock(flourItem)).currentStock).toBe(970);
      expect((await col('stockMovements').get()).size).toBe(1);
      expect(retry.id).toBe(first.id);
    });

    it('refuses a retry key that would not survive as a doc id', async () => {
      await seedStock(flourItem, 1000);

      await expect(
        stockService.adjust(bakeryId, 'ingredient_harina', {
          qty: -30,
          reason: 'conteo',
          idempotencyKey: 'bad/key',
        }),
      ).rejects.toThrow(/idempotencyKey/);
    });

    it('adjusts the warehouse it was told to, not the default one', async () => {
      await seedStock(flourItem, 1000, MAIN);
      await seedStock(flourItem, 50, BRANCH);

      await stockService.adjust(bakeryId, 'ingredient_harina', {
        qty: -10,
        reason: 'conteo rápido',
        warehouseId: BRANCH,
      });

      expect((await readStock(flourItem, MAIN)).currentStock).toBe(1000);
      expect((await readStock(flourItem, BRANCH)).currentStock).toBe(40);
    });
  });

  describe('bajas (§3)', () => {
    it('records a negative waste movement with its reason', async () => {
      await seedStock(flourItem, 1000);

      await stockService.waste(bakeryId, 'ingredient_harina', {
        qty: -20,
        reason: 'expired',
        note: 'saco abierto',
      });

      expect((await readStock(flourItem)).currentStock).toBe(980);

      const movement = (await col('stockMovements').get()).docs[0].data();
      expect(movement.type).toBe('waste');
      // The enum stays bare: the note rides alongside, never welded into it.
      expect(movement.reason).toBe('expired');
      expect(movement.note).toBe('saco abierto');
    });

    it('refuses a positive quantity — a baja is a loss, not an entry', async () => {
      await seedStock(flourItem, 1000);

      await expect(
        stockService.waste(bakeryId, 'ingredient_harina', { qty: 20, reason: 'expired' }),
      ).rejects.toThrow(/negativa/);

      expect((await readStock(flourItem)).currentStock).toBe(1000);
      expect((await col('stockMovements').get()).size).toBe(0);
    });

    it('refuses a reason outside the enum', async () => {
      await seedStock(flourItem, 1000);

      await expect(
        stockService.waste(bakeryId, 'ingredient_harina', { qty: -20, reason: 'porque sí' }),
      ).rejects.toThrow(/Motivo de baja/);
    });
  });

  describe('transfers (§1.2)', () => {
    it('moves stock between two warehouses in one transaction', async () => {
      await seedStock(flourItem, 1000, MAIN);

      const movements = await stockService.transfer(bakeryId, 'ingredient_harina', {
        qty: 300,
        fromWarehouseId: MAIN,
        toWarehouseId: BRANCH,
      });

      expect((await readStock(flourItem, MAIN)).currentStock).toBe(700);
      // The destination doc did not exist: the movement created it.
      expect((await readStock(flourItem, BRANCH)).currentStock).toBe(300);

      expect(movements).toHaveLength(2);
      const [transferId] = [...new Set(movements.map((m) => m.refs.transferId))];
      expect(transferId).toBeTruthy();
      expect(movements.every((m) => m.type === 'transfer')).toBe(true);
    });

    it('refuses a transfer to the same warehouse, or of a non-positive quantity', async () => {
      await seedStock(flourItem, 1000, MAIN);

      await expect(
        stockService.transfer(bakeryId, 'ingredient_harina', {
          qty: 10,
          fromWarehouseId: MAIN,
          toWarehouseId: MAIN,
        }),
      ).rejects.toThrow(/distintos/);

      await expect(
        stockService.transfer(bakeryId, 'ingredient_harina', {
          qty: -10,
          fromWarehouseId: MAIN,
          toWarehouseId: BRANCH,
        }),
      ).rejects.toThrow(/positiva/);

      expect((await col('stockMovements').get()).size).toBe(0);
    });

    it('moves the stock once when the same retry key arrives twice', async () => {
      await seedStock(flourItem, 1000, MAIN);

      const body = {
        qty: 300,
        fromWarehouseId: MAIN,
        toWarehouseId: BRANCH,
        idempotencyKey: 'form-open-abc123',
      };

      const first = await stockService.transfer(bakeryId, 'ingredient_harina', body);
      const retry = await stockService.transfer(bakeryId, 'ingredient_harina', body);

      expect((await readStock(flourItem, MAIN)).currentStock).toBe(700);
      expect((await readStock(flourItem, BRANCH)).currentStock).toBe(300);
      expect((await col('stockMovements').get()).size).toBe(2);

      // The retry is indistinguishable from the first call to its caller.
      expect(retry.map((m) => m.id).sort()).toEqual(first.map((m) => m.id).sort());
    });

    it('refuses a destination the bakery never declared', async () => {
      await seedStock(flourItem, 1000, MAIN);

      await expect(
        stockService.transfer(bakeryId, 'ingredient_harina', {
          qty: 10,
          fromWarehouseId: MAIN,
          toWarehouseId: 'bodega-fantasma',
        }),
      ).rejects.toThrow(/Bodega desconocida/);

      // Nothing was debited: the typo cannot strand stock in a doc no one reads.
      expect((await readStock(flourItem, MAIN)).currentStock).toBe(1000);
      expect((await col('stockMovements').get()).size).toBe(0);
    });

    it('refuses to transfer out of a warehouse that holds nothing of the item', async () => {
      await seedStock(flourItem, 1000, MAIN);

      await expect(
        stockService.transfer(bakeryId, 'ingredient_harina', {
          qty: 10,
          fromWarehouseId: BRANCH,
          toWarehouseId: MAIN,
        }),
      ).rejects.toThrow(/not found/i);
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
      // Only the default warehouse: the others are born from their first
      // movement (CORRECTIONS §1.2).
      expect(stocks.map((s) => s.id).sort()).toEqual([
        'product_coke_c1l__main',
        'product_coke_c350__main',
      ]);
    });

    it('gives a recipe-mode product a stocks doc too (§2.3 amends §5)', async () => {
      await productService.create(
        {
          id: 'panDeBono',
          name: 'pan de bono',
          basePrice: 2000,
          inventoryMode: 'recipe',
        },
        bakeryId,
      );

      const stocks = await stockService.getStocks(bakeryId);
      expect(stocks.map((s) => s.itemKey)).toEqual(['product_panDeBono']);
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
        isResale: false,
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
      expect(stocks[0]).toMatchObject({
        id: 'ingredient_crema__main',
        itemKey: 'ingredient_crema',
        warehouseId: 'main',
        unit: 'g',
      });
    });
  });

  describe('read paths (1B.3)', () => {
    it('returns an order\'s movements', async () => {
      await seedStock(flourItem, 1000);

      await stockService.writeMovements(bakeryId, [
        { item: flourItem, warehouseId: MAIN, qty: -10, type: 'sale', refs: { orderId: 'o1' } },
        { item: flourItem, warehouseId: MAIN, qty: -20, type: 'sale', refs: { orderId: 'o2' } },
      ]);

      const movements = await stockService.getOrderMovements(bakeryId, 'o1');
      expect(movements).toHaveLength(1);
      expect(movements[0].qty).toBe(-10);
    });

    it('lists one row per warehouse, and filters to one on request', async () => {
      await seedStock(flourItem, 1000, MAIN);
      await seedStock(flourItem, 25, BRANCH);

      expect(await stockService.getStocks(bakeryId)).toHaveLength(2);

      const branchOnly = await stockService.getStocks(bakeryId, { warehouseId: BRANCH });
      expect(branchOnly).toHaveLength(1);
      expect(branchOnly[0].currentStock).toBe(25);
    });

    it('shows an item\'s history across every warehouse it sits in', async () => {
      await seedStock(flourItem, 1000, MAIN);
      await seedStock(flourItem, 25, BRANCH);

      await stockService.writeMovements(bakeryId, [
        { item: flourItem, warehouseId: MAIN, qty: -10, type: 'sale' },
        { item: flourItem, warehouseId: BRANCH, qty: -5, type: 'sale' },
      ]);

      const movements = await stockService.getItemMovements(bakeryId, 'ingredient_harina');
      expect(movements).toHaveLength(2);
      expect(movements.map((m) => m.warehouseId).sort()).toEqual([MAIN, BRANCH].sort());
    });
  });
});
