const { initializeFirebase, clearFirestoreData } = require('../setup/firebase');

// Production runs and the deduction walk they receive through.
// See bake-ry-front zplanning/inventory/INVENTORY.md §3 and §4.2.
describe('Production runs', () => {
  let db;
  let stockService;
  let runService;
  const bakeryId = 'test-bakery';
  const user = { uid: 'u1', email: 'cocina@test.com', role: 'production_assistant' };

  const col = (name) => db.collection(`bakeries/${bakeryId}/${name}`);

  const seedIngredient = (id, data = {}) =>
    col('ingredients').doc(id).set({
      name: id,
      unit: 'g',
      costPerUnit: 1,
      usedInRecipes: [],
      stockBehavior: 'stocked',
      recipeId: null,
      isDeleted: false,
      ...data,
    });

  const seedProduct = (id, data = {}) =>
    col('products').doc(id).set({
      name: id,
      hasVariations: false,
      inventoryMode: 'recipe',
      recipeId: null,
      isDeleted: false,
      ...data,
    });

  const seedRecipe = (id, ingredients, data = {}) =>
    col('recipes').doc(id).set({ name: id, ingredients, isDeleted: false, ...data });

  const ing = (id, quantity) => ({ type: 'ingredient', id, quantity });
  const prod = (id, quantity, combinationId = null) => ({ type: 'product', id, quantity, combinationId });

  const stockOf = async (itemKey) => {
    const doc = await col('stocks').doc(`${itemKey}__main`).get();
    return doc.exists ? doc.data().currentStock : null;
  };

  const qtyOf = (result, id) => result.components.find((c) => c.item.id === id)?.qty;

  /* torta (recipe product): 100 harina, 50 crema, 2 croissants per torta.
   * crema is a passThrough preparación: 1000 g from 800 leche + 200 azúcar.
   * croissant is itself a tracked product with its own recipe (harina). */
  const seedTorta = async () => {
    await seedIngredient('harina');
    await seedIngredient('leche', { unit: 'ml' });
    await seedIngredient('azucar');
    await seedIngredient('crema', { stockBehavior: 'passThrough', recipeId: 'r-crema' });
    await seedRecipe('r-crema', [ing('leche', 800), ing('azucar', 200)], { ingredientId: 'crema', yield: 1000 });
    await seedProduct('croissant', { recipeId: 'r-croissant' });
    await seedRecipe('r-croissant', [ing('harina', 60)], { productId: 'croissant' });
    await seedProduct('torta', { recipeId: 'r-torta' });
    await seedRecipe('r-torta', [ing('harina', 100), ing('crema', 50), prod('croissant', 2)], { productId: 'torta' });
  };

  beforeAll(() => {
    ({ db } = initializeFirebase());
    stockService = require('../../services/stockService');
    runService = require('../../services/productionRunService');
  });

  beforeEach(async () => {
    await clearFirestoreData(db);
    await col('settings').doc('default').set({
      features: {
        inventory: { enabled: true, warehouses: [{ id: 'main', name: 'Principal', isDefault: true }] },
      },
    });
  });

  describe('expandRecipe', () => {
    it('walks preparaciones down to stocked ingredients, scaled by yield', async () => {
      await seedTorta();

      const result = await stockService.expandRecipe(bakeryId, { type: 'product', id: 'torta' }, 3);

      expect(result.name).toBe('torta');
      expect(qtyOf(result, 'harina')).toBe(300); // never the croissants' harina
      expect(qtyOf(result, 'leche')).toBeCloseTo(120); // 150 g crema × 800/1000
      expect(qtyOf(result, 'azucar')).toBeCloseTo(30);
      expect(qtyOf(result, 'crema')).toBeUndefined();
      expect(result.gaps).toEqual([]);
    });

    it('takes a tracked product used as a component from its own stock', async () => {
      await seedTorta();

      const result = await stockService.expandRecipe(bakeryId, { type: 'product', id: 'torta' }, 3);

      expect(qtyOf(result, 'croissant')).toBe(6);
    });

    it('deducts nothing for a passThrough ingredient with no recipe, and is not a gap', async () => {
      await seedIngredient('agua', { stockBehavior: 'passThrough' });
      await seedIngredient('harina');
      await seedProduct('pan', { recipeId: 'r-pan' });
      await seedRecipe('r-pan', [ing('agua', 50), ing('harina', 100)], { productId: 'pan' });

      const result = await stockService.expandRecipe(bakeryId, { type: 'product', id: 'pan' }, 1);

      expect(result.components.map((c) => c.item.id)).toEqual(['harina']);
      expect(result.gaps).toEqual([]);
    });

    it('deducts nothing for an untracked product component', async () => {
      await seedIngredient('harina');
      await seedProduct('vela', { inventoryMode: 'none' });
      await seedProduct('torta', { recipeId: 'r-torta' });
      await seedRecipe('r-torta', [ing('harina', 100), prod('vela', 1)], { productId: 'torta' });

      const result = await stockService.expandRecipe(bakeryId, { type: 'product', id: 'torta' }, 1);

      expect(result.components.map((c) => c.item.id)).toEqual(['harina']);
    });

    it("never falls back to the product's recipe for a combination without one", async () => {
      await seedIngredient('harina');
      await seedRecipe('r-pan', [ing('harina', 100)], { productId: 'pan' });
      await seedProduct('pan', {
        recipeId: 'r-pan',
        hasVariations: true,
        variations: { combinations: [{ id: 'grande', name: 'Grande', recipeId: null }] },
      });

      const result = await stockService.expandRecipe(
        bakeryId, { type: 'product', id: 'pan', combinationId: 'grande' }, 1);

      expect(result.components).toEqual([]);
      expect(result.gaps).toEqual([
        expect.objectContaining({ reason: 'missingRecipe', name: 'pan Grande' }),
      ]);
    });

    it('stops at the depth guard with a gap', async () => {
      // p0 → p1 → … → p7, each a passThrough preparación made from the next.
      for (let i = 0; i < 8; i += 1) {
        await seedIngredient(`p${i}`, { stockBehavior: 'passThrough', recipeId: `r-p${i}` });
        await seedRecipe(`r-p${i}`, [ing(`p${i + 1}`, 1)], { ingredientId: `p${i}`, yield: 1 });
      }
      await seedProduct('torre', { recipeId: 'r-torre' });
      await seedRecipe('r-torre', [ing('p0', 1)], { productId: 'torre' });

      const result = await stockService.expandRecipe(bakeryId, { type: 'product', id: 'torre' }, 1);

      expect(result.gaps.some((g) => g.reason === 'depthExceeded')).toBe(true);
    });
  });

  describe('runs', () => {
    const tortaLine = (plannedQty = 3) => ({ item: { type: 'product', id: 'torta' }, plannedQty });

    it("refuses an output that has nowhere to land", async () => {
      await seedProduct('vela', { inventoryMode: 'none' });
      await seedProduct('coke', { inventoryMode: 'unit' });

      await expect(runService.create(
        { lines: [{ item: { type: 'product', id: 'vela' }, plannedQty: 1 }] }, bakeryId, user,
      )).rejects.toThrow(/no lleva inventario/);
      await expect(runService.create(
        { lines: [{ item: { type: 'product', id: 'coke' }, plannedQty: 1 }] }, bakeryId, user,
      )).rejects.toThrow(/se compra/);
    });

    it('creates a run with pending lines and no movements, idempotently', async () => {
      await seedTorta();

      const first = await runService.create({ lines: [tortaLine()], idempotencyKey: 'k1' }, bakeryId, user);
      const second = await runService.create({ lines: [tortaLine()], idempotencyKey: 'k1' }, bakeryId, user);

      expect(second.id).toBe(first.id);
      expect(first.status).toBe('open');
      expect(first.lines[0].status).toBe('pending');
      expect((await col('productionRuns').get()).size).toBe(1);
      expect((await col('stockMovements').get()).size).toBe(0);
    });

    it('refuses a retry that reuses the key with different content, and an infinite quantity', async () => {
      await seedTorta();
      await runService.create({ lines: [tortaLine(3)], idempotencyKey: 'k2' }, bakeryId, user);

      await expect(
        runService.create({ lines: [tortaLine(5)], idempotencyKey: 'k2' }, bakeryId, user),
      ).rejects.toThrow(/otros datos/);
      await expect(
        runService.create({ lines: [tortaLine(Infinity)] }, bakeryId, user),
      ).rejects.toThrow(/cantidad/);
      expect((await col('productionRuns').get()).size).toBe(1);
    });

    it('previews without writing anything', async () => {
      await seedTorta();

      const [line] = await runService.preview(bakeryId, { lines: [tortaLine()] });

      expect(qtyOf(line, 'harina')).toBe(300);
      expect((await col('stockMovements').get()).size).toBe(0);
      expect((await col('stocks').get()).size).toBe(0);
    });

    it('receives a line: + output, − exactly what the preview said, once', async () => {
      await seedTorta();
      const [preview] = await runService.preview(bakeryId, { lines: [tortaLine()] });
      const run = await runService.create({ lines: [tortaLine()] }, bakeryId, user);
      const lineId = run.lines[0].id;

      const received = await runService.receiveLine(bakeryId, run.id, lineId, user);
      await runService.receiveLine(bakeryId, run.id, lineId, user);

      expect(received.lines[0]).toMatchObject({ status: 'received', receivedQty: 3 });
      expect(received.status).toBe('closed');
      expect(await stockOf('product_torta')).toBe(3);
      for (const c of preview.components) {
        expect(await stockOf(stockService.buildItemKey(stockService.toStockItem(c.item))))
          .toBeCloseTo(-c.qty);
      }

      const movements = (await col('stockMovements').get()).docs.map((d) => d.data());
      expect(movements).toHaveLength(1 + preview.components.length);
      expect(movements.every((m) => m.type === 'production'
        && m.refs.productionRunId === run.id && m.refs.lineId === lineId)).toBe(true);
    });

    it('refuses a bodega the bakery never declared', async () => {
      await seedTorta();

      await expect(runService.create(
        { warehouseId: 'bodega-fantasma', lines: [tortaLine()] }, bakeryId, user,
      )).rejects.toThrow(/Bodega desconocida/);
      expect((await col('productionRuns').get()).size).toBe(0);
    });

    it('receives a stocked preparación: + its output, − its recipe scaled by the yield', async () => {
      await seedIngredient('harina');
      await seedIngredient('masa', { stockBehavior: 'stocked', recipeId: 'r-masa' });
      await seedRecipe('r-masa', [ing('harina', 500)], { ingredientId: 'masa', yield: 1000 });

      const run = await runService.create(
        { lines: [{ item: { type: 'ingredient', id: 'masa' }, plannedQty: 2000 }] }, bakeryId, user,
      );
      await runService.receiveLine(bakeryId, run.id, run.lines[0].id, user);

      expect(await stockOf('ingredient_masa')).toBe(2000);
      expect(await stockOf('ingredient_harina')).toBe(-1000);
    });

    it('receives a combination output into that combination, from its own recipe', async () => {
      await seedIngredient('harina');
      await seedProduct('pan', {
        hasVariations: true,
        variations: { combinations: [{ id: 'grande', name: 'Grande', recipeId: 'r-pan-grande' }] },
      });
      await seedRecipe('r-pan-grande', [ing('harina', 100)], { productId: 'pan', combinationId: 'grande' });

      const run = await runService.create(
        { lines: [{ item: { type: 'product', id: 'pan', combinationId: 'grande' }, plannedQty: 3 }] },
        bakeryId, user,
      );
      await runService.receiveLine(bakeryId, run.id, run.lines[0].id, user);

      expect(await stockOf('product_pan_grande')).toBe(3);
      expect(await stockOf('product_pan')).toBeNull();
      expect(await stockOf('ingredient_harina')).toBe(-300);
    });

    it('cancels a pending line without moving stock, and closes the run when none is pending', async () => {
      await seedTorta();
      const run = await runService.create({ lines: [tortaLine(1), tortaLine(2)] }, bakeryId, user);
      const [a, b] = run.lines;

      const afterCancel = await runService.cancelLine(bakeryId, run.id, a.id);
      expect(afterCancel.lines[0].status).toBe('cancelled');
      expect(afterCancel.status).toBe('open');
      expect((await col('stockMovements').get()).size).toBe(0);

      // A cancelled line can't be received.
      await runService.receiveLine(bakeryId, run.id, a.id, user);
      expect((await col('stockMovements').get()).size).toBe(0);

      const closed = await runService.receiveLine(bakeryId, run.id, b.id, user);
      expect(closed.status).toBe('closed');
      expect(await stockOf('product_torta')).toBe(2);
    });

    it('edits the planned quantity of a pending line only, and receives the new number', async () => {
      await seedTorta();
      const run = await runService.create({ lines: [tortaLine(3), tortaLine(5)] }, bakeryId, user);
      const [a, b] = run.lines;

      const edited = await runService.updateLine(bakeryId, run.id, a.id, { plannedQty: 4 });
      expect(edited.lines.map((l) => l.plannedQty)).toEqual([4, 5]);
      expect((await col('stockMovements').get()).size).toBe(0);

      await runService.receiveLine(bakeryId, run.id, a.id, user);
      expect(await stockOf('product_torta')).toBe(4);

      // Received and cancelled lines are facts now: refused, and nothing changes.
      await expect(runService.updateLine(bakeryId, run.id, a.id, { plannedQty: 9 }))
        .rejects.toThrow(/pendiente/);
      await runService.cancelLine(bakeryId, run.id, b.id);
      await expect(runService.updateLine(bakeryId, run.id, b.id, { plannedQty: 9 }))
        .rejects.toThrow(/pendiente/);

      const stored = (await col('productionRuns').doc(run.id).get()).data();
      expect(stored.lines.map((l) => l.plannedQty)).toEqual([4, 5]);
    });

    it('refuses a receipt when the quantity was edited after the recipe was measured', async () => {
      await seedTorta();
      const run = await runService.create({ lines: [tortaLine(3)] }, bakeryId, user);
      const runRef = col('productionRuns').doc(run.id);

      // The edit lands between the walk (outside) and the receipt (inside).
      const original = db.runTransaction.bind(db);
      db.runTransaction = async (fn) => {
        db.runTransaction = original;
        const stored = (await runRef.get()).data();
        await runRef.update({ lines: stored.lines.map((l) => ({ ...l, plannedQty: 9 })) });
        return original(fn);
      };

      try {
        await expect(runService.receiveLine(bakeryId, run.id, run.lines[0].id, user))
          .rejects.toThrow(/cambió/);
      } finally {
        db.runTransaction = original;
      }
      expect((await col('stockMovements').get()).size).toBe(0);

      // Retried, it measures the new quantity and books it.
      await runService.receiveLine(bakeryId, run.id, run.lines[0].id, user);
      expect(await stockOf('product_torta')).toBe(9);
      expect(await stockOf('ingredient_harina')).toBe(-900);
    });

    it('records who edited, cancelled and undid a line', async () => {
      await seedTorta();
      const run = await runService.create({ lines: [tortaLine(3), tortaLine(5)] }, bakeryId, user);
      const [a, b] = run.lines;

      await runService.updateLine(bakeryId, run.id, a.id, { plannedQty: 4 }, user);
      await runService.cancelLine(bakeryId, run.id, b.id, user);
      await runService.receiveLine(bakeryId, run.id, a.id, user);
      await runService.undoLine(bakeryId, run.id, a.id, user);

      const history = (await col('productionRuns').doc(run.id).collection('updateHistory').get())
        .docs.map((d) => d.data());
      expect(history).toHaveLength(3);
      expect(history.every((h) => h.editor.email === user.email)).toBe(true);

      const changes = history.map((h) => h.changes.line);
      expect(changes).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: a.id, plannedQty: { from: 3, to: 4 } }),
        expect.objectContaining({ id: b.id, status: { from: 'pending', to: 'cancelled' } }),
        expect.objectContaining({ id: a.id, status: { from: 'received', to: 'pending' }, receipt: 1 }),
      ]));
    });

    it('previews only known item types, and refuses a null line', async () => {
      await expect(runService.preview(bakeryId, {
        lines: [{ item: { type: 'pastry', id: 'x' }, plannedQty: 1 }],
      })).rejects.toThrow(/ítem válido/);
      await expect(runService.preview(bakeryId, { lines: [null] })).rejects.toThrow(/ítem válido/);
      await expect(runService.create({ lines: [null] }, bakeryId, user)).rejects.toThrow(/Línea 1/);
    });

    it('refuses an edit to zero, a negative or a non-number', async () => {
      await seedTorta();
      const run = await runService.create({ lines: [tortaLine(3)] }, bakeryId, user);

      for (const plannedQty of [0, -2, 'abc', undefined]) {
        await expect(runService.updateLine(bakeryId, run.id, run.lines[0].id, { plannedQty }))
          .rejects.toThrow(/mayor a 0/);
      }
      const stored = (await col('productionRuns').doc(run.id).get()).data();
      expect(stored.lines[0].plannedQty).toBe(3);
    });

    describe('undo', () => {
      const KEYS = [
        'product_torta',
        'ingredient_harina',
        'ingredient_leche',
        'ingredient_azucar',
        'product_croissant',
      ];
      const snapshot = () => Promise.all(KEYS.map(stockOf));

      it('puts a produced line back to pending and the bodega back with it, and the line can be received again', async () => {
        await seedTorta();
        const run = await runService.create({ lines: [tortaLine(3)] }, bakeryId, user);
        const lineId = run.lines[0].id;

        await runService.receiveLine(bakeryId, run.id, lineId, user);
        const produced = await snapshot();
        expect(produced[0]).toBe(3);
        expect(produced[1]).toBe(-300);

        const undone = await runService.undoLine(bakeryId, run.id, lineId, user);
        expect(undone.lines[0]).toMatchObject({ status: 'pending', receivedQty: null, receiptNo: 1 });
        expect(undone.status).toBe('open');
        (await snapshot()).forEach((qty) => expect(qty).toBeCloseTo(0));

        // The second receipt has its own ids. With the first receipt's ids it
        // would be skipped as already written, and move nothing.
        await runService.receiveLine(bakeryId, run.id, lineId, user);
        expect(await stockOf('product_torta')).toBe(3);
        expect(await stockOf('ingredient_harina')).toBe(-300);

        // Undoing it again reverses only the second receipt.
        await runService.undoLine(bakeryId, run.id, lineId, user);
        (await snapshot()).forEach((qty) => expect(qty).toBeCloseTo(0));

        // Nothing was deleted: both receipts and both reversals are in the ledger.
        const movements = (await col('stockMovements').get()).docs.map((d) => d.data());
        expect(movements.filter((m) => m.type === 'production')).toHaveLength(10);
        const reversals = movements.filter((m) => m.type === 'compensation');
        expect(reversals).toHaveLength(10);
        expect([...new Set(reversals.map((m) => m.refs.receipt))].sort()).toEqual([1, 2]);
      });

      it('only undoes a produced line', async () => {
        await seedTorta();
        const run = await runService.create({ lines: [tortaLine(1), tortaLine(2)] }, bakeryId, user);
        const [a, b] = run.lines;

        await expect(runService.undoLine(bakeryId, run.id, a.id, user)).rejects.toThrow(/producida/);
        await runService.cancelLine(bakeryId, run.id, b.id);
        await expect(runService.undoLine(bakeryId, run.id, b.id, user)).rejects.toThrow(/producida/);
        expect((await col('stockMovements').get()).size).toBe(0);
      });

      it('refuses to undo a counted receipt whose movements are missing', async () => {
        await seedTorta();
        const run = await runService.create({ lines: [tortaLine(2)] }, bakeryId, user);
        const lineId = run.lines[0].id;
        await runService.receiveLine(bakeryId, run.id, lineId, user);

        const written = await col('stockMovements').get();
        await Promise.all(written.docs.map((d) => d.ref.delete()));

        await expect(runService.undoLine(bakeryId, run.id, lineId, user))
          .rejects.toThrow(/No se encontraron/);
        const stored = (await col('productionRuns').doc(run.id).get()).data();
        expect(stored.lines[0].status).toBe('received');
      });

      it('undoes a receipt written before receipts were counted', async () => {
        await seedTorta();
        const run = await runService.create({ lines: [tortaLine(2)] }, bakeryId, user);
        const lineId = run.lines[0].id;
        await runService.receiveLine(bakeryId, run.id, lineId, user);

        // Rewrite the run and its movements the way they were stored before.
        const runRef = col('productionRuns').doc(run.id);
        const stored = (await runRef.get()).data();
        await runRef.update({
          lines: stored.lines.map(({ receiptNo, ...legacy }) => legacy),
        });
        // Movements then had no receipt number in their ids or refs.
        const written = await col('stockMovements').get();
        await Promise.all(written.docs.map(async (d) => {
          const data = d.data();
          await col('stockMovements').doc(`run_${run.id}_${lineId}_${data.itemKey}`).set({
            ...data,
            refs: { productionRunId: run.id, lineId },
          });
          await d.ref.delete();
        }));

        await runService.undoLine(bakeryId, run.id, lineId, user);
        (await snapshot()).forEach((qty) => expect(qty).toBeCloseTo(0));

        await runService.receiveLine(bakeryId, run.id, lineId, user);
        expect(await stockOf('product_torta')).toBe(2);
      });
    });
  });
});
