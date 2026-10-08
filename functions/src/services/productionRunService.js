const { db } = require('../config/firebase');
const ProductionRun = require('../models/ProductionRun');
const createBaseService = require('./base/serviceFactory');
const recordHistory = require('./base/recordHistory');
const { BadRequestError, NotFoundError } = require('../utils/errors');
const {
  MOVEMENT_TYPES,
  ITEM_TYPES,
  buildItemKey,
  resolveWarehouseId,
  writeMovements,
  toStockItem,
  retryId,
  expandRecipe,
  getMovementsByRefs,
  reverseMovements,
} = require('./stockService');

/**
 * Production runs: what the counter sends to the kitchen to make for the
 * vitrina. Sending writes no movements; its pending lines are stock on its way.
 * Receiving one line adds the output and consumes its recipe, in one
 * transaction. See inventory-next-steps.md §4.
 */
const createProductionRunService = () => {
  const baseService = createBaseService('productionRuns', ProductionRun, 'bakeries/{bakeryId}');

  const ingredientsRef = (bakeryId) => db.collection(`bakeries/${bakeryId}/ingredients`);
  const productsRef = (bakeryId) => db.collection(`bakeries/${bakeryId}/products`);

  const editorOf = (user) => ({ userId: user?.uid, email: user?.email, role: user?.role });

  // Each preview line walks the recipe graph: a ceiling on how many one call walks.
  const MAX_PREVIEW_LINES = 100;

  /* Who changed which line, and from what. Receiving is traced by its movements
   * and `receivedBy`; undo, cancel and quantity edits are traced here, in the
   * same updateHistory subcollection every other document uses. */
  const recordLineChange = (t, runRef, line, change, user) =>
    recordHistory(t, runRef, { line: { id: line.id, name: line.name, ...change } }, null, user);

  /** Refuses an output with no stock row to land in; else what the kitchen list shows. */
  const describeOutput = (line, doc, i) => {
    const where = `Línea ${i + 1}`;
    if (!doc.exists || doc.data().isDeleted) {
      throw new BadRequestError(`${where}: el ítem no existe`);
    }
    const data = doc.data();

    if (line.item.type === ITEM_TYPES.INGREDIENT) {
      if (data.stockBehavior !== 'stocked') {
        throw new BadRequestError(`${where}: ${data.name} no lleva inventario`);
      }
      return { name: data.name, unit: data.unit || '', collectionName: 'Preparaciones' };
    }

    if (data.inventoryMode === 'unit') {
      throw new BadRequestError(`${where}: ${data.name} se compra, no se produce`);
    }
    if (data.inventoryMode !== 'recipe') {
      throw new BadRequestError(`${where}: ${data.name} no lleva inventario`);
    }

    // A product with variations keeps one stock row per combination.
    const combinations = data.variations?.combinations || [];
    const collectionName = data.collectionName || '';
    if (data.hasVariations && combinations.length) {
      const combination = combinations.find((c) => c.id === line.item.combinationId);
      if (!combination) {
        throw new BadRequestError(`${where}: elige la variación de ${data.name}`);
      }
      return { name: `${data.name} ${combination.name}`.trim(), unit: 'uds', collectionName };
    }
    if (line.item.combinationId) {
      throw new BadRequestError(`${where}: ${data.name} no tiene variaciones`);
    }
    return { name: data.name, unit: 'uds', collectionName };
  };

  const create = async (data, bakeryId, user = null) => {
    const warehouseId = await resolveWarehouseId(bakeryId, data.warehouseId);

    // Only identity and quantity come from the client: a new line is pending.
    const draft = new ProductionRun({
      bakeryId,
      date: data.date || new Date(),
      warehouseId,
      lines: (Array.isArray(data.lines) ? data.lines : [])
        .map((l) => ({ item: l?.item, plannedQty: l?.plannedQty })),
      createdBy: editorOf(user),
    });
    draft.validate();

    const outputDocs = await Promise.all(draft.lines.map((line) =>
      (line.item.type === ITEM_TYPES.INGREDIENT ? ingredientsRef : productsRef)(bakeryId)
        .doc(line.item.id).get()));
    const lines = draft.lines.map((line, i) => ({
      ...line,
      ...describeOutput(line, outputDocs[i], i),
    }));

    const runsRef = baseService.getCollectionRef(bakeryId);
    const id = retryId(data.idempotencyKey, 'run');
    const runRef = id ? runsRef.doc(id) : runsRef.doc();

    return db.runTransaction(async (t) => {
      const existing = await t.get(runRef);
      if (existing.exists) return ProductionRun.fromFirestore(existing);

      const run = new ProductionRun({ ...draft, lines, id: runRef.id });
      t.set(runRef, run.toFirestore());
      return run;
    });
  };

  /** What each line would add and consume. Writes nothing. */
  const preview = async (bakeryId, { lines = [] } = {}) => {
    if (!Array.isArray(lines)) throw new BadRequestError('lines debe ser una lista');
    if (lines.length > MAX_PREVIEW_LINES) {
      throw new BadRequestError(`Máximo ${MAX_PREVIEW_LINES} líneas por vista previa`);
    }

    return Promise.all(lines.map(async (l) => {
      const item = l?.item;
      const qty = Number(l?.plannedQty);
      const validType = item?.type === ITEM_TYPES.INGREDIENT || item?.type === ITEM_TYPES.PRODUCT;
      if (!validType || !item?.id || !(qty > 0)) {
        throw new BadRequestError('Cada línea necesita un ítem válido y una cantidad mayor a 0');
      }
      const { name, unit, components, gaps } = await expandRecipe(bakeryId, item, qty);
      return { item, plannedQty: qty, name, unit, components, gaps };
    }));
  };

  const readRun = async (bakeryId, runId) => {
    const doc = await baseService.getCollectionRef(bakeryId).doc(runId).get();
    if (!doc.exists) throw new NotFoundError('Producción no encontrada');
    return ProductionRun.fromFirestore(doc);
  };

  const findLine = (run, lineId) => {
    const line = run.lines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundError('Línea de producción no encontrada');
    return line;
  };

  /**
   * Received at its planned quantity: + the output, − its recipe's components.
   * The walk runs before the transaction (invariant 4); the transaction re-reads
   * the run, so a line received twice moves stock once. Gaps never block: the
   * output still lands, a recipe-less part just isn't deducted.
   */
  const receiveLine = async (bakeryId, runId, lineId, user = null) => {
    const before = await readRun(bakeryId, runId);
    const planned = findLine(before, lineId);
    if (planned.status !== 'pending') return before;

    const { name, unit, components } = await expandRecipe(bakeryId, planned.item, planned.plannedQty);
    const runRef = baseService.getCollectionRef(bakeryId).doc(runId);
    const editor = editorOf(user);

    return db.runTransaction(async (t) => {
      const run = ProductionRun.fromFirestore(await t.get(runRef));
      const line = findLine(run, lineId);
      if (line.status !== 'pending') return run;
      // The components were measured for `planned.plannedQty`. An edit since
      // then would book the output at one quantity and consume for another.
      if (line.plannedQty !== planned.plannedQty) {
        throw new BadRequestError('La cantidad cambió, intenta de nuevo');
      }

      // Each receipt has its own ids: after an undo, the same fixed ids would be
      // skipped as "already written" and the second receipt would move nothing.
      const receiptNo = line.receiptNo + 1;
      const refs = { productionRunId: runId, lineId, receipt: receiptNo };
      const movement = (item, qty, itemName, itemUnit) => {
        const stockItem = toStockItem(item);
        return {
          id: `run_${runId}_${lineId}_${receiptNo}_${buildItemKey(stockItem)}`,
          item: stockItem,
          warehouseId: run.warehouseId,
          qty,
          type: MOVEMENT_TYPES.PRODUCTION,
          refs,
          editor,
          name: itemName,
          unit: itemUnit,
        };
      };

      await writeMovements(bakeryId, [
        movement(line.item, line.plannedQty, name, unit),
        ...components.map((c) => movement(c.item, -c.qty, c.name, c.unit)),
      ], { transaction: t });

      const received = new ProductionRun({
        ...run,
        lines: run.lines.map((l) => (l.id === lineId
          ? { ...l, status: 'received', receivedQty: l.plannedQty, receivedAt: new Date(), receivedBy: editor, receiptNo }
          : l)),
        updatedAt: new Date(),
      });
      t.set(runRef, received.toFirestore());
      return received;
    });
  };

  /**
   * A produced line goes back to pending, and the bodega goes back with it: the
   * opposite of exactly what that receipt wrote, read from the ledger (not
   * rebuilt from a recipe that may have changed since). Nothing is deleted;
   * the correction is new `compensation` movements. Stock may end negative.
   */
  const undoLine = async (bakeryId, runId, lineId, user = null) => {
    const runRef = baseService.getCollectionRef(bakeryId).doc(runId);
    const editor = editorOf(user);

    return db.runTransaction(async (t) => {
      const doc = await t.get(runRef);
      if (!doc.exists) throw new NotFoundError('Producción no encontrada');
      const run = ProductionRun.fromFirestore(doc);
      const line = findLine(run, lineId);
      if (line.status !== 'received') {
        throw new BadRequestError('Solo se puede deshacer una línea producida');
      }

      // A receipt from before receipts were counted has no number on its
      // movements: there was only ever one.
      const refs = { productionRunId: runId, lineId };
      if (line.receiptNo) refs.receipt = line.receiptNo;
      const written = await getMovementsByRefs(bakeryId, refs, {
        type: MOVEMENT_TYPES.PRODUCTION,
        transaction: t,
      });
      // Every receipt writes at least its output. A counted receipt with nothing
      // in the ledger is broken data: going back to pending would leave its
      // stock in the bodega with nothing to show why.
      if (line.receiptNo && !written.length) {
        throw new BadRequestError('No se encontraron los movimientos de esta producción');
      }

      await reverseMovements(bakeryId, written, {
        idFor: (m) => `undo_${m.id}`,
        refs: { ...refs, receipt: line.receiptNo },
        editor,
        transaction: t,
      });

      const undone = new ProductionRun({
        ...run,
        lines: run.lines.map((l) => (l.id === lineId
          ? { ...l, status: 'pending', receivedQty: null, receivedAt: null, receivedBy: null }
          : l)),
        updatedAt: new Date(),
      });
      t.set(runRef, undone.toFirestore());
      recordLineChange(t, runRef, line, {
        status: { from: 'received', to: 'pending' },
        receipt: line.receiptNo,
        receivedBy: line.receivedBy,
      }, user);
      return undone;
    });
  };

  /** A pending line the kitchen won't make. No movements. */
  const cancelLine = async (bakeryId, runId, lineId, user = null) => {
    const runRef = baseService.getCollectionRef(bakeryId).doc(runId);

    return db.runTransaction(async (t) => {
      const doc = await t.get(runRef);
      if (!doc.exists) throw new NotFoundError('Producción no encontrada');
      const run = ProductionRun.fromFirestore(doc);
      const line = findLine(run, lineId);
      if (line.status !== 'pending') return run;

      const cancelled = new ProductionRun({
        ...run,
        lines: run.lines.map((l) => (l.id === lineId ? { ...l, status: 'cancelled' } : l)),
        updatedAt: new Date(),
      });
      t.set(runRef, cancelled.toFirestore());
      recordLineChange(t, runRef, line, { status: { from: 'pending', to: 'cancelled' } }, user);
      return cancelled;
    });
  };

  /**
   * What the kitchen is asked to make. A pending line only: once received, its
   * stock has moved and the number is a fact. Refused (not ignored), so the
   * screen can tell the edit did not happen.
   */
  const updateLine = async (bakeryId, runId, lineId, { plannedQty } = {}, user = null) => {
    const qty = Number(plannedQty);
    if (!(qty > 0)) throw new BadRequestError('La cantidad debe ser mayor a 0');

    const runRef = baseService.getCollectionRef(bakeryId).doc(runId);

    return db.runTransaction(async (t) => {
      const doc = await t.get(runRef);
      if (!doc.exists) throw new NotFoundError('Producción no encontrada');
      const run = ProductionRun.fromFirestore(doc);
      const line = findLine(run, lineId);
      if (line.status !== 'pending') {
        throw new BadRequestError('Solo se puede editar una línea pendiente');
      }

      const updated = new ProductionRun({
        ...run,
        lines: run.lines.map((l) => (l.id === lineId ? { ...l, plannedQty: qty } : l)),
        updatedAt: new Date(),
      });
      t.set(runRef, updated.toFirestore());
      if (line.plannedQty !== qty) {
        recordLineChange(t, runRef, line, { plannedQty: { from: line.plannedQty, to: qty } }, user);
      }
      return updated;
    });
  };

  // A run changes one line at a time (receive, cancel, edit the quantity); there
  // is no whole-run update or remove.
  return {
    getCollectionRef: baseService.getCollectionRef,
    getAll: baseService.getAll,
    getById: baseService.getById,
    create,
    preview,
    receiveLine,
    undoLine,
    cancelLine,
    updateLine,
  };
};

module.exports = createProductionRunService();
