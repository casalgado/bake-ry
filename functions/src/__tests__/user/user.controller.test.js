const userController = require("../../controllers/userController");
const userService = require("../../services/userService");

jest.mock("../../services/userService");

describe("User Controller", () => {
  let mockRequest;
  let mockResponse;
  let mockNext;

  beforeEach(() => {
    mockRequest = {
      body: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  describe("register", () => {
    it("should register a new user successfully", async () => {
      const userData = {
        email: "test@example.com",
        password: "password123",
        role: "baker",
        name: "Test Baker",
        bakeryId: "bakery123",
      };
      mockRequest.body = userData;

      const createdUser = { ...userData, uid: "user123" };
      userService.createUser.mockResolvedValue(createdUser);

      await userController.register(mockRequest, mockResponse);

      expect(userService.createUser).toHaveBeenCalledWith(userData);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "User created successfully",
        user: createdUser,
      });
    });

    it("should handle registration errors", async () => {
      mockRequest.body = {
        email: "existing@example.com",
        password: "password123",
      };

      userService.createUser.mockRejectedValue(
        new Error("User already exists")
      );

      await userController.register(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "User already exists",
      });
    });
  });

  describe("login", () => {
    test("should login a user successfully", async () => {
      const mockRequest = {
        headers: {
          authorization: "Bearer fake_token",
        },
        body: {
          email: "user@example.com",
        },
      };

      const mockResponse = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      await userController.loginUser(mockRequest, mockResponse);

      expect(userService.loginUser).toHaveBeenCalledWith(
        "fake_token",
        "user@example.com"
      );
    });

    test("should handle login errors", async () => {
      const mockRequest = {
        headers: {
          authorization: "Bearer invalid_token",
        },
        body: {
          email: "user@example.com",
        },
      };

      const mockResponse = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      // Mock the service to throw an error
      userService.loginUser.mockRejectedValue(new Error("Invalid credentials"));

      await userController.loginUser(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Invalid credentials",
      });
    });
  });
});
