// tests/unit/controllers/authController.test.js
const authController = require('../../controllers/authController');
const authService = require('../../services/authService');
const { AuthenticationError } = require('../../utils/errors');

// Mock the service
jest.mock('../../services/authService');

describe('Auth Controller', () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('register', () => {
    it('should register a user successfully with valid data', async () => {
      const req = {
        body: {
          email: 'test@example.com',
          password: 'password123',
          role: 'bakery_admin',
          name: 'Test User',
          bakeryId: 'bakery123',
        },
      };

      const mockUser = {
        id: 'user123',
        email: req.body.email,
        role: req.body.role,
        name: req.body.name,
        bakeryId: req.body.bakeryId,
      };

      authService.register.mockResolvedValue(mockUser);

      await authController.register(req, res);

      expect(authService.register).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User created successfully',
        user: mockUser,
      });
    });

    it('should reject registration with invalid email format', async () => {
      const req = {
        body: {
          email: 'invalid-email',
          password: 'password123',
          role: 'bakery_admin',
          name: 'Test User',
          bakeryId: 'bakery123',
        },
      };

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid email format',
      });
    });

    it('should reject registration with missing required fields', async () => {
      const req = {
        body: {
          email: 'test@example.com',
          // Missing password and other required fields
        },
      };

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringMatching(/Password is required/),
        }),
      );
    });

    it('should require bakeryId for non-admin roles', async () => {
      const req = {
        body: {
          email: 'test@example.com',
          password: 'password123',
          role: 'bakery_staff',
          name: 'Test User',
          // Missing bakeryId
        },
      };

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'BakeryId is required for non-admin users',
      });
    });

    it('should handle service errors during registration', async () => {
      const req = {
        body: {
          email: 'test@example.com',
          password: 'password123',
          role: 'bakery_admin',
          name: 'Test User',
        },
      };

      const error = new Error('Registration failed');
      authService.register.mockRejectedValue(error);

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Registration failed',
        }),
      );
    });
  });

  describe('login', () => {
    it('should login user successfully with valid token and email', async () => {
      const req = {
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: {
          email: 'test@example.com',
        },
      };

      const mockUserData = {
        uid: 'user123',
        email: 'test@example.com',
        role: 'bakery_admin',
        bakeryId: 'bakery123',
      };

      authService.login.mockResolvedValue(mockUserData);

      await authController.login(req, res);

      expect(authService.login).toHaveBeenCalledWith(
        'valid-token',
        'test@example.com',
      );
      expect(res.json).toHaveBeenCalledWith(mockUserData);
    });

    it('should reject login without authorization header', async () => {
      const req = {
        headers: {},
        body: {
          email: 'test@example.com',
        },
      };

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No token provided',
      });
    });

    it('should reject login with invalid authorization format', async () => {
      const req = {
        headers: {
          authorization: 'InvalidFormat token',
        },
        body: {
          email: 'test@example.com',
        },
      };

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No token provided',
      });
    });

    it('should reject login without email', async () => {
      const req = {
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: {},
      };

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Email is required',
      });
    });

    it('should handle authentication errors', async () => {
      const req = {
        headers: {
          authorization: 'Bearer invalid-token',
        },
        body: {
          email: 'test@example.com',
        },
      };

      authService.login.mockRejectedValue(
        new AuthenticationError('Invalid token'),
      );

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid token',
      });
    });
  });
});
