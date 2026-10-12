const BaseModel = require('./base/BaseModel');

// One count of one bodega. status: 'open' | 'closing' | 'closed' | 'discarded'.
// `closing` is the short stretch while close processes the counted items in
// chunks: no more typing, no discard, and close can be called again to resume.
// `items` is a map keyed by itemKey, not an array: each typed number is a
// single field write (`items.<itemKey>`), so two people on different rows
// never overwrite each other.
// Open rows carry { qty, by, at }. Close freezes name, unit, expectedQty,
// diffQty, unitCost (null = could not resolve) and wasteSinceBaseline onto each.
// closedBy/closedAt are set by close and by discard; status tells them apart.
class StockCount extends BaseModel {
  constructor({
    id,
    warehouseId,
    status = 'open',
    createdBy = null,
    items = {},
    closedBy = null,
    closedAt = null,
    totalItems = null,
    createdAt,
    updatedAt,
  }) {
    super({ id, createdAt, updatedAt, closedAt });
    this.warehouseId = warehouseId;
    this.status = status;
    this.createdBy = createdBy;
    this.items = Object.fromEntries(Object.entries(items || {}).map(([key, row]) => [
      key,
      { ...row, at: BaseModel.ensureDate(row.at) },
    ]));
    this.closedBy = closedBy;
    this.totalItems = totalItems;
  }

  static get dateFields() {
    return [...super.dateFields, 'closedAt'];
  }
}

module.exports = StockCount;
