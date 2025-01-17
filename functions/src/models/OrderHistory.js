// models/OrderHistory.js
const BaseModel = require('./base/BaseModel');

class OrderHistoryChange {
  constructor(change = {}) {
    this.from = this.formatValue(change.from);
    this.to = this.formatValue(change.to);
  }

  // Helper to format values, including nested dates
  formatValue(value) {
    if (this.isFirestoreTimestamp(value)) {
      return this.convertTimestamp(value);
    }

    // Handle arrays (like orderItems)
    if (Array.isArray(value)) {
      return value.map(item => this.formatValue(item));
    }

    // Handle nested objects
    if (value && typeof value === 'object') {
      const formatted = {};
      for (const [key, val] of Object.entries(value)) {
        formatted[key] = this.formatValue(val);
      }
      return formatted;
    }

    return value;
  }

  isFirestoreTimestamp(value) {
    return value &&
           typeof value === 'object' &&
           '_seconds' in value &&
           '_nanoseconds' in value;
  }

  convertTimestamp(timestamp) {
    return new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000);
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
      email: 'system@system.com',
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

  static get dateFields() {
    return [...super.dateFields, 'timestamp'];
  }

  toFirestore() {
    const data = super.toFirestore();

    const changes = Object.entries(this.changes).reduce((acc, [field, change]) => {
      acc[field] = change.toFirestore();
      return acc;
    }, {});

    return {
      ...data,
      changes,
    };
  }

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
