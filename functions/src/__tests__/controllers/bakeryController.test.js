// tests/controllers/bakeryController.test.js
const bakeryController = require('../../controllers/bakeryController');
const bakeryService = require('../../services/bakeryService');

jest.mock('../../services/bakeryService');

describe('Bakery Controller', () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('create', () => {
    it('should create a bakery successfully', async () => {
      const req = {
        params: {},
        body: {
          name: 'Test Bakery',
          address: '123 Bakery St',
          operatingHours: {
            monday: { isOpen: true, open: '08:00', close: '17:00' },
          },
        },
        user: {
          uid: 'user123',
          bakeryId: null,
        },
      };

      const mockBakery = {
        id: 'bakery123',
        ...req.body,
        ownerId: req.user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      bakeryService.create.mockResolvedValue(mockBakery);

      await bakeryController.create(req, res);

      expect(bakeryService.create).toHaveBeenCalledWith({
        ...req.body,
        ownerId: req.user.uid,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockBakery);
    });

    it('should reject if user already has a bakery', async () => {
      const req = {
        params: {},
        body: {
          name: 'Test Bakery',
          address: '123 Bakery St',
        },
        user: {
          uid: 'user123',
          bakeryId: 'existing-bakery',
        },
      };

      await bakeryController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'User already has a bakery assigned and cannot create another one',
        }),
      );
    });
  });

  describe('getAll', () => {
    it('should get all bakeries with pagination', async () => {
      const req = {
        query: {
          page: '1',
          perPage: '10',
        },
        params: {},
        user: {
          role: 'system_admin',
        },
      };

      const mockResult = {
        items: [
          { id: 'bakery1', name: 'Bakery 1' },
          { id: 'bakery2', name: 'Bakery 2' },
        ],
        pagination: {
          page: 1,
          perPage: 10,
          total: 2,
        },
      };

      bakeryService.getAll.mockResolvedValue(mockResult);

      await bakeryController.getAll(req, res);

      expect(bakeryService.getAll).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          pagination: { page: 1, perPage: 10, offset: 0 },
          sort: { field: 'createdAt', direction: 'desc' },
          filters: { perPage: 10 },
          options: {},
        }),
      );
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('getById', () => {
    it('should get bakery by id', async () => {
      const req = {
        params: {
          id: 'bakery123',
          bakeryId: 'bakery123',
        },
      };

      const mockBakery = {
        id: 'bakery123',
        name: 'Test Bakery',
        address: '123 Bakery St',
      };

      bakeryService.getById.mockResolvedValue(mockBakery);

      await bakeryController.getById(req, res);

      expect(bakeryService.getById).toHaveBeenCalledWith('bakery123', 'bakery123');
      expect(res.json).toHaveBeenCalledWith(mockBakery);
    });
  });

  describe('patch', () => {
    it('should patch bakery details successfully', async () => {
      const req = {
        params: {
          id: 'bakery123',
          bakeryId: 'bakery123',
        },
        body: {
          name: 'Updated Bakery Name',
          operatingHours: {
            monday: { isOpen: true, open: '09:00', close: '18:00' },
          },
        },
        user: {
          role: 'bakery_admin',
          uid: 'user123',
        },
      };

      const mockUpdated = {
        id: 'bakery123',
        ...req.body,
        updatedAt: new Date(),
      };

      bakeryService.patch.mockResolvedValue(mockUpdated);

      await bakeryController.patch(req, res);

      expect(bakeryService.patch).toHaveBeenCalledWith(
        'bakery123',
        req.body,
        'bakery123',
        req.user,
      );
      expect(res.json).toHaveBeenCalledWith(mockUpdated);
    });
  });

  describe('remove', () => {
    it('should remove bakery successfully', async () => {
      const req = {
        params: {
          id: 'bakery123',
          bakeryId: 'bakery123',
        },
        user: {
          role: 'system_admin',
          uid: 'user123',
        },
      };

      bakeryService.remove.mockResolvedValue(null);

      await bakeryController.remove(req, res);

      expect(bakeryService.remove).toHaveBeenCalledWith(
        'bakery123',
        'bakery123',
        req.user,
      );
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.json).toHaveBeenCalledWith(null);
    });
  });
});
