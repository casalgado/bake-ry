const { db, admin } = require("../../config/firebase");
const bakeryService = require("../../services/bakeryService");
const Bakery = require("../../models/Bakery");

// Mock Firebase modules
jest.mock("../../config/firebase", () => {
  // Mock get function for collection
  const mockGet = jest.fn();
  // Mock collection reference
  const mockCollectionRef = {
    doc: jest.fn(),
    get: mockGet,
  };
  // Mock collection function
  const mockCollection = jest.fn(() => mockCollectionRef);

  return {
    db: {
      collection: mockCollection,
      runTransaction: jest.fn(),
    },
    admin: {
      auth: () => ({
        getUser: jest.fn(() =>
          Promise.resolve({
            customClaims: { existingClaim: true },
          })
        ),
        setCustomUserClaims: jest.fn(() => Promise.resolve()),
      }),
    },
  };
});

describe("Bakery Service", () => {
  let mockTransaction;
  let mockBakeryRef;
  let mockUserRef;
  let mockBakeryDoc;
  let mockUserDoc;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock transaction
    mockTransaction = {
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
    };

    // Setup mock references and documents
    mockBakeryRef = {
      id: "test-bakery-id",
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockUserRef = {
      get: jest.fn(),
      update: jest.fn(),
    };

    mockBakeryDoc = {
      exists: true,
      id: "test-bakery-id",
      data: () => ({
        name: "Test Bakery",
        address: "123 Test St",
        ownerId: "test-user-id",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    };

    mockUserDoc = {
      exists: true,
      data: () => ({
        email: "test@example.com",
        name: "Test User",
      }),
    };

    // Setup collection mock to return different refs based on collection name
    db.collection.mockImplementation((collectionName) => {
      const mockRef = {
        doc: jest
          .fn()
          .mockReturnValue(
            collectionName === "bakeries" ? mockBakeryRef : mockUserRef
          ),
        get: jest.fn().mockResolvedValue({ docs: [mockBakeryDoc] }),
      };
      return mockRef;
    });

    // Setup transaction mock
    db.runTransaction.mockImplementation((callback) =>
      callback(mockTransaction)
    );
  });

  describe("createBakery", () => {
    test("should create bakery successfully with transaction", async () => {
      // Arrange
      const bakeryData = {
        name: "New Bakery",
        address: "456 New St",
        ownerId: "test-user-id",
      };

      mockTransaction.get.mockResolvedValue(mockUserDoc);

      // Act
      const result = await bakeryService.createBakery(bakeryData);

      // Assert
      expect(db.runTransaction).toHaveBeenCalled();
      expect(mockTransaction.set).toHaveBeenCalled();
      expect(mockTransaction.update).toHaveBeenCalledWith(expect.any(Object), {
        bakeryId: expect.any(String),
        updatedAt: expect.any(Date),
      });
      expect(result).toMatchObject({
        id: expect.any(String),
        name: bakeryData.name,
        address: bakeryData.address,
      });
    });

    test("should throw error if user not found", async () => {
      // Arrange
      const bakeryData = {
        name: "New Bakery",
        ownerId: "nonexistent-user-id",
      };

      mockTransaction.get.mockResolvedValue({ exists: false });

      // Act & Assert
      await expect(bakeryService.createBakery(bakeryData)).rejects.toThrow(
        "User not found"
      );
    });
  });

  describe("getBakeryById", () => {
    test("should return bakery when found", async () => {
      // Arrange
      mockBakeryRef.get.mockResolvedValue(mockBakeryDoc);

      // Act
      const result = await bakeryService.getBakeryById("test-bakery-id");

      // Assert
      expect(result).toMatchObject({
        id: "test-bakery-id",
        name: "Test Bakery",
      });
    });

    test("should return null when bakery not found", async () => {
      // Arrange
      mockBakeryRef.get.mockResolvedValue({ exists: false });

      // Act
      const result = await bakeryService.getBakeryById("nonexistent-id");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("getAllBakeries", () => {
    test("should return all bakeries", async () => {
      // Arrange
      const mockBakeries = [
        mockBakeryDoc,
        {
          ...mockBakeryDoc,
          id: "test-bakery-id-2",
          data: () => ({
            name: "Test Bakery 2",
            address: "789 Test St",
            ownerId: "test-user-id-2",
          }),
        },
      ];

      db.collection.mockReturnValueOnce({
        get: jest.fn().mockResolvedValue({ docs: mockBakeries }),
      });

      // Act
      const result = await bakeryService.getAllBakeries();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ name: "Test Bakery" });
      expect(result[1]).toMatchObject({ name: "Test Bakery 2" });
    });

    test("should return empty array when no bakeries exist", async () => {
      // Arrange
      db.collection.mockReturnValueOnce({
        get: jest.fn().mockResolvedValue({ docs: [] }),
      });

      // Act
      const result = await bakeryService.getAllBakeries();

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe("updateBakery", () => {
    test("should update bakery successfully", async () => {
      // Arrange
      const updateData = {
        name: "Updated Bakery Name",
        address: "Updated Address",
      };

      mockBakeryRef.get.mockResolvedValue(mockBakeryDoc);

      // Act
      const result = await bakeryService.updateBakery(
        "test-bakery-id",
        updateData
      );

      // Assert
      expect(mockBakeryRef.update).toHaveBeenCalled();
      expect(result).toMatchObject({
        id: "test-bakery-id",
        ...updateData,
      });
    });

    test("should return null when updating non-existent bakery", async () => {
      // Arrange
      mockBakeryRef.get.mockResolvedValue({ exists: false });

      // Act
      const result = await bakeryService.updateBakery("nonexistent-id", {
        name: "New Name",
      });

      // Assert
      expect(result).toBeNull();
      expect(mockBakeryRef.update).not.toHaveBeenCalled();
    });
  });

  describe("deleteBakery", () => {
    test("should delete bakery successfully", async () => {
      // Arrange
      mockBakeryRef.delete.mockResolvedValue();

      // Act
      await bakeryService.deleteBakery("test-bakery-id");

      // Assert
      expect(mockBakeryRef.delete).toHaveBeenCalled();
    });

    test("should handle errors during deletion", async () => {
      // Arrange
      const error = new Error("Delete failed");
      mockBakeryRef.delete.mockRejectedValue(error);

      // Act & Assert
      await expect(
        bakeryService.deleteBakery("test-bakery-id")
      ).rejects.toThrow("Delete failed");
    });
  });
});
