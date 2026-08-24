// services/productService.js
const { db } = require('../config/firebase');
const Product = require('../models/Product');
const createBaseService = require('./base/serviceFactory');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const { syncProductStockDocs } = require('./stockService');

const createProductService = () => {
  const baseService = createBaseService('products', Product, 'bakeries/{bakeryId}');

  const validateInventoryMode = (data) => {
    if (
      data.inventoryMode !== undefined &&
      !Object.values(Product.INVENTORY_MODES).includes(data.inventoryMode)
    ) {
      throw new BadRequestError(
        `Invalid inventory mode: ${data.inventoryMode}`,
      );
    }
  };

  const create = async (productData, bakeryId) => {
    try {
      validateInventoryMode(productData);

      const created = await db.runTransaction(async (transaction) => {

        let productRef;
        let productId;
        if (productData.id) {
          productRef = baseService.getCollectionRef(bakeryId).doc(productData.id);
          // Was left undefined, so a caller-supplied id never reached the model.
          productId = productData.id;
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

      // After the commit: the stocks doc is a rebuildable cache (§8), and
      // syncProductStockDocs swallows its own failures.
      await syncProductStockDocs(bakeryId, created);
      return created;
    } catch (error) {
      console.error('Error in createProduct:', error);
      throw error;
    }
  };

  const update = async (productId, updateData, bakeryId) => {
    try {
      validateInventoryMode(updateData);

      const updated = await db.runTransaction(async (transaction) => {
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

      await syncProductStockDocs(bakeryId, { ...updated, id: productId });
      return updated;
    } catch (error) {
      console.error('Error in updateProduct:', error);
      throw error;
    }
  };

  /**
   * Bulk update multiple products in a single transaction
   * @param {string} bakeryId - Bakery ID
   * @param {Array} updates - Array of { id, data } objects
   * @param {Object} editor - User performing the update
   * @returns {Object} { success: [], failed: [] }
   */
  const patchAll = async (bakeryId, updates, editor) => {
    try {
      if (!Array.isArray(updates)) {
        throw new BadRequestError('Updates must be an array');
      }

      if (updates.length === 0) {
        return { success: [], failed: [] };
      }

      const results = {
        success: [],
        failed: [],
      };

      // Process in batches of 500 (Firestore limit)
      const batchSize = 500;
      const batches = [];

      for (let i = 0; i < updates.length; i += batchSize) {
        const batchUpdates = updates.slice(i, i + batchSize);
        batches.push(batchUpdates);
      }

      // Process each batch
      for (const batchUpdates of batches) {
        await db.runTransaction(async (transaction) => {
          // Process reads sequentially
          const updateOperations = [];

          for (const update of batchUpdates) {
            try {
              const { id, data } = update || {};

              // Validate update structure
              if (!id) {
                updateOperations.push({
                  success: false,
                  id: id || 'unknown',
                  error: 'Missing product ID',
                });
                continue;
              }

              if (!data || typeof data !== 'object') {
                updateOperations.push({
                  success: false,
                  id,
                  error: 'Missing or invalid update data',
                });
                continue;
              }

              const productRef = baseService.getCollectionRef(bakeryId).doc(id);
              const productDoc = await transaction.get(productRef);

              if (!productDoc.exists) {
                updateOperations.push({
                  success: false,
                  id,
                  error: 'Product not found',
                });
                continue;
              }

              const currentProduct = Product.fromFirestore(productDoc);

              // Create updated instance
              const updatedProduct = new Product({
                ...currentProduct,
                ...data,
                updatedAt: new Date(),
                lastEditedBy: {
                  userId: editor?.uid,
                  email: editor?.email,
                  role: editor?.role,
                },
              });

              // Compute what changed
              const changes = baseService.diffObjects(currentProduct, updatedProduct);

              updateOperations.push({
                success: true,
                productRef,
                updatedProduct,
                changes,
                id,
              });
            } catch (error) {
              updateOperations.push({
                success: false,
                id: update.id,
                error: error.message,
              });
            }
          }

          // Process writes
          for (const operation of updateOperations) {
            if (!operation.success) {
              results.failed.push({
                id: operation.id,
                error: operation.error,
              });
              continue;
            }

            const { productRef, updatedProduct, changes, id } = operation;

            // Update product and history only if changes are present
            if (Object.keys(changes).length > 0) {
              const historyRef = productRef.collection('updateHistory').doc();
              transaction.set(historyRef, {
                timestamp: new Date(),
                editor: {
                  userId: editor?.uid,
                  email: editor?.email,
                  role: editor?.role,
                },
                changes,
              });
              transaction.update(productRef, updatedProduct.toFirestore());
            }

            results.success.push({
              id,
              changes,
            });
          }
        });
      }

      return results;
    } catch (error) {
      console.error('Error in patchAll:', error);
      throw error;
    }
  };

  /**
   * A product used as a recipe component cannot be deleted (§1A.7). The reverse
   * index on the product doc is maintained by recipeService.
   */
  const remove = async (productId, bakeryId, editor = null) => {
    try {
      const productDoc = await baseService
        .getCollectionRef(bakeryId)
        .doc(productId)
        .get();

      if (!productDoc.exists) {
        throw new NotFoundError('Product not found');
      }

      const recipeIds = productDoc.data().usedInRecipes || [];

      if (recipeIds.length > 0) {
        const recipeDocs = await db.getAll(
          ...recipeIds.map((recipeId) =>
            db.collection(`bakeries/${bakeryId}/recipes`).doc(recipeId),
          ),
        );

        // Stale ids must not block a deletion — only recipes that still exist do.
        const recipeNames = recipeDocs
          .filter((doc) => doc.exists)
          .map((doc) => doc.data().name || doc.id);

        if (recipeNames.length > 0) {
          throw new BadRequestError(
            `No se puede eliminar un producto usado en recetas. Usado en: ${recipeNames.join(', ')}`,
          );
        }
      }

      return baseService.remove(productId, bakeryId, editor);
    } catch (error) {
      console.error('Error in deleteProduct:', error);
      throw error;
    }
  };

  return {
    ...baseService,
    create,
    update,
    patchAll,
    remove,
  };
};

module.exports = createProductService();
