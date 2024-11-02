const BaseController = require('../../controllers/BaseController');
const { NotFoundError, BadRequestError } = require('../../utils/errors');

describe('BaseController', () => {
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

    controller = new BaseController(mockService);

    req = {
      params: { id: '123', bakeryId: '456' },
      body: { name: 'Test Resource' },
      query: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
  });

  describe('error handling', () => {
    it('should handle NotFoundError from service', async () => {
      mockService.getById.mockRejectedValue(new NotFoundError('Resource not found'));

      await controller.getById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Resource not found',
      });
    });

    it('should handle BadRequestError from service', async () => {
      mockService.create.mockRejectedValue(new BadRequestError('Invalid data'));

      await controller.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid data',
      });
    });
  });

  describe('CRUD operations', () => {
    describe('create', () => {
      it('should throw BadRequestError when body is empty', async () => {
        req.body = null;

        await controller.create(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Request body is required',
        });
        expect(mockService.create).not.toHaveBeenCalled();
      });
    });

    describe('getById', () => {
      it('should throw BadRequestError when id is missing', async () => {
        req.params.id = null;

        await controller.getById(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'ID parameter is required',
        });
        expect(mockService.getById).not.toHaveBeenCalled();
      });

      it('should handle NotFoundError from service', async () => {
        mockService.getById.mockRejectedValue(new NotFoundError('Resource not found'));

        await controller.getById(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Resource not found',
        });
      });
    });

    describe('update', () => {
      it('should throw BadRequestError when update data is empty', async () => {
        req.body = null;

        await controller.update(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Update data is required',
        });
        expect(mockService.update).not.toHaveBeenCalled();
      });
    });

    describe('patch', () => {
      it('should throw BadRequestError when patch data is empty', async () => {
        req.body = {};

        await controller.patch(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Patch data is required',
        });
        expect(mockService.patch).not.toHaveBeenCalled();
      });
    });

    describe('delete', () => {
      it('should throw BadRequestError when id is missing', async () => {
        req.params.id = null;

        await controller.delete(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: 'ID parameter is required',
        });
        expect(mockService.delete).not.toHaveBeenCalled();
      });

      it('should handle NotFoundError from service', async () => {
        mockService.delete.mockRejectedValue(new NotFoundError('Resource not found'));

        await controller.delete(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
          error: 'Resource not found',
        });
      });
    });
  });
});
