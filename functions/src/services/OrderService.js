// services/orderService.js
const { Order } = require('../models/Order');
const SalesReport = require('../models/SalesReport');
const ProductReport = require('../models/ProductReport');
const OrderHistory = require('../models/OrderHistory');
const createBaseService = require('./base/serviceFactory');
const { db } = require('../config/firebase');
const { NotFoundError, BadRequestError } = require('../utils/errors');

const createOrderService = () => {
  const baseService = createBaseService('orders', Order, 'bakeries/{bakeryId}');

  const updateClientHistory = async (transaction, bakeryId, order) => {
    const clientHistoryRef = db
      .collection('bakeries')
      .doc(bakeryId)
      .collection('users')
      .doc(order.userId)
      .collection('orderHistory')
      .doc(order.id);

    transaction.set(clientHistoryRef, order.toClientHistoryObject(), { merge: true });
  };

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

  const update = async (id, data, bakeryId, editor = null) => {
    try {
      const orderRef = baseService.getCollectionRef(bakeryId).doc(id);

      return await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(orderRef);

        if (!doc.exists) {
          throw new NotFoundError('Order not found');
        }

        const currentOrder = Order.fromFirestore(doc);
        const updatedOrder = new Order({
          ...currentOrder,
          ...data,
          id,
          updatedAt: new Date(),
          lastEditedBy: {
            userId: editor?.uid,
            email: editor?.email,
            role: editor?.role,
          },
        });

        if (data.shouldUpdateClientAddress) {
          const clientRef = db
            .collection('bakeries')
            .doc(bakeryId)
            .collection('users')
            .doc(updatedOrder.userId);

          transaction.update(clientRef, {
            address: updatedOrder.deliveryAddress,
            updatedAt: new Date(),
          });
        }

        // Record changes in history
        const changes = baseService.diffObjects(currentOrder, updatedOrder);
        await baseService.recordHistory(transaction, orderRef, changes, currentOrder, editor);

        // Update both main order and client history
        transaction.update(orderRef, updatedOrder.toFirestore());
        await updateClientHistory(transaction, bakeryId, updatedOrder);

        return updatedOrder;
      });
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  };

  const patch = async (id, data, bakeryId, editor = null) => {
    try {
      const orderRef = baseService.getCollectionRef(bakeryId).doc(id);

      return await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(orderRef);

        if (!doc.exists) {
          throw new NotFoundError('Order not found');
        }

        const currentOrder = Order.fromFirestore(doc);
        const updatedOrder = new Order({
          ...currentOrder,
          ...data,
          id,
          updatedAt: new Date(),
          lastEditedBy: {
            userId: editor?.uid,
            email: editor?.email,
            role: editor?.role,
          },
        });

        if (!currentOrder.isPaid && updatedOrder.isPaid) {
          updatedOrder.paymentDate = new Date();
        } else if (currentOrder.isPaid && !updatedOrder.isPaid) {
          updatedOrder.paymentDate = null;}

        console.log('Patching order:', updatedOrder);

        if (data.shouldUpdateClientAddress) {
          const clientRef = db
            .collection('bakeries')
            .doc(bakeryId)
            .collection('users')
            .doc(updatedOrder.userId);

          transaction.update(clientRef, {
            address: updatedOrder.deliveryAddress,
            updatedAt: new Date(),
          });
        }

        // Record changes in history
        const changes = baseService.diffObjects(currentOrder, updatedOrder);
        await baseService.recordHistory(transaction, orderRef, changes, currentOrder, editor);

        // Update both main order and client history
        transaction.update(orderRef, updatedOrder.toFirestore());
        await updateClientHistory(transaction, bakeryId, updatedOrder);

        return updatedOrder;
      });
    } catch (error) {
      console.error('Error patching order:', error);
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
                  email: editor?.email,
                  role: editor?.role,
                },
              });

              if (!currentOrder.isPaid && updatedOrder.isPaid) {
                updatedOrder.paymentDate = new Date();
              } else if (currentOrder.isPaid && !updatedOrder.isPaid) {
                updatedOrder.paymentDate = null;}

              console.log('Patching order:', updatedOrder);

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
                  userId: editor?.uid,
                  email: editor?.email,
                  role: editor?.role,
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

  const remove = async (id, bakeryId, editor = null) => {
    try {
      const orderRef = baseService.getCollectionRef(bakeryId).doc(id);

      return await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(orderRef);

        if (!doc.exists) {
          throw new NotFoundError('Order not found');
        }

        const currentOrder = Order.fromFirestore(doc);
        const updatedOrder = new Order({
          ...currentOrder,
          isDeleted: true,
          updatedAt: new Date(),
          lastEditedBy: {
            userId: editor?.uid,
            email: editor?.email,
            role: editor?.role,
          },
        });

        // Record changes in history
        const changes = baseService.diffObjects(currentOrder, updatedOrder);
        await baseService.recordHistory(transaction, orderRef, changes, currentOrder, editor);

        // Update both main order and client history
        transaction.update(orderRef, updatedOrder.toFirestore());
        await updateClientHistory(transaction, bakeryId, updatedOrder);

        return null;
      });
    } catch (error) {
      console.error('Error removing order:', error);
      throw error;
    }
  };

  const getSalesReport = async (bakeryId, query) => {
    try {
      // Get orders using the existing getAll method
      const orders = await baseService.getAll(bakeryId, query);
      const products_query = await db.collection('bakeries').doc(bakeryId).collection('products').get();
      const products = [];
      products_query.forEach(doc => {
        products.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      const b2b_clients_query = await db.collection('bakeries').doc(bakeryId).collection('settings').doc('default').collection('b2b_clients').get();
      const b2b_clients = [];
      b2b_clients_query.forEach(doc => {
        b2b_clients.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      console.log(products);

      // Create a new sales report instance and generate the report
      const salesReport = new SalesReport(orders.items, b2b_clients, products);
      return salesReport.generateReport();
    } catch (error) {
      console.error('Error generating sales report:', error);
      throw error;
    }
  };

  const getProductReport = async (bakeryId, query) => {
    try {
      // Extract report-specific options before querying orders
      const options = {
        categories: query.filters.categories?.split(',') || null,
        period: query.filters.period || null,
        metrics: query.filters.metrics || 'both',
        segment: query.filters.segment || 'none',
        dateField: query.filters.date_field || 'dueDate',
      };

      // Remove report-specific filters from query so they don't get applied to Firestore
      const orderQuery = {
        ...query,
        filters: { ...query.filters },
      };
      delete orderQuery.filters.categories;
      delete orderQuery.filters.period;
      delete orderQuery.filters.metrics;
      delete orderQuery.filters.segment;

      // Default to current year if no date range provided
      if (!orderQuery.filters.dateRange && !orderQuery.filters.paymentDateWithFallback) {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        orderQuery.filters.dateRange = {
          dateField: options.dateField,
          startDate: startOfYear.toISOString().split('T')[0],
          endDate: now.toISOString().split('T')[0],
        };
        options.defaultDateRangeApplied = true;
      }

      const orders = await baseService.getAll(bakeryId, orderQuery);

      const [products_query, b2b_clients_query] = await Promise.all([
        db.collection('bakeries').doc(bakeryId).collection('products').get(),
        db.collection('bakeries').doc(bakeryId).collection('settings').doc('default').collection('b2b_clients').get(),
      ]);

      const products = products_query.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const b2b_clients = b2b_clients_query.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const productReport = new ProductReport(orders.items, b2b_clients, products, options);
      return productReport.generateReport();
    } catch (error) {
      console.error('Error generating product report:', error);
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
    update,
    patch,
    patchAll,
    remove,
    getSalesReport,
    getProductReport,
    getHistory,
  };
};

// Export a singleton instance
module.exports = createOrderService();
