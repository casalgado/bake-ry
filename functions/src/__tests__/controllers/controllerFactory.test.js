// tests/unit/controllers/base/controllerFactory.test.js
const createBaseController = require('../../controllers/base/controllerFactory');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../../utils/errors');

// Mock service
const mockService = {
  getAll: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  patch: jest.fn(),
  remove: jest.fn(),
};

// Mock validation function
const mockValidate = jest.fn();

// Mock request and response objects
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Controller Factory', () => {
  let controller;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = createBaseController(mockService, mockValidate);
    res = mockResponse();
  });

  describe('handleResponse', () => {
    it('should send response with correct status code and data', () => {
      const data = { id: 1, name: 'test' };
      controller.handleResponse(res, data, 201);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(data);
    });

    it('should use default status code 200 if not provided', () => {
      const data = { id: 1 };
      controller.handleResponse(res, data);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('handleError', () => {
    it('should handle NotFoundError with 404 status', () => {
      const error = new NotFoundError('Resource not found');
      controller.handleError(res, error);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Resource not found' });
    });

    it('should handle BadRequestError with 400 status', () => {
      const error = new BadRequestError('Invalid data');
      controller.handleError(res, error);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid data' });
    });

    it('should handle ForbiddenError with 403 status', () => {
      const error = new ForbiddenError('Access denied');
      controller.handleError(res, error);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access denied' });
    });

    it('should handle unknown errors with 500 status', () => {
      const error = new Error('Unknown error');
      controller.handleError(res, error);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unknown error',
          timestamp: expect.any(String),
        }),
      );
    });
  });

  describe('CRUD operations', () => {
    describe('getAll', () => {
      it('should return all items with parsed query', async () => {
        const mockItems = [{ id: 1 }, { id: 2 }];
        mockService.getAll.mockResolvedValue({ items: mockItems });

        const req = {
          params: { bakeryId: 'bakery123' },
          query: { page: '1', perPage: '10' },
        };

        await controller.getAll(req, res);

        expect(mockService.getAll).toHaveBeenCalledWith(
          'bakery123',
          expect.objectContaining({
            pagination: expect.any(Object),
          }),
        );
        expect(res.json).toHaveBeenCalledWith({ items: mockItems });
      });

      it('should handle errors in getAll', async () => {
        const error = new Error('Database error');
        mockService.getAll.mockRejectedValue(error);

        const req = {
          params: { bakeryId: 'bakery123' },
          query: {},
        };

        await controller.getAll(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'Database error',
          }),
        );
      });
    });

    describe('getById', () => {
      it('should return item by id', async () => {
        const mockItem = { id: 'item123', name: 'Test Item' };
        mockService.getById.mockResolvedValue(mockItem);

        const req = {
          params: { id: 'item123', bakeryId: 'bakery123' },
        };

        await controller.getById(req, res);

        expect(mockService.getById).toHaveBeenCalledWith('item123', 'bakery123');
        expect(res.json).toHaveBeenCalledWith(mockItem);
      });

      it('should return 404 when item not found', async () => {
        mockService.getById.mockRejectedValue(new NotFoundError('Item not found'));

        const req = {
          params: { id: 'nonexistent', bakeryId: 'bakery123' },
        };

        await controller.getById(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Item not found' });
      });
    });

    describe('create', () => {
      it('should create new item with valid data', async () => {
        const mockItem = { id: 'new123', name: 'New Item' };
        mockService.create.mockResolvedValue(mockItem);
        mockValidate.mockReturnValue([]);

        const req = {
          body: { name: 'New Item' },
          params: { bakeryId: 'bakery123' },
        };

        await controller.create(req, res);

        expect(mockValidate).toHaveBeenCalledWith(req.body);
        expect(mockService.create).toHaveBeenCalledWith(req.body, 'bakery123');
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(mockItem);
      });

      it('should return 400 with validation errors', async () => {
        mockValidate.mockReturnValue(['Name is required']);

        const req = {
          body: {},
          params: { bakeryId: 'bakery123' },
        };

        await controller.create(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Name is required' });
      });
    });
  });
});
