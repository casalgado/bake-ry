// tests/bakery-firebase.test.js
const { initializeFirebase, clearFirestoreData } = require('../setup/firebase');
const Company = require('../../models/Bakery');

describe('Company Firestore Tests', () => {
  let db;

  // Set up before running any tests
  beforeAll(() => {
    ({ db } = initializeFirebase());
  });

  // Clean up after each test
  afterEach(async () => {
    await clearFirestoreData(db);
  });

  afterAll(async () => {
    await clearFirestoreData(db);
  }, 10000);

  it('should create and retrieve a bakery from Firestore', async () => {
    // Create a test bakery

    const testBakery = new Company({
      name: 'Test Company',
      address: '123 Test St',
      phone: '1234567890',
      operatingHours: {
        monday: { isOpen: true, open: '08:00', close: '18:00' },
      },
    });

    // Save to Firestore
    const bakeryRef = db.collection('companies').doc();
    await bakeryRef.set(testBakery.toFirestore());

    // Retrieve from Firestore
    const savedDoc = await bakeryRef.get();
    const savedData = savedDoc.data();

    // Verify the data
    expect(savedData.name).toBe('Test Company');
    expect(savedData.address).toBe('123 Test St');
    expect(savedData.phone).toBe('1234567890');
    expect(savedData.operatingHours.monday.isOpen).toBe(true);
  });

  it('should update bakery status in Firestore', async () => {
    // Create initial bakery
    const testBakery = new Company({
      name: 'Test Company',
      isActive: true,
      isPaused: false,
    });

    // Save to Firestore
    const bakeryRef = db.collection('companies').doc();
    await bakeryRef.set(testBakery.toFirestore());

    // Update status
    testBakery.toggleStatus(true); // Set to paused
    await bakeryRef.update(testBakery.toFirestore());

    // Retrieve and verify
    const updatedDoc = await bakeryRef.get();
    const updatedData = updatedDoc.data();

    expect(updatedData.isPaused).toBe(true);
  });

  it('should handle non-existent bakery', async () => {
    const nonExistentDoc = await db.collection('companies')
      .doc('non-existent-id')
      .get();

    expect(nonExistentDoc.exists).toBe(false);
  });
});
