const { db } = require('../config/firebase');
const Purchase = require('../models/Purchase');
const createBaseService = require('./base/serviceFactory');
const { BadRequestError } = require('../utils/errors');
const {
  MOVEMENT_TYPES,
  ITEM_TYPES,
  buildItemKey,
  resolveWarehouseId,
  writeMovements,
  toStockItem,
  retryId,
} = require('./stockService');
const {
  createPlan,
  stage,
  stagedData,
  recordCostChange,
  sameCost,
  planIngredientCostPropagation,
  applyPlan,
} = require('./recipeGraph');

const createPurchaseService = () => {
  const baseService = createBaseService('purchases', Purchase, 'bakeries/{bakeryId}');

  const ingredientsRef = (bakeryId) => db.collection(`bakeries/${bakeryId}/ingredients`);
  const productsRef = (bakeryId) => db.collection(`bakeries/${bakeryId}/products`);
  const providersRef = (bakeryId) => db.collection(`bakeries/${bakeryId}/providers`);

  /** What the ledger needs to know about a line's item, or why it can't be bought. */
  const describeLine = (line, doc, i) => {
    const where = `Línea ${i + 1}`;
    if (!doc.exists || doc.data().isDeleted) {
      throw new BadRequestError(`${where}: el ítem no existe`);
    }
    const data = doc.data();

    if (line.item.type === ITEM_TYPES.INGREDIENT) {
      return { name: data.name, unit: data.unit || '', ingredient: data };
    }

    // The Ingreso shelf rule: only resale products are bought.
    if (data.inventoryMode !== 'unit') {
      throw new BadRequestError(`${where}: ${data.name} no es un producto de reventa`);
    }

    // A product with variations keeps one stock row per combination.
    const combinations = data.variations?.combinations || [];
    if (data.hasVariations && combinations.length) {
      const combination = combinations.find((c) => c.id === line.item.combinationId);
      if (!combination) {
        throw new BadRequestError(`${where}: elige la variación de ${data.name}`);
      }
      return { name: `${data.name} ${combination.name}`.trim(), unit: 'uds', product: data };
    }
    if (line.item.combinationId) {
      throw new BadRequestError(`${where}: ${data.name} no tiene variaciones`);
    }
    return { name: data.name, unit: 'uds', product: data };
  };

  const isManual = (source) => (source || 'manual') === 'manual';

  /**
   * Resale products: the price paid is the cost. Only a manually costed product
   * or combination; a recipe-costed one is never overwritten. Last line wins
   * when one item appears twice.
   *
   * ponytail: not propagated to recipes that use the product as a component —
   * recipeGraph's walk stops at products. reconcileOwnerCost is the backstop.
   */
  const planProductCosts = (plan, bakeryId, lines, described) => {
    const byItem = new Map();
    lines.forEach((line, i) => {
      const { product } = described[i];
      if (!line.updateCost || !product || !(line.unitCost > 0)) return;
      byItem.set(`${line.item.id}:${line.item.combinationId || ''}`, { line, product });
    });

    for (const { line, product } of byItem.values()) {
      const ref = productsRef(bakeryId).doc(line.item.id);
      const to = line.unitCost;

      if (!line.item.combinationId) {
        if (!isManual(product.costPriceSource) || sameCost(product.costPrice, to)) continue;
        stage(plan, ref, { costPrice: to, updatedAt: new Date() });
        recordCostChange(plan, ref, { costPrice: { from: Number(product.costPrice) || 0, to } });
        continue;
      }

      // Build on the staged variations when a sibling combination was already
      // planned in this purchase, otherwise on the stored snapshot.
      const variations = stagedData(plan, ref)?.variations || product.variations || {};
      const combinations = variations.combinations || [];
      const target = combinations.find((c) => c.id === line.item.combinationId);
      if (!target || !isManual(target.costPriceSource) || sameCost(target.costPrice, to)) continue;

      stage(plan, ref, {
        variations: {
          ...variations,
          combinations: combinations.map((c) => (c.id === target.id ? { ...c, costPrice: to } : c)),
        },
        updatedAt: new Date(),
      });
      recordCostChange(plan, ref, {
        costPrice: { from: Number(target.costPrice) || 0, to, combinationId: target.id },
      });
    }
  };

  /**
   * One transaction: the purchase doc, one `purchase` movement per line, and the
   * opt-in cost updates (ingredients with their propagation, resale products).
   * All or nothing.
   * Every read happens before any write.
   */
  const create = async (data, bakeryId, user = null) => {
    const editor = { userId: user?.uid, email: user?.email, role: user?.role };
    const warehouseId = await resolveWarehouseId(bakeryId, data.warehouseId);

    const draft = new Purchase({
      bakeryId,
      providerId: data.providerId,
      date: data.date || new Date(),
      warehouseId,
      lines: data.lines || [],
      createdBy: editor,
    });
    draft.validate();

    const purchasesRef = baseService.getCollectionRef(bakeryId);
    const id = retryId(data.idempotencyKey, 'purchase');
    const purchaseRef = id ? purchasesRef.doc(id) : purchasesRef.doc();

    return db.runTransaction(async (t) => {
      // ---- reads ----
      const existing = await t.get(purchaseRef);
      if (existing.exists) return Purchase.fromFirestore(existing);

      const provider = await t.get(providersRef(bakeryId).doc(draft.providerId));
      if (!provider.exists || provider.data().isDeleted) {
        throw new BadRequestError('El proveedor no existe');
      }

      const itemDocs = await Promise.all(draft.lines.map((line) =>
        t.get((line.item.type === ITEM_TYPES.INGREDIENT ? ingredientsRef : productsRef)(bakeryId)
          .doc(line.item.id))));
      const described = draft.lines.map((line, i) => describeLine(line, itemDocs[i], i));

      // Preparaciones are skipped: their cost comes from their recipe. A $0 line
      // (a gift, a sample) never zeroes a cost. Last line wins when one
      // ingredient appears twice: one cost, one walk.
      const newCosts = new Map();
      draft.lines.forEach((line, i) => {
        const { ingredient } = described[i];
        if (!line.updateCost || !ingredient || ingredient.recipeId || !(line.unitCost > 0)) return;
        newCosts.set(line.item.id, {
          from: Number(ingredient.costPerUnit) || 0,
          to: line.unitCost,
        });
      });
      newCosts.forEach(({ from, to }, ingredientId) => {
        if (sameCost(from, to)) newCosts.delete(ingredientId);
      });

      // Seed every new price before walking, so a recipe fed by two purchased
      // ingredients is costed once, with both.
      const plan = createPlan();
      newCosts.forEach(({ to }, ingredientId) =>
        plan.costOverrides.set(`ingredient_${ingredientId}`, to));
      for (const [ingredientId, { from, to }] of newCosts) {
        const ref = ingredientsRef(bakeryId).doc(ingredientId);
        stage(plan, ref, { costPerUnit: to, updatedAt: new Date() });
        recordCostChange(plan, ref, { costPerUnit: { from, to } });
        await planIngredientCostPropagation(t, bakeryId, ingredientId, to, { plan });
      }
      planProductCosts(plan, bakeryId, draft.lines, described);

      // ---- writes (writeMovements reads its stock docs first) ----
      const purchase = new Purchase({
        ...draft,
        id: purchaseRef.id,
        lines: draft.lines.map((line) => ({
          ...line,
          itemKey: buildItemKey(toStockItem(line.item)),
        })),
      });

      await writeMovements(bakeryId, purchase.lines.map((line, i) => ({
        id: `${purchaseRef.id}_${i}`,
        item: toStockItem(line.item),
        warehouseId,
        qty: line.qty,
        type: MOVEMENT_TYPES.PURCHASE,
        unitCost: line.unitCost,
        refs: { purchaseId: purchaseRef.id },
        editor,
        name: described[i].name,
        unit: described[i].unit,
      })), { transaction: t });

      t.set(purchaseRef, purchase.toFirestore());
      applyPlan(t, plan, { editor: user, reason: 'purchase' });
      return purchase;
    });
  };

  /** The provider's newest purchase: what the Ingreso basket prefills from. */
  const getLastPurchase = async (bakeryId, providerId) => {
    const snapshot = await baseService.getCollectionRef(bakeryId)
      .where('providerId', '==', providerId)
      .orderBy('date', 'desc')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    return snapshot.empty ? null : Purchase.fromFirestore(snapshot.docs[0]);
  };

  // No update/patch/remove: a confirmed purchase is immutable.
  return {
    getCollectionRef: baseService.getCollectionRef,
    getAll: baseService.getAll,
    getById: baseService.getById,
    create,
    getLastPurchase,
  };
};

module.exports = createPurchaseService();
