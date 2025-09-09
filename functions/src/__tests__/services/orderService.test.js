const { initializeFirebase, clearFirestoreData } = require('../setup/firebase');
const { Order } = require('../../models/Order');

// Test Data Setup Helpers
const setupTestData = async (db, bakeryId) => {
  // Create test user
  const userRef = db.collection('bakeries').doc(bakeryId).collection('users').doc('test-user');
  await userRef.set({
    id: 'test-user',
    name: 'Test Customer',
    email: 'test@example.com',
    address: '123 Test St',
  });

  // Create B2B client
  const b2bRef = db
    .collection('bakeries')
    .doc(bakeryId)
    .collection('settings')
    .doc('default')
    .collection('b2b_clients')
    .doc('b2b-user');

  await b2bRef.set({
    id: 'b2b-user',
    name: 'B2B Customer',
    email: 'b2b@example.com',
  });

  // Create settings document
  const settingsRef = db
    .collection('bakeries')
    .doc(bakeryId)
    .collection('settings')
    .doc('default');

  await settingsRef.set({
    id: 'default',
    orderStatuses: ['Pending', 'In Progress', 'Completed'],
  });
};
const createTestOrders = async (orderService, bakeryId, count = 10) => {
  const orders = [];
  const baseDate = new Date('2024-01-01');

  for (let i = 0; i < count; i++) {
    const isB2B = i % 2 === 0;
    const quantity = Math.floor(Math.random() * 5) + 1;
    const basePrice = 10000;
    const itemTotal = quantity * basePrice;
    const deliveryFee = isB2B ? 5000 : 0;
    const total = itemTotal + deliveryFee;

    // IMPORTANT: The userId for B2B orders must match the ID in b2b_clients collection
    const userId = isB2B ? 'b2b-user' : 'test-user';  // b2b-user matches the ID we set in setupTestData

    const order = {
      userId: userId,
      userName: isB2B ? 'B2B Customer' : 'Test Customer',
      userEmail: isB2B ? 'b2b@example.com' : 'test@example.com',
      orderItems: [
        {
          id: `item-${i}`,
          productId: `product-${i}`,
          productName: `Test Product ${i}`,
          collectionId: `collection-${i}`,
          collectionName: 'Test Collection',
          quantity: quantity,
          basePrice: basePrice,
          currentPrice: basePrice,
          variation: { name: 'regular', value: 1 },
          recipeId: `recipe-${i}`,
          taxPercentage: 19,
          isComplimentary: false,
          productionBatch: 1,
          status: 0,
          total: itemTotal,
        },
      ],
      status: i % 4,
      isPaid: true,
      paymentMethod: i % 3 === 0 ? 'transfer' : 'cash',
      fulfillmentType: isB2B ? 'delivery' : 'pickup',
      deliveryFee: deliveryFee,
      total: total,
      dueDate: new Date(baseDate.getTime() + (i * 24 * 60 * 60 * 1000)),
      preparationDate: new Date(baseDate.getTime() + (i * 24 * 60 * 60 * 1000)),
      // Removed isB2B flag since it's not used by the SalesReport
    };

    const instance = await orderService.create(order, bakeryId);
    orders.push(instance);
  }

  return orders;
};

const createBatchUpdateData = (orders) => {
  return orders.map(order => ({
    id: order.id,
    data: {
      status: order.status + 1,
      updatedAt: new Date(),
    },
  }));
};

