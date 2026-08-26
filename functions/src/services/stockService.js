// services/stockService.js
//
// The stock ledger (INVENTORY-IMPLEMENTATION.md §8).
//
// `stockMovements` is the system of record; a `stocks` doc is a derived,
// disposable cache of one item's current quantity. If every stocks doc were
// deleted, all of them could be rebuilt from the ledger — never the reverse.
//
// NON-NEGOTIABLE, in order of how badly breaking them corrupts data:
//   1. Movements are append-only. Nothing updates or deletes one. Corrections
//      are new movements. There are deliberately no update/delete endpoints.
//   2. Every movement write goes through writeMovements(). Never write a
//      movement doc or touch a stocks doc's currentStock anywhere else.
//   3. The movement doc and the cache increment land in the same transaction.
//   4. Reads happen before writes, always (a Firestore transaction requirement).
//   5. Deterministic ids are the idempotency mechanism — never an "already
//      deducted" flag on the order.
//   6. Stock is held per (item, warehouse). The stocks doc id is built by
//      buildStockDocId — never hand-concatenated, same rule as itemKey.
//
// "warehouse" here is the UI's "bodega": code and stored data are English, the
// Spanish word lives in the frontend copy only.
const { db } = require('../config/firebase');
const { FieldValue } = require('firebase-admin/firestore');
const { BadRequestError, NotFoundError } = require('../utils/errors');
const { generateId } = require('../utils/helpers');

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

const ITEM_TYPES = {
  INGREDIENT: 'ingredient',
  PRODUCT: 'product',
};

// Auto-provisioned in BakerySettings.DEFAULT_FEATURES.inventory, so every
// bakery has one without a migration. Repeated here as the floor for a bakery
// whose settings doc cannot be read.
const DEFAULT_WAREHOUSE_ID = 'main';

const stocksRef = (bakeryId) => db.collection(`bakeries/${bakeryId}/stocks`);
const movementsRef = (bakeryId) =>
  db.collection(`bakeries/${bakeryId}/stockMovements`);

/**
 * THE itemKey builder — invariant 7. Never concatenate a key at a call site.
 * A combination is the sellable unit, so a product with variations gets one
 * stocks doc per combination (§8.1).
 */
const buildItemKey = (item = {}) => {
  const { itemType, ingredientId, productId, combinationId } = item;

  if (itemType === ITEM_TYPES.INGREDIENT) {
    if (!ingredientId) throw new BadRequestError('itemKey requires ingredientId');
    return `ingredient_${ingredientId}`;
  }

  if (itemType === ITEM_TYPES.PRODUCT) {
    if (!productId) throw new BadRequestError('itemKey requires productId');
    return combinationId
      ? `product_${productId}_${combinationId}`
      : `product_${productId}`;
  }

  throw new BadRequestError(`Unknown stock item type: ${itemType}`);
};

/**
 * THE stocks doc id builder — same rule as buildItemKey. `itemKey` keeps
 * meaning *item identity*; the doc id carries the warehouse. `__` is safe:
 * item keys only ever use single underscores.
 */
const buildStockDocId = (itemKey, warehouseId) => {
  if (!itemKey) throw new BadRequestError('stock doc id requires an itemKey');
  if (!warehouseId) throw new BadRequestError('stock doc id requires a warehouseId');
  return `${itemKey}__${warehouseId}`;
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

const stockDocSeed = (item, { name = '', unit = '', warehouseId } = {}) => ({
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
  baselineAt: new Date(),
  updatedAt: new Date(),
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
 *                           Sale ids stay `{orderId}_{orderItemId}_{itemKey}`:
 *                           one order line deducts from exactly one warehouse,
 *                           so the id is still unique.
 * @param {Object} options   { transaction } to enlist in an outer transaction —
 *                           phase 2 runs this inside the order transaction.
 * @returns {Array} the movements actually written (skipped duplicates excluded)
 */
const writeMovements = async (bakeryId, movements = [], { transaction = null } = {}) => {
  if (!movements.length) return [];

  const prepared = movements.map((movement) => {
    const qty = validateMovement(movement);
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
        timestamp: movement.timestamp || new Date(),
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
          updatedAt: new Date(),
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
        }),
        currentStock: delta.qty,
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
  const doc = await ref.get();

  if (!doc.exists) {
    await ref.set(stockDocSeed(item, { name, unit, warehouseId }));
    return stockDocId;
  }

  const data = doc.data();
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
        syncStockDoc(bakeryId, item, { name, unit: 'unidad', warehouseId }),
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

/** One row per (item, warehouse). A single-warehouse bakery cannot tell. */
const getStocks = async (
  bakeryId,
  { itemType = null, search = null, warehouseId = null } = {},
) => {
  let query = stocksRef(bakeryId);
  if (itemType) query = query.where('itemType', '==', itemType);
  if (warehouseId) query = query.where('warehouseId', '==', warehouseId);

  const snapshot = await query.get();
  const stocks = snapshot.docs.map(toPlain);

  if (!search) return stocks;

  const needle = search.toLowerCase();
  return stocks.filter((stock) => (stock.name || '').toLowerCase().includes(needle));
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
 * Turns a client's retry key into a movement doc id — the same mechanism sales
 * get from `{orderId}_{orderItemId}_{itemKey}`, exposed to hand-entered
 * movements that have no natural id of their own (invariant 5).
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
  const id = retryId(idempotencyKey, 'manual');
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

  return manualMovement(bakeryId, itemKey, {
    qty,
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

module.exports = {
  MOVEMENT_TYPES,
  WASTE_REASONS,
  ITEM_TYPES,
  DEFAULT_WAREHOUSE_ID,
  buildItemKey,
  buildStockDocId,
  getWarehouses,
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
};
