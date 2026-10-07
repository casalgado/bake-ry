const BaseModel = require('./base/BaseModel');
const { BadRequestError } = require('../utils/errors');

const ITEM_TYPES = ['ingredient', 'product'];

// The invoice states qty and total; unitCost is derived, never typed.
const toLine = ({ item, itemKey = null, qty, total, updateCost = false } = {}) => ({
  item: { type: item?.type, id: item?.id, combinationId: item?.combinationId || null },
  itemKey,
  qty: Number(qty),
  total: Number(total),
  unitCost: Number(qty) > 0 ? Number(total) / Number(qty) : null,
  updateCost: Boolean(updateCost),
});

class Purchase extends BaseModel {
  constructor({
    id,
    bakeryId,
    providerId,
    date,
    warehouseId,
    lines = [],
    createdBy = null,
    isDeleted = false,
    createdAt,
    updatedAt,
  }) {
    super({ id, createdAt, updatedAt, date });
    this.bakeryId = bakeryId;
    this.providerId = providerId;
    this.warehouseId = warehouseId;
    this.lines = Array.isArray(lines) ? lines.map(toLine) : [];
    this.total = this.lines.reduce((sum, l) => sum + (l.total || 0), 0);
    this.createdBy = createdBy;
    // Never true: a confirmed purchase is immutable. Stored so the base list
    // query (`isDeleted != true`) doesn't skip the doc.
    this.isDeleted = isDeleted;
  }

  static get dateFields() {
    return [...super.dateFields, 'date'];
  }

  validate() {
    if (!this.providerId) throw new BadRequestError('La compra necesita un proveedor');
    if (Number.isNaN(this.date?.getTime())) {
      throw new BadRequestError('La fecha de la compra no es válida');
    }
    if (!this.lines.length) throw new BadRequestError('La compra necesita al menos una línea');

    this.lines.forEach((l, i) => {
      if (!ITEM_TYPES.includes(l.item.type) || !l.item.id) {
        throw new BadRequestError(`Línea ${i + 1}: ítem inválido`);
      }
      if (!(l.qty > 0)) {
        throw new BadRequestError(`Línea ${i + 1}: la cantidad debe ser mayor a 0`);
      }
      if (!Number.isFinite(l.total) || l.total < 0) {
        throw new BadRequestError(`Línea ${i + 1}: el total no es válido`);
      }
    });
  }
}

module.exports = Purchase;
