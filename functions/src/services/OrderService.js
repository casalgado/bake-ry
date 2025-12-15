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
      // Override pagination for reports - fetch all orders
      const reportQuery = {
        ...query,
        pagination: { ...query.pagination, perPage: 10000, offset: 0 },
      };

      // Get orders using the existing getAll method
      const orders = await baseService.getAll(bakeryId, reportQuery);
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
      // Override pagination for reports - fetch all orders
      const orderQuery = {
        ...query,
        pagination: { ...query.pagination, perPage: 10000, offset: 0 },
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

  const getIncomeStatement = async (bakeryId, query) => {
    try {
      // Determine date filter type
      const bakerySettingsRef = db.collection('bakeries').doc(bakeryId).collection('settings').doc('default');
      const bakerySettingsDoc = await bakerySettingsRef.get();
      const bakerySettings = bakerySettingsDoc.exists ? bakerySettingsDoc.data() : {};
      const dateFilterType = query.filters?.dateFilterType || bakerySettings.features?.reports?.defaultReportFilter || 'dueDate';
      const groupBy = query.filters?.groupBy || 'total';

      // Parse dates - use current year if not provided
      let startDate, endDate;
      if (query.filters?.dateRange?.startDate && query.filters?.dateRange?.endDate) {
        startDate = new Date(query.filters.dateRange.startDate);
        endDate = new Date(query.filters.dateRange.endDate);
      } else {
        // Default to current year
        const now = new Date();
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
      }
      endDate.setHours(23, 59, 59, 999);

      // Build query for paid orders
      let ordersQuery = baseService.getCollectionRef(bakeryId)
        .where('isPaid', '==', true);

      // Filter by date field
      const dateField = dateFilterType === 'paymentDate' ? 'paymentDate' : 'dueDate';
      ordersQuery = ordersQuery
        .where(dateField, '>=', startDate)
        .where(dateField, '<=', endDate);

      const ordersSnapshot = await ordersQuery.get();
      const orders = [];

      ordersSnapshot.forEach(doc => {
        orders.push(Order.fromFirestore(doc));
      });

      // Fetch products for waterfall cost lookup
      const productsSnapshot = await db.collection('bakeries').doc(bakeryId).collection('products').get();
      const products = {};
      productsSnapshot.forEach(doc => {
        products[doc.id] = doc.data();
      });

      // Group orders by month if needed
      const monthlyGroups = {};
      const excludedProductsMap = new Map();

      orders.forEach(order => {
        const dateToUse = dateFilterType === 'paymentDate' ? order.paymentDate : order.dueDate;
        const monthKey = new Date(dateToUse).toISOString().slice(0, 7);

        if (!monthlyGroups[monthKey]) {
          monthlyGroups[monthKey] = [];
        }
        monthlyGroups[monthKey].push(order);
      });

      // Function to calculate period metrics
      const calculatePeriodMetrics = (periodOrders) => {
        const revenue = {
          productSales: 0,
          deliveryFees: 0,
          taxesCollected: 0,
          totalRevenue: 0,
        };
        const costs = {
          cogs: 0,
          deliveryCosts: 0,
          totalCosts: 0,
        };
        const coverage = {
          itemsWithCost: 0,
          totalItems: 0,
          uniqueProductsWithCost: new Set(),
          uniqueProductsTotal: new Set(),
        };

        periodOrders.forEach(order => {
          // Add taxes and delivery fees
          revenue.taxesCollected += order.totalTaxAmount || 0;
          revenue.deliveryFees += order.deliveryFee || 0;
          costs.deliveryCosts += order.deliveryCost || 0;

          // Process each order item
          order.orderItems?.forEach(item => {
            if (item.isComplimentary) return;

            // Track total items
            coverage.totalItems++;
            coverage.uniqueProductsTotal.add(item.productId);

            // Add product sales revenue
            revenue.productSales += (item.currentPrice * item.quantity) || 0;

            // Cost price waterfall: orderItem → combination (current product) → combination (order snapshot) → product → null
            let costPrice = item.costPrice;

            // If no historical cost, try to find matching combination in current product
            if (!costPrice && item.combination) {
              const product = products[item.productId];
              if (product?.variations?.combinations) {
                // Find combination by matching the selection or name
                const matchingCombination = product.variations.combinations.find(
                  combo => combo.id === item.combination.id || combo.name === item.combination.name,
                );
                if (matchingCombination?.costPrice) {
                  costPrice = matchingCombination.costPrice;
                }
              }
            }

            // Fallback to order snapshot combination cost
            if (!costPrice) {
              costPrice = item.combination?.costPrice;
            }

            // Final fallback to product base cost
            if (!costPrice) {
              costPrice = products[item.productId]?.costPrice;
            }

            if (costPrice) {
              costs.cogs += (costPrice * item.quantity);
              coverage.itemsWithCost++;
              coverage.uniqueProductsWithCost.add(item.productId);
            } else {
              // Track excluded product
              if (!excludedProductsMap.has(item.productId)) {
                excludedProductsMap.set(item.productId, {
                  id: item.productId,
                  name: item.productName,
                  reason: 'Sin costo definido',
                  orderCount: 0,
                  totalQuantity: 0,
                });
              }
              const product = excludedProductsMap.get(item.productId);
              product.orderCount++;
              product.totalQuantity += item.quantity;
            }
          });
        });

        // Calculate derived values
        // Note: taxesCollected is tracked for reporting but NOT added to totalRevenue
        // because taxes are already included in the currentPrice that customers pay
        revenue.totalRevenue = revenue.productSales + revenue.deliveryFees;
        costs.totalCosts = costs.cogs + costs.deliveryCosts;
        const grossProfit = {
          amount: revenue.totalRevenue - costs.totalCosts,
          marginPercent: revenue.totalRevenue > 0
            ? parseFloat(((revenue.totalRevenue - costs.totalCosts) / revenue.totalRevenue * 100).toFixed(1))
            : 0,
        };
        const coveragePercent = coverage.totalItems > 0
          ? (coverage.itemsWithCost / coverage.totalItems * 100).toFixed(0)
          : 0;

        return {
          revenue,
          costs,
          grossProfit,
          coverage: {
            itemsWithCost: coverage.itemsWithCost,
            totalItems: coverage.totalItems,
            percentCovered: parseInt(coveragePercent),
            uniqueProductsWithCost: coverage.uniqueProductsWithCost.size,
            uniqueProductsTotal: coverage.uniqueProductsTotal.size,
          },
        };
      };

      // Build response based on groupBy parameter
      if (groupBy === 'month') {
        const periods = [];
        const monthLabels = {
          '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
          '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
          '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
        };

        // Sort months chronologically
        const sortedMonths = Object.keys(monthlyGroups).sort();

        sortedMonths.forEach(month => {
          const [year, monthNum] = month.split('-');
          const metrics = calculatePeriodMetrics(monthlyGroups[month]);
          periods.push({
            month,
            label: `${monthLabels[monthNum]} ${year}`,
            ...metrics,
          });
        });

        // Calculate totals
        const allOrders = Object.values(monthlyGroups).flat();
        const totals = calculatePeriodMetrics(allOrders);

        return {
          periods,
          totals,
          excludedProducts: Array.from(excludedProductsMap.values()),
        };
      } else {
        // Return total aggregation
        const allOrders = Object.values(monthlyGroups).flat();
        const metrics = calculatePeriodMetrics(allOrders);

        return {
          ...metrics,
          excludedProducts: Array.from(excludedProductsMap.values()),
        };
      }
    } catch (error) {
      console.error('Error generating income statement:', error);
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
    getIncomeStatement,
  };
};

// Export a singleton instance
module.exports = createOrderService();
