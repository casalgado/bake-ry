// services/stockService.js
//
// The stock ledger (bake-ry-front zplanning/inventory/INVENTORY.md §2).
//
// `stockMovements` is the system of record; a `stocks` doc is a derived,
// disposable cache of one item's current quantity. If every stocks doc were
// deleted, all of them could be rebuilt from the ledger — never the reverse.
//
// NON-NEGOTIABLE, in order of how badly breaking them corrupts data:
//   1. Movements are append-only. Nothing updates or deletes one. Corrections
//      are new movements. There are deliberately no update/delete endpoints.
//   2. Every movement write goes through writeMovements(). Never write a
//      movement doc or touch a stocks doc's currentStock anywhere else. The only
//      other stocks writes are a doc's first seed (syncStockDoc) and a count
//      setting the baseline of an item whose count matched (stockCountService).
//   3. The movement doc and the cache increment land in the same transaction.
//   4. Reads happen before writes, always (a Firestore transaction requirement).
//   5. Idempotency comes from deterministic ids (hand-entered movements, run
//      receipts) or, for orders, from the diff against the order's own
//      movements (reconcileOrderStock) — never an "already deducted" flag.
//   6. Stock is held per (item, warehouse). The stocks doc id is built by
//      buildStockDocId — never hand-concatenated, same rule as itemKey.
//
// "warehouse" here is the UI's "bodega": code and stored data are English, the
// Spanish word lives in the frontend copy only.
const { db } = require('../config/firebase');
const { FieldValue } = require('firebase-admin/firestore');
const { BadRequestError, NotFoundError } = require('../utils/errors');
const { generateId } = require('../utils/helpers');
const { ITEM_TYPES, buildItemKey } = require('../utils/itemKey');
const { MAX_DEPTH, resolveRecipeId, normalizeComponent } = require('./recipeGraph');

const MOVEMENT_TYPES = {
  SALE: 'sale',
  PURCHASE: 'purchase',
  COUNT: 'count',
  ADJUSTMENT: 'adjustment',
  PRODUCTION: 'production',
  COMPENSATION: 'compensation',
  // Moving stock between warehouses: two movements, one transaction (§1.2).
  TRANSFER: 'transfer',
  // A real loss of value, never an information correction (§3). Kept apart
  // from `adjustment` so the merma report can separate explained from
  // unexplained — an append-only ledger cannot be re-tagged later.
  WASTE: 'waste',
};

// Stored values are English like every other enum in the ledger; the frontend
// renders them as dañado / vencido / perdido / otro.
const WASTE_REASONS = ['damaged', 'expired', 'lost', 'other'];

// Auto-provisioned in BakerySettings.DEFAULT_FEATURES.inventory, so every
// bakery has one without a migration. Repeated here as the floor for a bakery
// whose settings doc cannot be read.
const DEFAULT_WAREHOUSE_ID = 'main';

// gRPC status code Firestore reports when create() meets an existing document.
const ALREADY_EXISTS = 6;

const stocksRef = (bakeryId) => db.collection(`bakeries/${bakeryId}/stocks`);
const movementsRef = (bakeryId) =>
  db.collection(`bakeries/${bakeryId}/stockMovements`);

/**
 * THE stocks doc id builder — same rule as buildItemKey (utils/itemKey.js). `itemKey` keeps
 * meaning *item identity*; the doc id carries the warehouse. `__` is safe:
 * item keys only ever use single underscores.
 */
const buildStockDocId = (itemKey, warehouseId) => {
  if (!itemKey) throw new BadRequestError('stock doc id requires an itemKey');
  if (!warehouseId) throw new BadRequestError('stock doc id requires a warehouseId');
  return `${itemKey}__${warehouseId}`;
};

/** API item identity `{ type, id, combinationId }` → the ledger descriptor buildItemKey reads. */
const toStockItem = ({ type, id, combinationId = null } = {}) => {
  if (type === ITEM_TYPES.INGREDIENT) return { itemType: type, ingredientId: id };
  if (type === ITEM_TYPES.PRODUCT) {
    return { itemType: type, productId: id, combinationId: combinationId || null };
  }
  throw new BadRequestError(`Unknown stock item type: ${type}`);
};

/**
 * The bakery's warehouse list. Never swallows a read failure: guessing the
 * default would silently write a movement to the wrong warehouse, and the
 * ledger is append-only. The settings-doc fallback covers a bakery whose
 * settings predate the field — BakerySettings merges the default in on read.
 */
const getWarehouses = async (bakeryId) => {
  const doc = await db.doc(`bakeries/${bakeryId}/settings/default`).get();
  const warehouses = doc.data()?.features?.inventory?.warehouses;

  return warehouses?.length
    ? warehouses
    : [{ id: DEFAULT_WAREHOUSE_ID, isDefault: true }];
};

/**
 * When the bakery's inventory first went live, or null if it never has. The
 * switch hides the screens; it does not pause the ledger. Once a bakery has
 * been on, orders keep moving stock whatever the switch says, so turning it
 * back on never meets a gap. A bakery found on without a start date gets one
 * here, once.
 */
const getInventoryStart = async (bakeryId) => {
  const ref = db.doc(`bakeries/${bakeryId}/settings/default`);
  const inventory = (await ref.get()).data()?.features?.inventory;

  const startedAt = inventory?.enabledAt;
  if (startedAt) return startedAt.toDate ? startedAt.toDate() : new Date(startedAt);
  if (inventory?.enabled !== true) return null;

  const now = new Date();
  await ref.set({ features: { inventory: { enabledAt: now } } }, { merge: true });
  return now;
};

/**
 * The warehouse a caller means, and proof that it exists. Movements themselves
 * are never implicit — validateMovement rejects a movement without a
 * warehouseId — but the entry points resolve one on the client's behalf.
 *
 * An unknown id is refused rather than created: a typo'd warehouse would mint a
 * stocks doc no screen can reach and no transfer can empty.
 */
