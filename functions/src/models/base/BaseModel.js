class BaseModel {
  constructor(data = {}) {
    // Common fields all models have
    this.id = data.id;

    // Assign remaining data to instance
    Object.assign(this, data);

    if (!this.createdAt) {
      this.createdAt = new Date();
    }

    this.constructor.dateFields.forEach(field => {
      if (this[field]) {
        this[field] = BaseModel.ensureDate(this[field]);
      }
    });

  }

  static ensureDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (value?.toDate) return value.toDate();
    if (typeof value === 'string' && !value.includes('T') && !value.includes(':')) {
      return new Date(value + 'T12:00:00Z');
    }
    return new Date(value);
  }

  // Define which fields should be treated as dates
  static get dateFields() {
    return ['createdAt', 'updatedAt'];
  }

  // Convert model instance to Firestore format
  toFirestore() {
    // Create a copy of the object without private fields

    const data = { ...this };
    // Remove id as it's stored as document ID
    delete data.id;

    // Remove any undefined values
    Object.keys(data).forEach((key) => {
      if (data[key] === undefined || Number.isNaN(data[key])) {
        delete data[key];
      }
    });

    return data;
  }

  // Create model instance from Firestore document
  static fromFirestore(doc) {
    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    const id = doc.id;

    return new this({ id, ...data });
  }
}

module.exports = BaseModel;
