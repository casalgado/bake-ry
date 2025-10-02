const { initializeFirebase, clearFirestoreData } = require('../setup/firebase');
const Product = require('../../models/Product');
const ProductVariation = require('../../models/ProductVariation');

// Test Data Setup Helpers
const createTestProduct = (overrides = {}) => ({
  name: 'test product', // Changed to lowercase to match model behavior
  collectionId: 'test-collection',
  collectionName: 'Test Collection',
  basePrice: 10000,
  currentPrice: 10000,
  variations: [
    new ProductVariation({
      name: 'regular',
      value: 1,
      basePrice: 10000,
    }),
  ],
  taxPercentage: 19,
  displayOrder: 1,
  isActive: true,
  ...overrides,
});

describe('Product Service Tests', () => {
  let db;
  let productService;
  let testStoreId;
  let testEditor;
  console.log(testEditor);

  beforeAll(() => {
    ({ db } = initializeFirebase());
    productService = require('../../services/productService');
    testStoreId = 'test-bakery';
    testEditor = {
      uid: 'test-editor',
      email: 'editor@example.com',
      role: 'bakery_staff',
    };
  });

  beforeEach(async () => {
    await clearFirestoreData(db);
  });

  afterAll(async () => {
    await clearFirestoreData(db);
  });

  describe('Basic CRUD Operations', () => {
    it('should create a new product', async () => {
      const productData = createTestProduct();
      const result = await productService.create(productData, testStoreId);

      expect(result).toBeInstanceOf(Product);
      expect(result.id).toBeDefined();
      expect(result.name).toBe(productData.name); // Now matches lowercase
      expect(result.variations.combinations).toHaveLength(1);

      // Verify product exists in Firestore
      const doc = await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('products')
        .doc(result.id)
        .get();

      expect(doc.exists).toBe(true);
      expect(doc.data().name).toBe(productData.name);
    });

    it('should create a product with specified ID', async () => {
      const customId = 'custom-product-id';
      const productData = {
        ...createTestProduct(),
        id: customId,
      };

      await productService.create(productData, testStoreId);

      // Check the document exists with the custom ID
      const doc = await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('products')
        .doc(customId)
        .get();

      expect(doc.exists).toBe(true);
      expect(doc.id).toBe(customId);
    });

    it('should update an existing product', async () => {
      // First create a product
      const product = await productService.create(createTestProduct(), testStoreId);

      const updateData = {
        name: 'updated name', // Changed to lowercase
        basePrice: 15000,
        variations: [
          new ProductVariation({
            name: 'large',
            value: 2,
            basePrice: 15000,
          }),
        ],
      };

      const updated = await productService.update(product.id, updateData, testStoreId);

      expect(updated.name).toBe(updateData.name);
      expect(updated.basePrice).toBe(updateData.basePrice);
      expect(updated.variations.combinations).toHaveLength(1);
      expect(updated.variations.combinations[0].name).toBe('Large');

      // Verify in Firestore
      const doc = await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('products')
        .doc(product.id)
        .get();

      expect(doc.data().name).toBe(updateData.name);
    });

    it('should throw NotFoundError when updating non-existent product', async () => {
      await expect(
        productService.update('non-existent-id', { name: 'New Name' }, testStoreId),
      ).rejects.toThrow('Product not found');
    });
  });

  describe('Product Variations', () => {
    it('should create product with multiple variations', async () => {
      const productData = createTestProduct({
        variations: [
          new ProductVariation({
            name: 'small',
            value: 1,
            basePrice: 10000,
          }),
          new ProductVariation({
            name: 'medium',
            value: 2,
            basePrice: 15000,
          }),
          new ProductVariation({
            name: 'large',
            value: 3,
            basePrice: 20000,
          }),
        ],
      });

      const result = await productService.create(productData, testStoreId);

      expect(result.variations.combinations).toHaveLength(3);
      expect(result.variations.combinations[0].name).toBe('Small');
      expect(result.variations.combinations[1].name).toBe('Medium');
      expect(result.variations.combinations[2].name).toBe('Large');

      // Verify variations in Firestore
      const doc = await db
        .collection('bakeries')
        .doc(testStoreId)
        .collection('products')
        .doc(result.id)
        .get();

      expect(doc.data().variations.combinations).toHaveLength(3);
    });

    it('should update product variations', async () => {
      const product = await productService.create(createTestProduct(), testStoreId);

      const updateData = {
        variations: [
          new ProductVariation({
            name: 'updated',
            value: 1,
            basePrice: 12000,
          }),
        ],
      };

      const updated = await productService.update(product.id, updateData, testStoreId);

      expect(updated.variations.combinations).toHaveLength(1);
      expect(updated.variations.combinations[0].name).toBe('Updated');
      expect(updated.variations.combinations[0].basePrice).toBe(12000);
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      // Create multiple test products
      await Promise.all([
        productService.create(createTestProduct({ name: 'active product', isActive: true }), testStoreId),
        productService.create(createTestProduct({ name: 'inactive product', isActive: false }), testStoreId),
        productService.create(createTestProduct({ name: 'deleted product', isDeleted: true }), testStoreId),
      ]);
    });

    it('should get all active products', async () => {
      const result = await productService.getAll(testStoreId, {
        filters: { isActive: true },
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('active product');
    });

    it('should exclude deleted products by default', async () => {
      const result = await productService.getAll(testStoreId);

      const hasDeletedProduct = result.items.some(product => product.name === 'deleted product');
      expect(hasDeletedProduct).toBe(false);
    });

    it('should include deleted products when specified', async () => {
      const result = await productService.getAll(testStoreId, {
        includeDeleted: true,
      });

      const deletedProducts = result.items.filter(product => product.isDeleted);
      expect(deletedProducts).toHaveLength(1);
      expect(deletedProducts[0].name).toBe('deleted product');
    });
  });
});
