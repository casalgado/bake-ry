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
const { db } = require('../config/firebase');
const { FieldValue } = require('firebase-admin/firestore');
const { BadRequestError, NotFoundError } = require('../utils/errors');

const MOVEMENT_TYPES = {
  SALE: 'sale',
  PURCHASE: 'purchase',
  COUNT: 'count',
  ADJUSTMENT: 'adjustment',
  PRODUCTION: 'production',
  COMPENSATION: 'compensation',
};

const ITEM_TYPES = {
  INGREDIENT: 'ingredient',
  PRODUCT: 'product',
};

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

const stockDocSeed = (item, { name = '', unit = '' } = {}) => ({
  itemKey: buildItemKey(item),
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

  return qty;
};

/**
 * The one write primitive. Appends movement documents and moves the cached
 * currentStock of every item they touch, atomically.
 *
 * @param {string} bakeryId
 * @param {Array} movements  [{ id?, item, qty, type, refs?, editor?, unitCost?, name?, unit? }]
 *                           `id` present ⇒ deterministic ⇒ idempotent: writing
 *                           it twice produces one movement and one increment.
 * @param {Object} options   { transaction } to enlist in an outer transaction —
 *                           phase 2 runs this inside the order transaction.
 * @returns {Array} the movements actually written (skipped duplicates excluded)
 */
const writeMovements = async (bakeryId, movements = [], { transaction = null } = {}) => {
  if (!movements.length) return [];

  const prepared = movements.map((movement) => {
    const qty = validateMovement(movement);
    return {
      ...movement,
      qty,
      itemKey: buildItemKey(movement.item),
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

    // One cache write per item, even when several movements touch the same
    // one (a recipe using an ingredient twice, a production entry). Two writes
    // to one doc inside a transaction would depend on write ordering; a single
    // net delta does not.
    const deltaByItem = new Map();
    toWrite.forEach((movement) => {
      const current = deltaByItem.get(movement.itemKey);
      deltaByItem.set(movement.itemKey, {
        item: movement.item,
        name: current?.name || movement.name || '',
        unit: current?.unit || movement.unit || '',
        qty: (current?.qty || 0) + movement.qty,
      });
    });

    const stockKeys = [...deltaByItem.keys()];
    const stockDocs = await Promise.all(
      stockKeys.map((itemKey) => t.get(stocksRef(bakeryId).doc(itemKey))),
    );

    // ---- writes ----
    toWrite.forEach((movement) => {
      t.set(movement.ref, {
        itemKey: movement.itemKey,
        qty: movement.qty,
        type: movement.type,
        refs: movement.refs || {},
        timestamp: movement.timestamp || new Date(),
        editor: movement.editor || null,
        ...(movement.reason ? { reason: movement.reason } : {}),
        ...(movement.unitCost !== undefined ? { unitCost: movement.unitCost } : {}),
      });
    });

    stockKeys.forEach((itemKey, i) => {
      const doc = stockDocs[i];
      const delta = deltaByItem.get(itemKey);
      const ref = stocksRef(bakeryId).doc(itemKey);

      if (doc.exists) {
        t.update(ref, {
          currentStock: FieldValue.increment(delta.qty),
          updatedAt: new Date(),
        });
        return;
      }

      // A movement for an item that never opted in (or whose doc was removed):
      // the ledger still wins — create the cache rather than lose the movement.
      t.set(ref, {
        ...stockDocSeed(delta.item, { name: delta.name, unit: delta.unit }),
        currentStock: delta.qty,
      });
    });

    return toWrite.map(({ ref, ...movement }) => ({ id: ref.id, ...movement }));
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
const syncStockDoc = async (bakeryId, item, { name = '', unit = '' } = {}) => {
  const itemKey = buildItemKey(item);
  const ref = stocksRef(bakeryId).doc(itemKey);
  const doc = await ref.get();

  if (!doc.exists) {
    await ref.set(stockDocSeed(item, { name, unit }));
    return itemKey;
  }

  const data = doc.data();
  if (data.name !== name || data.unit !== unit) {
    await ref.update({ name, unit, updatedAt: new Date() });
  }

  return itemKey;
};

/**
 * Opting a product into 'unit' tracking gives every sellable unit a stocks doc —
 * one per combination, or the product itself. 'recipe' and 'none' products hold
 * no stock of their own (§5).
 *
 * Never throws: the caller runs this after its own write has committed, and a
 * rebuildable cache must not fail the write that owns the data.
 */
const syncProductStockDocs = async (bakeryId, product) => {
  if (product.inventoryMode !== 'unit') return [];

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
    return await Promise.all(
      items.map(({ item, name }) =>
        syncStockDoc(bakeryId, item, { name, unit: 'unidad' }),
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
      { name: ingredient.name, unit: ingredient.unit },
    );
  } catch (error) {
    console.error('Could not sync stock doc for ingredient', ingredient?.id, error);
    return null;
  }
};

const getStocks = async (bakeryId, { itemType = null, search = null } = {}) => {
  let query = stocksRef(bakeryId);
  if (itemType) query = query.where('itemType', '==', itemType);

  const snapshot = await query.get();
  const stocks = snapshot.docs.map(toPlain);

  if (!search) return stocks;

  const needle = search.toLowerCase();
  return stocks.filter((stock) => (stock.name || '').toLowerCase().includes(needle));
};

const getStock = async (bakeryId, itemKey) => {
  const doc = await stocksRef(bakeryId).doc(itemKey).get();
  if (!doc.exists) throw new NotFoundError('Stock item not found');
  return toPlain(doc);
};

const getItemMovements = async (bakeryId, itemKey, { limit = 50, startAfter = null } = {}) => {
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

/**
 * The permanent manual escape hatch: a signed quantity with a required reason.
 * Also what makes the ledger hand-testable before deduction exists.
 */
const adjust = async (bakeryId, itemKey, { qty, reason, editor }) => {
  if (!reason || !String(reason).trim()) {
    throw new BadRequestError('Una corrección manual necesita un motivo');
  }

  const stock = await getStock(bakeryId, itemKey);

  const [movement] = await writeMovements(bakeryId, [
    {
      item: {
        itemType: stock.itemType,
        ingredientId: stock.ingredientId,
        productId: stock.productId,
        combinationId: stock.combinationId,
      },
      qty,
      type: MOVEMENT_TYPES.ADJUSTMENT,
      reason: String(reason).trim(),
      editor,
      name: stock.name,
      unit: stock.unit,
    },
  ]);

  return movement;
};

module.exports = {
  MOVEMENT_TYPES,
  ITEM_TYPES,
  buildItemKey,
  writeMovements,
  syncStockDoc,
  syncProductStockDocs,
  syncIngredientStockDoc,
  getStocks,
  getStock,
  getItemMovements,
  getOrderMovements,
  adjust,
};
