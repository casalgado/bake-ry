const ProductService = require('../../services/ProductService');
const productController = require('../../controllers/productController');

// Mock Firebase Admin SDK
jest.mock('../../config/firebase', () => ({
  db: {
    collection: jest.fn(),
    runTransaction: jest.fn(),
  },
}));

// Mock Product Service - this is the key change
jest.mock('../../services/ProductService');
ProductService.mockImplementation(() => ({
  create: jest.fn(),
  getById: jest.fn(),
  getAll: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
}));

describe('Product Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      params: {
        bakeryId: 'test-bakery-id',
        id: 'test-product-id',
      },
      body: {},
      user: {
        uid: 'test-user-id',
        role: 'bakery_staff',
      },
    };

    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a product with valid data', async () => {
      const validProduct = {
        name: 'Test Product',
        categoryId: 'cat-1',
      };

      mockReq.body = validProduct;

      const createdProduct = { ...validProduct, id: 'new-product-id' };
      ProductService.prototype.create.mockResolvedValue(createdProduct);

      await productController.create(mockReq, mockRes);

      expect(ProductService.prototype.create).toHaveBeenCalledWith(
        validProduct,
        'test-bakery-id',
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(createdProduct);
    });

    it('should return error for missing required fields', async () => {
      const invalidProduct = {
        categoryId: 'cat-1', // Missing name
      };

      mockReq.body = invalidProduct;

      await productController.create(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Product name is required',
      });
    });
  });

  describe('getById', () => {
    it('should get product by id', async () => {
      const product = {
        id: 'test-product-id',
        name: 'Test Product',
      };

      ProductService.prototype.getById.mockResolvedValue(product);

      await productController.getById(mockReq, mockRes);

      expect(ProductService.prototype.getById).toHaveBeenCalledWith(
        'test-product-id',
        'test-bakery-id',
      );
      expect(mockRes.json).toHaveBeenCalledWith(product);
    });
  });

  describe('getAll', () => {
    it('should get all products', async () => {
      const products = [
        { id: '1', name: 'Product 1' },
        { id: '2', name: 'Product 2' },
      ];

      ProductService.prototype.getAll.mockResolvedValue({ items: products });

      await productController.getAll(mockReq, mockRes);

      expect(ProductService.prototype.getAll).toHaveBeenCalledWith(
        'test-bakery-id',
        expect.any(Object),
      );
      expect(mockRes.json).toHaveBeenCalledWith({ items: products });
    });
  });

  describe('update', () => {
    it('should update product with valid data', async () => {
      const updateData = {
        name: 'Updated Product',
      };

      mockReq.body = updateData;

      const updatedProduct = {
        id: 'test-product-id',
        ...updateData,
      };

      ProductService.prototype.update.mockResolvedValue(updatedProduct);

      await productController.update(mockReq, mockRes);

      expect(ProductService.prototype.update).toHaveBeenCalledWith(
        'test-product-id',
        updateData,
        'test-bakery-id',
        mockReq.user,
      );
      expect(mockRes.json).toHaveBeenCalledWith(updatedProduct);
    });
  });

  describe('delete', () => {
    it('should delete product', async () => {
      ProductService.prototype.delete.mockResolvedValue(null);

      await productController.delete(mockReq, mockRes);

      expect(ProductService.prototype.delete).toHaveBeenCalledWith(
        'test-product-id',
        'test-bakery-id',
        mockReq.user,
      );
      expect(mockRes.status).toHaveBeenCalledWith(204);
    });
  });
});
