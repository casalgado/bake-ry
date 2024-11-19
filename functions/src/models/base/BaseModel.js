class BaseModel {
  constructor(data = {}) {
    // Common fields all models have
    this.id = data.id;

    // Assign remaining data to instance
    Object.assign(this, data);

    // Ensure dates are properly set using the static getter directly
    this.constructor.dateFields.forEach(field => {
      if (!this[field]) {
        this[field] = new Date();
      }
    });
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
      if (data[key] === undefined || data[key] === null || data[key] === '' || Number.isNaN(data[key])) {
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

    // Standardize date conversion using the static getter
    this.dateFields.forEach((field) => {
      if (data[field]) {
        // Handle both Timestamp objects and date strings
        if (data[field].toDate) {
          data[field] = data[field].toDate();
        } else if (typeof data[field] === 'string') {
          data[field] = new Date(data[field]);
        }
      }
    });

    return new this({ id, ...data });
  }
}

module.exports = BaseModel;
