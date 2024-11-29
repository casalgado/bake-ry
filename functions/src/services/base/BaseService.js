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

  async getAll(parentId = null, query = {}) {
    try {
      let dbQuery = this.getCollectionRef(parentId);
      const { pagination, sort, filters } = query;
      console.log('query', query);
      console.log('pagination', pagination);
      console.log('sort', sort);
      console.log('filters', filters);

      // Apply filters
      if (filters) {
        // Handle date range filters
        if (filters.dateRange) {
          const { dateField, startDate, endDate } = filters.dateRange;
          console.log('dateField:', dateField);
          console.log('startDate:', startDate);
          console.log('endDate:', endDate);

          if (startDate) {
            dbQuery = dbQuery.where(dateField, '>=', new Date(startDate));
          }

          if (endDate) {
            dbQuery = dbQuery.where(dateField, '<=', new Date(endDate));
          }
        }

        // Handle other filters
        Object.entries(filters).forEach(([key, value]) => {
          if (key !== 'dateRange' && value !== undefined) {
            dbQuery = dbQuery.where(key, '==', value);
          }
        });
      }

      // Apply sorting
      if (sort) {
        dbQuery = dbQuery.orderBy(sort.field, sort.direction);
      } else {
        // Default sorting by createdAt desc if no sort specified
        dbQuery = dbQuery.orderBy('createdAt', 'desc');
      }

      // Apply pagination
      if (pagination) {
        const { perPage, offset } = pagination;

        if (offset) {
          dbQuery = dbQuery.offset(offset);
        }

        if (perPage) {
          dbQuery = dbQuery.limit(perPage);
        }
      }

      // Execute query
      const snapshot = await dbQuery.get();
      // Transform to model instances
      const documents = snapshot.docs.map(doc => this.ModelClass.fromFirestore(doc));

      // Return results with metadata
      return {
        items: documents,
        pagination: pagination ? {
          page: pagination.page,
          perPage: pagination.perPage,
          total: snapshot.size, // Note: This is the current page size, not total collection size
        } : null,
      };

    } catch (error) {
      console.error(`Error getting all ${this.collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Updates a document
   */
  async update(id, data, parentId = null, editor = null) {
    try {
      // Get reference to the document
      const docRef = this.getCollectionRef(parentId).doc(id);

      // Use transaction to ensure atomic updates
      return await db.runTransaction(async (transaction) => {
        // Get current document
        const doc = await transaction.get(docRef);

        if (!doc.exists) {
          throw new NotFoundError(`${this.collectionName} not found`);
        }

        // Get current data as model instance
        const currentData = this.ModelClass.fromFirestore(doc);

        // Create updated instance
        const updatedInstance = new this.ModelClass({
          ...currentData,
          ...data,
          id,
          updatedAt: new Date(),
        });

        // Compute what changed
        const changes = this.diffObjects(currentData, updatedInstance);

        // Record the changes in history
        await this.recordHistory(transaction, docRef, changes, currentData, editor);

        // Update the main document
        transaction.update(docRef, updatedInstance.toFirestore());

        return updatedInstance;
      });
    } catch (error) {
      console.error(`Error updating ${this.collectionName}:`, error);
      throw error;
    }
  }

  /**
 * Partially updates a document
 * Possible optimization here if necessary in the future
 * considering application costs
 */
  async patch(id, data, parentId = null, editor = null) {
    try {
      // Get reference to the document
      const docRef = this.getCollectionRef(parentId).doc(id);

      // Use transaction to ensure atomic updates
      return await db.runTransaction(async (transaction) => {
        // Get current document
        const doc = await transaction.get(docRef);

        if (!doc.exists) {
          throw new NotFoundError(`${this.collectionName} not found`);
        }

        // Get current data as model instance
        const currentData = this.ModelClass.fromFirestore(doc);

        // Create updated instance
        const updatedInstance = new this.ModelClass({
          ...currentData,
          ...data,
          id,
          updatedAt: new Date(),
        });

        // Compute what changed
        const changes = this.diffObjects(currentData, updatedInstance);

        // Record the changes in history
        await this.recordHistory(transaction, docRef, changes, currentData, editor);

        // Update the main document
        transaction.update(docRef, updatedInstance.toFirestore());

        return updatedInstance;
      });
    } catch (error) {
      console.error(`Error updating ${this.collectionName}:`, error);
      throw error;
    }
  }

  async recordHistory(transaction, docRef, changes, currentData, editor) {
    // Create a new document reference in the updateHistory subcollection
    const historyRef = docRef.collection('updateHistory').doc();

    // Create the history record object
    const historyRecord = {
      timestamp: new Date(),
      // Store who made the changes - if no editor is provided, use 'system'
      editor: {
        userId: editor?.uid || 'system',
        name: editor?.name || 'system',
        role: editor?.role || 'system',
      },
      // Store the actual changes (will be computed by diffObjects)
      changes,
    };

    // Add the history record within the same transaction
    transaction.set(historyRef, historyRecord);
  }

  diffObjects(oldObj, newObj) {
    const changes = {};

    // Convert model instances to plain objects if needed
    const oldData = oldObj.toFirestore ? oldObj.toFirestore() : oldObj;
    const newData = newObj.toFirestore ? newObj.toFirestore() : newObj;

    // Compare each property in the new data
    Object.keys(newData).forEach(key => {
      // Skip updatedAt since it changes on every update
      if (key === 'updatedAt') return;

      // If values are different, record both old and new values
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        changes[key] = {
          from: oldData[key],
          to: newData[key],
        };
      }
    });

    return changes;
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
