const { initializeFirebase, clearFirestoreData } = require('../setup/firebase');

// Test Data Setup Helpers
const createTestUserData = (overrides = {}) => ({
  email: 'test@example.com',
  name: 'Test User',
  role: 'bakery_staff',
  phone: '1234567890',
  ...overrides,
});

const setupTestData = async (db, bakeryId) => {
  // Create settings document with default collections
  const settingsRef = db
    .collection('bakeries')
    .doc(bakeryId)
    .collection('settings')
    .doc('default');

  await settingsRef.set({
    id: 'default',
    bakeryId: bakeryId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
};

describe('Bakery User Service Tests', () => {
  let db;
  let admin;
  let bakeryUserService;
  let testStoreId;
  let testEditor;

  beforeAll(() => {
    const firebase = initializeFirebase();
    db = firebase.db;
    admin = firebase.admin;
    bakeryUserService = require('../../services/bakeryUserService');
    testStoreId = 'test-bakery';
    testEditor = {
      uid: 'test-editor',
      email: 'editor@example.com',
      role: 'bakery_staff',
    };

    // Connect to Auth Emulator
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
  });

  beforeEach(async () => {
    await clearFirestoreData(db);
    await setupTestData(db, testStoreId);

    // Clear Auth users
    try {
      const users = await admin.auth().listUsers();
      await Promise.all(
        users.users.map(user => admin.auth().deleteUser(user.uid)),
      );
    } catch (error) {
      console.log('No users to clean up', error);
    }
  });

  afterAll(async () => {
    await clearFirestoreData(db);
    const apps = admin.apps;
    await Promise.all(apps.map(app => app.delete()));
  });

  describe('User Creation', () => {
    it('should create a bakery staff user with correct collections', async () => {
      const userData = createTestUserData();

      const result = await bakeryUserService.create(userData, testStoreId);

      expect(result).toBeDefined();
      expect(result.email).toBe(userData.email);
      expect(result.role).toBe(userData.role);

      // Verify user in Auth
      const authUser = await admin.auth().getUser(result.id);
      expect(authUser.email).toBe(userData.email);
      expect(authUser.customClaims).toEqual({
        role: userData.role,
        bakeryId: testStoreId,
        subscriptionStatus: 'TRIAL',
        subscriptionTier: 'BASIC',
      });

      // Verify user in Firestore
      const userDoc = await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('users')
        .doc(result.id)
        .get();
      expect(userDoc.exists).toBe(true);
      expect(userDoc.data().email).toBe(userData.email);

      // Verify staff collection entry
      const staffDoc = await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('settings')
        .doc('default')
        .collection('staff')
        .doc(result.id)
        .get();
      expect(staffDoc.exists).toBe(true);
      expect(staffDoc.data().email).toBe(userData.email);
    });

    it('should create a B2B client with correct collections', async () => {
      const userData = createTestUserData({
        role: 'bakery_customer',
        category: 'B2B',
        address: '123 Test St',
      });

      const result = await bakeryUserService.create(userData, testStoreId);

      // Verify B2B collection entry
      const b2bDoc = await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('settings')
        .doc('default')
        .collection('b2b_clients')
        .doc(result.id)
        .get();
      expect(b2bDoc.exists).toBe(true);
      expect(b2bDoc.data().email).toBe(userData.email);
      expect(b2bDoc.data().address).toBe(userData.address);
    });

    it('should create a B2B client without phone number', async () => {
      const userData = createTestUserData({
        role: 'bakery_customer',
        category: 'B2B',
        address: '123 Test St',
        phone: '', // explicitly test empty phone
      });

      const result = await bakeryUserService.create(userData, testStoreId);

      // Verify B2B collection entry
      const b2bDoc = await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('settings')
        .doc('default')
        .collection('b2b_clients')
        .doc(result.id)
        .get();

      expect(b2bDoc.exists).toBe(true);
      expect(b2bDoc.data().email).toBe(userData.email);
      expect(b2bDoc.data().address).toBe(userData.address);
      expect(b2bDoc.data().phone).toBe('');
    });

    it('should create a staff user without phone number or address', async () => {
      const userData = createTestUserData({
        role: 'delivery_assistant',
        category: 'PER',
        address: '',
        phone: '', // explicitly test empty phone
      });

      const result = await bakeryUserService.create(userData, testStoreId);

      // Verify B2B collection entry
      const b2bDoc = await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('settings')
        .doc('default')
        .collection('b2b_clients')
        .doc(result.id)
        .get();

      expect(b2bDoc.exists).toBe(true);
      expect(b2bDoc.data().email).toBe(userData.email);
      expect(b2bDoc.data().address).toBe(userData.address);
      expect(b2bDoc.data().phone).toBe('');
    });

    it('should prevent duplicate email registration within bakery', async () => {
      const userData = createTestUserData();
      await bakeryUserService.create(userData, testStoreId);

      await expect(
        bakeryUserService.create(userData, testStoreId),
      ).rejects.toThrow('A user with this email already exists in this bakery');
    });
  });

  describe('User Updates', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await bakeryUserService.create(createTestUserData(), testStoreId);
    });

    it('should update user details and related collections', async () => {
      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com',
        phone: '9876543210',
      };

      const updated = await bakeryUserService.update(
        testUser.id,
        updateData,
        testStoreId,
        testEditor,
      );

      expect(updated.name).toBe(updateData.name);
      expect(updated.email).toBe(updateData.email);

      // Verify Auth update
      const authUser = await admin.auth().getUser(testUser.id);
      expect(authUser.email).toBe(updateData.email);

      // Verify staff collection update
      const staffDoc = await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('settings')
        .doc('default')
        .collection('staff')
        .doc(testUser.id)
        .get();
      expect(staffDoc.data().name).toBe(updateData.name);
      expect(staffDoc.data().email).toBe(updateData.email);
    });

    it('should handle role changes correctly', async () => {
      const updateData = {
        role: 'delivery_assistant',
      };

      await bakeryUserService.update(
        testUser.id,
        updateData,
        testStoreId,
        testEditor,
      );

      // Verify Auth claims update
      const authUser = await admin.auth().getUser(testUser.id);
      expect(authUser.customClaims.role).toBe(updateData.role);

      // Verify staff collection maintains entry
      const staffDoc = await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('settings')
        .doc('default')
        .collection('staff')
        .doc(testUser.id)
        .get();
      expect(staffDoc.exists).toBe(true);
      expect(staffDoc.data().role).toBe(updateData.role);
    });

    it('should handle category changes and record history', async () => {
      const updateData = {
        category: 'B2B',
        address: '123 New St',
        categoryChangeReason: 'Customer upgraded to B2B',
      };

      await bakeryUserService.update(
        testUser.id,
        updateData,
        testStoreId,
        testEditor,
      );

      // Verify B2B collection entry
      const b2bDoc = await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('settings')
        .doc('default')
        .collection('b2b_clients')
        .doc(testUser.id)
        .get();
      expect(b2bDoc.exists).toBe(true);

      // Verify category change history
      const historySnapshot = await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('users')
        .doc(testUser.id)
        .collection('category_history')
        .get();

      expect(historySnapshot.empty).toBe(false);
      const historyDoc = historySnapshot.docs[0];
      expect(historyDoc.data().new_category).toBe('B2B');
      expect(historyDoc.data().changed_by.email).toBe(testEditor.email);
    });
  });

  describe('User Deletion', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await bakeryUserService.create(createTestUserData(), testStoreId);
    });

    it('should delete user and clean up related collections', async () => {
      // Mock the Firebase Auth deleteUser function
      const originalDeleteUser = admin.auth().deleteUser;
      admin.auth().deleteUser = jest.fn().mockResolvedValue(undefined);

      try {
        await bakeryUserService.delete(testUser.id, testStoreId);

        // Verify deleteUser was called
        expect(admin.auth().deleteUser).toHaveBeenCalledWith(testUser.id);

        // Verify Firestore deletion (soft delete)
        const userDoc = await db
          .collection('bakeries')
          .doc(testStoreId)
          .collection('users')
          .doc(testUser.id)
          .get();
        expect(userDoc.data().isDeleted).toBe(true);

        // Verify staff collection cleanup
        const staffDoc = await db
          .collection('bakeries')
          .doc(testStoreId)
          .collection('settings')
          .doc('default')
          .collection('staff')
          .doc(testUser.id)
          .get();
        expect(staffDoc.exists).toBe(false);
      } finally {
        // Restore original function
        admin.auth().deleteUser = originalDeleteUser;
      }
    });
  });

  describe('History Operations', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await bakeryUserService.create(createTestUserData(), testStoreId);
    });

    it('should get user order history', async () => {
      // Create some test orders
      const orderHistoryRef = db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('users')
        .doc(testUser.id)
        .collection('orderHistory');

      await orderHistoryRef.doc('order1').set({
        id: 'order1',
        dueDate: new Date(),
        isDeleted: false,
      });

      await orderHistoryRef.doc('order2').set({
        id: 'order2',
        dueDate: new Date(),
        isDeleted: true, // This one should be filtered out
      });

      const history = await bakeryUserService.getHistory(testStoreId, testUser.id);
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('order1');
    });

    it('should throw error when getting history without required params', async () => {
      await expect(
        bakeryUserService.getHistory(null, testUser.id),
      ).rejects.toThrow('Both bakeryId and userId are required');

      await expect(
        bakeryUserService.getHistory(testStoreId, null),
      ).rejects.toThrow('Both bakeryId and userId are required');
    });
  });
});
