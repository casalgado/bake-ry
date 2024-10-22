const { db } = require("../../config/firebase");
const Bakery = require("../../models/Bakery");
const bakeryService = require("../../services/bakeryService");

// Mock Firebase
jest.mock("../../config/firebase.js");

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
      const bakeryData = new Bakery({
        // Basic Info
        name: "Sweet Delight Artisan Bakery",
        address: {
          street: "123 Maple Avenue",
          city: "Portland",
          state: "OR",
          zipCode: "97201",
          country: "USA",
        },
        phone: "+1-503-555-0123",
        email: "hello@sweetdelightbakery.com",
        operatingHours: {
          monday: { open: "07:00", close: "19:00" },
          tuesday: { open: "07:00", close: "19:00" },
          wednesday: { open: "07:00", close: "19:00" },
          thursday: { open: "07:00", close: "19:00" },
          friday: { open: "07:00", close: "20:00" },
          saturday: { open: "08:00", close: "20:00" },
          sunday: { open: "08:00", close: "16:00" },
        },
        ownerId: "usr_987654321",
        createdAt: new Date("2023-01-15T08:00:00Z"),
        updatedAt: new Date("2024-03-20T14:30:00Z"),

        // Business Information
        description:
          "Artisanal bakery specializing in French pastries and organic sourdough breads. Family-owned since 2023.",
        website: "https://sweetdelightbakery.com",
        socialMedia: {
          instagram: "@sweetdelightpdx",
          facebook: "SweetDelightBakeryPDX",
          tiktok: "@sweetdelightbakes",
        },
        businessLicense: "BL-PDX-2023-456789",
        taxId: "87-1234567",

        // Location & Delivery
        coordinates: {
          lat: 45.523064,
          lng: -122.676483,
        },
        deliveryRadius: 5.0, // miles
        deliveryFee: 5.99,
        parkingAvailable: true,

        // Operations
        capacity: 30,
        specialties: [
          "Croissants",
          "Sourdough Bread",
          "French Macarons",
          "Custom Wedding Cakes",
        ],
        cuisineTypes: ["French", "American", "European"],
        dietary: ["Vegan Options", "Gluten-Free Options", "Nut-Free Options"],

        // Payment & Orders
        acceptedPaymentMethods: [
          "VISA",
          "MasterCard",
          "American Express",
          "Apple Pay",
          "Google Pay",
        ],
        minimumOrderAmount: 15.0,
        onlineOrderingEnabled: true,

        // Ratings & Reviews
        rating: 4.8,
        reviewCount: 127,
        featuredReviews: [
          {
            id: "rev_123",
            author: "Sarah M.",
            rating: 5,
            text: "Best croissants in Portland! Perfectly flaky and buttery.",
            date: new Date("2024-03-15"),
          },
          {
            id: "rev_124",
            author: "Michael R.",
            rating: 5,
            text: "Their sourdough bread is exceptional. Worth the trip across town!",
            date: new Date("2024-03-18"),
          },
        ],

        // Staff & Service
        employeeCount: 12,
        serviceTypes: [
          "Dine-in",
          "Takeout",
          "Delivery",
          "Catering",
          "Special Orders",
        ],

        // Marketing & Promotions
        loyaltyProgram: {
          name: "Sweet Rewards",
          pointsPerDollar: 1,
          rewardThreshold: 100,
        },
        promotions: [
          {
            id: "promo_123",
            title: "Early Bird Special",
            description: "20% off all pastries before 9am",
            validUntil: new Date("2024-12-31"),
            createdAt: new Date("2024-01-01"),
          },
        ],
        tags: [
          "bakery",
          "pastries",
          "french",
          "organic",
          "sourdough",
          "wedding cakes",
          "portland",
        ],

        // Status
        isActive: true,
        isPaused: false,
        pauseReason: null,

        // Customization
        theme: {
          primaryColor: "#FE938C",
          secondaryColor: "#E6B89C",
          fontFamily: "Montserrat",
          logo: "sweet-delight-logo.png",
        },
        customAttributes: {
          sustainabilityScore: 4.5,
          certifications: ["Organic", "Local First"],
          preferredVendors: ["Portland Flour Co.", "Oregon Dairy Farms"],
        },
      });

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

    it("should update nested fields correctly", async () => {
      const bakeryId = "existingBakeryId";
      const updateData = {
        socialMedia: {
          instagram: "@newhandle",
          facebook: "NewPage",
        },
        coordinates: {
          lat: 45.523064,
          lng: -122.676483,
        },
      };
      const existingData = {
        name: "Old Name",
        socialMedia: {
          instagram: "@oldhandle",
          facebook: "OldPage",
        },
      };

      mockFirestore.get.mockResolvedValue({
        exists: true,
        id: bakeryId,
        data: () => existingData,
      });

      const result = await bakeryService.updateBakery(bakeryId, updateData);

      expect(mockFirestore.update).toHaveBeenCalledWith(expect.any(Object));
      expect(result.socialMedia).toEqual(updateData.socialMedia);
      expect(result.coordinates).toEqual(updateData.coordinates);
    });

    it("should update array fields correctly", async () => {
      const bakeryId = "existingBakeryId";
      const updateData = {
        specialties: ["New Specialty 1", "New Specialty 2"],
        tags: ["new-tag-1", "new-tag-2"],
      };

      mockFirestore.get.mockResolvedValue({
        exists: true,
        id: bakeryId,
        data: () => ({ specialties: ["Old Specialty"], tags: ["old-tag"] }),
      });

      const result = await bakeryService.updateBakery(bakeryId, updateData);

      expect(mockFirestore.update).toHaveBeenCalledWith(expect.any(Object));
      expect(result.specialties).toEqual(updateData.specialties);
      expect(result.tags).toEqual(updateData.tags);
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
