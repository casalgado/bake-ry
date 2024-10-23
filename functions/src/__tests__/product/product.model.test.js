const Product = require("../../models/Product");

describe("Product Model", () => {
  // Mock Timestamp class
  class Timestamp {
    constructor(seconds, nanoseconds) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }

    toDate() {
      return new Date(this.seconds * 1000);
    }
  }

  describe("Constructor", () => {
    it("should create a product with minimal required fields", () => {
      const product = new Product({
        name: "Simple Cake",
        category: "Cake",
        basePrice: 19.99,
        currentPrice: 19.99,
      });

      expect(product.name).toBe("Simple Cake");
      expect(product.category).toBe("Cake");
      expect(product.basePrice).toBe(19.99);
      expect(product.currentPrice).toBe(19.99);
    });

    it("should set default values for optional fields", () => {
      const product = new Product({
        name: "Test Product",
        category: "Test",
        basePrice: 10,
        currentPrice: 10,
      });

      // Check default values
      expect(product.isActive).toBe(true);
      expect(product.customizable).toBe(false);
      expect(product.discountable).toBe(true);
      expect(product.variations).toEqual([]);
      expect(product.minimumStock).toBe(0);
      expect(product.currentStock).toBe(0);
      expect(product.displayOrder).toBe(0);
      expect(product.featured).toBe(false);
      expect(product.tags).toEqual([]);
      expect(product.allergens).toEqual([]);
      expect(product.dietary).toEqual([]);
      expect(product.totalSold).toBe(0);
      expect(product.averageRating).toBe(0);
      expect(product.reviewCount).toBe(0);
      expect(product.leadTime).toBe(0);
      expect(Array.isArray(product.availableDays)).toBe(true);
      expect(product.availableDays).toContain("Monday");
    });

    it("should handle all provided fields", () => {
      const productData = {
        name: "Deluxe Cake",
        category: "Premium",
        type: "Special",
        basePrice: 29.99,
        currentPrice: 34.99,
        size: "Large",
        weight: 2000,
        dimensions: { length: 30, width: 30, height: 15 },
        customizable: true,
        variations: ["Chocolate", "Vanilla"],
        costToMake: 15.0,
        minimumStock: 5,
      };

      const product = new Product(productData);

      Object.keys(productData).forEach((key) => {
        expect(product[key]).toEqual(productData[key]);
      });
    });
  });

  describe("Firestore Conversion", () => {
    it("should create product from Firestore document", () => {
      const now = new Date();
      const nowTimestamp = new Timestamp(Math.floor(now.getTime() / 1000), 0);
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const nextWeekTimestamp = new Timestamp(
        Math.floor(nextWeek.getTime() / 1000),
        0
      );

      const mockDoc = {
        id: "prod123",
        data: () => ({
          name: "Chocolate Cake",
          description: "Delicious chocolate cake",
          category: "Cake",
          type: "Regular",
          basePrice: 29.99,
          currentPrice: 29.99,
          createdAt: nowTimestamp,
          updatedAt: nowTimestamp,
          seasonalPeriod: {
            start: nowTimestamp,
            end: nextWeekTimestamp,
          },
        }),
      };

      const product = Product.fromFirestore(mockDoc);
      expect(product).toBeInstanceOf(Product);
      expect(product.id).toBe("prod123");
      expect(product.name).toBe("Chocolate Cake");
      expect(product.createdAt).toBeInstanceOf(Date);
      expect(product.seasonalPeriod.start).toBeInstanceOf(Date);
      expect(product.seasonalPeriod.end).toBeInstanceOf(Date);
    });

    it("should handle missing timestamp fields", () => {
      const mockDoc = {
        id: "prod123",
        data: () => ({
          name: "Simple Product",
          category: "Other",
          basePrice: 10,
          currentPrice: 10,
          seasonalPeriod: null,
        }),
      };

      const product = Product.fromFirestore(mockDoc);
      expect(product).toBeInstanceOf(Product);
      expect(product.createdAt).toBeInstanceOf(Date);
      expect(product.updatedAt).toBeInstanceOf(Date);
      expect(product.seasonalPeriod).toBeNull();
    });

    it("should convert to Firestore format correctly", () => {
      const product = new Product({
        id: "test123",
        name: "Test Product",
        category: "Test",
        basePrice: 10,
        currentPrice: 10,
      });

      const firestoreData = product.toFirestore();
      expect(firestoreData.id).toBeUndefined();
      expect(firestoreData.name).toBe("Test Product");
      expect(firestoreData.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("Utility Methods", () => {
    let product;

    beforeEach(() => {
      product = new Product({
        name: "Test Product",
        category: "Test",
        basePrice: 30,
        currentPrice: 30,
        costToMake: 10,
        currentStock: 5,
        restockThreshold: 3,
        isActive: true,
        leadTime: 2, // 2 hours
      });
    });

    describe("calculateProfit", () => {
      it("should calculate profit correctly", () => {
        expect(product.calculateProfit()).toBe(20); // 30 - 10
      });

      it("should handle missing costToMake", () => {
        product.costToMake = undefined;
        expect(product.calculateProfit()).toBe(30);
      });
    });

    describe("calculateProfitMargin", () => {
      it("should calculate profit margin percentage correctly", () => {
        expect(product.calculateProfitMargin()).toBeCloseTo(66.67, 2); // ((30 - 10) / 30) * 100
      });

      it("should return 0 when price or cost is missing", () => {
        product.costToMake = undefined;
        expect(product.calculateProfitMargin()).toBe(0);
      });
    });

    describe("needsRestock", () => {
      it("should return true when stock is below threshold", () => {
        product.currentStock = 2;
        expect(product.needsRestock()).toBe(true);
      });

      it("should return false when stock is above threshold", () => {
        product.currentStock = 5;
        expect(product.needsRestock()).toBe(false);
      });
    });

    describe("isAvailableOn", () => {
      it("should check day availability correctly", () => {
        const now = new Date();
        expect(product.isAvailableOn(now)).toBe(true);
      });

      it("should respect seasonal period", () => {
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        product.isSeasonalItem = true;
        product.seasonalPeriod = {
          start: now,
          end: nextWeek,
        };

        expect(product.isAvailableOn(now)).toBe(true);
        expect(
          product.isAvailableOn(
            new Date(nextWeek.getTime() + 24 * 60 * 60 * 1000)
          )
        ).toBe(false);
      });
    });

    describe("canOrderFor", () => {
      it("should check if product can be ordered for a date", () => {
        const orderDate = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 hours from now
        expect(product.canOrderFor(orderDate)).toBe(true);
      });

      it("should respect lead time", () => {
        const orderDate = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour from now
        expect(product.canOrderFor(orderDate)).toBe(false);
      });

      it("should respect active status", () => {
        product.isActive = false;
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        expect(product.canOrderFor(tomorrow)).toBe(false);
      });
    });
  });
});
