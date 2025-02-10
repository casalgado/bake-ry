// tests/controllers/bakeryUserController.test.js
const bakeryUserController = require('../../controllers/bakeryUserController');
const bakeryUserService = require('../../services/bakeryUserService');
const {  NotFoundError } = require('../../utils/errors');

// Mock the service
jest.mock('../../services/bakeryUserService');

describe('Bakery User Controller', () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('create', () => {
    it('should create a bakery user successfully', async () => {
      const req = {
        params: { bakeryId: 'bakery123' },
        body: {
          email: 'staff@example.com',
          password: 'password123',
          role: 'bakery_staff',
          name: 'Test Staff',
          phone: '1234567890',
        },
      };

      const mockUser = {
        id: 'user123',
        ...req.body,
        createdAt: new Date(),
      };

      bakeryUserService.create.mockResolvedValue(mockUser);

      await bakeryUserController.create(req, res);

      expect(bakeryUserService.create).toHaveBeenCalledWith(
        req.body,
        'bakery123',
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockUser);
    });

    it('should reject creation with invalid email format', async () => {
      const req = {
        params: { bakeryId: 'bakery123' },
        body: {
          email: 'invalid-email',
          password: 'password123',
          role: 'bakery_staff',
          name: 'Test Staff',
        },
      };

      await bakeryUserController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid email format',
      });
    });

    it('should reject creation with invalid role', async () => {
      const req = {
        params: { bakeryId: 'bakery123' },
        body: {
          email: 'staff@example.com',
          password: 'password123',
          role: 'invalid_role',
          name: 'Test Staff',
        },
      };

      await bakeryUserController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid bakery user role',
      });
    });
  });

  describe('update', () => {
    const validUser = {
      id: 'user123',
      role: 'bakery_staff',
      email: 'staff@example.com',
    };

    it('should update user successfully', async () => {
      const req = {
        params: {
          id: 'user123',
          bakeryId: 'bakery123',
        },
        body: {
          name: 'Updated Name',
          role: 'production_assistant',
        },
      };

      bakeryUserService.getById.mockResolvedValue(validUser);
      bakeryUserService.update.mockResolvedValue({
        ...validUser,
        ...req.body,
      });

      await bakeryUserController.update(req, res);

      expect(bakeryUserService.update).toHaveBeenCalledWith(
        'user123',
        req.body,
        'bakery123',
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
          bakeryId: 'bakery123',
        },
        body: {
          role: 'invalid_role',
        },
      };

      bakeryUserService.getById.mockResolvedValue(validUser);

      await bakeryUserController.update(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Cannot change to non-bakery user role',
      });
    });

    it('should reject update of non-existent user', async () => {
      const req = {
        params: {
          id: 'nonexistent',
          bakeryId: 'bakery123',
        },
        body: {
          name: 'Updated Name',
        },
      };

      bakeryUserService.getById.mockRejectedValue(
        new NotFoundError('User not found'),
      );

      await bakeryUserController.update(req, res);

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
          bakeryId: 'bakery123',
        },
      };

      bakeryUserService.getById.mockResolvedValue({
        id: 'user123',
        role: 'bakery_staff',
      });

      bakeryUserService.remove.mockResolvedValue(null);

      await bakeryUserController.remove(req, res);

      expect(bakeryUserService.remove).toHaveBeenCalledWith(
        'user123',
        'bakery123',
      );
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.json).toHaveBeenCalledWith(null);
    });

    it('should reject removal of user with invalid role', async () => {
      const req = {
        params: {
          id: 'user123',
          bakeryId: 'bakery123',
        },
      };

      bakeryUserService.getById.mockResolvedValue({
        id: 'user123',
        role: 'invalid_role',
      });

      await bakeryUserController.remove(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid bakery user role',
      });
    });
  });

  describe('getHistory', () => {
    it('should get user history successfully', async () => {
      const req = {
        params: {
          id: 'user123',
          bakeryId: 'bakery123',
        },
      };

      const mockHistory = [
        {
          timestamp: new Date(),
          changes: { name: { from: 'Old Name', to: 'New Name' } },
        },
      ];

      bakeryUserService.getHistory.mockResolvedValue(mockHistory);

      await bakeryUserController.getHistory(req, res);

      expect(bakeryUserService.getHistory).toHaveBeenCalledWith(
        'bakery123',
        'user123',
      );
      expect(res.json).toHaveBeenCalledWith(mockHistory);
    });

    it('should handle errors in history retrieval', async () => {
      const req = {
        params: {
          id: 'user123',
          bakeryId: 'bakery123',
        },
      };

      bakeryUserService.getHistory.mockRejectedValue(
        new Error('Failed to fetch history'),
      );

      await bakeryUserController.getHistory(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Failed to fetch history',
        }),
      );
    });
  });
});
