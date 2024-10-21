const bakeryAccess = require("../middleware/bakeryAccess");

describe("Bakery Access Middleware", () => {
  let mockRequest;
  let mockResponse;
  let mockNext;

  beforeEach(() => {
    mockRequest = {
      user: {},
      params: {},
      body: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should allow access for system admin regardless of bakery ID", () => {
    mockRequest.user = { role: "system_admin" };
    mockRequest.params.bakeryId = "some-bakery-id";

    bakeryAccess(mockRequest, mockResponse, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
  });

  it("should allow access when user bakeryId matches requested bakeryId in params", () => {
    const bakeryId = "matching-bakery-id";
    mockRequest.user = { role: "bakery_owner", bakeryId: bakeryId };
    mockRequest.params.bakeryId = bakeryId;

    bakeryAccess(mockRequest, mockResponse, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
  });

  it("should allow access when user bakeryId matches requested bakeryId in body", () => {
    const bakeryId = "matching-bakery-id";
    mockRequest.user = { role: "bakery_owner", bakeryId: bakeryId };
    mockRequest.body.bakeryId = bakeryId;

    bakeryAccess(mockRequest, mockResponse, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
  });

  it("should deny access when user bakeryId does not match requested bakeryId", () => {
    mockRequest.user = { role: "bakery_owner", bakeryId: "user-bakery-id" };
    mockRequest.params.bakeryId = "different-bakery-id";

    bakeryAccess(mockRequest, mockResponse, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: "Access denied to this bakery",
    });
  });

  it("should deny access when bakeryId is not provided", () => {
    mockRequest.user = { role: "bakery_owner", bakeryId: "user-bakery-id" };

    bakeryAccess(mockRequest, mockResponse, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: "Access denied to this bakery",
    });
  });

  it("should deny access for non-system admin users without matching bakeryId", () => {
    mockRequest.user = { role: "customer", bakeryId: "customer-bakery-id" };
    mockRequest.params.bakeryId = "different-bakery-id";

    bakeryAccess(mockRequest, mockResponse, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: "Access denied to this bakery",
    });
  });
});