describe('Order Service Tests', () => {
  let db;
  let orderService;
  let testStoreId;
  let testOrders;
  let testEditor;

  beforeAll(() => {
    ({ db } = initializeFirebase());
    orderService = require('../../services/orderService');
    testStoreId = 'test-bakery';
    testEditor = {
      uid: 'test-editor',
      email: 'editor@example.com',
      role: 'bakery_staff',
    };
  });

  beforeEach(async () => {
    console.log('=== BEFORE EACH START ===');

    // Force clean the orders collection specifically
    const ordersRef = db.collection('bakeries').doc(testStoreId).collection('orders');
    // Clean up previous test data
    await clearFirestoreData(db);

    // Verify orders are gone
    const ordersAfterDelete = await ordersRef.get();
    console.log('Orders after explicit delete:', ordersAfterDelete.size);

    // Set up fresh test data
    await setupTestData(db, testStoreId);
    testOrders = await createTestOrders(orderService, testStoreId, 10);

    // Verify we have exactly the orders we expect
    const ordersAfterSetup = await ordersRef.get();
    console.log('Orders after setup:', ordersAfterSetup.size);
    console.log('=== BEFORE EACH END ===');
  }, 10000);

  afterAll(async () => {
    await clearFirestoreData(db);
    const b2bRef = db
      .collection('bakeries')
      .doc(testStoreId)
      .collection('settings')
      .doc('default')
      .collection('b2b_clients');

    const staffRef = db
      .collection('bakeries')
      .doc(testStoreId)
      .collection('settings')
      .doc('default')
      .collection('staff');

    const b2bSnapshot = await b2bRef.get();
    const staffSnapshot = await staffRef.get();

    if (!b2bSnapshot.empty) {
      await Promise.all(b2bSnapshot.docs.map(doc => doc.ref.delete()));
    }

    if (!staffSnapshot.empty) {
      await Promise.all(staffSnapshot.docs.map(doc => doc.ref.delete()));
    }
  }, 10000);

  describe('Basic CRUD Operations', () => {
    it('should create a new order', async () => {
      const orderData = {
        userId: 'test-user',
        userName: 'Test Customer',
        userEmail: 'test@example.com',
        orderItems: [{
          id: 'test-item',
          productId: 'test-product',
          productName: 'Test Product',
          collectionId: 'test-collection',
          collectionName: 'Test Collection',
          quantity: 1,
          basePrice: 10000,
          currentPrice: 10000,
          variation: { name: 'regular', value: 1 },
          recipeId: 'test-recipe',
          taxPercentage: 19,
          isComplimentary: false,
          productionBatch: 1,
          status: 0,
        }],
        paymentMethod: 'transfer',
        fulfillmentType: 'pickup',
        preparationDate: new Date(),
        dueDate: new Date(),
      };

      const result = await orderService.create(orderData, testStoreId);

      expect(result).toBeInstanceOf(Order);
      expect(result.id).toBeDefined();
      expect(result.userId).toBe(orderData.userId);

      // Verify order exists in Firestore
      const doc = await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('orders')
        .doc(result.id)
        .get();

      expect(doc.exists).toBe(true);
      expect(doc.data().userId).toBe(orderData.userId);
    });

    it('should create order with client address update', async () => {
      const orderData = {
        userId: 'test-user',
        userName: 'Test Customer',
        userEmail: 'test@example.com',
        deliveryAddress: 'New Address 123',
        shouldUpdateClientAddress: true,
        orderItems: [{
          id: 'test-item',
          productId: 'test-product',
          productName: 'Test Product',
          collectionId: 'test-collection',
          collectionName: 'Test Collection',
          quantity: 1,
          basePrice: 10000,
          currentPrice: 10000,
          variation: { name: 'regular', value: 1 },
          recipeId: 'test-recipe',
          taxPercentage: 19,
          isComplimentary: false,
          productionBatch: 1,
          status: 0,
        }],
        fulfillmentType: 'delivery',
        preparationDate: new Date(),
        dueDate: new Date(),
      };

      await orderService.create(orderData, testStoreId);

      // Verify client address was updated
      const clientDoc = await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('users')
        .doc('test-user')
        .get();

      expect(clientDoc.data().address).toBe(orderData.deliveryAddress);
    });

    it('should update an order', async () => {
      const testOrder = testOrders[0];
      const updateData = {
        status: 2,
        isPaid: true,
      };

      const updated = await orderService.update(
        testOrder.id,
        updateData,
        testStoreId,
        testEditor,
      );

      expect(updated.status).toBe(updateData.status);
      expect(updated.isPaid).toBe(updateData.isPaid);
      expect(updated.lastEditedBy).toBeDefined();
      expect(updated.lastEditedBy.email).toBe(testEditor.email);

      // Verify history was created
      const historySnapshot = await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('orders')
        .doc(testOrder.id)
        .collection('updateHistory')
        .get();

      expect(historySnapshot.empty).toBe(false);
      const historyDoc = historySnapshot.docs[0];
      expect(historyDoc.data().editor.email).toBe(testEditor.email);
      expect(historyDoc.data().changes).toHaveProperty('status');
    });

    it('should soft delete an order', async () => {
      const testOrder = testOrders[0];

      await orderService.remove(testOrder.id, testStoreId, testEditor);

      const doc = await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('orders')
        .doc(testOrder.id)
        .get();

      expect(doc.data().isDeleted).toBe(true);
      expect(doc.data().lastEditedBy).toBeDefined();
      expect(doc.data().lastEditedBy.email).toBe(testEditor.email);

    });
  });

  describe('Batch Operations', () => {
    it('should update multiple orders in a single batch', async () => {
      const updates = createBatchUpdateData(testOrders.slice(0, 5));
      const result = await orderService.patchAll(testStoreId, updates, testEditor);

      expect(result.success).toHaveLength(5);
      expect(result.failed).toHaveLength(0);

      // Verify each order was updated
      for (const update of result.success) {
        const order = await orderService.getById(update.id, testStoreId);
        expect(order.status).toBe(updates.find(u => u.id === order.id).data.status);
      }
    });

    it('should handle partial failures in batch updates', async () => {
      const updates = [
        ...createBatchUpdateData(testOrders.slice(0, 2)),
        { id: 'non-existent-id', data: { status: 1 } },
      ];

      const result = await orderService.patchAll(testStoreId, updates, testEditor);

      expect(result.success).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].id).toBe('non-existent-id');
    });

  });

  describe('Sales Report', () => {
    it('should generate correct sales metrics', async () => {
      console.log('=== TEST START: SALES METRICS ===');

      const ordersRef = db.collection('bakeries').doc(testStoreId).collection('orders');
      const ordersAtStart = await ordersRef.get();
      console.log('Orders at test start:', ordersAtStart.size);

      const report = await orderService.getSalesReport(testStoreId, {
        filters: {
          dateRange: {
            dateField: 'dueDate',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-31'),
          },
        },
      });

      console.log('Report summary:', {
        totalB2B: report.summary.totalB2B,
        totalB2C: report.summary.totalB2C,
        totalSales: report.summary.totalSales,
        totalPaidOrders: report.summary.totalPaidOrders,
      });

      // Calculate expected totals from test orders using userId
      const b2bOrders = testOrders.filter(order => order.userId === 'b2b-user');
      const b2cOrders = testOrders.filter(order => order.userId === 'test-user');

      console.log('Test orders analysis:', {
        totalOrders: testOrders.length,
        b2bCount: b2bOrders.length,
        b2cCount: b2cOrders.length,
        b2bTotal: b2bOrders.reduce((sum, order) => sum + order.total, 0),
        b2cTotal: b2cOrders.reduce((sum, order) => sum + order.total, 0),
      });

      const expectedB2BTotal = b2bOrders.reduce((sum, order) => sum + order.subtotal, 0);
      const expectedB2CTotal = b2cOrders.reduce((sum, order) => sum + order.subtotal, 0);
      const expectedTotal = expectedB2BTotal + expectedB2CTotal;

      expect(report.summary.totalB2B).toBe(expectedB2BTotal);
      expect(report.summary.totalB2C).toBe(expectedB2CTotal);
      expect(report.summary.totalSales).toBe(expectedTotal);
    }, 10000);
  });

  describe('History Tracking', () => {
    it('should retrieve order history', async () => {
      const testOrder = testOrders[0];

      // Create some history by making updates
      await orderService.update(
        testOrder.id,
        { status: 1 },
        testStoreId,
        testEditor,
      );
      await orderService.update(
        testOrder.id,
        { status: 2 },
        testStoreId,
        testEditor,
      );

      const history = await orderService.getHistory(testStoreId, testOrder.id);

      expect(history).toHaveLength(2);
      expect(history[0].editor.email).toBe(testEditor.email);
      expect(history[0].changes).toHaveProperty('status');
    });

    it('should update client history on order changes', async () => {
      const testOrder = testOrders[0];

      await orderService.update(
        testOrder.id,
        { deliveryFee: 1 },
        testStoreId,
        testEditor,
      );

      const clientHistoryDoc = await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('users')
        .doc(testOrder.userId)
        .collection('orderHistory')
        .doc(testOrder.id)
        .get();

      expect(clientHistoryDoc.exists).toBe(true);
      expect(clientHistoryDoc.data().deliveryFee).toBe(1);
    });
  });

  describe('PaymentDate Queries with Legacy Support', () => {
    let testOrdersWithPaymentDates;
    let testOrdersLegacy;

    beforeEach(async () => {
      // Create orders with actual paymentDate
      testOrdersWithPaymentDates = [];
      for (let i = 0; i < 3; i++) {
        const orderData = {
          userId: 'test-user',
          userName: 'Test Customer',
          userEmail: 'test@example.com',
          dueDate: new Date('2025-09-15'),
          preparationDate: new Date('2025-09-15'),
          paymentDate: new Date('2025-09-16'), // Set actual payment date
          isPaid: true,
          paymentMethod: 'transfer',
          fulfillmentType: 'pickup',
          orderItems: [{
            productId: `product-${i}`,
            productName: `Test Product ${i}`,
            collectionId: `collection-${i}`,
            collectionName: 'Test Collection',
            quantity: 2,
            basePrice: 10000,
            currentPrice: 10000,
            variation: { size: 'medium' },
            recipeId: `recipe-${i}`,
            taxPercentage: 19,
          }],
        };

        const order = await orderService.create(orderData, testStoreId);
        testOrdersWithPaymentDates.push(order);
      }

      // Create legacy orders (paymentDate null but isPaid true)
      testOrdersLegacy = [];
      for (let i = 0; i < 2; i++) {
        const orderData = {
          userId: 'test-user',
          userName: 'Test Customer',
          userEmail: 'test@example.com',
          dueDate: new Date('2025-09-15'), // Same dueDate as paymentDate above
          preparationDate: new Date('2025-09-15'),
          paymentDate: null, // Legacy: no payment date set
          isPaid: true,
          paymentMethod: 'cash',
          fulfillmentType: 'pickup',
          orderItems: [{
            productId: `legacy-product-${i}`,
            productName: `Legacy Product ${i}`,
            collectionId: `legacy-collection-${i}`,
            collectionName: 'Legacy Collection',
            quantity: 1,
            basePrice: 5000,
            currentPrice: 5000,
            variation: { size: 'small' },
            recipeId: `legacy-recipe-${i}`,
            taxPercentage: 19,
          }],
        };

        const order = await orderService.create(orderData, testStoreId);
        testOrdersLegacy.push(order);
      }
    });

    it('should return orders with actual paymentDate when querying by paymentDate', async () => {
      const QueryParser = require('../../utils/queryParser');
      const mockReq = {
        query: {
          date_field: 'paymentDate',
          start_date: '2025-09-16T00:00:00.000Z',
          end_date: '2025-09-16T23:59:59.999Z',
        },
      };

      const queryParser = new QueryParser(mockReq);
      const query = queryParser.getQuery();

      const result = await orderService.getSalesReport(testStoreId, query);

      expect(result.summary.totalPaidOrders).toBe(3); // Only orders with actual paymentDate
    });

    it('should return legacy orders when dueDate falls in paymentDate range', async () => {
      const QueryParser = require('../../utils/queryParser');
      const mockReq = {
        query: {
          date_field: 'paymentDate',
          start_date: '2025-09-15T00:00:00.000Z',
          end_date: '2025-09-15T23:59:59.999Z',
        },
      };

      const queryParser = new QueryParser(mockReq);
      const query = queryParser.getQuery();

      const result = await orderService.getSalesReport(testStoreId, query);

      expect(result.summary.totalPaidOrders).toBe(2); // Only legacy orders with dueDate in range
    });

    it('should return both actual and legacy orders when ranges overlap', async () => {
      const QueryParser = require('../../utils/queryParser');
      const mockReq = {
        query: {
          date_field: 'paymentDate',
          start_date: '2025-09-15T00:00:00.000Z',
          end_date: '2025-09-16T23:59:59.999Z',
        },
      };

      const queryParser = new QueryParser(mockReq);
      const query = queryParser.getQuery();

      const result = await orderService.getSalesReport(testStoreId, query);

      expect(result.summary.totalPaidOrders).toBe(5); // Both actual (3) and legacy (2) orders
    });

    it('should continue to work normally with dueDate queries', async () => {
      const QueryParser = require('../../utils/queryParser');
      const mockReq = {
        query: {
          date_field: 'dueDate',
          start_date: '2025-09-15T00:00:00.000Z',
          end_date: '2025-09-15T23:59:59.999Z',
        },
      };

      const queryParser = new QueryParser(mockReq);
      const query = queryParser.getQuery();

      const result = await orderService.getSalesReport(testStoreId, query);

      expect(result.summary.totalPaidOrders).toBe(5); // All orders have dueDate 2025-09-15
    });

    it('should not return unpaid orders even if dueDate matches', async () => {
      // Create an unpaid order with dueDate in range
      const unpaidOrderData = {
        userId: 'test-user',
        userName: 'Test Customer',
        userEmail: 'test@example.com',
        dueDate: new Date('2025-09-15'),
        preparationDate: new Date('2025-09-15'),
        paymentDate: null,
        isPaid: false, // Not paid
        paymentMethod: 'cash',
        fulfillmentType: 'pickup',
        orderItems: [{
          productId: 'unpaid-product',
          productName: 'Unpaid Product',
          collectionId: 'unpaid-collection',
          collectionName: 'Unpaid Collection',
          quantity: 1,
          basePrice: 5000,
          currentPrice: 5000,
          variation: { size: 'small' },
          recipeId: 'unpaid-recipe',
          taxPercentage: 19,
        }],
      };

      await orderService.create(unpaidOrderData, testStoreId);

      const QueryParser = require('../../utils/queryParser');
      const mockReq = {
        query: {
          date_field: 'paymentDate',
          start_date: '2025-09-15T00:00:00.000Z',
          end_date: '2025-09-15T23:59:59.999Z',
        },
      };

      const queryParser = new QueryParser(mockReq);
      const query = queryParser.getQuery();

      const result = await orderService.getSalesReport(testStoreId, query);

      // Should still be 2 (only legacy paid orders), not including the unpaid one
      expect(result.summary.totalPaidOrders).toBe(2);
    });

    it('should handle orders that completely lack paymentDate field', async () => {
      // Create an order by directly writing to Firestore without paymentDate field
      const orderWithoutPaymentDateField = {
        id: 'missing-payment-date',
        bakeryId: testStoreId,
        userId: 'test-user',
        userName: 'Test Customer',
        userEmail: 'test@example.com',
        dueDate: new Date('2025-09-15'),
        preparationDate: new Date('2025-09-15'),
        // Intentionally NOT setting paymentDate field at all
        isPaid: true,
        paymentMethod: 'cash',
        fulfillmentType: 'pickup',
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        orderItems: [{
          id: 'missing-payment-item',
          productId: 'missing-payment-product',
          productName: 'Missing Payment Product',
          collectionId: 'missing-payment-collection',
          collectionName: 'Missing Payment Collection',
          quantity: 1,
          basePrice: 3000,
          currentPrice: 3000,
          variation: { size: 'small' },
          recipeId: 'missing-payment-recipe',
          taxPercentage: 19,
          taxAmount: 478,
          preTaxPrice: 2522,
          subtotal: 3000,
          isComplimentary: false,
          productionBatch: 1,
          status: 0,
        }],
        taxableSubtotal: 3000,
        nonTaxableSubtotal: 0,
        subtotal: 3000,
        totalTaxAmount: 478,
        preTaxTotal: 2522,
        total: 3000,
        isComplimentary: false,
        status: 1,
        partialPaymentAmount: 0,
        isDeliveryPaid: false,
        deliveryAddress: '',
        deliveryInstructions: '',
        deliveryDriverId: '-',
        driverMarkedAsPaid: false,
        deliverySequence: 1,
        deliveryFee: 0,
        deliveryCost: 0,
        numberOfBags: 1,
        customerNotes: '',
        deliveryNotes: '',
        internalNotes: '',
      };

      // Write directly to Firestore without going through Order model
      await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('orders')
        .doc('missing-payment-date')
        .set(orderWithoutPaymentDateField);

      const QueryParser = require('../../utils/queryParser');
      const mockReq = {
        query: {
          date_field: 'paymentDate',
          start_date: '2025-09-15T00:00:00.000Z',
          end_date: '2025-09-15T23:59:59.999Z',
        },
      };

      const queryParser = new QueryParser(mockReq);
      const query = queryParser.getQuery();

      const result = await orderService.getSalesReport(testStoreId, query);

      // Should be 3 now: 2 legacy orders + 1 order with missing paymentDate field
      expect(result.summary.totalPaidOrders).toBe(3);
    });
  }, 30000);
});
