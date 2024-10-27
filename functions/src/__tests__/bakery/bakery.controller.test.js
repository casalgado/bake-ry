// tests/controllers/bakeryController.test.js
const bakeryController = require("../../controllers/bakeryController");
const bakeryService = require("../../services/bakeryService");

jest.mock("../../services/bakeryService");

describe("Bakery Controller", () => {
  let mockRequest;
  let mockResponse;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock request object
    mockRequest = {
      user: {
        uid: "testUserId",
        bakeryId: null,
      },
      params: {},
      body: {},
    };

    // Mock response object
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
  });

  describe("createBakery", () => {
    test("should create a new bakery successfully", async () => {
      // Arrange
      const bakeryData = {
        name: "Test Bakery",
        address: "123 Test St",
      };
      mockRequest.body = bakeryData;

      const expectedBakery = {
        id: "testBakeryId",
        ...bakeryData,
        ownerId: "testUserId",
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      };

      bakeryService.createBakery.mockResolvedValue(expectedBakery);

      // Act
      await bakeryController.createBakery(mockRequest, mockResponse);

      // Assert
      expect(bakeryService.createBakery).toHaveBeenCalledWith(
        expect.objectContaining({
          ...bakeryData,
          ownerId: "testUserId",
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(expectedBakery);
    });

    test("should prevent creation if user already has a bakery", async () => {
      // Arrange
      mockRequest.user.bakeryId = "existingBakeryId";

      // Act
      await bakeryController.createBakery(mockRequest, mockResponse);

      // Assert
      expect(bakeryService.createBakery).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error:
          "User already has a bakery assigned and cannot create another one",
      });
    });

    test("should handle service errors", async () => {
      // Arrange
      const error = new Error("Database error");
      bakeryService.createBakery.mockRejectedValue(error);

      // Act
      await bakeryController.createBakery(mockRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: error.message,
      });
    });
  });

  describe("getBakery", () => {
    test("should get bakery by id successfully", async () => {
      // Arrange
      const expectedBakery = {
        id: "testBakeryId",
        name: "Test Bakery",
      };
      mockRequest.params.bakeryId = "testBakeryId";
      bakeryService.getBakeryById.mockResolvedValue(expectedBakery);

      // Act
      await bakeryController.getBakery(mockRequest, mockResponse);

      // Assert
      expect(bakeryService.getBakeryById).toHaveBeenCalledWith("testBakeryId");
      expect(mockResponse.json).toHaveBeenCalledWith(expectedBakery);
    });

    test("should return 404 when bakery not found", async () => {
      // Arrange
      mockRequest.params.bakeryId = "nonexistentId";
      bakeryService.getBakeryById.mockResolvedValue(null);

      // Act
      await bakeryController.getBakery(mockRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Bakery not found",
      });
    });
  });

  describe("getAllBakeries", () => {
    test("should get all bakeries successfully", async () => {
      // Arrange
      const expectedBakeries = [
        { id: "1", name: "Bakery 1" },
        { id: "2", name: "Bakery 2" },
      ];
      bakeryService.getAllBakeries.mockResolvedValue(expectedBakeries);

      // Act
      await bakeryController.getAllBakeries(mockRequest, mockResponse);

      // Assert
      expect(bakeryService.getAllBakeries).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(expectedBakeries);
    });

    test("should handle service errors", async () => {
      // Arrange
      const error = new Error("Database error");
      bakeryService.getAllBakeries.mockRejectedValue(error);

      // Act
      await bakeryController.getAllBakeries(mockRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: error.message,
      });
    });
  });

  describe("updateBakery", () => {
    test("should update bakery successfully", async () => {
      // Arrange
      const updateData = {
        name: "Updated Bakery Name",
      };
      const expectedBakery = {
        id: "testBakeryId",
        ...updateData,
      };
      mockRequest.params.bakeryId = "testBakeryId";
      mockRequest.body = updateData;
      bakeryService.updateBakery.mockResolvedValue(expectedBakery);

      // Act
      await bakeryController.updateBakery(mockRequest, mockResponse);

      // Assert
      expect(bakeryService.updateBakery).toHaveBeenCalledWith(
        "testBakeryId",
        updateData
      );
      expect(mockResponse.json).toHaveBeenCalledWith(expectedBakery);
    });

    test("should return 404 when updating non-existent bakery", async () => {
      // Arrange
      mockRequest.params.bakeryId = "nonexistentId";
      bakeryService.updateBakery.mockResolvedValue(null);

      // Act
      await bakeryController.updateBakery(mockRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Bakery not found",
      });
    });
  });

  describe("deleteBakery", () => {
    test("should delete bakery successfully", async () => {
      // Arrange
      mockRequest.params.bakeryId = "testBakeryId";
      bakeryService.deleteBakery.mockResolvedValue();

      // Act
      await bakeryController.deleteBakery(mockRequest, mockResponse);

      // Assert
      expect(bakeryService.deleteBakery).toHaveBeenCalledWith("testBakeryId");
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalled();
    });

    test("should handle service errors during deletion", async () => {
      // Arrange
      const error = new Error("Database error");
      mockRequest.params.bakeryId = "testBakeryId";
      bakeryService.deleteBakery.mockRejectedValue(error);

      // Act
      await bakeryController.deleteBakery(mockRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: error.message,
      });
    });
  });
});
