const { initializeFirebase, clearFirestoreData } = require('../setup/firebase');

describe('Auth Service Tests', () => {
  let db;
  let admin;
  let authService;
  let testStoreId;

  beforeAll(async () => {
    console.log('Test setup: Before initialization');
    const firebase = initializeFirebase();
    db = firebase.db;
    admin = firebase.admin;

    console.log('Test setup: After initialization', {
      hasAdmin: !!admin,
      hasDb: !!db,
      adminApps: admin?.apps?.length,
      hasAuth: !!admin?.auth,
    });
    authService = require('../../services/authService');
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

  describe('Registration', () => {
    it('should register a bakery admin user', async () => {
      const userData = {
        email: 'admin@test.com',
        password: 'password123',
        name: 'Test Admin',
        role: 'company_admin',
      };

      const result = await authService.register(userData);

      expect(result).toBeDefined();
      expect(result.email).toBe(userData.email);
      expect(result.role).toBe(userData.role);

      // Verify user exists in Auth
      const userRecord = await admin.auth().getUserByEmail(userData.email);
      expect(userRecord).toBeDefined();
      expect(userRecord.customClaims).toBeDefined();
      expect(userRecord.customClaims.role).toBe(userData.role);

      // Verify user exists in Firestore
      const userDoc = await db.collection('users').doc(userRecord.uid).get();
      expect(userDoc.exists).toBe(true);
      expect(userDoc.data().email).toBe(userData.email);
    });

    it('should not allow duplicate email registration', async () => {
      const userData = {
        email: 'duplicate@test.com',
        password: 'password123',
        name: 'Test User',
        role: 'company_admin',
      };

      await authService.register(userData);

      await expect(authService.register(userData)).rejects.toThrow();
    });
  });

  describe('Login', () => {
    it('should login an existing user and return correct data', async () => {
      // First register a user
      const userData = {
        email: 'login@test.com',
        password: 'password123',
        name: 'Test Login',
        role: 'company_admin',
      };

      const registered = await authService.register(userData);

      console.log('registered', registered);

      // For testing purposes in the emulator, we can create a mock ID token
      // with the correct audience claim
      const mockIdToken = {
        uid: registered.uid,
        email: userData.email,
        aud: 'tres-fuegos-en-casa',
        bakeryId: testStoreId,
        role: userData.role,
        auth_time: Math.floor(Date.now() / 1000),
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,

        firebase: {
          sign_in_provider: 'custom',
          identities: {},
        },
      };

      // Mock the verifyIdToken function to return our mock token
      const originalVerifyIdToken = admin.auth().verifyIdToken;
      admin.auth().verifyIdToken = jest.fn().mockResolvedValue(mockIdToken);

      try {
        // Sign in with mock ID token
        const signInResult = await authService.login(
          'mock-id-token', // The actual token value doesn't matter as we've mocked verification
          userData.email,
        );

        expect(signInResult).toBeDefined();
        expect(signInResult.email).toBe(userData.email);
        expect(signInResult.role).toBe(userData.role);
      } finally {
        // Restore original function
        admin.auth().verifyIdToken = originalVerifyIdToken;
      }
    });
  });

  describe('Token Verification', () => {
    it('should verify valid tokens', async () => {
      // Register a user first
      const userData = {
        email: 'verify@test.com',
        password: 'password123',
        name: 'Test Verify',
        role: 'company_admin',
      };

      const registered = await authService.register(userData);

      // Create a mock token with the correct claims
      const mockDecodedToken = {
        uid: registered.uid,
        email: userData.email,
        role: userData.role,
        bakeryId: testStoreId,
        aud: 'tres-fuegos-en-casa',
        auth_time: Math.floor(Date.now() / 1000),
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        firebase: {
          sign_in_provider: 'custom',
          identities: {},
        },
      };

      // Mock the verification function
      admin.auth().verifyIdToken = jest.fn().mockResolvedValue(mockDecodedToken);

      const result = await authService.verifyToken('mock-token');
      expect(result).toBeDefined();
      expect(result.uid).toBe(registered.uid);
      expect(result.role).toBe(userData.role);
      expect(result.email).toBe(userData.email);
    });
  });
});