const resolveWarehouseId = async (bakeryId, warehouseId = null) => {
  const warehouses = await getWarehouses(bakeryId);

  if (!warehouseId) {
    return (warehouses.find((warehouse) => warehouse.isDefault) || warehouses[0]).id;
  }

  if (!warehouses.some((warehouse) => warehouse.id === warehouseId)) {
    throw new BadRequestError(`Bodega desconocida: ${warehouseId}`);
  }

  return warehouseId;
};

const getDefaultWarehouseId = (bakeryId) => resolveWarehouseId(bakeryId);

const stockDocSeed = (item, { name = '', unit = '', warehouseId, now = new Date() } = {}) => ({
  itemKey: buildItemKey(item),
  warehouseId,
  itemType: item.itemType,
  ...(item.itemType === ITEM_TYPES.INGREDIENT
    ? { ingredientId: item.ingredientId }
    : { productId: item.productId, combinationId: item.combinationId || null }),
  name,
  unit,
  currentStock: 0,
  baselineQty: 0,
  baselineAt: now,
  updatedAt: now,
});

/**
 * Stocks and movements are read as raw documents (no model class), so Firestore
 * Timestamps would reach the client as {_seconds, _nanoseconds}. Everything
 * else in the API hands back real dates via the models; match that.
 */
const toPlain = (doc) => {
  const data = doc.data();

  Object.keys(data).forEach((key) => {
    if (typeof data[key]?.toDate === 'function') {
      data[key] = data[key].toDate();
    }
  });

  return { id: doc.id, ...data };
};

const validateMovement = (movement) => {
  const qty = Number(movement.qty);

  if (!Number.isFinite(qty)) {
    throw new BadRequestError('Movement qty must be a number');
  }

  if (!Object.values(MOVEMENT_TYPES).includes(movement.type)) {
    throw new BadRequestError(`Unknown movement type: ${movement.type}`);
  }

  if (!movement.item) {
    throw new BadRequestError('Movement requires an item descriptor');
  }

  // Explicit always: no "missing means main". A ledger that has to be
  // interpreted years later is a ledger that will be interpreted wrongly.
  if (!movement.warehouseId) {
    throw new BadRequestError('Movement requires a warehouseId');
  }

  return qty;
};

/**
 * The one write primitive. Appends movement documents and moves the cached
 * currentStock of every item they touch, atomically.
 *
 * @param {string} bakeryId
 * @param {Array} movements  [{ id?, item, warehouseId, qty, type, refs?, editor?,
 *                           unitCost?, name?, unit? }]
 *                           `id` present ⇒ deterministic ⇒ idempotent: writing
 *                           it twice produces one movement and one increment.
 *                           Order movements have no id: reconcileOrderStock's
 *                           diff is their idempotency.
 * @param {Object} options   { transaction } to enlist in an outer transaction.
 *                           { stockFields } stocks doc id → extra fields merged
 *                           into that doc's one cache write (a count's baseline).
 * @returns {Array} the movements actually written (skipped duplicates excluded)
 */
const writeMovements = async (
  bakeryId,
  movements = [],
  { transaction = null, stockFields = {} } = {},
) => {
  if (!movements.length) return [];

  const prepared = movements.map((movement) => {
    const qty = roundQty(validateMovement(movement));
    const itemKey = buildItemKey(movement.item);
    return {
      ...movement,
      qty,
      itemKey,
      stockDocId: buildStockDocId(itemKey, movement.warehouseId),
      ref: movement.id
        ? movementsRef(bakeryId).doc(movement.id)
        : movementsRef(bakeryId).doc(),
    };
  });

  // A deterministic id repeated inside one batch is the same movement asked for
  // twice. Writing it twice sets one document but adds its qty to the cache
  // twice, which is exactly the ledger/cache divergence invariant 1 forbids.
  const seenIds = new Set();
  const unique = prepared.filter((movement) => {
    if (!movement.id) return true;
    if (seenIds.has(movement.id)) return false;
    seenIds.add(movement.id);
    return true;
  });

  const run = async (t) => {
    // One instant per attempt. A stocks doc born from a movement takes it as its
    // baselineAt, so its founding movement can never land before the baseline
    // (verify() counts movements at or after it); taken here, not before the
    // transaction, so a retry after a concurrent create is still later.
    const now = new Date();

    // ---- reads: every one of them, before any write ----

    // Idempotency: a deterministic id that already exists is a structural
    // no-op — skip both the movement doc and the increment.
    const existing = await Promise.all(
      unique.map((movement) =>
        movement.id ? t.get(movement.ref) : Promise.resolve(null),
      ),
    );

    const toWrite = unique.filter((_, i) => !(existing[i] && existing[i].exists));
    if (!toWrite.length) return [];

    // One cache write per (item, warehouse), even when several movements touch
    // the same one (a recipe using an ingredient twice, a production entry).
    // Two writes to one doc inside a transaction would depend on write
    // ordering; a single net delta does not. A transfer moves two different
    // docs precisely because its two movements key differently here.
    const deltaByStockDoc = new Map();
    toWrite.forEach((movement) => {
      const current = deltaByStockDoc.get(movement.stockDocId);
      deltaByStockDoc.set(movement.stockDocId, {
        item: movement.item,
        warehouseId: movement.warehouseId,
        name: current?.name || movement.name || '',
        unit: current?.unit || movement.unit || '',
        qty: (current?.qty || 0) + movement.qty,
      });
    });

    const stockDocIds = [...deltaByStockDoc.keys()];
    const stockDocs = await Promise.all(
      stockDocIds.map((docId) => t.get(stocksRef(bakeryId).doc(docId))),
    );

    // ---- writes ----
    toWrite.forEach((movement) => {
      t.set(movement.ref, {
        itemKey: movement.itemKey,
        warehouseId: movement.warehouseId,
        qty: movement.qty,
        type: movement.type,
        refs: movement.refs || {},
        timestamp: movement.timestamp || now,
        editor: movement.editor || null,
        ...(movement.reason ? { reason: movement.reason } : {}),
        ...(movement.note ? { note: movement.note } : {}),
        ...(movement.unitCost !== undefined ? { unitCost: movement.unitCost } : {}),
      });
    });

    stockDocIds.forEach((docId, i) => {
      const doc = stockDocs[i];
      const delta = deltaByStockDoc.get(docId);
      const ref = stocksRef(bakeryId).doc(docId);

      if (doc.exists) {
        t.update(ref, {
          currentStock: FieldValue.increment(delta.qty),
          updatedAt: now,
          ...stockFields[docId],
        });
        return;
      }

      // A movement for an item that never opted in, or for a warehouse this
      // item has never been held in: the ledger still wins — create the cache
      // rather than lose the movement. This is also how a transfer's
      // destination doc is born.
      t.set(ref, {
        ...stockDocSeed(delta.item, {
          name: delta.name,
          unit: delta.unit,
          warehouseId: delta.warehouseId,
          now,
        }),
        currentStock: delta.qty,
        ...stockFields[docId],
      });
    });

    return toWrite.map(({ ref, stockDocId, ...movement }) => ({
      id: ref.id,
      ...movement,
    }));
  };

  return transaction ? run(transaction) : db.runTransaction(run);
};

