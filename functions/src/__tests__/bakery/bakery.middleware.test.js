// tests/middleware/bakeryAccess.test.js
const { admin } = require("../../config/firebase");
const hasBakeryAccess = require("../../middleware/bakeryAccess");
const { ForbiddenError } = require("../../utils/errors");

describe("hasBakeryAccess Middleware", () => {
  let mockRequest;
  let mockResponse;
  let nextFunction;

  beforeEach(() => {
    // Reset all mocks before each test
    mockRequest = {
      user: {},
      params: {},
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    nextFunction = jest.fn();
  });

  test("should allow system admin access to any bakery", async () => {
    // Arrange
    mockRequest.user = {
      role: "system_admin",
      bakeryId: "bakery1",
    };
    mockRequest.params.bakeryId = "bakery2";

    // Act
    await hasBakeryAccess(mockRequest, mockResponse, nextFunction);

    // Assert
    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  test("should allow user access to their own bakery", async () => {
    // Arrange
    mockRequest.user = {
      role: "baker",
      bakeryId: "bakery1",
    };
    mockRequest.params.bakeryId = "bakery1";

    // Act
    await hasBakeryAccess(mockRequest, mockResponse, nextFunction);

    // Assert
    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  test("should deny access to user trying to access different bakery", async () => {
    // Arrange
    mockRequest.user = {
      role: "baker",
      bakeryId: "bakery1",
    };
    mockRequest.params.bakeryId = "bakery2";

    // Act
    await hasBakeryAccess(mockRequest, mockResponse, nextFunction);

    // Assert
    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: "User does not have access to this bakery",
    });
  });

  test("should get bakeryId from request body if not in params", async () => {
    // Arrange
    mockRequest.user = {
      role: "baker",
      bakeryId: "bakery1",
    };
    mockRequest.body.bakeryId = "bakery1";

    // Act
    await hasBakeryAccess(mockRequest, mockResponse, nextFunction);

    // Assert
    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  test("should handle missing bakeryId", async () => {
    // Arrange
    mockRequest.user = {
      role: "baker",
      bakeryId: "bakery1",
    };
    // No bakeryId in params or body

    // Act
    await hasBakeryAccess(mockRequest, mockResponse, nextFunction);

    // Assert
    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: "User does not have access to this bakery",
    });
  });

  test("should handle undefined user", async () => {
    // Arrange
    mockRequest.user = undefined;
    mockRequest.params.bakeryId = "bakery1";

    // Act
    await hasBakeryAccess(mockRequest, mockResponse, nextFunction);

    // Assert
    expect(nextFunction).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalled();
  });
});
