const { db } = require('../../config/firebase');
const { NotFoundError } = require('../../utils/errors');

const createBaseService = (collectionName, ModelClass, parentPath = null) => {
  // Helper functions
  const getCollectionRef = (parentId = null) => {
    if (parentPath && !parentId) {
      throw new Error('Parent ID is required for nested collections');
    }

    if (parentPath) {
      const fullPath = `${parentPath.replace('{bakeryId}', parentId)}/${collectionName}`;
      return db.collection(fullPath);
    }

    return db.collection(collectionName);
  };

  const diffObjects = (oldObj, newObj) => {
    const changes = {};
    const oldData = oldObj.toFirestore ? oldObj.toFirestore() : oldObj;
    const newData = newObj.toFirestore ? newObj.toFirestore() : newObj;

    Object.keys(newData).forEach(key => {
      if (key === 'updatedAt') return;

      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        changes[key] = {
          from: oldData[key],
          to: newData[key],
        };
      }
    });

    return changes;
  };

  const recordHistory = async (transaction, docRef, changes, currentData, editor) => {
    const historyRef = docRef.collection('updateHistory').doc();
    const historyRecord = {
      timestamp: new Date(),
      editor: {
        userId: editor?.uid || 'system',
        name: editor?.name || 'system',
        role: editor?.role || 'system',
      },
      changes,
    };

    transaction.set(historyRef, historyRecord);
  };

  // Service methods
  const create = async (data, parentId = null) => {
    try {
      const collectionRef = getCollectionRef(parentId);
      const docRef = collectionRef.doc();

      const instance = new ModelClass({
        id: docRef.id,
        ...data,
      });

      await docRef.set(instance.toFirestore());
      return instance;
    } catch (error) {
      console.error(`Error creating ${collectionName}:`, error);
      throw error;
    }
  };

  const getById = async (id, parentId = null) => {
    try {
      const docRef = getCollectionRef(parentId).doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new NotFoundError(`${collectionName} not found`);
      }

      return ModelClass.fromFirestore(doc);
    } catch (error) {
      console.error(`Error getting ${collectionName}:`, error);
      throw error;
    }
  };

  const getAll = async (parentId = null, query = {}) => {
    try {
      let dbQuery = getCollectionRef(parentId);
      const { pagination, sort, filters } = query;

      const hasIsDeletedField =
        Object.prototype.hasOwnProperty.call(ModelClass.prototype, 'isDeleted') ||
        Object.prototype.hasOwnProperty.call(ModelClass, 'isDeleted');

      if (!query.includeDeleted && hasIsDeletedField) {
        dbQuery = dbQuery.where('isDeleted', '!=', true);
      }

      if (filters) {
        if (filters.dateRange) {
          const { dateField, startDate, endDate } = filters.dateRange;

          if (startDate) {
            dbQuery = dbQuery.where(dateField, '>=', new Date(startDate));
          }
          if (endDate) {
            dbQuery = dbQuery.where(dateField, '<=', new Date(endDate));
          }
        }

        Object.entries(filters).forEach(([key, value]) => {
          if (key !== 'dateRange' && value !== undefined) {
            dbQuery = dbQuery.where(key, '==', value);
          }
        });
      }

      if (sort) {
        dbQuery = dbQuery.orderBy(sort.field, sort.direction);
      } else {
        dbQuery = dbQuery.orderBy('createdAt', 'desc');
      }

      if (pagination) {
        const { perPage, offset } = pagination;
        if (offset) dbQuery = dbQuery.offset(offset);
        if (perPage) dbQuery = dbQuery.limit(perPage);
      }

      const snapshot = await dbQuery.get();
      const documents = snapshot.docs.map(doc => ModelClass.fromFirestore(doc));

      return {
        items: documents,
        pagination: pagination ? {
          page: pagination.page,
          perPage: pagination.perPage,
          total: snapshot.size,
        } : null,
      };
    } catch (error) {
      console.error(`Error getting all ${collectionName}:`, error);
      throw error;
    }
  };

  const update = async (id, data, parentId = null, editor = null) => {
    try {
      const docRef = getCollectionRef(parentId).doc(id);

      return await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);

        if (!doc.exists) {
          throw new NotFoundError(`${collectionName} not found`);
        }

        const currentData = ModelClass.fromFirestore(doc);
        const updatedInstance = new ModelClass({
          ...currentData,
          ...data,
          id,
          updatedAt: new Date(),
        });

        const changes = diffObjects(currentData, updatedInstance);
        await recordHistory(transaction, docRef, changes, currentData, editor);
        transaction.update(docRef, updatedInstance.toFirestore());

        return updatedInstance;
      });
    } catch (error) {
      console.error(`Error updating ${collectionName}:`, error);
      throw error;
    }
  };

  const patch = async (id, data, parentId = null, editor = null) => {
    try {
      const docRef = getCollectionRef(parentId).doc(id);

      return await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);

        if (!doc.exists) {
          throw new NotFoundError(`${collectionName} not found`);
        }

        const currentData = ModelClass.fromFirestore(doc);
        const updatedInstance = new ModelClass({
          ...currentData,
          ...data,
          id,
          updatedAt: new Date(),
          lastEditedBy: {
            userId: editor?.uid,
            name: editor?.name,
            role: editor?.role,
          },
        });

        const changes = diffObjects(currentData, updatedInstance);
        await recordHistory(transaction, docRef, changes, currentData, editor);
        transaction.update(docRef, updatedInstance.toFirestore());

        return updatedInstance;
      });
    } catch (error) {
      console.error(`Error updating ${collectionName}:`, error);
      throw error;
    }
  };

  const remove = async (id, parentId = null, editor = null) => {
    try {
      const docRef = getCollectionRef(parentId).doc(id);

      return await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);

        if (!doc.exists) {
          throw new NotFoundError(`${collectionName} not found`);
        }

        const currentData = ModelClass.fromFirestore(doc);
        const updatedInstance = new ModelClass({
          ...currentData,
          isDeleted: true,
          updatedAt: new Date(),
          lastEditedBy: {
            userId: editor?.uid,
            name: editor?.name,
            role: editor?.role,
          },
        });

        const changes = diffObjects(currentData, updatedInstance);
        await recordHistory(transaction, docRef, changes, currentData, editor);
        transaction.update(docRef, updatedInstance.toFirestore());

        return updatedInstance;
      });
    } catch (error) {
      console.error(`Error deleting ${collectionName}:`, error);
      throw error;
    }
  };

  return {
    create,
    getById,
    getAll,
    update,
    patch,
    remove,
    // Expose helper functions if needed by extending services
    getCollectionRef,
    diffObjects,
    recordHistory,
  };
};

module.exports = createBaseService;
