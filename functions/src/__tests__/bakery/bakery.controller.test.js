const bakeryController = require("../../controllers/bakeryController");
const bakeryService = require("../../services/bakeryService");

// Mock the bakeryService
jest.mock("../../services/bakeryService");

describe("Bakery Controller", () => {
  let mockRequest;
  let mockResponse;
  let mockNext;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createBakery", () => {
    it("should create a new bakery and return 201 status", async () => {
      const bakeryData = { name: "Test Bakery", address: "123 Test St" };
      mockRequest.body = bakeryData;
      const newBakery = { id: "new-bakery-id", ...bakeryData };

      bakeryService.createBakery.mockResolvedValue(newBakery);

      await bakeryController.createBakery(mockRequest, mockResponse);

      expect(bakeryService.createBakery).toHaveBeenCalledWith(bakeryData);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(newBakery);
    });

    it("should return 400 status when creation fails", async () => {
      mockRequest.body = { name: "Test Bakery" };
      const error = new Error("Creation failed");

      bakeryService.createBakery.mockRejectedValue(error);

      await bakeryController.createBakery(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Creation failed",
      });
    });
  });

  describe("getBakery", () => {
    it("should return a bakery if it exists", async () => {
      const bakeryId = "existing-bakery-id";
      mockRequest.params = { id: bakeryId };
      const bakery = { id: bakeryId, name: "Existing Bakery" };

      bakeryService.getBakeryById.mockResolvedValue(bakery);

      await bakeryController.getBakery(mockRequest, mockResponse);

      expect(bakeryService.getBakeryById).toHaveBeenCalledWith(bakeryId);
      expect(mockResponse.json).toHaveBeenCalledWith(bakery);
    });

    it("should return 404 status if bakery does not exist", async () => {
      mockRequest.params = { id: "non-existent-id" };

      bakeryService.getBakeryById.mockResolvedValue(null);

      await bakeryController.getBakery(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Bakery not found",
      });
    });
  });

  describe("getAllBakeries", () => {
    it("should return all bakeries", async () => {
      const bakeries = [
        { id: "1", name: "Bakery 1" },
        { id: "2", name: "Bakery 2" },
      ];

      bakeryService.getAllBakeries.mockResolvedValue(bakeries);

      await bakeryController.getAllBakeries(mockRequest, mockResponse);

      expect(bakeryService.getAllBakeries).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(bakeries);
    });

    it("should return 500 status if fetching fails", async () => {
      const error = new Error("Fetching failed");

      bakeryService.getAllBakeries.mockRejectedValue(error);

      await bakeryController.getAllBakeries(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Fetching failed",
      });
    });
  });

  describe("updateBakery", () => {
    it("should update an existing bakery", async () => {
      const bakeryId = "existing-bakery-id";
      const updateData = { name: "Updated Bakery" };
      mockRequest.params = { id: bakeryId };
      mockRequest.body = updateData;
      const updatedBakery = { id: bakeryId, ...updateData };

      bakeryService.updateBakery.mockResolvedValue(updatedBakery);

      await bakeryController.updateBakery(mockRequest, mockResponse);

      expect(bakeryService.updateBakery).toHaveBeenCalledWith(
        bakeryId,
        updateData
      );
      expect(mockResponse.json).toHaveBeenCalledWith(updatedBakery);
    });

    it("should return 404 status if bakery does not exist", async () => {
      mockRequest.params = { id: "non-existent-id" };
      mockRequest.body = { name: "Updated Bakery" };

      bakeryService.updateBakery.mockResolvedValue(null);

      await bakeryController.updateBakery(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Bakery not found",
      });
    });
  });

  describe("deleteBakery", () => {
    it("should delete an existing bakery", async () => {
      const bakeryId = "existing-bakery-id";
      mockRequest.params = { id: bakeryId };

      await bakeryController.deleteBakery(mockRequest, mockResponse);

      expect(bakeryService.deleteBakery).toHaveBeenCalledWith(bakeryId);
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it("should return 500 status if deletion fails", async () => {
      mockRequest.params = { id: "failing-bakery-id" };
      const error = new Error("Deletion failed");

      bakeryService.deleteBakery.mockRejectedValue(error);

      await bakeryController.deleteBakery(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Deletion failed",
      });
    });
  });
});
