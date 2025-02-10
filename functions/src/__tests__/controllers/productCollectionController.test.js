// tests/controllers/productCollectionController.test.js
const productCollectionController = require('../../controllers/productCollectionController');
const productCollectionService = require('../../services/productCollectionService');
const { BadRequestError, NotFoundError } = require('../../utils/errors');

// Mock the service
jest.mock('../../services/productCollectionService');

describe('Product Collection Controller', () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock response object
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('create', () => {
    it('should create a product collection successfully', async () => {
      const req = {
        params: { bakeryId: 'bakery123' },
        body: {
          name: 'Test Collection',
          isActive: true,
        },
      };

      const mockCollection = {
        id: 'collection123',
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      productCollectionService.create.mockResolvedValue(mockCollection);

      await productCollectionController.create(req, res);

      expect(productCollectionService.create).toHaveBeenCalledWith(
        req.body,
        'bakery123',
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockCollection);
    });

    it('should handle missing request body', async () => {
      const req = {
        params: { bakeryId: 'bakery123' },
        body: null,
      };

      await productCollectionController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Request body is required',
      });
    });
  });

  describe('getById', () => {
    it('should get a product collection by id', async () => {
      const req = {
        params: {
          bakeryId: 'bakery123',
          id: 'collection123',
        },
      };

      const mockCollection = {
        id: 'collection123',
        name: 'Test Collection',
        isActive: true,
      };

      productCollectionService.getById.mockResolvedValue(mockCollection);

      await productCollectionController.getById(req, res);

      expect(productCollectionService.getById).toHaveBeenCalledWith(
        'collection123',
        'bakery123',
      );
      expect(res.json).toHaveBeenCalledWith(mockCollection);
    });

    it('should handle not found error', async () => {
      const req = {
        params: {
          bakeryId: 'bakery123',
          id: 'nonexistent',
        },
      };

      productCollectionService.getById.mockRejectedValue(
        new NotFoundError('Product collection not found'),
      );

      await productCollectionController.getById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Product collection not found',
      });
    });
  });

  describe('getAll', () => {
    it('should get all product collections with pagination', async () => {
      const req = {
        params: { bakeryId: 'bakery123' },
        query: {
          page: '1',
          perPage: '10',
        },
      };

      const mockResult = {
        items: [
          { id: 'collection1', name: 'Collection 1' },
          { id: 'collection2', name: 'Collection 2' },
        ],
        pagination: {
          page: 1,
          perPage: 10,
          total: 2,
        },
      };

      productCollectionService.getAll.mockResolvedValue(mockResult);

      await productCollectionController.getAll(req, res);

      expect(productCollectionService.getAll).toHaveBeenCalledWith(
        'bakery123',
        expect.objectContaining({
          pagination: { page: 1, perPage: 10, offset: 0 },
          sort: { field: 'createdAt', direction: 'desc' },
          filters: { perPage: 10 },
          options: {},
        }),
      );
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should handle query filters', async () => {
      const req = {
        params: { bakeryId: 'bakery123' },
        query: {
          isActive: 'true',
        },
      };

      const mockResult = {
        items: [
          { id: 'collection1', name: 'Collection 1', isActive: true },
        ],
      };

      productCollectionService.getAll.mockResolvedValue(mockResult);

      await productCollectionController.getAll(req, res);

      expect(productCollectionService.getAll).toHaveBeenCalledWith(
        'bakery123',
        expect.objectContaining({
          filters: { isActive: true },
          pagination: { page: 1, perPage: 10, offset: 0 },
          sort: { field: 'createdAt', direction: 'desc' },
          options: {},
        }),
      );
    });
  });

  describe('remove', () => {
    it('should remove a product collection successfully', async () => {
      const req = {
        params: {
          bakeryId: 'bakery123',
          id: 'collection123',

        },
        user: 'editor',

      };

      productCollectionService.remove.mockResolvedValue(null);

      await productCollectionController.remove(req, res);

      expect(productCollectionService.remove).toHaveBeenCalledWith(
        'collection123',
        'bakery123',
        'editor',
      );
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.json).toHaveBeenCalledWith(null);

    });

    it('should handle removal of collection with active products', async () => {
      const req = {
        params: {
          bakeryId: 'bakery123',
          id: 'collection123',
        },
      };

      productCollectionService.remove.mockRejectedValue(
        new BadRequestError('Cannot delete collection with active products'),
      );

      await productCollectionController.remove(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Cannot delete collection with active products',
      });
    });
  });
});
