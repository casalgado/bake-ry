// tests/controllers/bakerySettingsController.test.js
const bakerySettingsController = require('../../controllers/bakerySettingsController');
const bakerySettingsService = require('../../services/bakerySettingsService');
const {  NotFoundError } = require('../../utils/errors');

jest.mock('../../services/bakerySettingsService');

describe('Bakery Settings Controller', () => {
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

      bakerySettingsService.getById.mockResolvedValue(mockSettings);

      await bakerySettingsController.getById(req, res);

      expect(bakerySettingsService.getById).toHaveBeenCalledWith(
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

      bakerySettingsService.getById.mockRejectedValue(
        new NotFoundError('Settings not found'),
      );

      await bakerySettingsController.getById(req, res);

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

      bakerySettingsService.patch.mockResolvedValue(mockUpdated);

      await bakerySettingsController.patch(req, res);

      expect(bakerySettingsService.patch).toHaveBeenCalledWith(
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

      await bakerySettingsController.patch(req, res);

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
          role: 'bakery_staff',
        },
        {
          id: 'admin1',
          name: 'Admin Member',
          role: 'bakery_admin',
        },
      ];

      bakerySettingsService.getStaffList.mockResolvedValue(mockStaff);

      await bakerySettingsController.getStaffList(req, res);

      expect(bakerySettingsService.getStaffList).toHaveBeenCalledWith('bakery123');
      expect(res.json).toHaveBeenCalledWith(mockStaff);
    });

    it('should handle errors when getting staff list', async () => {
      const req = {
        params: {
          bakeryId: 'bakery123',
        },
      };

      bakerySettingsService.getStaffList.mockRejectedValue(
        new Error('Failed to fetch staff list'),
      );

      await bakerySettingsController.getStaffList(req, res);

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

      bakerySettingsService.getB2bClientsList.mockResolvedValue(mockClients);

      await bakerySettingsController.getB2bClientsList(req, res);

      expect(bakerySettingsService.getB2bClientsList).toHaveBeenCalledWith('bakery123');
      expect(res.json).toHaveBeenCalledWith(mockClients);
    });

    it('should handle errors when getting B2B clients list', async () => {
      const req = {
        params: {
          bakeryId: 'bakery123',
        },
      };

      bakerySettingsService.getB2bClientsList.mockRejectedValue(
        new Error('Failed to fetch B2B clients'),
      );

      await bakerySettingsController.getB2bClientsList(req, res);

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
