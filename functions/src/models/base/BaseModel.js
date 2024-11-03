class BaseModel {
  constructor(data = {}) {
    // Store date fields from child class or use defaults
    this._dateFields = this.constructor.dateFields || ['createdAt', 'updatedAt'];

    // Common fields all models have
    this.id = data.id;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();

    // Assign remaining data to instance
    Object.assign(this, data);
  }

  // Define which fields should be treated as dates
  // Child classes will override this to add their specific date fields
  static get dateFields() {
    return ['createdAt', 'updatedAt'];
  }

  // Convert model instance to Firestore format
  toFirestore() {
    // Create a copy of the object without private fields
    const data = { ...this };

    // Remove internal properties
    delete data._dateFields;

    // Remove id as it's stored as document ID
    delete data.id;

    // Remove any undefined values
    Object.keys(data).forEach((key) => {
      if (data[key] === undefined) {
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

    // Convert all date fields from Firestore Timestamp to JavaScript Date
    this.dateFields.forEach((field) => {
      if (data[field]?.toDate) {
        data[field] = data[field].toDate();
      }
    });

    return new this({ id, ...data });
  }
}

module.exports = BaseModel;
