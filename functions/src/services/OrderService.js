// services/orderService.js
const { Order } = require('../models/Order');
const SalesReport = require('../models/SalesReport');
const OrderHistory = require('../models/OrderHistory');
const createBaseService = require('./base/serviceFactory');
const { db } = require('../config/firebase');
const { NotFoundError, BadRequestError } = require('../utils/errors');

const createOrderService = () => {
  const baseService = createBaseService('orders', Order, 'bakeries/{bakeryId}');

  const create = async (orderData, bakeryId) => {
    try {
      return await db.runTransaction(async (transaction) => {
        // 1. Create main order
        const orderRef = baseService.getCollectionRef(bakeryId).doc();
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
  };

  const patchAll = async (bakeryId, updates, editor) => {
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
          // Process reads sequentially instead of Promise.all
          const updateOperations = [];
          for (const update of batchUpdates) {
            try {
              const { id, data } = update;
              const orderRef = baseService.getCollectionRef(bakeryId).doc(id);
              const orderDoc = await transaction.get(orderRef);

              if (!orderDoc.exists) {
                updateOperations.push({
                  success: false,
                  id,
                  error: 'Order not found',
                });
                continue;
              }

              const currentOrder = Order.fromFirestore(orderDoc);

              // Create updated instance
              const updatedOrder = new Order({
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
              let changes = baseService.diffObjects(currentOrder, updatedOrder);
              if (data.orderItems) {
                changes = {
                  orderItems: currentOrder.orderItems.map((item, index) => {
                    let change = baseService.diffObjects(
                      item,
                      updatedOrder.orderItems[index],
                    );
                    change.id = item.id;
                    return change;
                  }),
                };
              }

              updateOperations.push({
                success: true,
                orderRef,
                updatedOrder,
                changes,
                data,
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

            const { orderRef, updatedOrder, changes, id } = operation;

            // update order and history only if changes are present
            if (Object.keys(changes).length > 0) {
              const historyRef = orderRef.collection('updateHistory').doc();
              transaction.set(historyRef, {
                timestamp: new Date(),
                editor: {
                  userId: editor?.uid || 'system',
                  name: editor?.name || 'system',
                  role: editor?.role || 'system',
                },
                changes,
              });
              transaction.update(orderRef, updatedOrder.toFirestore());
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

  const getSalesReport = async (bakeryId, query) => {
    try {
      // Get orders using the existing getAll method
      const orders = await baseService.getAll(bakeryId, query);
      const b2b_clients_query = await db.collection('bakeries').doc(bakeryId).collection('settings').doc('default').collection('b2b_clients').get();
      const b2b_clients = [];
      b2b_clients_query.forEach(doc => {
        b2b_clients.push({
          id: doc.id,
          ...doc.data(),
        });
      });
      console.log('b2b_clients in service', b2b_clients);
      // Create a new sales report instance and generate the report
      const salesReport = new SalesReport(orders.items, b2b_clients);
      return salesReport.generateReport();
    } catch (error) {
      console.error('Error generating sales report:', error);
      throw error;
    }
  };

  const getHistory = async (bakeryId, orderId) => {
    try {
      if (!bakeryId || !orderId) {
        throw new BadRequestError('Both bakeryId and orderId are required');
      }

      const orderRef = baseService.getCollectionRef(bakeryId).doc(orderId);
      const historySnapshot = await orderRef.collection('updateHistory')
        .orderBy('timestamp', 'desc')
        .get();

      return historySnapshot.docs.map(doc => OrderHistory.fromFirestore(doc));
    } catch (error) {
      console.error('Error getting order history:', error);
      throw error;
    }
  };

  return {
    ...baseService,
    create,
    patchAll,
    getSalesReport,
    getHistory,
  };
};

// Export a singleton instance
module.exports = createOrderService();
