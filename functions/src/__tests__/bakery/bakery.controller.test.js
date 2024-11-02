const BakeryController = require('../../controllers/BakeryController');
const { ForbiddenError, BadRequestError, NotFoundError } = require('../../utils/errors');

describe('BakeryController', () => {
  let controller;
  let mockService;
  let req;
  let res;

  beforeEach(() => {
    mockService = {
      create: jest.fn(),
      getById: jest.fn(),
      getAll: jest.fn(),
      update: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    };

    controller = new BakeryController(mockService);

    req = {
      user: { uid: 'user123' },
      body: {
        name: 'Test Bakery',
        address: '123 Test St',
      },
      params: {},
    };

    // Properly chain the mock functions
    res = {
      status: jest.fn().mockReturnThis(), // This ensures status() returns 'this'
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe('create', () => {
    describe('error handling', () => {
      it('should throw ForbiddenError when user already has bakery', async () => {
        req.user.bakeryId = 'existing123';

        await controller.create(req, res);
        const expectedError = new ForbiddenError(
          'User already has a bakery assigned and cannot create another one',
        );

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          error: expectedError.message,
        });
        expect(mockService.create).not.toHaveBeenCalled();
      });

      it('should throw BadRequestError when name is missing', async () => {
        delete req.body.name;

        await controller.create(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Name and address are required',
        });
        expect(mockService.create).not.toHaveBeenCalled();
      });

      it('should throw BadRequestError when address is missing', async () => {
        delete req.body.address;

        await controller.create(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Name and address are required',
        });
        expect(mockService.create).not.toHaveBeenCalled();
      });

      it('should handle NotFoundError from service', async () => {
        mockService.create.mockRejectedValue(new NotFoundError('Referenced entity not found'));

        await controller.create(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Referenced entity not found',
        });
      });

      it('should handle BadRequestError from service', async () => {
        mockService.create.mockRejectedValue(new BadRequestError('Invalid data format'));

        await controller.create(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Invalid data format',
        });
      });

      it('should handle unexpected errors from service', async () => {
        const error = new Error('Unexpected error');
        mockService.create.mockRejectedValue(error);

        await controller.create(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Unexpected error',
          timestamp: expect.any(String),
        });
      });
    });

    describe('successful creation', () => {
      it('should create bakery with correct data structure', async () => {
        const expectedBakery = {
          id: 'bakery123',
          name: req.body.name,
          address: req.body.address,
          ownerId: req.user.uid,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        };

        mockService.create.mockResolvedValue(expectedBakery);

        await controller.create(req, res);

        expect(mockService.create).toHaveBeenCalledWith({
          ...req.body,
          ownerId: req.user.uid,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expectedBakery);
      });
    });
  });
});
