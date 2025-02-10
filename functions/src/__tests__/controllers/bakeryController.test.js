// tests/controllers/companyController.test.js
const companyController = require('../../controllers/bakeryController');
const companyService = require('../../services/bakeryService');

jest.mock('../../services/companyService');

describe('Company Controller', () => {
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
          name: 'Test Company',
          address: '123 Company St',
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

      companyService.create.mockResolvedValue(mockBakery);

      await companyController.create(req, res);

      expect(companyService.create).toHaveBeenCalledWith({
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
          name: 'Test Company',
          address: '123 Company St',
        },
        user: {
          uid: 'user123',
          bakeryId: 'existing-bakery',
        },
      };

      await companyController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'User already has a company assigned and cannot create another one',
        }),
      );
    });
  });

  describe('getAll', () => {
    it('should get all companies with pagination', async () => {
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
          { id: 'bakery1', name: 'Company 1' },
          { id: 'bakery2', name: 'Company 2' },
        ],
        pagination: {
          page: 1,
          perPage: 10,
          total: 2,
        },
      };

      companyService.getAll.mockResolvedValue(mockResult);

      await companyController.getAll(req, res);

      expect(companyService.getAll).toHaveBeenCalledWith(
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
        name: 'Test Company',
        address: '123 Company St',
      };

      companyService.getById.mockResolvedValue(mockBakery);

      await companyController.getById(req, res);

      expect(companyService.getById).toHaveBeenCalledWith('bakery123', 'bakery123');
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
          name: 'Updated Company Name',
          operatingHours: {
            monday: { isOpen: true, open: '09:00', close: '18:00' },
          },
        },
        user: {
          role: 'company_admin',
          uid: 'user123',
        },
      };

      const mockUpdated = {
        id: 'bakery123',
        ...req.body,
        updatedAt: new Date(),
      };

      companyService.patch.mockResolvedValue(mockUpdated);

      await companyController.patch(req, res);

      expect(companyService.patch).toHaveBeenCalledWith(
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

      companyService.remove.mockResolvedValue(null);

      await companyController.remove(req, res);

      expect(companyService.remove).toHaveBeenCalledWith(
        'bakery123',
        'bakery123',
        req.user,
      );
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.json).toHaveBeenCalledWith(null);
    });
  });
});