/**
 * Creates the stocks docs an item needs when it opts into tracking (§8.1), and
 * refreshes the denormalized name/unit otherwise. Never deletes: opting back
 * out orphans the doc harmlessly and keeps its history intact.
 *
 * Called after the owning update commits, not inside it — the cache is
 * rebuildable, and writeMovements creates any doc that is missing anyway, so
 * this is not worth complicating the product/ingredient write path for.
 */
const syncStockDoc = async (bakeryId, item, { name = '', unit = '', warehouseId } = {}) => {
  const stockDocId = buildStockDocId(buildItemKey(item), warehouseId);
  const ref = stocksRef(bakeryId).doc(stockDocId);

  // create(), not set(): a movement may have made this doc since we looked, and
  // overwriting it would reset its stock to 0 without leaving a trace.
  try {
    await ref.create(stockDocSeed(item, { name, unit, warehouseId }));
    return stockDocId;
  } catch (error) {
    if (error.code !== ALREADY_EXISTS) throw error;
  }

  const data = (await ref.get()).data();
  if (data.name !== name || data.unit !== unit) {
    await ref.update({ name, unit, updatedAt: new Date() });
  }

  return stockDocId;
};

/**
 * Opting a product into tracking gives every sellable unit a stocks doc — one
 * per combination, or the product itself. Only 'none' products hold no stock:
 * a recipe-mode product may still hold finished goods (pan de bono made for
 * the vitrina *and* made to order — §2.3 amends §5).
 *
 * Docs are created for the default warehouse only; docs in other warehouses
 * are born lazily from the first movement that touches them.
 *
 * Never throws: the caller runs this after its own write has committed, and a
 * rebuildable cache must not fail the write that owns the data.
 */
const syncProductStockDocs = async (bakeryId, product) => {
  if (product.inventoryMode === 'none' || !product.inventoryMode) return [];

  const combinations = product.variations?.combinations || [];

  const items =
    product.hasVariations && combinations.length
      ? combinations.map((combination) => ({
        item: {
          itemType: ITEM_TYPES.PRODUCT,
          productId: product.id,
          combinationId: combination.id,
        },
        name: `${product.name} ${combination.name}`.trim(),
      }))
      : [
        {
          item: { itemType: ITEM_TYPES.PRODUCT, productId: product.id },
          name: product.name,
        },
      ];

  try {
    const warehouseId = await getDefaultWarehouseId(bakeryId);

    return await Promise.all(
      items.map(({ item, name }) =>
        syncStockDoc(bakeryId, item, { name, unit: 'uds', warehouseId }),
      ),
    );
  } catch (error) {
    console.error('Could not sync stock docs for product', product?.id, error);
    return [];
  }
};

/** Non-fatal for the same reason as syncProductStockDocs. */
const syncIngredientStockDoc = async (bakeryId, ingredient) => {
  if (ingredient.stockBehavior !== 'stocked') return null;

  try {
    return await syncStockDoc(
      bakeryId,
      { itemType: ITEM_TYPES.INGREDIENT, ingredientId: ingredient.id },
      {
        name: ingredient.name,
        unit: ingredient.unit,
        warehouseId: await getDefaultWarehouseId(bakeryId),
      },
    );
  } catch (error) {
    console.error('Could not sync stock doc for ingredient', ingredient?.id, error);
    return null;
  }
};

// ponytail: an open order whose dueDate is more than this many days past counts
// as forgotten and stops holding stock. Future orders always count.
const COMMITTED_WINDOW_DAYS = 10;

/**
 * Stock doc id → quantity, for open order lines that will take from stock and
 * pending run lines. A resale (`unit`) product always takes from stock when it
 * ships, whatever the line's fulfillmentSource says, so its lines count too.
 */
