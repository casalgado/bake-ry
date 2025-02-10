// services/productService.js
const { db } = require('../config/firebase');
const { Product } = require('../models/Product');
const createBaseService = require('./base/serviceFactory');
const { NotFoundError, BadRequestError } = require('../utils/errors');

const createProductService = () => {
  const baseService = createBaseService('products', Product, 'bakeries/{bakeryId}');

  const create = async (productData, bakeryId) => {
    try {
      return await db.runTransaction(async (transaction) => {

        let productRef;
        let productId;
        if (productData.id) {
          productRef = baseService.getCollectionRef(bakeryId).doc(productData.id);
        } else {
          productRef = baseService.getCollectionRef(bakeryId).doc();
          productId = productRef.id;
        }

        const newProduct = new Product({
          ...productData,
          id: productId,
          bakeryId,
        });

        transaction.set(productRef, newProduct.toFirestore());
        /* Recipe Implementation TBD
        transaction.update(recipeRef, {
          productId: productRef.id,
          updatedAt: new Date(),
        });
        */

        return newProduct;
      });
    } catch (error) {
      console.error('Error in createProduct:', error);
      throw error;
    }
  };

  const update = async (productId, updateData, bakeryId) => {
    try {
      return await db.runTransaction(async (transaction) => {
        const productRef = baseService.getCollectionRef(bakeryId).doc(productId);
        const productDoc = await transaction.get(productRef);

        if (!productDoc.exists) {
          throw new NotFoundError('Product not found');
        }

        const currentProduct = Product.fromFirestore(productDoc);

        // Handle recipe reassignment if recipe is being changed
        if (updateData.recipeId && updateData.recipeId !== currentProduct.recipeId) {
          // Check new recipe availability
          const newRecipeRef = db
            .collection(`bakeries/${bakeryId}/recipes`)
            .doc(updateData.recipeId);
          const newRecipeDoc = await transaction.get(newRecipeRef);

          if (!newRecipeDoc.exists) {
            throw new NotFoundError('New recipe not found');
          }

          if (newRecipeDoc.data().productId) {
            throw new BadRequestError('New recipe is already assigned to another product');
          }

          // Release old recipe
          const oldRecipeRef = db
            .collection(`bakeries/${bakeryId}/recipes`)
            .doc(currentProduct.recipeId);

          transaction.update(oldRecipeRef, {
            productId: null,
            updatedAt: new Date(),
          });

          // Assign new recipe
          transaction.update(newRecipeRef, {
            productId: productId,
            updatedAt: new Date(),
          });
        }

        const updatedProduct = new Product({
          ...currentProduct,
          ...updateData,
          updatedAt: new Date(),
        });

        transaction.update(productRef, updatedProduct.toFirestore());
        return updatedProduct;
      });
    } catch (error) {
      console.error('Error in updateProduct:', error);
      throw error;
    }
  };

  return {
    ...baseService,
    create,
    update,
  };
};

module.exports = createProductService();
