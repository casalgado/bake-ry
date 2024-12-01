const BaseService = require('./base/BaseService');
const { Order } = require('../models/Order');
const { db } = require('../config/firebase');
const { NotFoundError } = require('../utils/errors');

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

        // 4. Save order documents
        console.log('order before toFirestore', order);
        transaction.set(orderRef, order.toFirestore());
        console.log('order after toFirestore', order);

        return order;
      });
    } catch (error) {
      console.error('Error in order create:', error);
      throw error;
    }
  }

}

module.exports = OrderService;