const getCommittedAndIncoming = async (bakeryId) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - COMMITTED_WINDOW_DAYS);

  const [warehouseId, orders, runs, unitProducts] = await Promise.all([
    getDefaultWarehouseId(bakeryId),
    db.collection(`bakeries/${bakeryId}/orders`)
      .where('isDeleted', '==', false)
      .where('status', 'in', [0, 1])
      .where('dueDate', '>=', cutoff)
      .get(),
    db.collection(`bakeries/${bakeryId}/productionRuns`).where('status', '==', 'open').get(),
    db.collection(`bakeries/${bakeryId}/products`).where('inventoryMode', '==', 'unit').select().get(),
  ]);
  const unitIds = new Set(unitProducts.docs.map((doc) => doc.id));

  const committed = new Map();
  const incoming = new Map();
  const add = (map, item, atWarehouse, qty) => {
    const id = buildStockDocId(buildItemKey(toStockItem(item)), atWarehouse);
    map.set(id, (map.get(id) || 0) + (Number(qty) || 0));
  };

  orders.docs.forEach((doc) => (doc.data().orderItems || []).forEach((line) => {
    if (line.fulfillmentSource !== 'stock' && !unitIds.has(line.productId)) return;
    const item = { type: ITEM_TYPES.PRODUCT, id: line.productId, combinationId: line.combination?.id };
    add(committed, item, line.sourceWarehouseId || warehouseId, line.quantity);
  }));

  runs.docs.forEach((doc) => {
    const run = doc.data();
    if (run.isDeleted) return;
    (run.lines || []).forEach((line) => {
      if (line.status === 'pending') add(incoming, line.item, run.warehouseId, line.plannedQty);
    });
  });

  return { committed, incoming };
};

/**
 * One row per (item, warehouse). A single-warehouse bakery cannot tell.
 * Each row carries committed / incoming / available, computed here and never
 * stored: the orders and runs are the commitment, so the next read reflects them.
 */
const getStocks = async (
  bakeryId,
  { itemType = null, search = null, warehouseId = null, itemKeys = null } = {},
) => {
  let query = stocksRef(bakeryId);
  if (itemType) query = query.where('itemType', '==', itemType);
  if (warehouseId) query = query.where('warehouseId', '==', warehouseId);

  const snapshot = await query.get();
  let stocks = snapshot.docs.map(toPlain);

  if (itemKeys?.length) stocks = stocks.filter((stock) => itemKeys.includes(stock.itemKey));

  if (search) {
    const needle = search.toLowerCase();
    stocks = stocks.filter((stock) => (stock.name || '').toLowerCase().includes(needle));
  }

  const { committed, incoming } = await getCommittedAndIncoming(bakeryId);
  return stocks.map((stock) => {
    const c = committed.get(stock.id) || 0;
    const i = incoming.get(stock.id) || 0;
    return { ...stock, committed: c, incoming: i, available: (stock.currentStock || 0) + i - c };
  });
};

const getStock = async (bakeryId, itemKey, warehouseId) => {
  const doc = await stocksRef(bakeryId).doc(buildStockDocId(itemKey, warehouseId)).get();
  if (!doc.exists) throw new NotFoundError('Stock item not found');
  return toPlain(doc);
};

/**
 * One item's history, across every warehouse it has been held in — the
 * (itemKey, timestamp) index already serves that (§1.3). Narrowing to one
 * warehouse would have to happen in the query, not after `limit`, so it waits
 * for the composite index and the screen that actually needs it.
 */
const getItemMovements = async (
  bakeryId,
  itemKey,
  { limit = 50, startAfter = null } = {},
) => {
  let query = movementsRef(bakeryId)
    .where('itemKey', '==', itemKey)
    .orderBy('timestamp', 'desc')
    .limit(Number(limit));

  if (startAfter) query = query.startAfter(new Date(startAfter));

  const snapshot = await query.get();
  return snapshot.docs.map(toPlain);
};

/** All movements of one order — compensation (§8.6) and audit both need this. */
const getOrderMovements = async (bakeryId, orderId) => {
  const snapshot = await movementsRef(bakeryId)
    .where('refs.orderId', '==', orderId)
    .get();

  return snapshot.docs.map(toPlain);
};

/** Both legs of one transfer — the retry path and any report need the pair. */
const getTransferMovements = async (bakeryId, transferId) => {
  const snapshot = await movementsRef(bakeryId)
    .where('refs.transferId', '==', transferId)
    .get();

  return snapshot.docs.map(toPlain);
};

/** The item descriptor a movement needs, read back off its stocks doc. */
const itemOf = (stock) => ({
  itemType: stock.itemType,
  ingredientId: stock.ingredientId,
  productId: stock.productId,
  combinationId: stock.combinationId,
});

/**
 * Turns a client's retry key into a doc id, for hand-entered documents that
 * have no natural id of their own (invariant 5).
 *
 * The key is generated when the form opens, not when it submits, so a resend
 * after a lost response carries the key the first attempt used and lands on the
 * same document. Prefixed so a client can never aim at a sale's id.
 */
const retryId = (idempotencyKey, prefix) => {
  if (!idempotencyKey) return undefined;

  // It becomes a Firestore doc id: reject the shapes that would 500 instead.
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(idempotencyKey)) {
    throw new BadRequestError('idempotencyKey inválida');
  }

  return `${prefix}_${idempotencyKey}`;
};

/** Shared spine of the two hand-entered movements: adjust and waste. */
const manualMovement = async (
  bakeryId,
  itemKey,
  { qty, type, reason, note, warehouseId, editor, idempotencyKey },
) => {
  const resolvedWarehouseId = await resolveWarehouseId(bakeryId, warehouseId);
  // One key reused across an adjustment and a baja must not answer for the other.
  const id = retryId(idempotencyKey, type);
  const stock = await getStock(bakeryId, itemKey, resolvedWarehouseId);

  const [movement] = await writeMovements(bakeryId, [
    {
      id,
      item: itemOf(stock),
      warehouseId: resolvedWarehouseId,
      qty,
      type,
      reason,
      note,
      editor,
      name: stock.name,
      unit: stock.unit,
    },
  ]);

  // A retry writes nothing. Hand back what already landed rather than an
  // undefined body, so the caller cannot tell the retry from the first try.
  if (movement) return movement;
  return toPlain(await movementsRef(bakeryId).doc(id).get());
};

