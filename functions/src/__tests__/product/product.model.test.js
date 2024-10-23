const Product = require("../../models/Product");

describe("Product Model", () => {
  // Sample dates for testing
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Sample product data
  const sampleProductData = {
    id: "prod123",
    bakeryId: "bakery456",
    name: "Chocolate Cake",
    description: "Delicious chocolate cake",
    category: "Cake",
    type: "Regular",
    basePrice: 29.99,
    currentPrice: 29.99,
    costToMake: 10.0,
    size: "Medium",
    weight: 1000, // grams
    dimensions: { length: 20, width: 20, height: 10 },
    seasonalPeriod: {
      start: now,
      end: nextWeek,
    },
  };

  describe("Constructor", () => {
    it("should create a product with required fields", () => {
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
      const product = new Product(sampleProductData);

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
      expect(product.availableDays).toContain("Monday");
      expect(product.leadTime).toBe(0);
    });

    it("should handle dates properly", () => {
      const product = new Product(sampleProductData);

      expect(product.createdAt).toBeInstanceOf(Date);
      expect(product.updatedAt).toBeInstanceOf(Date);
      expect(product.seasonalPeriod.start).toBeInstanceOf(Date);
      expect(product.seasonalPeriod.end).toBeInstanceOf(Date);
    });
  });

  describe("Firestore Conversion", () => {
    it("should create product from Firestore document", () => {
      const mockDoc = {
        id: "prod123",
        data: () => ({
          ...sampleProductData,
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
      expect(product.name).toBe(sampleProductData.name);
      expect(product.createdAt).toBeInstanceOf(Date);
      expect(product.seasonalPeriod.start).toBeInstanceOf(Date);
    });

    // Add a test for handling missing timestamps
    it("should handle missing timestamp fields", () => {
      const mockDoc = {
        id: "prod123",
        data: () => ({
          ...sampleProductData,
          // Omit createdAt and updatedAt
          seasonalPeriod: null,
        }),
      };

      const product = Product.fromFirestore(mockDoc);
      expect(product).toBeInstanceOf(Product);
      expect(product.createdAt).toBeUndefined();
      expect(product.updatedAt).toBeUndefined();
      expect(product.seasonalPeriod).toBeNull();
    });
  });

  describe("Utility Methods", () => {
    let product;

    beforeEach(() => {
      product = new Product({
        ...sampleProductData,
        currentStock: 5,
        restockThreshold: 3,
        isActive: true,
        leadTime: 2, // 2 hours
      });
    });

    describe("calculateProfit", () => {
      it("should calculate profit correctly", () => {
        expect(product.calculateProfit()).toBe(19.99); // 29.99 - 10.00
      });

      it("should handle missing costToMake", () => {
        product.costToMake = undefined;
        expect(product.calculateProfit()).toBe(29.99);
      });
    });

    describe("calculateProfitMargin", () => {
      it("should calculate profit margin percentage correctly", () => {
        expect(product.calculateProfitMargin()).toBeCloseTo(66.66, 1); // ((29.99 - 10) / 29.99) * 100
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
        expect(product.isAvailableOn(now)).toBe(true);
      });

      it("should handle seasonal items", () => {
        product.isSeasonalItem = true;
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
        const orderDate = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now
        expect(product.canOrderFor(orderDate)).toBe(true);
      });

      it("should respect lead time", () => {
        const orderDate = new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1 hour from now
        expect(product.canOrderFor(orderDate)).toBe(false);
      });

      it("should respect active status", () => {
        product.isActive = false;
        expect(product.canOrderFor(tomorrow)).toBe(false);
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing dimensions", () => {
      const product = new Product({
        name: "Simple Product",
        category: "Other",
        basePrice: 10,
        currentPrice: 10,
      });
      expect(product.dimensions).toBeUndefined();
    });

    it("should handle invalid dates", () => {
      const product = new Product({
        ...sampleProductData,
        seasonalPeriod: {
          start: "invalid date",
          end: "invalid date",
        },
      });
      expect(product.seasonalPeriod.start).not.toBeInstanceOf(Date);
    });

    it("should handle empty arrays", () => {
      const product = new Product({
        ...sampleProductData,
        tags: null,
        allergens: null,
        variations: null,
      });
      expect(product.tags).toEqual([]);
      expect(product.allergens).toEqual([]);
      expect(product.variations).toEqual([]);
    });
  });
});
