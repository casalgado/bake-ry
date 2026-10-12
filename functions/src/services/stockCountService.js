const { db } = require('../config/firebase');
const { FieldValue } = require('firebase-admin/firestore');
const StockCount = require('../models/StockCount');
const createBaseService = require('./base/serviceFactory');
const { BadRequestError, NotFoundError } = require('../utils/errors');
const {
  MOVEMENT_TYPES,
  ITEM_TYPES,
  buildStockDocId,
  resolveWarehouseId,
  writeMovements,
  itemOf,
  roundQty,
} = require('./stockService');

// Counted items closed per transaction. A differing item costs two writes (its
// movement and its stocks doc) and the count doc one more: 401 writes, inside
// the 500 a transaction has been allowed to hold.
const CLOSE_CHUNK = 200;

/**
 * Conteo: people type what is on the shelf, live and together, and closing sets
 * each counted item's baseline to that number. See the frontend repo's
 * zplanning/inventory/INVENTORY.md §4.5.
 * Rows change one at a time (setItem); there is no whole-count update.
 */
const createStockCountService = () => {
  const baseService = createBaseService('stockCounts', StockCount, 'bakeries/{bakeryId}');
  const countsRef = baseService.getCollectionRef;
  const stocksRef = (bakeryId) => db.collection(`bakeries/${bakeryId}/stocks`);
  const movementsRef = (bakeryId) => db.collection(`bakeries/${bakeryId}/stockMovements`);

  // It becomes a field path and part of a doc id.
  const ITEM_KEY = /^[A-Za-z0-9_-]{1,200}$/;

  const editorOf = (user) => ({ userId: user?.uid, email: user?.email, role: user?.role });

  // Each row shows who counted it, so this carries a name, read off the user's doc.
  const whoOf = async (bakeryId, user) => {
    const doc = await db.doc(`bakeries/${bakeryId}/users/${user?.uid}`).get();
    return { userId: user?.uid || null, name: doc.data()?.name || user?.email || '' };
  };

  const readCount = async (read) => {
    const doc = await read;
    if (!doc.exists) throw new NotFoundError('Conteo no encontrado');
    return StockCount.fromFirestore(doc);
  };

  const requireOpen = (count) => {
    if (count.status !== 'open') throw new BadRequestError('El conteo ya no está abierto');
    return count;
  };

  // The list shows totals, not rows: a closed count carries hundreds.
  const summarize = ({ items, ...count }) => {
    const rows = Object.values(items);
    return {
      ...count,
      counted: rows.length,
      counters: [...new Set(rows.map((row) => row.by?.name).filter(Boolean))],
      netValue: count.status === 'closed'
        ? rows.reduce((sum, row) => sum + (row.diffQty || 0) * (row.unitCost || 0), 0)
        : null,
    };
  };

  // ponytail: the latest 100; paginate when a bakery has more counts than that.
  const getAll = async (bakeryId) => {
    const snapshot = await countsRef(bakeryId).orderBy('createdAt', 'desc').limit(100).get();
    return snapshot.docs.map((doc) => summarize(StockCount.fromFirestore(doc)));
  };

  /** Open-or-join: two people pressing Empezar at once land on the same count. */
  const open = async (bakeryId, { warehouseId } = {}, user = null) => {
    const resolved = await resolveWarehouseId(bakeryId, warehouseId);
    const createdBy = await whoOf(bakeryId, user);
    const ref = countsRef(bakeryId);

    return db.runTransaction(async (t) => {
      const existing = await t.get(
        ref.where('status', '==', 'open').where('warehouseId', '==', resolved).limit(1),
      );
      if (!existing.empty) return StockCount.fromFirestore(existing.docs[0]);

      const doc = ref.doc();
      const count = new StockCount({ id: doc.id, warehouseId: resolved, createdBy });
      t.set(doc, count.toFirestore());
      return count;
    });
  };

  /** One row: `qty ≥ 0` sets it (latest wins), `qty: null` clears it. */
  const setItem = async (bakeryId, countId, itemKey, { qty } = {}, user = null) => {
    if (!ITEM_KEY.test(itemKey || '')) throw new BadRequestError('itemKey inválido');
    const clear = qty === null;
    if (!clear && !(typeof qty === 'number' && Number.isFinite(qty) && qty >= 0)) {
      throw new BadRequestError('La cantidad debe ser 0 o más');
    }

    const by = await whoOf(bakeryId, user);
    const ref = countsRef(bakeryId).doc(countId);

    return db.runTransaction(async (t) => {
      const count = requireOpen(await readCount(t.get(ref)));
      const stock = await t.get(stocksRef(bakeryId).doc(buildStockDocId(itemKey, count.warehouseId)));
      if (!stock.exists) throw new BadRequestError('Ese ítem no está en esta bodega');

      const row = clear ? null : { qty, by, at: new Date() };
      t.update(ref, {
        [`items.${itemKey}`]: row || FieldValue.delete(),
        updatedAt: new Date(),
      });
      return { itemKey, row };
    });
  };

  /** Same rules as the frontend's useItemCatalog.costOf: null = could not resolve. */
  const costOf = async (bakeryId, stock) => {
    if (stock.itemType === ITEM_TYPES.INGREDIENT) {
      const doc = await db.doc(`bakeries/${bakeryId}/ingredients/${stock.ingredientId}`).get();
      return doc.exists ? doc.data().costPerUnit ?? 0 : null;
    }

    const doc = await db.doc(`bakeries/${bakeryId}/products/${stock.productId}`).get();
    if (!doc.exists) return null;
    const product = doc.data();
    const combo = stock.combinationId
      ? (product.variations?.combinations || []).find((c) => c.id === stock.combinationId)
      : product;
    return combo ? combo.costPrice ?? 0 : null;
  };

  // ponytail: reads every baja the item ever had and filters in memory. Narrow the
  // query by warehouseId and timestamp (composite index itemKey, type,
  // warehouseId, timestamp) if closing a count gets slow.
  /** Σ bajas of the item in this bodega since its last baseline (negative). */
  const wasteSince = async (bakeryId, stock) => {
    const snapshot = await movementsRef(bakeryId)
      .where('itemKey', '==', stock.itemKey)
      .where('type', '==', MOVEMENT_TYPES.WASTE)
      .get();
    const since = stock.baselineAt?.toDate?.() || new Date(0);
    return roundQty(snapshot.docs
      .map((doc) => doc.data())
      .filter((m) => m.warehouseId === stock.warehouseId && m.timestamp.toDate() >= since)
      .reduce((sum, m) => sum + m.qty, 0));
  };

  // Unbounded reads, so outside the close transactions (invariant 4).
  const describeItems = async (bakeryId, warehouseId, keys) => Object.fromEntries(
    await Promise.all(keys.map(async (key) => {
      const doc = await stocksRef(bakeryId).doc(buildStockDocId(key, warehouseId)).get();
      if (!doc.exists) throw new BadRequestError(`${key} no está en esta bodega`);
      const stock = doc.data();
      const [unitCost, wasteSinceBaseline] = await Promise.all([
        costOf(bakeryId, stock),
        wasteSince(bakeryId, stock),
      ]);
      return [key, { unitCost, wasteSinceBaseline }];
    })),
  );

  // A row is frozen once close has measured it; open rows have no diffQty.
  const isFrozen = (row) => row.diffQty !== undefined;

  /**
   * One chunk of counted items, one transaction: per item a `count` movement
   * for the difference against currentStock (none when it matches) and
   * baselineQty = counted, baselineAt = the count's close time. The rows are
   * frozen onto the count. Items are independent (baselines are per item) and
   * their movement ids are deterministic, so a chunk that already ran is skipped.
   */
  const closeChunk = async (bakeryId, ref, keys, known, closing, editor) => {
    await db.runTransaction(async (t) => {
      const count = await readCount(t.get(ref));
      if (count.status !== 'closing') throw new BadRequestError('El conteo ya no se está cerrando');

      const todo = keys.filter((key) => count.items[key] && !isFrozen(count.items[key]));
      if (!todo.length) return;

      const stockRefs = todo.map((key) => stocksRef(bakeryId).doc(buildStockDocId(key, count.warehouseId)));
      const stockDocs = await Promise.all(stockRefs.map((stockRef) => t.get(stockRef)));

      // verify() sums movements at or after baselineAt; the baseline already
      // holds this one, so it lands 1 ms before.
      const movedAt = new Date(closing.closedAt.getTime() - 1);
      const frozen = {};
      const movements = [];
      const stockFields = {};
      const unmoved = [];

      todo.forEach((key, i) => {
        const stock = stockDocs[i].data();
        const row = count.items[key];
        const expectedQty = Number(stock.currentStock) || 0;
        const diffQty = roundQty(row.qty - expectedQty);
        const { unitCost, wasteSinceBaseline } = known[key];

        frozen[`items.${key}`] = {
          ...row, name: stock.name, unit: stock.unit, expectedQty, diffQty, unitCost, wasteSinceBaseline,
        };
        stockFields[stockRefs[i].id] = { baselineQty: row.qty, baselineAt: closing.closedAt };

        if (diffQty === 0) {
          unmoved.push(stockRefs[i]);
          return;
        }
        movements.push({
          id: `count_${count.id}_${key}`,
          item: itemOf(stock),
          warehouseId: count.warehouseId,
          qty: diffQty,
          type: MOVEMENT_TYPES.COUNT,
          refs: { countId: count.id },
          editor,
          timestamp: movedAt,
          unitCost,
          name: stock.name,
          unit: stock.unit,
        });
      });

      // A movement's baseline rides on its one cache write; a matching count
      // still verifies the item, with a plain update.
      await writeMovements(bakeryId, movements, { transaction: t, stockFields });
      unmoved.forEach((stockRef) => t.update(stockRef, {
        ...stockFields[stockRef.id], updatedAt: closing.closedAt,
      }));
      t.update(ref, { ...frozen, updatedAt: closing.closedAt });
    });
  };

  /**
   * Closes a count: open → closing → closed. Closing stops further typing and
   * stamps the close time; the counted items are then processed in chunks (see
   * closeChunk), and the last step marks the count closed. A count left in
   * `closing` by a crash is finished by calling close again.
   */
  const close = async (bakeryId, countId, user = null) => {
    const ref = countsRef(bakeryId).doc(countId);
    const editor = editorOf(user);
    const closedBy = await whoOf(bakeryId, user);

    const closing = await db.runTransaction(async (t) => {
      const count = await readCount(t.get(ref));
      if (count.status === 'closing') return count;

      requireOpen(count);
      const closedAt = new Date();
      t.update(ref, { status: 'closing', closedBy, closedAt, updatedAt: closedAt });
      return new StockCount({ ...count, status: 'closing', closedBy, closedAt, updatedAt: closedAt });
    });

    const pending = Object.keys(closing.items).filter((key) => !isFrozen(closing.items[key]));
    const known = await describeItems(bakeryId, closing.warehouseId, pending);
    const totalItems = (await stocksRef(bakeryId)
      .where('warehouseId', '==', closing.warehouseId).count().get()).data().count;

    for (let i = 0; i < pending.length; i += CLOSE_CHUNK) {
      await closeChunk(bakeryId, ref, pending.slice(i, i + CLOSE_CHUNK), known, closing, editor);
    }

    return db.runTransaction(async (t) => {
      const count = await readCount(t.get(ref));
      if (count.status === 'closed') return count;
      if (count.status !== 'closing') throw new BadRequestError('El conteo ya no se está cerrando');

      const updatedAt = new Date();
      t.update(ref, { status: 'closed', totalItems, updatedAt });
      return new StockCount({ ...count, status: 'closed', totalItems, updatedAt });
    });
  };

  /** Ends an open count for everyone. Writes nothing to the ledger. */
  const discard = async (bakeryId, countId, user = null) => {
    const ref = countsRef(bakeryId).doc(countId);
    const closedBy = await whoOf(bakeryId, user);

    return db.runTransaction(async (t) => {
      const count = requireOpen(await readCount(t.get(ref)));
      const now = new Date();
      const discarded = new StockCount({
        ...count, status: 'discarded', closedBy, closedAt: now, updatedAt: now,
      });
      t.set(ref, discarded.toFirestore());
      return discarded;
    });
  };

  return {
    getAll,
    getById: baseService.getById,
    open,
    setItem,
    close,
    discard,
  };
};

module.exports = createStockCountService();
