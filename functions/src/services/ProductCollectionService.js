// services/productCollectionService.js
const { db } = require('../config/firebase');
const ProductCollection = require('../models/ProductCollection');
const createBaseService = require('./base/serviceFactory');
const { BadRequestError, NotFoundError } = require('../utils/errors');

const createProductCollectionService = () => {
  const baseService = createBaseService(
    'productCollections',
    ProductCollection,
    'bakeries/{bakeryId}',
  );

  const remove = async (collectionId, bakeryId) => {
    try {
      return await db.runTransaction(async (transaction) => {
        // 1. Check if collection exists
        const collectionRef = baseService.getCollectionRef(bakeryId).doc(collectionId);
        const collectionDoc = await transaction.get(collectionRef);

        if (!collectionDoc.exists) {
          throw new NotFoundError('Product collection not found');
        }

        // 2. Check for products using this collection
        const productsRef = db
          .collection(`bakeries/${bakeryId}/products`)
          .where('collectionId', '==', collectionId)
          .where('isActive', '==', true);

        const productsSnapshot = await transaction.get(productsRef);

        if (!productsSnapshot.empty) {
          throw new BadRequestError(
            'No se puede eliminar la colección porque tiene productos activos',
          );
        }

        // 3. Delete the collection within the transaction
        transaction.delete(collectionRef);
        return null;
      });
    } catch (error) {
      console.error('Error in deleteProductCollection:', error);
      throw error;
    }
  };

  return {
    ...baseService,
    remove,
  };
};

// Export a singleton instance
module.exports = createProductCollectionService();
