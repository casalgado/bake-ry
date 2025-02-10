const { initializeFirebase, clearFirestoreData } = require('../setup/firebase');

// Test Data Setup Helpers
const createTestUserData = (overrides = {}) => ({
  email: 'test@example.com',
  password: 'password123',
  name: 'Test User',
  role: 'system_admin',
  ...overrides,
});

describe('Admin User Service Tests', () => {
  let db;
  let admin;
  let adminUserService;
  let testStoreId;

  beforeAll(() => {
    const firebase = initializeFirebase();
    db = firebase.db;
    admin = firebase.admin;
    adminUserService = require('../../services/adminUserService');
    testStoreId = 'test-bakery';

    // Connect to Auth Emulator
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
  });

  beforeEach(async () => {
    await clearFirestoreData(db);
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
    it('should create a system admin user', async () => {
      const userData = createTestUserData();
      const result = await adminUserService.create(userData);

      expect(result.email).toBe(userData.email);
      expect(result.role).toBe(userData.role);
      expect(result.uid).toBeDefined();

      // Verify user in Auth
      const authUser = await admin.auth().getUser(result.uid);
      expect(authUser.email).toBe(userData.email);
      expect(authUser.customClaims).toEqual({ role: userData.role });

      // Verify user in Firestore
      const doc = await db.collection('users').doc(result.uid).get();
      expect(doc.exists).toBe(true);
      expect(doc.data().email).toBe(userData.email);
      expect(doc.data().password).toBeUndefined(); // Password should not be stored
    });

    it('should create a bakery admin user with bakeryId claim', async () => {
      const userData = createTestUserData({
        role: 'company_admin',
        bakeryId: testStoreId,
      });

      const result = await adminUserService.create(userData);

      // Verify custom claims include bakeryId
      const authUser = await admin.auth().getUser(result.uid);
      expect(authUser.customClaims).toEqual({
        role: userData.role,
        bakeryId: userData.bakeryId,
      });
    });

    it('should prevent duplicate email registration', async () => {
      const userData = createTestUserData();
      await adminUserService.create(userData);

      await expect(adminUserService.create(userData))
        .rejects
        .toThrow('A user with this email already exists');
    });

    it('should clean up Auth user if transaction fails', async () => {
      // Mock the transaction to force a failure
      const originalRunTransaction = db.runTransaction.bind(db);
      db.runTransaction = jest.fn().mockRejectedValue(new Error('Transaction failed'));

      try {
        const userData = createTestUserData();
        await expect(adminUserService.create(userData)).rejects.toThrow('Transaction failed');

        // Verify no user exists in Auth
        const users = await admin.auth().listUsers();
        const matchingUsers = users.users.filter(user => user.email === userData.email);
        expect(matchingUsers).toHaveLength(0);
      } finally {
        // Restore original transaction function
        db.runTransaction = originalRunTransaction;
      }
    });
  });

  describe('User Updates', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await adminUserService.create(createTestUserData());
    });

    it('should update user details', async () => {
      const updateData = {
        name: 'Updated Name',
      };

      const updated = await adminUserService.update(testUser.uid, updateData);

      expect(updated.name).toBe(updateData.name);

      // Verify in Firestore
      const doc = await db.collection('users').doc(testUser.uid).get();
      expect(doc.data().name).toBe(updateData.name);
    });

    it('should update email in both Auth and Firestore', async () => {
      const newEmail = 'updated@example.com';
      const updated = await adminUserService.update(testUser.uid, { email: newEmail });

      expect(updated.email).toBe(newEmail);

      // Verify in Auth
      const authUser = await admin.auth().getUser(testUser.uid);
      expect(authUser.email).toBe(newEmail);

      // Verify in Firestore
      const doc = await db.collection('users').doc(testUser.uid).get();
      expect(doc.data().email).toBe(newEmail);
    });

    it('should record update history', async () => {
      const updateData = {
        name: 'Updated Name',
      };

      await adminUserService.update(testUser.uid, updateData);

      // Verify history record
      const historySnapshot = await db
        .collection('users')
        .doc(testUser.uid)
        .collection('updateHistory')
        .get();

      expect(historySnapshot.empty).toBe(false);
      const historyDoc = historySnapshot.docs[0];
      expect(historyDoc.data().changes).toHaveProperty('name');
    });

    it('should throw NotFoundError for non-existent user', async () => {
      await expect(
        adminUserService.update('non-existent-id', { name: 'New Name' }),
      ).rejects.toThrow('User not found');
    });
  });

  describe('User Deletion', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await adminUserService.create(createTestUserData());
    });

    it('should delete user from both Auth and Firestore', async () => {
      await adminUserService.remove(testUser.uid);

      // Verify deleted from Auth
      await expect(
        admin.auth().getUser(testUser.uid),
      ).rejects.toThrow();

      // Verify deleted from Firestore (soft delete)
      const doc = await db.collection('users').doc(testUser.uid).get();
      expect(doc.data().isDeleted).toBe(true);
    });

    it('should handle deletion of non-existent user', async () => {
      await expect(
        adminUserService.remove('non-existent-id'),
      ).rejects.toThrow();
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Create multiple test users
      await Promise.all([
        adminUserService.create(createTestUserData({
          email: 'active@example.com',
          name: 'Active User',
          isActive: true,
        })),
        adminUserService.create(createTestUserData({
          email: 'inactive@example.com',
          name: 'Inactive User',
          isActive: false,
        })),
      ]);
    });

    it('should get all active users', async () => {
      const result = await adminUserService.getAll(null, {
        filters: { isActive: true },
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].email).toBe('active@example.com');
    });

    it('should exclude deleted users by default', async () => {
      const allUsers = await adminUserService.getAll();
      const hasDeletedUser = allUsers.items.some(user => user.isDeleted);
      expect(hasDeletedUser).toBe(false);
    });
  });
});