/**
 * The permanent manual escape hatch: a signed quantity with a required reason.
 * Also what makes the ledger hand-testable before deduction exists.
 *
 * An adjustment is an *information* correction and should net to roughly zero
 * over time. Real losses are waste() — keeping them apart is what lets the
 * merma report tell reported bajas from unexplained shrinkage (§3).
 */
const adjust = async (
  bakeryId,
  itemKey,
  { qty, reason, warehouseId, editor, idempotencyKey },
) => {
  if (!reason || !String(reason).trim()) {
    throw new BadRequestError('Una corrección manual necesita un motivo');
  }

  const amount = Number(qty);
  // Number(null) and Number('') are 0, so the zero check covers a missing quantity.
  if (!Number.isFinite(amount) || amount === 0) {
    throw new BadRequestError('Una corrección necesita una cantidad distinta de cero');
  }

  return manualMovement(bakeryId, itemKey, {
    qty: amount,
    type: MOVEMENT_TYPES.ADJUSTMENT,
    reason: String(reason).trim(),
    warehouseId,
    editor,
    idempotencyKey,
  });
};

/** A write-off: value that left the business. Always negative (§3). */
const waste = async (
  bakeryId,
  itemKey,
  { qty, reason, note, warehouseId, editor, idempotencyKey },
) => {
  const amount = Number(qty);

  if (!Number.isFinite(amount) || amount >= 0) {
    throw new BadRequestError('Una baja registra una cantidad negativa');
  }

  if (!WASTE_REASONS.includes(reason)) {
    throw new BadRequestError(`Motivo de baja inválido: ${reason}`);
  }

  // reason stays the bare enum value — the merma report groups by it, and a
  // free-text note welded onto it could never be ungrouped later.
  return manualMovement(bakeryId, itemKey, {
    qty: amount,
    type: MOVEMENT_TYPES.WASTE,
    reason,
    note: note ? String(note).trim() : null,
    warehouseId,
    editor,
    idempotencyKey,
  });
};

/**
 * Moving stock between warehouses: −qty at the origin, +qty at the
 * destination, one writeMovements call so both land or neither does. The
 * destination's stocks doc is created by the fallback path if this is the
 * first stock it has ever held.
 */
const transfer = async (
  bakeryId,
  itemKey,
  { qty, fromWarehouseId, toWarehouseId, editor, idempotencyKey },
) => {
  const amount = Number(qty);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new BadRequestError('La cantidad a transferir debe ser positiva');
  }

  if (!fromWarehouseId || !toWarehouseId) {
    throw new BadRequestError('Una transferencia necesita origen y destino');
  }

  if (fromWarehouseId === toWarehouseId) {
    throw new BadRequestError('El origen y el destino deben ser distintos');
  }

  // Both against one settings read: a typo'd destination would otherwise mint a
  // stocks doc nothing can reach, holding stock this transfer just debited.
  const warehouses = await getWarehouses(bakeryId);
  [fromWarehouseId, toWarehouseId].forEach((id) => {
    if (!warehouses.some((warehouse) => warehouse.id === id)) {
      throw new BadRequestError(`Bodega desconocida: ${id}`);
    }
  });

  const stock = await getStock(bakeryId, itemKey, fromWarehouseId);

  // The two legs need distinct ids or they would collide on one document; the
  // shared transferId is what ties them back together in a report.
  const base = retryId(idempotencyKey, 'transfer');
  const shared = {
    item: itemOf(stock),
    type: MOVEMENT_TYPES.TRANSFER,
    refs: { transferId: idempotencyKey || generateId() },
    editor,
    name: stock.name,
    unit: stock.unit,
  };

  const written = await writeMovements(bakeryId, [
    { ...shared, id: base && `${base}_out`, warehouseId: fromWarehouseId, qty: -amount },
    { ...shared, id: base && `${base}_in`, warehouseId: toWarehouseId, qty: amount },
  ]);

  // A retry moves nothing a second time: return the pair that already landed.
  if (written.length) return written;
  return getTransferMovements(bakeryId, shared.refs.transferId);
};

/**
 * Movements carrying all of these refs (and this type): e.g. everything one
 * production receipt wrote. Equality filters only, so no composite index.
 */
const getMovementsByRefs = async (bakeryId, refs = {}, { type = null, transaction = null } = {}) => {
  let query = movementsRef(bakeryId);
  Object.entries(refs).forEach(([key, value]) => {
    query = query.where(`refs.${key}`, '==', value);
  });
  if (type) query = query.where('type', '==', type);

  const snapshot = await (transaction ? transaction.get(query) : query.get());
  return snapshot.docs.map(toPlain);
};

/**
 * The opposite of movements already written: same item, warehouse and size,
 * opposite sign, type `compensation`. The ledger is append-only, so a mistake is
 * undone by new movements, never by deleting. `idFor(movement)` makes each one
 * deterministic, so reversing twice writes once. Stock may end negative: the
 * ledger never blocks (invariant 8).
 */
const reverseMovements = async (
  bakeryId,
  movements = [],
  { idFor = null, refs = {}, editor = null, transaction = null } = {},
) => {
  // The descriptor a movement needs is read back off its stocks doc: a movement
  // stores only the itemKey.
  const stocks = await Promise.all(
    movements.map((m) => getStock(bakeryId, m.itemKey, m.warehouseId)),
  );

  return writeMovements(
    bakeryId,
    movements.map((m, i) => ({
      id: idFor ? idFor(m) : undefined,
      item: itemOf(stocks[i]),
      warehouseId: m.warehouseId,
      qty: -m.qty,
      type: MOVEMENT_TYPES.COMPENSATION,
      refs,
      editor,
      name: stocks[i].name,
      unit: stocks[i].unit,
    })),
    { transaction },
  );
};

