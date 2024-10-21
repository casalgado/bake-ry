const { db } = require("../config/firebase");
const Bakery = require("../models/Bakery");
const bakeryService = require("../services/bakeryService");

// Mock Firebase
jest.mock("../config/firebase.js");

describe("Bakery Service", () => {
  let mockFirestore;

  beforeEach(() => {
    mockFirestore = {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      add: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    db.collection.mockReturnValue(mockFirestore);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createBakery", () => {
    it("should create a new bakery", async () => {
      const bakeryData = { name: "Test Bakery", address: "123 Test St" };
      const newBakeryId = "newBakeryId";
      mockFirestore.add.mockResolvedValue({ id: newBakeryId });

      const result = await bakeryService.createBakery(bakeryData);

      expect(mockFirestore.add).toHaveBeenCalledWith(expect.any(Object));
      expect(result).toBeInstanceOf(Bakery);
      expect(result.id).toBe(newBakeryId);
      expect(result.name).toBe(bakeryData.name);
      expect(result.address).toBe(bakeryData.address);
    });

    it("should throw an error if creation fails", async () => {
      const bakeryData = { name: "Test Bakery" };
      mockFirestore.add.mockRejectedValue(new Error("Creation failed"));

      await expect(bakeryService.createBakery(bakeryData)).rejects.toThrow(
        "Creation failed"
      );
    });
  });

  describe("getBakeryById", () => {
    it("should return a bakery if it exists", async () => {
      const bakeryId = "existingBakeryId";
      const bakeryData = { name: "Existing Bakery", address: "456 Exist St" };
      mockFirestore.get.mockResolvedValue({
        exists: true,
        id: bakeryId,
        data: () => bakeryData,
      });

      const result = await bakeryService.getBakeryById(bakeryId);

      expect(mockFirestore.doc).toHaveBeenCalledWith(bakeryId);
      expect(result).toBeInstanceOf(Bakery);
      expect(result.id).toBe(bakeryId);
      expect(result.name).toBe(bakeryData.name);
    });

    it("should return null if bakery doesn't exist", async () => {
      const bakeryId = "nonExistentBakeryId";
      mockFirestore.get.mockResolvedValue({ exists: false });

      const result = await bakeryService.getBakeryById(bakeryId);

      expect(result).toBeNull();
    });
  });

  describe("getAllBakeries", () => {
    it("should return all bakeries", async () => {
      const bakeries = [
        { id: "1", name: "Bakery 1" },
        { id: "2", name: "Bakery 2" },
      ];
      mockFirestore.get.mockResolvedValue({
        docs: bakeries.map((b) => ({
          id: b.id,
          data: () => b,
        })),
      });

      const result = await bakeryService.getAllBakeries();

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Bakery);
      expect(result[0].id).toBe("1");
      expect(result[1].id).toBe("2");
    });
  });

  describe("updateBakery", () => {
    it("should update an existing bakery", async () => {
      const bakeryId = "existingBakeryId";
      const updateData = { name: "Updated Bakery" };
      const existingData = { name: "Old Name", address: "Old Address" };
      mockFirestore.get.mockResolvedValue({
        exists: true,
        id: bakeryId,
        data: () => existingData,
      });

      const result = await bakeryService.updateBakery(bakeryId, updateData);

      expect(mockFirestore.update).toHaveBeenCalledWith(expect.any(Object));
      expect(result).toBeInstanceOf(Bakery);
      expect(result.id).toBe(bakeryId);
      expect(result.name).toBe(updateData.name);
      expect(result.address).toBe(existingData.address);
    });

    it("should return null if bakery doesn't exist", async () => {
      const bakeryId = "nonExistentBakeryId";
      const updateData = { name: "Updated Bakery" };
      mockFirestore.get.mockResolvedValue({ exists: false });

      const result = await bakeryService.updateBakery(bakeryId, updateData);

      expect(result).toBeNull();
      expect(mockFirestore.update).not.toHaveBeenCalled();
    });
  });

  describe("deleteBakery", () => {
    it("should delete an existing bakery", async () => {
      const bakeryId = "existingBakeryId";

      await bakeryService.deleteBakery(bakeryId);

      expect(mockFirestore.doc).toHaveBeenCalledWith(bakeryId);
      expect(mockFirestore.delete).toHaveBeenCalled();
    });

    it("should throw an error if deletion fails", async () => {
      const bakeryId = "failedDeletionId";
      mockFirestore.delete.mockRejectedValue(new Error("Deletion failed"));

      await expect(bakeryService.deleteBakery(bakeryId)).rejects.toThrow(
        "Deletion failed"
      );
    });
  });
});
