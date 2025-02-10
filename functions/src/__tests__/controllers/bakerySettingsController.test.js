// tests/controllers/companySettingsController.test.js
const companySettingsController = require('../../controllers/bakerySettingsController');
const companySettingsService = require('../../services/bakerySettingsService');
const {  NotFoundError } = require('../../utils/errors');

jest.mock('../../services/companySettingsService');

describe('Company Settings Controller', () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('getById', () => {
    it('should get settings by id', async () => {
      const req = {
        params: {
          bakeryId: 'bakery123',
          id: 'default',
        },
      };

      const mockSettings = {
        id: 'default',
        bakeryId: 'bakery123',
        theme: { primaryColor: '#000000' },
        ingredientCategories: [],
      };

      companySettingsService.getById.mockResolvedValue(mockSettings);

      await companySettingsController.getById(req, res);

      expect(companySettingsService.getById).toHaveBeenCalledWith(
        'default',
        'bakery123',
      );
      expect(res.json).toHaveBeenCalledWith(mockSettings);
    });

    it('should handle not found error', async () => {
      const req = {
        params: {
          bakeryId: 'bakery123',
          id: 'nonexistent',
        },
      };

      companySettingsService.getById.mockRejectedValue(
        new NotFoundError('Settings not found'),
      );

      await companySettingsController.getById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Settings not found',
      });
    });
  });

  describe('patch', () => {
    it('should patch settings successfully', async () => {
      const req = {
        params: {
          bakeryId: 'bakery123',
          id: 'default',
        },
        body: {
          theme: { primaryColor: '#FF0000' },
        },
      };

      const mockUpdated = {
        id: 'default',
        bakeryId: 'bakery123',
        theme: { primaryColor: '#FF0000' },
        updatedAt: new Date(),
      };

      companySettingsService.patch.mockResolvedValue(mockUpdated);

      await companySettingsController.patch(req, res);

      expect(companySettingsService.patch).toHaveBeenCalledWith(
        'default',
        req.body,
        'bakery123',
      );
      expect(res.json).toHaveBeenCalledWith(mockUpdated);
    });

    it('should prevent updating immutable fields', async () => {
      const req = {
        params: {
          bakeryId: 'bakery123',
          id: 'default',
        },
        body: {
          id: 'new-id', // Attempting to update immutable field
          theme: { primaryColor: '#FF0000' },
        },
      };

      await companySettingsController.patch(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Cannot update immutable field: id',
      });
    });
  });

  describe('getStaffList', () => {
    it('should get staff list successfully', async () => {
      const req = {
        params: {
          bakeryId: 'bakery123',
        },
      };

      const mockStaff = [
        {
          id: 'staff1',
          name: 'Staff Member 1',
          role: 'company_staff',
        },
        {
          id: 'admin1',
          name: 'Admin Member',
          role: 'company_admin',
        },
      ];

      companySettingsService.getStaffList.mockResolvedValue(mockStaff);

      await companySettingsController.getStaffList(req, res);

      expect(companySettingsService.getStaffList).toHaveBeenCalledWith('bakery123');
      expect(res.json).toHaveBeenCalledWith(mockStaff);
    });

    it('should handle errors when getting staff list', async () => {
      const req = {
        params: {
          bakeryId: 'bakery123',
        },
      };

      companySettingsService.getStaffList.mockRejectedValue(
        new Error('Failed to fetch staff list'),
      );

      await companySettingsController.getStaffList(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Failed to fetch staff list',
          timestamp: expect.any(String),
        }),
      );
    });
  });

  describe('getB2bClientsList', () => {
    it('should get B2B clients list successfully', async () => {
      const req = {
        params: {
          bakeryId: 'bakery123',
        },
      };

      const mockClients = [
        {
          id: 'client1',
          name: 'B2B Client 1',
          email: 'client1@example.com',
        },
        {
          id: 'client2',
          name: 'B2B Client 2',
          email: 'client2@example.com',
        },
      ];

      companySettingsService.getB2bClientsList.mockResolvedValue(mockClients);

      await companySettingsController.getB2bClientsList(req, res);

      expect(companySettingsService.getB2bClientsList).toHaveBeenCalledWith('bakery123');
      expect(res.json).toHaveBeenCalledWith(mockClients);
    });

    it('should handle errors when getting B2B clients list', async () => {
      const req = {
        params: {
          bakeryId: 'bakery123',
        },
      };

      companySettingsService.getB2bClientsList.mockRejectedValue(
        new Error('Failed to fetch B2B clients'),
      );

      await companySettingsController.getB2bClientsList(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Failed to fetch B2B clients',
          timestamp: expect.any(String),
        }),
      );
    });
  });
});