const productName = (product, combinationId) => {
  const combination = (product.variations?.combinations || [])
    .find((c) => c.id === combinationId);
  return combination ? `${product.name} ${combination.name}`.trim() : product.name;
};

/**
 * The deduction walk: what making `qty` of `item` consumes from the bodega,
 * through the item's OWN recipe. Plain reads, never inside a transaction
 * (invariant 4): callers expand first, then write inside theirs.
 *
 * Each component of that recipe resolves as:
 *   product 'unit' or 'recipe'          → its own stock. Stop.
 *   product 'none'                      → nothing
 *   ingredient 'stocked'                → its own stock. Stop.
 *   ingredient 'passThrough' + recipe   → its recipe, scaled by qty / yield
 *   ingredient 'passThrough', no recipe → nothing, and not a gap
 *
 * A tracked product used as a component is taken from the vitrina, not
 * re-made: a caja de 6 consumes six croissants, not their flour.
 *
 * Gaps say where the walk couldn't follow; they never block.
 * Returns { name, unit, components: [{ item, qty, name, unit }], gaps: [{ item, name, reason }] }:
 * the top item's own name/unit, and its components merged by item.
 */
const expandRecipe = async (bakeryId, item, qty) => {
  const cache = new Map();
  const read = async (path) => {
    if (!cache.has(path)) {
      const snap = await db.doc(`bakeries/${bakeryId}/${path}`).get();
      cache.set(path, snap.exists && !snap.data().isDeleted ? snap.data() : null);
    }
    return cache.get(path);
  };

  const components = new Map();
  const gaps = [];

  const take = (component, amount, name, unit) => {
    const key = buildItemKey(toStockItem(component));
    const current = components.get(key);
    if (current) current.qty += amount;
    else components.set(key, { item: component, qty: amount, name, unit });
  };

  // One recipe level: a product's recipe makes one unit, a preparación's makes `yield`.
  const walkRecipe = async (owner, amount, depth, recipeId, name) => {
    if (depth > MAX_DEPTH) return gaps.push({ item: owner, name, reason: 'depthExceeded' });
    const recipe = recipeId ? await read(`recipes/${recipeId}`) : null;
    if (!recipe) return gaps.push({ item: owner, name, reason: 'missingRecipe' });

    const factor = owner.type === ITEM_TYPES.INGREDIENT
      ? amount / (Number(recipe.yield) || 1)
      : amount;
    for (const raw of recipe.ingredients || []) {
      const quantity = Number(raw.quantity) || 0;
      const component = normalizeComponent(raw);
      if (quantity > 0 && component.id) await expand(component, quantity * factor, depth + 1);
    }
  };

  const expand = async (component, amount, depth) => {
    if (component.type === ITEM_TYPES.PRODUCT) {
      const product = await read(`products/${component.id}`);
      if (!product) return gaps.push({ item: component, name: component.id, reason: 'missingItem' });
      if (product.inventoryMode === 'unit' || product.inventoryMode === 'recipe') {
        take(component, amount, productName(product, component.combinationId), 'uds');
      }
      return;
    }

    const ingredient = await read(`ingredients/${component.id}`);
    if (!ingredient) return gaps.push({ item: component, name: component.id, reason: 'missingItem' });
    if (ingredient.stockBehavior === 'stocked') {
      return take(component, amount, ingredient.name, ingredient.unit || '');
    }
    if (!ingredient.recipeId) return;
    return walkRecipe(component, amount, depth, ingredient.recipeId, ingredient.name);
  };

  // The top item is never taken: what is asked for is its recipe's components.
  const top = { type: item.type, id: item.id, combinationId: item.combinationId || null };
  let name;
  let unit;
  if (top.type === ITEM_TYPES.PRODUCT) {
    const product = await read(`products/${top.id}`);
    if (!product) throw new NotFoundError('Producto no encontrado');
    name = productName(product, top.combinationId);
    unit = 'uds';
    await walkRecipe(top, qty, 0, resolveRecipeId(product, top.combinationId), name);
  } else {
    const ingredient = await read(`ingredients/${top.id}`);
    if (!ingredient) throw new NotFoundError('Ingrediente no encontrado');
    name = ingredient.name;
    unit = ingredient.unit || '';
    await walkRecipe(top, qty, 0, ingredient.recipeId, name);
  }

  return { name, unit, components: [...components.values()], gaps };
};

// Recipe scaling leaves float dust; a difference under this is no difference.
const roundQty = (n) => Math.round(n * 1e6) / 1e6;

/**
 * Drift check: per stocks doc, baselineQty + Σ movements since baselineAt
 * against currentStock. Report only — a repair is an adjustment, never a
 * silent overwrite. Returns only the rows that disagree.
 */
// ponytail: reads every movement of the bakery; narrow by baselineAt per item if it gets slow.
const verify = async (bakeryId) => {
  const [stocksSnap, movementsSnap] = await Promise.all([
    stocksRef(bakeryId).get(),
    movementsRef(bakeryId).get(),
  ]);

  const byStockDoc = new Map();
  movementsSnap.docs.map(toPlain).forEach((m) => {
    const id = buildStockDocId(m.itemKey, m.warehouseId);
    if (!byStockDoc.has(id)) byStockDoc.set(id, []);
    byStockDoc.get(id).push(m);
  });

  return stocksSnap.docs.map(toPlain).flatMap((stock) => {
    // `>=` on purpose: a count stamps its movement 1 ms before the baselineAt it
    // sets (stockCountService.close), so the baseline already holds it.
    const since = stock.baselineAt ? new Date(stock.baselineAt) : new Date(0);
    const expected = roundQty((byStockDoc.get(stock.id) || [])
      .filter((m) => new Date(m.timestamp) >= since)
      .reduce((sum, m) => sum + m.qty, Number(stock.baselineQty) || 0));
    const actual = roundQty(Number(stock.currentStock) || 0);
    return expected === actual
      ? []
      : [{ id: stock.id, name: stock.name, expected, actual, diff: roundQty(actual - expected) }];
  });
};

