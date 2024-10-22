const {
  authenticateUser,
  requireSystemAdmin,
} = require("../../middleware/userAccess");
const userService = require("../../services/userService");

jest.mock("../../services/userService");

describe("Auth Middleware", () => {
  let mockRequest;
  let mockResponse;
  let mockNext;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      user: null,
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  describe("authenticateUser", () => {
    it("should authenticate a user with a valid token", async () => {
      const validToken = "valid_token";
      const decodedToken = { uid: "user123", email: "user@example.com" };

      mockRequest.headers.authorization = `Bearer ${validToken}`;
      userService.verifyToken.mockResolvedValue(decodedToken);

      await authenticateUser(mockRequest, mockResponse, mockNext);

      expect(userService.verifyToken).toHaveBeenCalledWith(validToken);
      expect(mockRequest.user).toEqual(decodedToken);
      expect(mockNext).toHaveBeenCalled();
    });

    it("should return 401 if no token is provided", async () => {
      await authenticateUser(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "No token provided",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 if token verification fails", async () => {
      mockRequest.headers.authorization = "Bearer invalid_token";
      userService.verifyToken.mockRejectedValue(new Error("Invalid token"));

      await authenticateUser(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Invalid token",
        details: "Invalid token",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("requireSystemAdmin", () => {
    it("should allow access for system admin", () => {
      mockRequest.user = { role: "system_admin" };

      requireSystemAdmin(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should deny access for non-system admin", () => {
      mockRequest.user = { role: "baker" };

      requireSystemAdmin(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "System admin access required",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
