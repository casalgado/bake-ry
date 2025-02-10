// tests/controllers/companyUserController.test.js
const companyUserController = require('../../controllers/bakeryUserController');
const companyUserService = require('../../services/bakeryUserService');
const {  NotFoundError } = require('../../utils/errors');

// Mock the service
jest.mock('../../services/companyUserService');

describe('Company User Controller', () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('create', () => {
    it('should create a company user successfully', async () => {
      const req = {
        params: { bakeryId: 'company123' },
        body: {
          email: 'staff@example.com',
          password: 'password123',
          role: 'company_staff',
          name: 'Test Staff',
          phone: '1234567890',
        },
      };

      const mockUser = {
        id: 'user123',
        ...req.body,
        createdAt: new Date(),
      };

      companyUserService.create.mockResolvedValue(mockUser);

      await companyUserController.create(req, res);

      expect(companyUserService.create).toHaveBeenCalledWith(
        req.body,
        'company123',
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockUser);
    });

    it('should reject creation with invalid email format', async () => {
      const req = {
        params: { bakeryId: 'company123' },
        body: {
          email: 'invalid-email',
          password: 'password123',
          role: 'company_staff',
          name: 'Test Staff',
        },
      };

      await companyUserController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid email format',
      });
    });

    it('should reject creation with invalid role', async () => {
      const req = {
        params: { bakeryId: 'company123' },
        body: {
          email: 'staff@example.com',
          password: 'password123',
          role: 'invalid_role',
          name: 'Test Staff',
        },
      };

      await companyUserController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid company user role',
      });
    });
  });

  describe('update', () => {
    const validUser = {
      id: 'user123',
      role: 'company_staff',
      email: 'staff@example.com',
    };

    it('should update user successfully', async () => {
      const req = {
        params: {
          id: 'user123',
          bakeryId: 'company123',
        },
        body: {
          name: 'Updated Name',
          role: 'production_assistant',
        },
      };

      companyUserService.getById.mockResolvedValue(validUser);
      companyUserService.update.mockResolvedValue({
        ...validUser,
        ...req.body,
      });

      await companyUserController.update(req, res);

      expect(companyUserService.update).toHaveBeenCalledWith(
        'user123',
        req.body,
        'company123',
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          role: 'production_assistant',
        }),
      );
    });

    it('should reject update to invalid role', async () => {
      const req = {
        params: {
          id: 'user123',
          bakeryId: 'company123',
        },
        body: {
          role: 'invalid_role',
        },
      };

      companyUserService.getById.mockResolvedValue(validUser);

      await companyUserController.update(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Cannot change to non-company user role',
      });
    });

    it('should reject update of non-existent user', async () => {
      const req = {
        params: {
          id: 'nonexistent',
          bakeryId: 'company123',
        },
        body: {
          name: 'Updated Name',
        },
      };

      companyUserService.getById.mockRejectedValue(
        new NotFoundError('User not found'),
      );

      await companyUserController.update(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'User not found',
      });
    });
  });

  describe('remove', () => {
    it('should remove user successfully', async () => {
      const req = {
        params: {
          id: 'user123',
          bakeryId: 'company123',
        },
      };

      companyUserService.getById.mockResolvedValue({
        id: 'user123',
        role: 'company_staff',
      });

      companyUserService.remove.mockResolvedValue(null);

      await companyUserController.remove(req, res);

      expect(companyUserService.remove).toHaveBeenCalledWith(
        'user123',
        'company123',
      );
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.json).toHaveBeenCalledWith(null);
    });

    it('should reject removal of user with invalid role', async () => {
      const req = {
        params: {
          id: 'user123',
          bakeryId: 'company123',
        },
      };

      companyUserService.getById.mockResolvedValue({
        id: 'user123',
        role: 'invalid_role',
      });

      await companyUserController.remove(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid company user role',
      });
    });
  });

  describe('getHistory', () => {
    it('should get user history successfully', async () => {
      const req = {
        params: {
          id: 'user123',
          bakeryId: 'company123',
        },
      };

      const mockHistory = [
        {
          timestamp: new Date(),
          changes: { name: { from: 'Old Name', to: 'New Name' } },
        },
      ];

      companyUserService.getHistory.mockResolvedValue(mockHistory);

      await companyUserController.getHistory(req, res);

      expect(companyUserService.getHistory).toHaveBeenCalledWith(
        'company123',
        'user123',
      );
      expect(res.json).toHaveBeenCalledWith(mockHistory);
    });

    it('should handle errors in history retrieval', async () => {
      const req = {
        params: {
          id: 'user123',
          bakeryId: 'company123',
        },
      };

      companyUserService.getHistory.mockRejectedValue(
        new Error('Failed to fetch history'),
      );

      await companyUserController.getHistory(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Failed to fetch history',
        }),
      );
    });
  });
});