const stockGapsRef = (bakeryId) => db.collection(`bakeries/${bakeryId}/stockGaps`);

/** Σ qty of an order's existing movements, per stocks doc. */
const netByStockDoc = (movements) => {
  const net = new Map();
  movements.forEach((m) => {
    const id = buildStockDocId(m.itemKey, m.warehouseId);
    net.set(id, (net.get(id) || 0) + m.qty);
  });
  return net;
};

// Enviada. From here on the goods have physically left.
const SHIPPED_STATUS = 2;

/** An order moves stock once it has shipped (INVENTORY.md §4.3): the order decides when. */
const affectsStock = (order) => Boolean(order) && !order.isDeleted && order.status >= SHIPPED_STATUS;

/**
 * When the order last became Enviada. System-managed: derived from the status
 * change and never taken from the client, because the pre-tracking guard in
 * reconcileOrderStock trusts it. Shipping (again) stamps the new moment; going
 * back below Enviada keeps the last one, so findUnreconciledOrders still sees an
 * order whose reversal failed. `before` is null on create. The full history stays
 * in the order's updateHistory.
 */
const stampShippedAt = (before, after, now = new Date()) => {
  const shipped = after.status >= SHIPPED_STATUS;
  const wasShipped = Boolean(before) && before.status >= SHIPPED_STATUS;

  after.shippedAt = shipped && !wasShipped ? now : (before?.shippedAt ?? null);

  return after;
};

// What of a line can move stock. A price or note edit leaves this unchanged.
const stockSignature = (order) => JSON.stringify((order?.orderItems || []).map((l) => [
  l.id, l.productId, l.combination?.id || null, Number(l.quantity),
  l.fulfillmentSource, l.sourceWarehouseId || null,
]));

const needsReconcile = (before, after) =>
  affectsStock(before) !== affectsStock(after) ||
  (affectsStock(after) && stockSignature(before) !== stockSignature(after));

/**
 * What a shipped order should have taken from the bodega; each line decides:
 *   product 'none'                  → nothing
 *   product 'unit', or a stock line → −quantity of the product itself
 *   product 'recipe', produce line  → its recipe, through expandRecipe
 * Plain reads, before any transaction. Nothing when affectsStock is false.
 * Returns { movements: [{ item, warehouseId, qty, name, unit }] merged by stock
 * doc, gaps: [{ orderItemId, productId, productName, gaps }] }.
 */
const expandOrder = async (bakeryId, order) => {
  if (!affectsStock(order)) return { movements: [], gaps: [] };

  const warehouseId = await getDefaultWarehouseId(bakeryId);
  const products = new Map();
  const readProduct = async (id) => {
    if (!products.has(id)) {
      const snap = await db.doc(`bakeries/${bakeryId}/products/${id}`).get();
      products.set(id, snap.exists && !snap.data().isDeleted ? snap.data() : null);
    }
    return products.get(id);
  };

  const desired = new Map();
  const take = (item, atWarehouse, qty, name, unit) => {
    const ledgerItem = toStockItem(item);
    const id = buildStockDocId(buildItemKey(ledgerItem), atWarehouse);
    const current = desired.get(id);
    if (current) current.qty -= qty;
    else desired.set(id, { item: ledgerItem, warehouseId: atWarehouse, qty: -qty, name, unit });
  };

  const gaps = [];
  for (const line of order.orderItems || []) {
    const quantity = Number(line.quantity) || 0;
    if (!line.productId || quantity <= 0) continue;

    const item = { type: ITEM_TYPES.PRODUCT, id: line.productId, combinationId: line.combination?.id || null };
    const lineGap = (list) => gaps.push({
      orderItemId: line.id,
      productId: line.productId,
      productName: line.productName || '',
      gaps: list,
    });

    const product = await readProduct(line.productId);
    if (!product) {
      lineGap([{ item, name: line.productName || '', reason: 'missingItem' }]);
      continue;
    }
    if (!product.inventoryMode || product.inventoryMode === 'none') continue;

    if (product.inventoryMode === 'unit' || line.fulfillmentSource === 'stock') {
      take(item, line.sourceWarehouseId || warehouseId, quantity, productName(product, item.combinationId), 'uds');
      continue;
    }

    const walk = await expandRecipe(bakeryId, item, quantity);
    walk.components.forEach((c) => take(c.item, warehouseId, c.qty, c.name, c.unit));
    if (walk.gaps.length) lineGap(walk.gaps);
  }

  return { movements: [...desired.values()], gaps };
};

/**
 * Brings an order's movements in line with what it should have deducted: the
 * desired movements minus the net of the ones it already has (refs.orderId),
 * written as the delta. An unchanged order is an empty diff — that is the
 * idempotency, not fixed ids. Ship → back → ship ends at one net deduction.
 *
 * The order is expanded outside the transaction (invariant 4); if it changed
 * before the transaction read it again, it is expanded again.
 */
