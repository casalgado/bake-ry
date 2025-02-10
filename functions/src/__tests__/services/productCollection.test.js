const { initializeFirebase, clearFirestoreData } = require('../setup/firebase');
const ProductCollection = require('../../models/ProductCollection');

// Test Data Setup Helpers
const setupTestData = async (db, bakeryId) => {
  // Create test collections
  const collections = [];
  const collectionsRef = db.collection('bakeries').doc(bakeryId).collection('productCollections');

  for (let i = 0; i < 5; i++) {
    const collection = new ProductCollection({
      id: `test-collection-${i}`,
      name: `Test Collection ${i}`,
      bakeryId: bakeryId,
      isActive: i < 3, // First 3 are active, last 2 are inactive
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await collectionsRef.doc(collection.id).set(collection.toFirestore());
    collections.push(collection);
  }

  // Create some test products
  const productsRef = db.collection('bakeries').doc(bakeryId).collection('products');
  await productsRef.doc('active-product').set({
    name: 'Active Product',
    collectionId: 'test-collection-0',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await productsRef.doc('inactive-product').set({
    name: 'Inactive Product',
    collectionId: 'test-collection-1',
    isActive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return collections;
};

describe('Product Collection Service Tests', () => {
  let db;
  let productCollectionService;
  let testStoreId;
  let testCollections;

  beforeAll(() => {
    ({ db } = initializeFirebase());
    productCollectionService = require('../../services/productCollectionService');
    testStoreId = 'test-bakery';
  });

  beforeEach(async () => {
    // Clean up previous test data
    await clearFirestoreData(db);

    // Set up fresh test data
    testCollections = await setupTestData(db, testStoreId);
  });

  afterAll(async () => {
    await clearFirestoreData(db);
  }, 10000);

  describe('Basic CRUD Operations', () => {
    it('should create a new product collection', async () => {
      const collectionData = {
        name: 'New Collection',
        isActive: true,
      };

      const result = await productCollectionService.create(collectionData, testStoreId);

      expect(result).toBeInstanceOf(ProductCollection);
      expect(result.id).toBeDefined();
      expect(result.name).toBe(collectionData.name);

      // Verify collection exists in Firestore
      const doc = await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('productCollections')
        .doc(result.id)
        .get();

      expect(doc.exists).toBe(true);
      expect(doc.data().name).toBe(collectionData.name);
    });

    it('should retrieve a product collection by ID', async () => {
      const testCollection = testCollections[0];

      const result = await productCollectionService.getById(
        testCollection.id,
        testStoreId,
      );

      expect(result).toBeInstanceOf(ProductCollection);
      expect(result.id).toBe(testCollection.id);
      expect(result.name).toBe(testCollection.name);
    });

    it('should update a product collection', async () => {
      const testCollection = testCollections[0];
      const updateData = {
        name: 'Updated Collection Name',
        isActive: false,
      };

      const result = await productCollectionService.update(
        testCollection.id,
        updateData,
        testStoreId,
      );

      expect(result.name).toBe(updateData.name);
      expect(result.isActive).toBe(updateData.isActive);

      // Verify updates in Firestore
      const doc = await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('productCollections')
        .doc(testCollection.id)
        .get();

      expect(doc.data().name).toBe(updateData.name);
      expect(doc.data().isActive).toBe(updateData.isActive);
    });
  });

  describe('Remove Operation', () => {
    it('should delete a collection with no active products', async () => {
      const testCollection = testCollections[1]; // Collection with only inactive products

      await productCollectionService.remove(testCollection.id, testStoreId);

      // Verify collection was deleted
      const doc = await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('productCollections')
        .doc(testCollection.id)
        .get();

      expect(doc.exists).toBe(false);
    });

    it('should throw error when trying to delete collection with active products', async () => {
      const testCollection = testCollections[0]; // Collection with active products

      await expect(
        productCollectionService.remove(testCollection.id, testStoreId),
      ).rejects.toThrow('No se puede eliminar la colección porque tiene productos activos');

      // Verify collection still exists
      const doc = await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('productCollections')
        .doc(testCollection.id)
        .get();

      expect(doc.exists).toBe(true);
    });

    it('should throw error when trying to delete non-existent collection', async () => {
      await expect(
        productCollectionService.remove('non-existent-id', testStoreId),
      ).rejects.toThrow('Product collection not found');
    });
  });

  describe('Query Operations', () => {
    it('should get all active collections', async () => {
      const result = await productCollectionService.getAll(testStoreId, {
        filters: { isActive: true },
        sort: { field: 'name', direction: 'asc' },
      });

      const activeCollections = result.items.filter(item => item.isActive);
      expect(activeCollections.length).toBe(3);
      expect(result.items[0]).toBeInstanceOf(ProductCollection);

      // Verify all returned collections are active
      result.items.forEach(collection => {
        expect(collection.isActive).toBe(true);
      });
    });

    it('should handle pagination', async () => {
      const result = await productCollectionService.getAll(testStoreId, {
        pagination: { perPage: 2, page: 1 },
        sort: { field: 'name', direction: 'asc' },
      });

      expect(result.items.length).toBe(2);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.perPage).toBe(2);

      // Get total count for verification
      const totalResult = await productCollectionService.getAll(testStoreId);
      expect(totalResult.items.length).toBe(5);
    });
  });
});
