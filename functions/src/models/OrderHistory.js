// models/OrderHistory.js
const BaseModel = require('./base/BaseModel');

class OrderHistoryChange {
  constructor(change = {}) {
    this.from = change.from;
    this.to = change.to;
  }

  // Convert to plain object for Firestore
  toFirestore() {
    return {
      from: this.from,
      to: this.to,
    };
  }
}

class OrderHistory extends BaseModel {
  constructor({
    id,
    timestamp,
    editor = {
      userId: 'system',
      name: 'system',
      role: 'system',
    },
    changes = {},
    createdAt,
    updatedAt,
  } = {}) {
    super({ id, timestamp, editor, changes, createdAt, updatedAt });

    // Process changes after BaseModel has handled dates
    this.changes = Object.entries(changes).reduce((acc, [field, change]) => {
      acc[field] = new OrderHistoryChange(change);
      return acc;
    }, {});
  }

  // Add timestamp to dateFields
  static get dateFields() {
    return [...super.dateFields, 'timestamp'];
  }

  toFirestore() {
    const data = super.toFirestore();

    // Convert changes to plain objects
    const changes = Object.entries(this.changes).reduce((acc, [field, change]) => {
      acc[field] = change.toFirestore();
      return acc;
    }, {});

    return {
      ...data,
      changes,
    };
  }

  // Helper methods
  hasFieldChange(fieldName) {
    return fieldName in this.changes;
  }

  getChange(fieldName) {
    return this.hasFieldChange(fieldName) ? this.changes[fieldName] : null;
  }

  getSummary() {
    return {
      timestamp: this.timestamp,
      editor: this.editor,
      changedFields: Object.keys(this.changes),
      changes: this.changes,
    };
  }
}

module.exports = OrderHistory;
