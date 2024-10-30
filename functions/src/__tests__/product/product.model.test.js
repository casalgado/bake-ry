const { Product, ProductVariation } = require("../../models/Product");

describe("Product Model", () => {
  describe("ProductVariation", () => {
    describe("Constructor", () => {
      it("should create a variation with provided values", () => {
        const variation = new ProductVariation({
          name: "Small Size",
          size: "Small",
          weight: 100,
          basePrice: 10,
          recipeMultiplier: 1,
        });

        expect(variation.id).toMatch(/^var_\d{4}_\d{3}$/);
        expect(variation.name).toBe("Small Size");
        expect(variation.size).toBe("Small");
        expect(variation.weight).toBe(100);
        expect(variation.basePrice).toBe(10);
        expect(variation.currentPrice).toBe(10);
        expect(variation.recipeMultiplier).toBe(1);
      });

      it("should use provided ID if available", () => {
        const variation = new ProductVariation({
          id: "var_test_123",
          name: "Small Size",
          size: "Small",
          basePrice: 10,
        });

        expect(variation.id).toBe("var_test_123");
      });

      it("should set currentPrice to basePrice if not provided", () => {
        const variation = new ProductVariation({
          name: "Small Size",
          size: "Small",
          basePrice: 10,
        });

        expect(variation.currentPrice).toBe(variation.basePrice);
      });
    });

    describe("Price Management", () => {
      let variation;

      beforeEach(() => {
        variation = new ProductVariation({
          name: "Small Size",
          size: "Small",
          basePrice: 100,
          recipeMultiplier: 1,
        });
      });

      it("should apply discount correctly", () => {
        variation.applyDiscount(20); // 20% discount
        expect(variation.currentPrice).toBe(80);
      });

      it("should throw error for invalid discount percentage", () => {
        expect(() => variation.applyDiscount(-10)).toThrow();
        expect(() => variation.applyDiscount(110)).toThrow();
      });

      it("should reset price to base price", () => {
        variation.applyDiscount(20);
        variation.resetPrice();
        expect(variation.currentPrice).toBe(variation.basePrice);
      });
    });

    describe("Data Conversion", () => {
      it("should convert to plain object correctly", () => {
        const variation = new ProductVariation({
          id: "var_test_123",
          name: "Small Size",
          size: "Small",
          weight: 100,
          basePrice: 10,
          currentPrice: 8,
          recipeMultiplier: 1,
        });

        const plainObject = variation.toPlainObject();

        expect(plainObject).toEqual({
          id: "var_test_123",
          name: "Small Size",
          size: "Small",
          weight: 100,
          basePrice: 10,
          currentPrice: 8,
          recipeMultiplier: 1,
        });
      });

      it("should remove undefined values when converting to plain object", () => {
        const variation = new ProductVariation({
          name: "Small Size",
          size: "Small",
          basePrice: 10,
          weight: undefined,
        });

        const plainObject = variation.toPlainObject();

        expect(plainObject.weight).toBeUndefined();
      });
    });
  });

  describe("Product", () => {
    describe("Constructor", () => {
      it("should create a product with basic information", () => {
        const product = new Product({
          name: "Test Product",
          category: "Test Category",
          type: "Fabricado",
          recipeId: "recipe123",
        });

        expect(product.name).toBe("Test Product");
        expect(product.category).toBe("Test Category");
        expect(product.type).toBe("Fabricado");
        expect(product.recipeId).toBe("recipe123");
        expect(product.isActive).toBe(true);
        expect(product.variations).toEqual([]);
      });

      it("should set default values correctly", () => {
        const product = new Product({
          name: "Test Product",
        });

        expect(product.isActive).toBe(true);
        expect(product.isSeasonalItem).toBe(false);
        expect(product.recipeMultiplier).toBe(1);
        expect(product.variations).toEqual([]);
        expect(product.customAttributes).toEqual({});
        expect(product.createdAt).toBeInstanceOf(Date);
        expect(product.updatedAt).toBeInstanceOf(Date);
      });
    });

    describe("Variation Management", () => {
      let product;
      let variationId;

      beforeEach(() => {
        product = new Product({
          name: "Test Product",
          category: "Test Category",
          variations: [
            {
              name: "Small Size",
              size: "Small",
              basePrice: 10,
              recipeMultiplier: 1,
            },
          ],
        });
        variationId = product.variations[0].id;
      });

      it("should convert variations to ProductVariation instances", () => {
        expect(product.variations[0]).toBeInstanceOf(ProductVariation);
      });

      it("should add a new variation", () => {
        const newVariation = product.addVariation({
          name: "Medium Size",
          size: "Medium",
          basePrice: 15,
          recipeMultiplier: 1.5,
        });

        expect(product.variations).toHaveLength(2);
        expect(newVariation).toBeInstanceOf(ProductVariation);
        expect(newVariation.size).toBe("Medium");
      });

      it("should get variation by id", () => {
        const variation = product.getVariation(variationId);

        expect(variation).toBeInstanceOf(ProductVariation);
        expect(variation.id).toBe(variationId);
      });

      it("should update variation by id", () => {
        const updated = product.updateVariation(variationId, { basePrice: 12 });

        expect(updated).toBe(true);
        expect(product.getVariation(variationId).basePrice).toBe(12);
      });

      it("should return false when updating non-existent variation", () => {
        const updated = product.updateVariation("non-existent-id", {
          basePrice: 12,
        });
        expect(updated).toBe(false);
      });

      it("should remove variation by id", () => {
        const removed = product.removeVariation(variationId);

        expect(removed).toBe(true);
        expect(product.variations).toHaveLength(0);
      });

      it("should return false when removing non-existent variation", () => {
        const removed = product.removeVariation("non-existent-id");
        expect(removed).toBe(false);
      });
    });

    describe("Firestore Conversion", () => {
      it("should convert to Firestore format correctly", () => {
        const product = new Product({
          name: "Test Product",
          category: "Test Category",
          variations: [
            {
              name: "Small Size",
              size: "Small",
              basePrice: 10,
              recipeMultiplier: 1,
            },
          ],
        });

        const firestoreData = product.toFirestore();

        expect(firestoreData.id).toBeUndefined();
        expect(firestoreData.variations[0]).not.toBeInstanceOf(
          ProductVariation
        );
        expect(firestoreData.createdAt).toBeInstanceOf(Date);
        expect(firestoreData.name).toBe("Test Product");
      });

      it("should convert from Firestore format correctly", () => {
        // Mock Firestore Timestamp
        const mockTimestamp = {
          toDate: () => new Date("2024-01-01"),
        };

        const firestoreDoc = {
          id: "test123",
          data: () => ({
            name: "Test Product",
            category: "Test Category",
            variations: [
              {
                name: "Small Size",
                size: "Small",
                basePrice: 10,
                recipeMultiplier: 1,
              },
            ],
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
            seasonalPeriod: {
              start: mockTimestamp,
              end: mockTimestamp,
            },
          }),
        };

        const product = Product.fromFirestore(firestoreDoc);

        expect(product.id).toBe("test123");
        expect(product.variations[0]).toBeInstanceOf(ProductVariation);
        expect(product.seasonalPeriod.start).toBeInstanceOf(Date);
        expect(product.name).toBe("Test Product");
      });
    });

    describe("Utility Methods", () => {
      it("should check if product needs restock", () => {
        const product = new Product({
          name: "Test Product",
          currentStock: 5,
          restockThreshold: 10,
        });

        expect(product.needsRestock()).toBe(true);
      });
    });
  });
});
