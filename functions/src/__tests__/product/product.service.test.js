const { db } = require("../../config/firebase");
const productService = require("../../services/productService");
const Product = require("../../models/Product");

// Mock Firebase
jest.mock("../../config/firebase", () => ({
  db: {
    collection: jest.fn(),
  },
}));

describe("ProductService", () => {
  let mockBakeryCollection;
  let mockProductsCollection;
  let mockDoc;
  let mockAdd;
  let mockGet;
  let mockUpdate;
  let mockDelete;

  beforeEach(() => {
    // Reset all mocks
    mockGet = jest.fn();
    mockAdd = jest.fn();
    mockUpdate = jest.fn();
    mockDelete = jest.fn();

    // Mock for products subcollection
    mockProductsCollection = jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({
        get: mockGet,
        update: mockUpdate,
        delete: mockDelete,
      }),
      add: mockAdd,
      get: mockGet,
      where: jest.fn().mockReturnThis(),
    });

    // Mock for bakery document
    mockDoc = jest.fn().mockReturnValue({
      collection: mockProductsCollection,
    });

    // Mock for bakeries collection
    mockBakeryCollection = jest.fn().mockReturnValue({
      doc: mockDoc,
    });

    // Setup main collection mock
    db.collection.mockImplementation((collectionName) => {
      if (collectionName === "bakeries") {
        return mockBakeryCollection();
      }
      return null;
    });
  });

  describe("createProduct", () => {
    const bakeryId = "bakery123";
    const validProductData = {
      name: "Chocolate Cake",
      description: "Delicious chocolate cake",
      category: "Cakes",
      basePrice: 29.99,
      currentPrice: 29.99,
    };

    it("should create a new product successfully", async () => {
      const docId = "product123";
      mockAdd.mockResolvedValueOnce({ id: docId });

      const result = await productService.createProduct(
        bakeryId,
        validProductData
      );

      expect(result).toBeInstanceOf(Product);
      expect(result.id).toBe(docId);
      expect(result.name).toBe(validProductData.name);
      expect(result.bakeryId).toBe(bakeryId);

      // Verify correct collection path
      expect(db.collection).toHaveBeenCalledWith("bakeries");
      expect(mockDoc).toHaveBeenCalledWith(bakeryId);
      expect(mockProductsCollection).toHaveBeenCalledWith("products");
    });

    it("should throw error if required fields are missing", async () => {
      const invalidData = { name: "Chocolate Cake" };

      await expect(
        productService.createProduct(bakeryId, invalidData)
      ).rejects.toThrow("Required fields missing");
    });
  });

  describe("getProductById", () => {
    const bakeryId = "bakery123";
    const productId = "product123";

    it("should return product if found", async () => {
      const productData = {
        name: "Chocolate Cake",
        category: "Cakes",
        basePrice: 29.99,
      };

      mockGet.mockResolvedValueOnce({
        exists: true,
        id: productId,
        data: () => productData,
      });

      const result = await productService.getProductById(bakeryId, productId);

      expect(result).toBeInstanceOf(Product);
      expect(result.id).toBe(productId);
      expect(result.name).toBe(productData.name);
      expect(result.bakeryId).toBe(bakeryId);
    });

    it("should return null if product not found", async () => {
      mockGet.mockResolvedValueOnce({ exists: false });

      const result = await productService.getProductById(bakeryId, productId);
      expect(result).toBeNull();
    });
  });

  describe("getProductsByBakery", () => {
    const bakeryId = "bakery123";

    it("should return all products for a bakery", async () => {
      const productsData = [
        { id: "product1", name: "Chocolate Cake", category: "Cakes" },
        { id: "product2", name: "Croissant", category: "Pastries" },
      ];

      mockGet.mockResolvedValueOnce({
        docs: productsData.map((product) => ({
          id: product.id,
          data: () => product,
          exists: true,
        })),
      });

      const results = await productService.getProductsByBakery(bakeryId);

      expect(results).toHaveLength(2);
      expect(results[0]).toBeInstanceOf(Product);
      expect(results[1]).toBeInstanceOf(Product);
      expect(results[0].bakeryId).toBe(bakeryId);
      expect(results[1].bakeryId).toBe(bakeryId);
    });

    it("should return empty array if no products found", async () => {
      mockGet.mockResolvedValueOnce({
        docs: [],
      });

      const results = await productService.getProductsByBakery(bakeryId);
      expect(results).toHaveLength(0);
    });
  });

  describe("updateProduct", () => {
    const bakeryId = "bakery123";
    const productId = "product123";

    it("should update product successfully", async () => {
      const updateData = {
        name: "Updated Cake",
        currentPrice: 34.99,
      };

      mockGet.mockResolvedValueOnce({
        exists: true,
        id: productId,
        data: () => ({
          name: "Original Cake",
          currentPrice: 29.99,
          category: "Cakes",
        }),
      });

      const result = await productService.updateProduct(
        bakeryId,
        productId,
        updateData
      );

      expect(result).toBeInstanceOf(Product);
      expect(result.name).toBe(updateData.name);
      expect(result.currentPrice).toBe(updateData.currentPrice);
      expect(result.bakeryId).toBe(bakeryId);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("should throw error if product not found", async () => {
      mockGet.mockResolvedValueOnce({ exists: false });

      await expect(
        productService.updateProduct(bakeryId, productId, {})
      ).rejects.toThrow("Product not found");
    });
  });

  describe("deleteProduct", () => {
    const bakeryId = "bakery123";
    const productId = "product123";

    it("should delete product successfully", async () => {
      mockGet.mockResolvedValueOnce({ exists: true });

      await productService.deleteProduct(bakeryId, productId);

      expect(mockDelete).toHaveBeenCalled();
    });

    it("should throw error if product not found", async () => {
      mockGet.mockResolvedValueOnce({ exists: false });

      await expect(
        productService.deleteProduct(bakeryId, productId)
      ).rejects.toThrow("Product not found");
    });
  });

  describe("searchProducts", () => {
    const bakeryId = "bakery123";

    it("should search products by name and category", async () => {
      const searchParams = {
        name: "cake",
        category: "Desserts",
      };

      const productsData = [
        { id: "product1", name: "Chocolate Cake", category: "Desserts" },
        { id: "product2", name: "Cheese Cake", category: "Desserts" },
      ];

      const mockWhere = jest.fn().mockReturnThis();
      mockProductsCollection.mockReturnValue({
        where: mockWhere,
        get: jest.fn().mockResolvedValueOnce({
          docs: productsData.map((product) => ({
            id: product.id,
            data: () => product,
            exists: true,
          })),
        }),
      });

      const results = await productService.searchProducts(
        bakeryId,
        searchParams
      );

      expect(results).toHaveLength(2);
      expect(results[0]).toBeInstanceOf(Product);
      expect(mockWhere).toHaveBeenCalledWith("category", "==", "Desserts");
    });
  });
});
