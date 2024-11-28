const BaseService = require('./base/BaseService');
const { Order } = require('../models/Order');
const { db } = require('../config/firebase');
const { BadRequestError, NotFoundError } = require('../utils/errors');

class OrderService extends BaseService {
  constructor() {
    super('orders', Order, 'bakeries/{bakeryId}');
  }

  /**
   * Create order and add to user's order history
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
        console.log('order in Service:', order);

        // 2. Create history record
        const historyRef = db
          .collection('bakeries')
          .doc(bakeryId)
          .collection('users')
          .doc(order.userId)
          .collection('orderHistory')
          .doc(order.id);

        // 3. Save both documents
        transaction.set(orderRef, order.toFirestore());
        transaction.set(historyRef, order.toHistoryObject());

        return order;
      });
    } catch (error) {
      console.error('Error in order create:', error);
      throw error;
    }
  }

  /**
   * Update order and its history record
   */
  async update(orderId, updateData, bakeryId, editor) {
    try {
      return await db.runTransaction(async (transaction) => {
        // 1. Get current order
        const orderRef = this.getCollectionRef(bakeryId).doc(orderId);
        const doc = await transaction.get(orderRef);

        if (!doc.exists) {
          throw new NotFoundError('Order not found');
        }

        const currentOrder = Order.fromFirestore(doc);

        // 2. Validate status
        if (currentOrder.status === 4) {
          throw new BadRequestError('Cannot update completed order');
        }

        // 3. Create updated order
        const updatedOrder = new Order({
          ...currentOrder,
          ...updateData,
          updatedAt: new Date(),
          lastEditedBy: {
            userId: editor.uid,
            role: editor.role,
            name: editor.name,
          },
        });

        // 4. Update history record
        const historyRef = db
          .collection('users')
          .doc(updatedOrder.userId)
          .collection('orderHistory')
          .doc(orderId);

        // 5. Save both updates
        transaction.update(orderRef, updatedOrder.toFirestore());
        transaction.update(historyRef, updatedOrder.toHistoryObject());

        return updatedOrder;
      });
    } catch (error) {
      console.error('Error in order update:', error);
      throw error;
    }
  }

}

module.exports = OrderService;
