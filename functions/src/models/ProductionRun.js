const BaseModel = require('./base/BaseModel');
const { BadRequestError } = require('../utils/errors');
const { generateId } = require('../utils/helpers');

const ITEM_TYPES = ['ingredient', 'product'];
const LINE_STATUSES = ['pending', 'received', 'cancelled'];

// One thing to make. Lives on the run doc, the way OrderItem lives on Order.
// Not an OrderItem: that is a sales line (price, tax) and can't hold a preparación.
// `name`/`unit`/`collectionName` are copied in at send, like OrderItem's
// productName: the kitchen list renders runs without loading the catalog.
// `receiptNo` counts how many times the line has been received: a line can be
// undone and received again, and each receipt writes its own movements.
const toLine = ({
  id,
  item,
  name = '',
  unit = '',
  collectionName = '',
  plannedQty,
  status = 'pending',
  receivedQty = null,
  receivedAt = null,
  receivedBy = null,
  receiptNo = 0,
} = {}) => ({
  id: id || generateId(),
  item: { type: item?.type, id: item?.id, combinationId: item?.combinationId || null },
  name,
  unit,
  collectionName,
  plannedQty: Number(plannedQty),
  status,
  receivedQty,
  receivedAt: receivedAt ? BaseModel.ensureDate(receivedAt) : null,
  receivedBy,
  receiptNo: Number(receiptNo) || 0,
});

class ProductionRun extends BaseModel {
  static LINE_STATUSES = LINE_STATUSES;

  constructor({
    id,
    bakeryId,
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
    this.warehouseId = warehouseId;
    this.lines = Array.isArray(lines) ? lines.map(toLine) : [];
    this.createdBy = createdBy;
    // Stored so the base list query (`isDeleted != true`) doesn't skip the doc.
    this.isDeleted = isDeleted;
    // Derived, never sent: open while anything is still to be made. Stored so
    // the kitchen can filter open runs; every write rebuilds the model, so it
    // never goes stale.
    this.status = this.lines.some((l) => l.status === 'pending') ? 'open' : 'closed';
  }

  static get dateFields() {
    return [...super.dateFields, 'date'];
  }

  validate() {
    if (Number.isNaN(this.date?.getTime())) {
      throw new BadRequestError('La fecha de la producción no es válida');
    }
    if (!this.lines.length) throw new BadRequestError('La producción necesita al menos una línea');

    this.lines.forEach((l, i) => {
      if (!ITEM_TYPES.includes(l.item.type) || !l.item.id) {
        throw new BadRequestError(`Línea ${i + 1}: ítem inválido`);
      }
      if (!(l.plannedQty > 0)) {
        throw new BadRequestError(`Línea ${i + 1}: la cantidad debe ser mayor a 0`);
      }
      if (!LINE_STATUSES.includes(l.status)) {
        throw new BadRequestError(`Línea ${i + 1}: estado inválido`);
      }
    });
  }
}

module.exports = ProductionRun;
