// tests/controllers/productController.test.js
const productController = require('../../controllers/productController');
const productService = require('../../services/productService');
const {  NotFoundError } = require('../../utils/errors');

// Mock the service
jest.mock('../../services/productService');

describe('Product Controller', () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('create', () => {
    it('should create a product successfully', async () => {
      const req = {
        params: { bakeryId: 'bakery123' },
        body: {
          name: 'Test Product',
          collection: 'collection123',
          basePrice: 10000,
          isActive: true,
        },
      };

      const mockProduct = {
        id: 'product123',
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      productService.create.mockResolvedValue(mockProduct);

      await productController.create(req, res);

      expect(productService.create).toHaveBeenCalledWith(
        req.body,
        'bakery123',
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockProduct);
    });

    it('should handle validation errors - missing name', async () => {
      const req = {
        params: { bakeryId: 'bakery123' },
        body: {
          collection: 'collection123',
          basePrice: 10000,
        },
      };

      await productController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Product name is required',
      });
    });

    it('should create product without collectionId', async () => {
      const req = {
        params: { bakeryId: 'bakery123' },
        body: {
          name: 'Test Product',
          basePrice: 10000,
        },
      };

      await productController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('should get a product by id', async () => {
      const req = {
        params: {
          bakeryId: 'bakery123',
          id: 'product123',
        },
      };

      const mockProduct = {
        id: 'product123',
        name: 'Test Product',
        collection: 'collection123',
        isActive: true,
      };

      productService.getById.mockResolvedValue(mockProduct);

      await productController.getById(req, res);

      expect(productService.getById).toHaveBeenCalledWith(
        'product123',
        'bakery123',
      );
      expect(res.json).toHaveBeenCalledWith(mockProduct);
    });

    it('should handle not found error', async () => {
      const req = {
        params: {
          bakeryId: 'bakery123',
          id: 'nonexistent',
        },
      };

      productService.getById.mockRejectedValue(
        new NotFoundError('Product not found'),
      );

      await productController.getById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Product not found',
      });
    });
  });

  describe('getAll', () => {
    it('should get all products with pagination and filters', async () => {
      const req = {
        params: { bakeryId: 'bakery123' },
        query: {
          page: '1',
          perPage: '10',
          isActive: 'true',
          collectionId: 'collection123',
        },
      };

      const mockResult = {
        items: [
          { id: 'product1', name: 'Product 1' },
          { id: 'product2', name: 'Product 2' },
        ],
        pagination: {
          page: 1,
          perPage: 10,
          total: 2,
        },
      };

      productService.getAll.mockResolvedValue(mockResult);

      await productController.getAll(req, res);

      expect(productService.getAll).toHaveBeenCalledWith(
        'bakery123',
        expect.objectContaining({
          pagination: { page: 1, perPage: 10, offset: 0 },
          sort: { field: 'createdAt', direction: 'desc' },
          filters: {
            isActive: true,
            collectionId: 'collection123',
            perPage: 10,
          },
          options: {},
        }),
      );
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('update', () => {
    it('should update a product successfully', async () => {
      const req = {
        params: {
          bakeryId: 'bakery123',
          id: 'product123',
        },
        body: {
          name: 'Updated Product',
          collection: 'collection123',
        },
        user: { uid: 'user123' },
      };

      const mockUpdated = {
        id: 'product123',
        ...req.body,
        updatedAt: new Date(),
      };

      productService.update.mockResolvedValue(mockUpdated);

      await productController.update(req, res);

      expect(productService.update).toHaveBeenCalledWith(
        'product123',
        req.body,
        'bakery123',
        req.user,
      );
      expect(res.json).toHaveBeenCalledWith(mockUpdated);
    });

    it('should update product without collection validation', async () => {
      const mockUpdated = { id: 'product123', name: 'Updated Product' };
      productService.update.mockResolvedValue(mockUpdated);

      const req = {
        params: {
          bakeryId: 'bakery123',
          id: 'product123',
        },
        body: {
          name: 'Updated Product',
          collection: '', // Empty collection is allowed
        },
      };

      await productController.update(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockUpdated);
    });
  });

  describe('remove', () => {
    it('should remove a product successfully', async () => {
      const req = {
        params: {
          bakeryId: 'bakery123',
          id: 'product123',
        },
        user: { uid: 'user123' },
      };

      productService.remove.mockResolvedValue(null);

      await productController.remove(req, res);

      expect(productService.remove).toHaveBeenCalledWith(
        'product123',
        'bakery123',
        req.user,
      );
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.json).toHaveBeenCalledWith(null);
    });
  });
});
