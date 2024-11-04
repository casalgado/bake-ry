// services/base/BaseService.js

const { db } = require('../../config/firebase');
const { NotFoundError } = require('../../utils/errors');

class BaseService {
  /**
   * @param {string} collectionName - Name of the Firestore collection
   * @param {class} ModelClass - The model class to use for this service
   * @param {string} parentPath - Optional parent path for nested collections (e.g., 'bakeries/{bakeryId}')
   */
  constructor(collectionName, ModelClass, parentPath = null) {
    this.collectionName = collectionName;
    this.ModelClass = ModelClass;
    this.parentPath = parentPath;
  }

  /**
   * Gets the Firestore collection reference
   * @param {string} parentId - ID of parent document if this is a nested collection
   * @returns Firestore collection reference
   */

  getCollectionRef(parentId = null) {
    if (this.parentPath && !parentId) {
      throw new Error('Parent ID is required for nested collections');
    }

    if (this.parentPath) {
      // Replace the placeholder with actual ID and add collection name
      const fullPath = `${this.parentPath.replace('{bakeryId}', parentId)}/${this.collectionName}`;
      return db.collection(fullPath);
    }

    return db.collection(this.collectionName);
  }

  /**
   * Creates a new document
   */
  async create(data, parentId = null) {
    try {
      const collectionRef = this.getCollectionRef(parentId);
      const docRef = collectionRef.doc();

      const instance = new this.ModelClass({
        id: docRef.id,
        ...data,
      });

      await docRef.set(instance.toFirestore());
      return instance;
    } catch (error) {
      console.error(`Error creating ${this.collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Gets a document by ID
   */
  async getById(id, parentId = null) {
    try {
      const docRef = this.getCollectionRef(parentId).doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new NotFoundError(`${this.collectionName} not found`);
      }

      return this.ModelClass.fromFirestore(doc);
    } catch (error) {
      console.error(`Error getting ${this.collectionName}:`, error);
      throw error;
    }
  }

  async getAll(parentId = null, filters = {}, options = {}) {
    try {
      let query = this.getCollectionRef(parentId);

      // Apply filters
      Object.entries(filters).forEach(([field, value]) => {
        if (value !== undefined && value !== '') {
          const [operator = '==', filterValue] = Array.isArray(value) ? value : ['==', value];
          query = query.where(field, operator, filterValue);
        }
      });

      // Apply sorting
      if (options.orderBy) {
        const [field, direction] = options.orderBy;
        query = query.orderBy(field, direction);
      }

      // Apply pagination
      if (options.offset) {
        query = query.offset(options.offset);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => this.ModelClass.fromFirestore(doc));
    } catch (error) {
      console.error(`Error getting all ${this.collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Updates a document
   */
  async update(id, data, parentId = null) {
    try {
      const docRef = this.getCollectionRef(parentId).doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new NotFoundError(`${this.collectionName} not found`);
      }

      const currentData = this.ModelClass.fromFirestore(doc);
      const updatedInstance = new this.ModelClass({
        ...currentData,
        ...data,
        id,
        updatedAt: new Date(),
      });

      await docRef.update(updatedInstance.toFirestore());
      return updatedInstance;
    } catch (error) {
      console.error(`Error updating ${this.collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Deletes a document
   */
  async delete(id, parentId = null) {
    try {
      const docRef = this.getCollectionRef(parentId).doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new NotFoundError(`${this.collectionName} not found`);
      }

      await docRef.delete();
    } catch (error) {
      console.error(`Error deleting ${this.collectionName}:`, error);
      throw error;
    }
  }
}

module.exports = BaseService;
