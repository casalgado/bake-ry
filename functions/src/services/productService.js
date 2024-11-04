const { db } = require('../config/firebase');
const { Product } = require('../models/Product');
const BaseService = require('./base/BaseService');
const { NotFoundError, BadRequestError } = require('../utils/errors');

class ProductService extends BaseService {
  constructor() {
    super('products', Product, 'bakeries/{bakeryId}');
  }

  /**
   * Create a new product and associate it with a recipe
   */
  async create(productData, bakeryId) {
    try {
      return await db.runTransaction(async (transaction) => {
        // Check recipe exists and is available
        const recipeRef = db
          .collection(`bakeries/${bakeryId}/recipes`)
          .doc(productData.recipeId);

        const recipeDoc = await transaction.get(recipeRef);
        if (!recipeDoc.exists) {
          throw new NotFoundError('Recipe not found');
        }

        if (recipeDoc.data().productId) {
          throw new BadRequestError('Recipe is already assigned to another product');
        }

        // Create new product
        const productRef = this.getCollectionRef(bakeryId).doc();
        const newProduct = new this.ModelClass({
          id: productRef.id,
          bakeryId,
          ...productData,
        });

        // Update both documents atomically
        transaction.set(productRef, newProduct.toFirestore());
        transaction.update(recipeRef, {
          productId: productRef.id,
          updatedAt: new Date(),
        });

        return newProduct;
      });
    } catch (error) {
      console.error('Error in createProduct:', error);
      throw error;
    }
  }

  /**
   * Get a product by ID
   */
  async getById(productId, bakeryId) {
    return super.getById(productId, bakeryId);
  }

  /**
   * Get all products with optional filters
   */
  async getAll(bakeryId, filters = {}, options = {}) {
    return super.getAll(bakeryId, filters, options);
  }

  /**
   * Update a product and handle recipe reassignment if needed
   */
  async update(productId, updateData, bakeryId) {
    try {
      return await db.runTransaction(async (transaction) => {
        const productRef = this.getCollectionRef(bakeryId).doc(productId);
        const productDoc = await transaction.get(productRef);

        if (!productDoc.exists) {
          throw new NotFoundError('Product not found');
        }

        const currentProduct = this.ModelClass.fromFirestore(productDoc);

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

        const updatedProduct = new this.ModelClass({
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
  }

  /**
   * Delete a product (soft delete) and release its recipe
   */
  async delete(productId, bakeryId) {
    try {
      return await db.runTransaction(async (transaction) => {
        const productRef = this.getCollectionRef(bakeryId).doc(productId);
        const productDoc = await transaction.get(productRef);

        if (!productDoc.exists) {
          throw new NotFoundError('Product not found');
        }

        // Release recipe
        const recipeRef = db
          .collection(`bakeries/${bakeryId}/recipes`)
          .doc(productDoc.data().recipeId);

        // Soft delete product and release recipe
        transaction.update(productRef, {
          isActive: false,
          updatedAt: new Date(),
        });

        transaction.update(recipeRef, {
          productId: null,
          updatedAt: new Date(),
        });
      });
    } catch (error) {
      console.error('Error in deleteProduct:', error);
      throw error;
    }
  }
}

module.exports =  ProductService;
