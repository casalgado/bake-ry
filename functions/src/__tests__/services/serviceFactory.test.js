const { initializeFirebase, clearFirestoreData } = require('../setup/firebase');
const createBaseService = require('../../services/base/serviceFactory');

// First, let's create a simple model class for testing
class TestModel {
  constructor(data = {}) {
    // Required base fields
    this.id = data.id;
    this.name = data.name;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.isDeleted = data.isDeleted || false;
    this.status = data.status;

    this.lastEditedBy = data.lastEditedBy || null;
  }

  toFirestore() {
    // Convert all fields to a Firestore-compatible format
    return {
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      isDeleted: this.isDeleted,
      status: this.status || null,
      lastEditedBy: this.lastEditedBy || null,
    };
  }

  static fromFirestore(doc) {
    return new TestModel({
      id: doc.id,
      ...doc.data(),
    });
  }
}

describe('Base Service Tests', () => {
  let db;
  let baseService;

  beforeAll(() => {
    // Initialize Firebase and get db instance
    ({ db } = initializeFirebase());

    // Create a base service instance for testing
    baseService = createBaseService('test-collection', TestModel);
  });

  afterEach(async () => {
    // Clean up before each test
    await clearFirestoreData(db);
  });

  afterAll(async () => {
    await clearFirestoreData(db);
  }, 10000);

  describe('Basic CRUD Operations', () => {
    it('should create a new document', async () => {

      const testData = {
        name: 'Test Document',
      };

      const result = await baseService.create(testData);

      // Verify the document was created
      expect(result).toBeInstanceOf(TestModel);
      expect(result.name).toBe(testData.name);
      expect(result.id).toBeDefined();

      // Verify it exists in Firestore
      const doc = await db.collection('test-collection').doc(result.id).get();
      expect(doc.exists).toBe(true);
      expect(doc.data().name).toBe(testData.name);
    });

    it('should retrieve a document by ID', async () => {
      // First create a document
      const created = await baseService.create({
        name: 'Test Retrieval',
      });

      // Then retrieve it
      const retrieved = await baseService.getById(created.id);

      expect(retrieved).toBeInstanceOf(TestModel);
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.name).toBe(created.name);
    });

    it('should update a document', async () => {
      // First create a document
      const created = await baseService.create({
        name: 'Original Name',
      });

      // Update the document
      const updated = await baseService.update(created.id, {
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');

      // Verify in Firestore
      const doc = await db.collection('test-collection').doc(created.id).get();
      expect(doc.data().name).toBe('Updated Name');
    });

    it('should delete a document (soft delete)', async () => {
      // Create initial document
      const created = await baseService.create({
        name: 'To Be Deleted',
        lastEditedBy: {
          userId: null,
          email: null,
          role: null,
        },
      });

      // Delete with editor info
      const editor = {
        uid: 'test-user',
        email: 'test@example.com',
        role: 'admin',
      };

      await baseService.remove(created.id, null, editor);

      // Verify the document is marked as deleted
      const doc = await db.collection('test-collection').doc(created.id).get();
      expect(doc.data().isDeleted).toBe(true);
      expect(doc.data().lastEditedBy.userId).toBe('test-user');
    });
  });

  describe('Query Operations', () => {
    it('should get all documents with pagination', async () => {
      // Create multiple documents
      await Promise.all([
        baseService.create({ name: 'Doc 1' }),
        baseService.create({ name: 'Doc 2' }),
        baseService.create({ name: 'Doc 3' }),
      ]);

      const result = await baseService.getAll(null, {
        pagination: { page: 1, perPage: 2 },
      });

      expect(result.items).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should filter documents based on criteria', async () => {
      // Create documents with different statuses
      await Promise.all([
        baseService.create({ name: 'Active Doc', status: 'active' }),
        baseService.create({ name: 'Inactive Doc', status: 'inactive' }),
      ]);

      const result = await baseService.getAll(null, {
        filters: { status: 'active' },
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Active Doc');
    });
  });

  describe('History Tracking', () => {
    it('should record update history', async () => {
      // Create a document
      const created = await baseService.create({
        name: 'Original Name',
      });

      // Update with editor info
      const editor = {
        uid: 'test-user',
        email: 'test@example.com',
        role: 'admin',
      };

      await baseService.update(created.id, {
        name: 'Updated Name',
      }, null, editor);

      // Verify history record was created
      const historySnapshot = await db
        .collection('test-collection')
        .doc(created.id)
        .collection('updateHistory')
        .get();

      expect(historySnapshot.empty).toBe(false);

      const historyDoc = historySnapshot.docs[0];
      expect(historyDoc.data().changes).toHaveProperty('name');
      expect(historyDoc.data().editor.email).toBe(editor.email);
    });
  });

  describe('Parent-Child Relationships', () => {
    it('should handle nested collections', async () => {
      // Create a service with parent path
      const nestedService = createBaseService(
        'child-collection',
        TestModel,
        'parent-collection/{bakeryId}',
      );

      const parentId = 'test-parent';
      const result = await nestedService.create({
        name: 'Nested Doc',
      }, parentId);

      // Verify the document was created in the correct location
      const doc = await db
        .collection('parent-collection')
        .doc(parentId)
        .collection('child-collection')
        .doc(result.id)
        .get();

      expect(doc.exists).toBe(true);
      expect(doc.data().name).toBe('Nested Doc');
    });
  });
});
