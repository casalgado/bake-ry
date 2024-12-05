const BaseService = require('./base/BaseService');
const { Order } = require('../models/Order');
const { db } = require('../config/firebase');
const { NotFoundError, BadRequestError } = require('../utils/errors');

class OrderService extends BaseService {
  constructor() {
    super('orders', Order, 'bakeries/{bakeryId}');
  }

  /**
   * Create order and add to user's order history
   * if client address is flagged, changes it in client record
   * @param {Object} orderData - Order data
   * @param {string} bakeryId - Bakery ID
   * @returns {Promise<Order>} Created order
   */
  async create(orderData, bakeryId) {
    try {
      return await db.runTransaction(async (transaction) => {
        // 1. Create main order
        const orderRef = this.getCollectionRef(bakeryId).doc();
        const order = new Order({
          id: orderRef.id,
          bakeryId,
          ...orderData,
        });

        // 2. Update client address if flag is true
        if (orderData.shouldUpdateClientAddress && orderData.deliveryAddress) {
          const clientRef = db
            .collection('bakeries')
            .doc(bakeryId)
            .collection('users')
            .doc(order.userId);

          const clientDoc = await transaction.get(clientRef);
          if (!clientDoc.exists) {
            throw new NotFoundError('Client not found');
          }

          transaction.update(clientRef, {
            address: orderData.deliveryAddress,
            updatedAt: new Date(),
          });
        }

        // 3. Create history record
        const clientHistoryRef = db
          .collection('bakeries')
          .doc(bakeryId)
          .collection('users')
          .doc(order.userId)
          .collection('orderHistory')
          .doc(order.id);

        // 4. Save order documents
        transaction.set(orderRef, order.toFirestore());
        transaction.set(clientHistoryRef, order.toClientHistoryObject());

        return order;
      });
    } catch (error) {
      console.error('Error in order create:', error);
      throw error;
    }
  }

  /**
   * Patch multiple orders at once
   * @param {string} bakeryId - Bakery ID
   * @param {Array<{id: string, data: Object}>} updates - Array of order updates
   * @param {Object} editor - User performing the update
   * @returns {Promise<{success: Array, failed: Array}>}
   */
  async patchAll(bakeryId, updates, editor) {
    console.log('updates', updates);
    console.log('bakeryId', bakeryId);
    console.log('editor', editor);
    try {
      if (!Array.isArray(updates)) {
        throw new BadRequestError('Updates must be an array');
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
          for (const update of batchUpdates) {
            try {
              const { id, data } = update;
              console.log('id', id);
              console.log('data', data);
              const orderRef = this.getCollectionRef(bakeryId).doc(id);
              const orderDoc = await transaction.get(orderRef);

              if (!orderDoc.exists) {
                results.failed.push({ id, error: 'Order not found' });
                continue;
              }

              const currentOrder = this.ModelClass.fromFirestore(orderDoc);

              // Create updated instance
              const updatedOrder = new this.ModelClass({
                ...currentOrder,
                ...data,
                updatedAt: new Date(),
                lastEditedBy: {
                  userId: editor?.uid,
                  name: editor?.name,
                  role: editor?.role,
                },
              });

              // Compute what changed
              const changes = this.diffObjects(currentOrder, updatedOrder);

              // Record history only if changes don't include orderItems
              if (!data.orderItems) {
                await this.recordHistory(transaction, orderRef, changes, currentOrder, editor);
              }

              // Update the order
              transaction.update(orderRef, updatedOrder.toFirestore());

              results.success.push({
                id,
                changes,
              });
            } catch (error) {
              results.failed.push({
                id: update.id,
                error: error.message,
              });
            }
          }
        });
      }

      return results;
    } catch (error) {
      console.error('Error in patchAll:', error);
      throw error;
    }
  }

}

module.exports = OrderService;
