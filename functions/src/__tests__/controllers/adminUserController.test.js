// tests/unit/controllers/adminUserController.test.js
const adminUserController = require('../../controllers/adminUserController');
const adminUserService = require('../../services/adminUserService');

jest.mock('../../services/adminUserService');

describe('Admin User Controller', () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // Mock base controller methods
    adminUserService.getAll = jest.fn();
    adminUserService.getById = jest.fn();
    adminUserService.patch = jest.fn();
  });

  describe('create', () => {
    it('should create admin successfully with valid data', async () => {
      const req = {
        body: {
          email: 'admin@test.com',
          password: 'secure123',
          role: 'system_admin',
          name: 'Admin User',
        },
      };

      const mockAdmin = {
        id: 'admin123',
        ...req.body,
        createdAt: new Date(),
      };

      adminUserService.create.mockResolvedValue(mockAdmin);

      await adminUserController.create(req, res);

      expect(adminUserService.create).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockAdmin);
    });

    it('should reject invalid email format', async () => {
      const req = {
        body: {
          email: 'invalid-email',
          password: 'short',
          role: 'invalid_role',
          name: 'Test User',
        },
      };

      await adminUserController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringMatching(/Invalid email format/),
        }),
      );
    });

    it('should reject missing required fields', async () => {
      const req = {
        body: {
          email: 'test@example.com',
          // Missing password, role, and name
        },
      };

      await adminUserController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringMatching(/Password is required/),
        }),
      );
    });
  });

  describe('update', () => {
    it('should update admin user successfully', async () => {
      const req = {
        params: { id: 'admin123' },
        body: {
          name: 'Updated Name',
          role: 'bakery_admin',
        },
      };

      const mockAdmin = {
        id: 'admin123',
        role: 'system_admin',
        email: 'admin@test.com',
      };

      adminUserService.getById.mockResolvedValue(mockAdmin);
      adminUserService.update.mockResolvedValue({
        ...mockAdmin,
        ...req.body,
      });

      await adminUserController.update(req, res);

      expect(adminUserService.update).toHaveBeenCalledWith(
        'admin123',
        req.body,
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          role: 'bakery_admin',
        }),
      );
    });

    it('should reject updating non-admin user', async () => {
      const req = {
        params: { id: 'user123' },
        body: { role: 'system_admin' },
      };

      adminUserService.getById.mockResolvedValue({
        role: 'customer',
      });

      await adminUserController.update(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'User is not an admin',
        }),
      );
    });

    it('should prevent email updates', async () => {
      const req = {
        params: { id: 'admin123' },
        body: { email: 'new@email.com' },
      };

      adminUserService.getById.mockResolvedValue({
        role: 'system_admin',
      });

      await adminUserController.update(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Email cannot be updated',
        }),
      );
    });
  });

  describe('remove', () => {
    it('should delete admin user successfully', async () => {
      const req = {
        params: { id: 'admin123' },
      };

      adminUserService.getById.mockResolvedValue({
        role: 'system_admin',
      });

      await adminUserController.remove(req, res);

      expect(adminUserService.remove).toHaveBeenCalledWith('admin123');
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('should reject deleting non-admin user', async () => {
      const req = {
        params: { id: 'user123' },
      };

      adminUserService.getById.mockResolvedValue({
        role: 'customer',
      });

      await adminUserController.remove(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'User is not an admin',
        }),
      );
    });
  });

  describe('base controller methods', () => {
    it('should get all admins', async () => {
      const req = {
        query: {
          page: '1',
          perPage: '20',
        },
        params: {}, // Add empty params object
      };

      const mockResult = {
        items: [{ id: 'admin1' }, { id: 'admin2' }],
        pagination: { page: 1, perPage: 20 },
      };

      adminUserService.getAll.mockResolvedValue(mockResult);

      await adminUserController.getAll(req, res);

      // Update expectation to match base controller's call signature
      expect(adminUserService.getAll).toHaveBeenCalledWith(
        undefined, // bakeryId
        expect.objectContaining({
          pagination: expect.any(Object),
          sort: expect.any(Object),
          filters: expect.any(Object),
        }),
      );
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should get admin by ID', async () => {
      const req = {
        params: {
          id: 'admin123',
          bakeryId: undefined, // Add expected parameter
        },
      };

      const mockAdmin = { id: 'admin123' };
      adminUserService.getById.mockResolvedValue(mockAdmin);

      await adminUserController.getById(req, res);

      // Update to match actual call signature (id, bakeryId)
      expect(adminUserService.getById).toHaveBeenCalledWith(
        'admin123',
        undefined,
      );
      expect(res.json).toHaveBeenCalledWith(mockAdmin);
    });

    it('should handle patch operations', async () => {
      const req = {
        params: {
          id: 'admin123',
          bakeryId: undefined, // Add expected parameter
        },
        body: { name: 'Patched Name' },
        user: {}, // Add user object if needed
      };

      adminUserService.patch.mockResolvedValue({
        id: 'admin123',
        name: 'Patched Name',
      });

      await adminUserController.patch(req, res);

      // Update to match actual call signature
      expect(adminUserService.patch).toHaveBeenCalledWith(
        'admin123',
        { name: 'Patched Name' },
        undefined, // bakeryId
        {}, // user
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Patched Name' }),
      );
    });
  });
});
