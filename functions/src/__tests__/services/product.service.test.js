const { db } = require('../../config/firebase');
const ProductService = require('../../services/ProductService');
const { Product } = require('../../models/Product');
const { NotFoundError, BadRequestError } = require('../../utils/errors');

// Mock Firebase Admin SDK
jest.mock('../../config/firebase', () => ({
  db: {
    collection: jest.fn(),
    runTransaction: jest.fn(),
  },
}));

describe('ProductService', () => {
  let productService;
  let mockTransaction;
  let mockProductRef;
  let mockRecipeRef;
  let mockProductDoc;
  let mockRecipeDoc;

  const TEST_BAKERY_ID = 'test-bakery-id';
  const TEST_PRODUCT_ID = 'test-product-id';
  const TEST_RECIPE_ID = 'test-recipe-id';

  const mockProducts = [
    {
      id: '1',
      data: () => ({
        name: 'Product 1',
        categoryId: 'cat1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
    {
      id: '2',
      data: () => ({
        name: 'Product 2',
        categoryId: 'cat2',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Initialize service
    productService = new ProductService();

    // Setup mock transaction
    mockTransaction = {
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
    };

    // Setup mock product document and reference
    mockProductDoc = {
      exists: true,
      id: TEST_PRODUCT_ID,
      data: () => ({
        name: 'Test Product',
        recipeId: TEST_RECIPE_ID,
        bakeryId: TEST_BAKERY_ID,
        basePrice: 1000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    };

    mockProductRef = {
      id: TEST_PRODUCT_ID,
      get: jest.fn().mockResolvedValue(mockProductDoc),
    };

    // Setup mock recipe document and reference
    mockRecipeDoc = {
      exists: true,
      id: TEST_RECIPE_ID,
      data: () => ({
        name: 'Test Recipe',
        productId: null,
      }),
    };

    mockRecipeRef = {
      id: TEST_RECIPE_ID,
      get: jest.fn().mockResolvedValue(mockRecipeDoc),
    };

    // Setup collection mock
    const mockCollection = jest.fn(() => ({
      doc: jest.fn((id) => {
        if (id === TEST_PRODUCT_ID) return mockProductRef;
        if (id === TEST_RECIPE_ID) return mockRecipeRef;
        return mockProductRef;
      }),
      where: jest.fn(() => ({
        where: jest.fn(() => ({
          orderBy: jest.fn(() => ({
            limit: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({ docs: mockProducts }),
            })),
            get: jest.fn().mockResolvedValue({ docs: mockProducts }),
          })),
          get: jest.fn().mockResolvedValue({ docs: mockProducts }),
        })),
        orderBy: jest.fn(() => ({
          limit: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({ docs: mockProducts }),
          })),
          get: jest.fn().mockResolvedValue({ docs: mockProducts }),
        })),
        get: jest.fn().mockResolvedValue({ docs: mockProducts }),
      })),
      get: jest.fn().mockResolvedValue({ docs: mockProducts }),
    }));

    // Setup db mock
    db.collection.mockImplementation(mockCollection);
    db.runTransaction.mockImplementation(callback => callback(mockTransaction));
  });

  describe('create', () => {
    const validProductData = {
      name: 'New Product',
      recipeId: TEST_RECIPE_ID,
      basePrice: 1000,
    };

    it('should create a product successfully', async () => {
      mockTransaction.get.mockResolvedValueOnce(mockRecipeDoc);

      const result = await productService.create(validProductData, TEST_BAKERY_ID);

      expect(result).toBeInstanceOf(Product);
      expect(result.name).toBe(validProductData.name);
      expect(mockTransaction.set).toHaveBeenCalled();
      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          productId: expect.any(String),
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should throw NotFoundError if recipe does not exist', async () => {
      mockTransaction.get.mockResolvedValueOnce({ exists: false });

      await expect(
        productService.create(validProductData, TEST_BAKERY_ID),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw BadRequestError if recipe is already assigned', async () => {
      mockTransaction.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ productId: 'existing-product' }),
      });

      await expect(
        productService.create(validProductData, TEST_BAKERY_ID),
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('getById', () => {
    it('should return product by id', async () => {
      const result = await productService.getById(TEST_PRODUCT_ID, TEST_BAKERY_ID);

      expect(result).toBeInstanceOf(Product);
      expect(result.id).toBe(TEST_PRODUCT_ID);
    });

    it('should throw NotFoundError if product does not exist', async () => {
      mockProductRef.get.mockResolvedValueOnce({ exists: false });

      await expect(
        productService.getById('non-existent', TEST_BAKERY_ID),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getAll', () => {
    it('should return all products with no filters', async () => {
      const results = await productService.getAll(TEST_BAKERY_ID);

      expect(Array.isArray(results)).toBeTruthy();
      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result).toBeInstanceOf(Product);
      });
    });

    it('should apply filters and options correctly', async () => {
      const filters = { isActive: true };
      const options = { orderBy: ['name', 'desc'] };

      const results = await productService.getAll(TEST_BAKERY_ID, filters, options);

      expect(Array.isArray(results)).toBeTruthy();
      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result).toBeInstanceOf(Product);
      });
    });
  });

  describe('update', () => {
    const updateData = {
      name: 'Updated Product',
      basePrice: 1200,
    };

    it('should update product without recipe change', async () => {
      mockTransaction.get.mockResolvedValueOnce(mockProductDoc);

      const result = await productService.update(
        TEST_PRODUCT_ID,
        updateData,
        TEST_BAKERY_ID,
      );

      expect(result.name).toBe(updateData.name);
      expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    });

    it('should handle recipe change correctly', async () => {
      const updateWithNewRecipe = {
        ...updateData,
        recipeId: 'new-recipe-id',
      };

      mockTransaction.get
        .mockResolvedValueOnce(mockProductDoc) // Current product
        .mockResolvedValueOnce({ // New recipe
          exists: true,
          data: () => ({ productId: null }),
        });

      const result = await productService.update(
        TEST_PRODUCT_ID,
        updateWithNewRecipe,
        TEST_BAKERY_ID,
      );

      expect(result.recipeId).toBe(updateWithNewRecipe.recipeId);
      expect(mockTransaction.update).toHaveBeenCalledTimes(3);
    });

    it('should throw NotFoundError if product does not exist', async () => {
      mockTransaction.get.mockResolvedValueOnce({ exists: false });

      await expect(
        productService.update(TEST_PRODUCT_ID, updateData, TEST_BAKERY_ID),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('should soft delete product and release recipe', async () => {
      mockTransaction.get.mockResolvedValueOnce(mockProductDoc);

      await productService.delete(TEST_PRODUCT_ID, TEST_BAKERY_ID);

      expect(mockTransaction.update).toHaveBeenCalledTimes(2);
      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isActive: false,
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('should throw NotFoundError if product does not exist', async () => {
      mockTransaction.get.mockResolvedValueOnce({ exists: false });

      await expect(
        productService.delete('non-existent', TEST_BAKERY_ID),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