const reconcileOrderStock = async (
  bakeryId,
  orderId,
  { editor = null, editedWhileShipped = false, inventoryStartedAt = null } = {},
) => {
  const orderRef = db.doc(`bakeries/${bakeryId}/orders/${orderId}`);

  for (let attempt = 0; attempt < 3; attempt++) {
    const snap = await orderRef.get();
    if (!snap.exists) throw new NotFoundError('Order not found');
    const plan = await expandOrder(bakeryId, { id: orderId, ...snap.data() });

    const result = await db.runTransaction(async (t) => {
      const fresh = await t.get(orderRef);
      if (!fresh.exists || !fresh.updateTime.isEqual(snap.updateTime)) return null;

      const [existing, gapDocs] = await Promise.all([
        getMovementsByRefs(bakeryId, { orderId }, { transaction: t }),
        t.get(stockGapsRef(bakeryId).where('orderId', '==', orderId)),
      ]);

      // An order already shipped that never produced a movement is either from
      // before inventory went live or was never reconciled. Editing it must not
      // deduct everything it ever held; only an order shipped since inventory
      // started is owed a deduction.
      if (editedWhileShipped && !existing.length) {
        const shippedAt = fresh.data().shippedAt?.toDate?.() ?? null;
        if (!shippedAt || !inventoryStartedAt || shippedAt < inventoryStartedAt) {
          return { written: [], gaps: [], skipped: true };
        }
      }

      const net = netByStockDoc(existing);

      const desired = new Map(plan.movements.map((m) => [
        buildStockDocId(buildItemKey(m.item), m.warehouseId), m,
      ]));

      // A line removed since the last reconcile: its descriptor comes off its
      // stocks doc, which the earlier movement created.
      const orphanIds = [...net.keys()].filter((id) => !desired.has(id));
      const orphanDocs = await Promise.all(orphanIds.map((id) => t.get(stocksRef(bakeryId).doc(id))));
      orphanDocs.forEach((doc) => {
        const stock = doc.data();
        desired.set(doc.id, {
          item: itemOf(stock), warehouseId: stock.warehouseId, qty: 0, name: stock.name, unit: stock.unit,
        });
      });

      // Undoing or changing what is already taken is a compensation; taking it
      // again once it was all given back (net 0) is a sale.
      const type = [...net.values()].every((qty) => roundQty(qty) === 0)
        ? MOVEMENT_TYPES.SALE
        : MOVEMENT_TYPES.COMPENSATION;
      const deltas = [...desired.entries()]
        .map(([id, m]) => ({ ...m, qty: roundQty(m.qty - (net.get(id) || 0)) }))
        .filter((m) => m.qty !== 0)
        .map((m) => ({ ...m, type, refs: { orderId }, editor }));

      const written = await writeMovements(bakeryId, deltas, { transaction: t });

      const gapIds = new Set();
      plan.gaps.forEach((gap) => {
        const id = `${orderId}_${gap.orderItemId}`;
        gapIds.add(id);
        t.set(stockGapsRef(bakeryId).doc(id), { orderId, ...gap, updatedAt: new Date() });
      });
      gapDocs.docs.forEach((doc) => {
        if (!gapIds.has(doc.id)) t.delete(doc.ref);
      });

      return { written, gaps: plan.gaps };
    });

    if (result) return result;
  }

  throw new Error(`Order ${orderId} kept changing; stock not reconciled`);
};

/**
 * The order-vs-ledger counterpart of verify(): shipped orders whose movements
 * differ from what they should have deducted, e.g. a reconcile that failed or
 * timed out after the order committed. Only orders shipped since inventory went
 * live are checked; older ones owe the ledger nothing. Report only.
 *
 * ponytail: expands every shipped order of the window one by one; narrow `days`
 * or move it to a scheduled job if a bakery ships thousands of orders a fortnight.
 */
const findUnreconciledOrders = async (bakeryId, { days = 14 } = {}) => {
  const startedAt = await getInventoryStart(bakeryId);
  if (!startedAt) return [];

  const windowStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const from = windowStart > startedAt ? windowStart : startedAt;
  const snapshot = await db.collection(`bakeries/${bakeryId}/orders`)
    .where('shippedAt', '>=', from)
    .get();

  const mismatched = [];
  for (const doc of snapshot.docs) {
    const plan = await expandOrder(bakeryId, { id: doc.id, ...doc.data() });
    const net = netByStockDoc(await getMovementsByRefs(bakeryId, { orderId: doc.id }));
    const desired = new Map(plan.movements.map((m) => [
      buildStockDocId(buildItemKey(m.item), m.warehouseId), m.qty,
    ]));

    const diffs = [...new Set([...desired.keys(), ...net.keys()])]
      .map((id) => ({ id, diff: roundQty((desired.get(id) || 0) - (net.get(id) || 0)) }))
      .filter(({ diff }) => diff !== 0);
    if (diffs.length) mismatched.push({ orderId: doc.id, diffs });
  }

  return mismatched;
};

/** Repairs what findUnreconciledOrders lists, one order at a time. */
const reconcileUnreconciledOrders = async (bakeryId, { days = 14, editor = null } = {}) => {
  const repaired = [];
  const failed = [];

  for (const { orderId } of await findUnreconciledOrders(bakeryId, { days })) {
    try {
      await reconcileOrderStock(bakeryId, orderId, { editor });
      repaired.push(orderId);
    } catch (error) {
      failed.push({ orderId, error: error.message });
    }
  }

  return { repaired, failed };
};

module.exports = {
  MOVEMENT_TYPES,
  WASTE_REASONS,
  ITEM_TYPES,
  DEFAULT_WAREHOUSE_ID,
  buildItemKey,
  buildStockDocId,
  toStockItem,
  retryId,
  getWarehouses,
  getInventoryStart,
  resolveWarehouseId,
  getDefaultWarehouseId,
  writeMovements,
  syncStockDoc,
  syncProductStockDocs,
  syncIngredientStockDoc,
  getStocks,
  getStock,
  getItemMovements,
  getOrderMovements,
  getTransferMovements,
  adjust,
  waste,
  transfer,
  getMovementsByRefs,
  reverseMovements,
  itemOf,
  roundQty,
  expandRecipe,
  affectsStock,
  stampShippedAt,
  needsReconcile,
  expandOrder,
  reconcileOrderStock,
  findUnreconciledOrders,
  reconcileUnreconciledOrders,
  verify,
};
