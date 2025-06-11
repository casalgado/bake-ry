const { db } = require('../../config/firebase');
const { NotFoundError } = require('../../utils/errors');

const createBaseService = (collectionName, ModelClass, parentPath = null) => {
  // Helper functions
  const getCollectionRef = (parentId = null) => {
    if (parentPath && !parentId) {
      throw new Error('Parent ID is required for nested collections');
    }

    if (parentPath) {
      const fullPath = `${parentPath.replace(
        '{bakeryId}',
        parentId
      )}/${collectionName}`;
      return db.collection(fullPath);
    }

    return db.collection(collectionName);
  };

  const getRootRef = () => db.collection(collectionName);

  const diffObjects = (oldObj, newObj) => {
    const changes = {};
    const oldData = oldObj.toFirestore ? oldObj.toFirestore() : oldObj;
    const newData = newObj.toFirestore ? newObj.toFirestore() : newObj;

    Object.keys(newData).forEach((key) => {
      if (key === 'updatedAt') return;

      // Handle undefined values by converting them to null
      const oldValue = oldData[key] === undefined ? null : oldData[key];
      const newValue = newData[key] === undefined ? null : newData[key];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[key] = {
          from: oldValue,
          to: newValue,
        };
      }
    });

    return changes;
  };

  const recordHistory = async (
    transaction,
    docRef,
    changes,
    currentData,
    editor
  ) => {
    const historyRef = docRef.collection('updateHistory').doc();
    const historyRecord = {
      timestamp: new Date(),
      editor: {
        userId: editor?.uid || 'system',
        email: editor?.email || 'system@system.com',
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

      if (!query.includeDeleted) {
        dbQuery = dbQuery.where('isDeleted', '!=', true);
      }

      if (filters) {
        // Handle regular date range
        if (filters.dateRange) {
          const { dateField, startDate, endDate } = filters.dateRange;

          if (startDate) {
            dbQuery = dbQuery.where(dateField, '>=', new Date(startDate));
          }
          if (endDate) {
            dbQuery = dbQuery.where(dateField, '<=', new Date(endDate));
          }
        }

        // Handle OR date range
        if (filters.orDateRange) {
          const { dateFields, startDate, endDate } = filters.orDateRange;

          // Create separate queries for each date field
          const queryPromises = dateFields.map(async (field) => {
            let fieldQuery = getCollectionRef(parentId);

            // Apply the same base filters
            if (!query.includeDeleted) {
              fieldQuery = fieldQuery.where('isDeleted', '!=', true);
            }

            // Apply date range for this field
            if (startDate) {
              fieldQuery = fieldQuery.where(field, '>=', new Date(startDate));
            }
            if (endDate) {
              fieldQuery = fieldQuery.where(field, '<=', new Date(endDate));
            }

            // Apply other filters
            Object.entries(filters).forEach(([key, value]) => {
              if (
                key !== 'dateRange' &&
                key !== 'orDateRange' &&
                value !== undefined
              ) {
                fieldQuery = fieldQuery.where(key, '==', value);
              }
            });

            return fieldQuery.get();
          });

          // Execute all queries in parallel
          const snapshots = await Promise.all(queryPromises);

          // Merge results and remove duplicates
          const allDocs = new Map();
          snapshots.forEach((snapshot) => {
            snapshot.docs.forEach((doc) => {
              allDocs.set(doc.id, doc);
            });
          });

          // Convert to array and sort
          let documents = Array.from(allDocs.values()).map((doc) =>
            ModelClass.fromFirestore(doc)
          );

          // Apply sorting
          if (sort) {
            documents.sort((a, b) => {
              const aVal = a[sort.field];
              const bVal = b[sort.field];
              const multiplier = sort.direction === 'desc' ? -1 : 1;

              if (aVal < bVal) return -1 * multiplier;
              if (aVal > bVal) return 1 * multiplier;
              return 0;
            });
          } else {
            documents.sort(
              (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
            );
          }

          // Apply pagination
          if (pagination) {
            const { perPage, offset } = pagination;
            const start = offset || 0;
            const end = start + (perPage || documents.length);
            documents = documents.slice(start, end);
          }

          return {
            items: documents,
            pagination: pagination
              ? {
                  page: pagination.page,
                  perPage: pagination.perPage,
                  total: allDocs.size,
                }
              : null,
          };
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

      const documents = snapshot.docs.map((doc) =>
        ModelClass.fromFirestore(doc)
      );

      return {
        items: documents,
        pagination: pagination
          ? {
              page: pagination.page,
              perPage: pagination.perPage,
              total: snapshot.size,
            }
          : null,
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
            email: editor?.email,
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
            email: editor?.email,
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
    getRootRef,
    diffObjects,
    recordHistory,
  };
};

module.exports = createBaseService;
