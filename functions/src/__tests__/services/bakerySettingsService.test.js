const { initializeFirebase, clearFirestoreData } = require('../setup/firebase');
const { CompanySettings } = require('../../models/BakerySettings');

// Test Data Setup Helpers
const createTestStaffMember = (overrides = {}) => ({
  id: 'test-staff-1',
  name: 'Test Staff',
  email: 'staff@example.com',
  role: 'company_staff',
  ...overrides,
});

const createTestB2BClient = (overrides = {}) => ({
  id: 'test-client-1',
  name: 'Test Client',
  email: 'client@example.com',
  address: '123 Test St',
  ...overrides,
});

describe('Company Settings Service Tests', () => {
  let db;
  let companySettingsService;
  let testStoreId;

  beforeAll(async () => {
    ({ db } = initializeFirebase());
    companySettingsService = require('../../services/companySettingsService');
    testStoreId = 'test-bakery';
    const b2bRef = db
      .collection('companies')
      .doc(testStoreId)
      .collection('settings')
      .doc('default')
      .collection('b2b_clients');

    const staffRef = db
      .collection('companies')
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
  });

  beforeEach(async () => {
    await clearFirestoreData(db);

  });

  afterAll(async () => {
    await clearFirestoreData(db);
  });

  const setupDefaultSettings = async () => {
    const settingsRef = db
      .collection('companies')
      .doc(testStoreId)
      .collection('settings')
      .doc('default');

    await settingsRef.set({
      id: 'default',
      bakeryId: testStoreId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return settingsRef;
  };

  describe('Basic Settings Operations', () => {
    it('should get settings by id', async () => {
      await setupDefaultSettings();

      const settings = await companySettingsService.getById('default', testStoreId);

      expect(settings).toBeInstanceOf(CompanySettings);
      expect(settings.bakeryId).toBe(testStoreId);
    });

    it('should throw NotFoundError when settings do not exist', async () => {
      await expect(
        companySettingsService.getById('default', testStoreId),
      ).rejects.toThrow('Settings not found');
    });

    it('should patch settings', async () => {
      await setupDefaultSettings();

      const patchData = {
        theme: { primaryColor: '#FF0000' },
      };

      const updated = await companySettingsService.patch('default', patchData, testStoreId);

      expect(updated.theme.primaryColor).toBe(patchData.theme.primaryColor);

      // Verify in Firestore
      const doc = await db
        .collection('companies')
        .doc(testStoreId)
        .collection('settings')
        .doc('default')
        .get();

      expect(doc.data().theme.primaryColor).toBe(patchData.theme.primaryColor);
    });

    it('should throw NotFoundError when patching non-existent settings', async () => {
      await expect(
        companySettingsService.patch('default', { theme: {} }, testStoreId),
      ).rejects.toThrow('Settings not found');
    });
  });

  describe('Staff Management', () => {
    beforeEach(async () => {
      await setupDefaultSettings();

      // Setup test staff
      const staffRef = db
        .collection('companies')
        .doc(testStoreId)
        .collection('settings')
        .doc('default')
        .collection('staff');

      await staffRef.doc('test-staff-1').set(createTestStaffMember());
      await staffRef.doc('test-staff-2').set(createTestStaffMember({
        id: 'test-staff-2',
        email: 'staff2@example.com',
      }));

      // Setup test admin in root users collection
      await db.collection('users').doc('admin-1').set({
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'company_admin',
        bakeryId: testStoreId,
      });
    });

    it('should get complete staff list including admins', async () => {
      const staffList = await companySettingsService.getStaffList(testStoreId);

      expect(staffList).toHaveLength(3); // 2 staff + 1 admin

      // Verify staff members
      const staffMembers = staffList.filter(staff => staff.role === 'company_staff');
      expect(staffMembers).toHaveLength(2);
      expect(staffMembers[0].email).toBe('staff@example.com');
      expect(staffMembers[1].email).toBe('staff2@example.com');

      // Verify admin
      const adminMembers = staffList.filter(staff => staff.role === 'company_admin');
      expect(adminMembers).toHaveLength(1);
      expect(adminMembers[0].email).toBe('admin@example.com');
    });
  });

  describe('B2B Clients Management', () => {
    beforeEach(async () => {
      await setupDefaultSettings();

      // Setup test B2B clients
      const b2bRef = db
        .collection('companies')
        .doc(testStoreId)
        .collection('settings')
        .doc('default')
        .collection('b2b_clients');

      await b2bRef.doc('test-client-1').set(createTestB2BClient());
      await b2bRef.doc('test-client-2').set(createTestB2BClient({
        id: 'test-client-2',
        email: 'client2@example.com',
      }));
    });

    it('should get all B2B clients', async () => {
      const clients = await companySettingsService.getB2bClientsList(testStoreId);

      expect(clients).toHaveLength(2);
      expect(clients[0].email).toBe('client@example.com');
      expect(clients[1].email).toBe('client2@example.com');
    });

    it('should return empty array when no B2B clients exist', async () => {
      // Create new bakery without any B2B clients
      const emptyCompanyId = 'empty-bakery';
      await db
        .collection('companies')
        .doc(emptyCompanyId)
        .collection('settings')
        .doc('default')
        .set({
          id: 'default',
          bakeryId: emptyCompanyId,
          createdAt: new Date(),
        });

      const clients = await companySettingsService.getB2bClientsList(emptyCompanyId);
      expect(clients).toHaveLength(0);
    });
  });
});
