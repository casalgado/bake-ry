const productController = require("../../controllers/productController");
const productService = require("../../services/productService");

// Mock the product service
jest.mock("../../services/productService");

describe("Product Controller", () => {
  let mockRequest;
  let mockResponse;
  let mockNext;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock request object
    mockRequest = {
      params: {},
      body: {},
      query: {},
    };

    // Mock response object
    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    // Mock next function
    mockNext = jest.fn();
  });

  describe("createProduct", () => {
    const mockProduct = {
      id: "product123",
      name: "Chocolate Cake",
      category: "Cakes",
      basePrice: 29.99,
    };

    it("should create a new product successfully", async () => {
      // Arrange
      mockRequest.params = { bakeryId: "bakery123" };
      mockRequest.body = mockProduct;
      productService.createProduct.mockResolvedValue(mockProduct);

      // Act
      await productController.createProduct(mockRequest, mockResponse);

      // Assert
      expect(productService.createProduct).toHaveBeenCalledWith(
        "bakery123",
        mockProduct
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockProduct);
    });

    it("should handle errors during product creation", async () => {
      // Arrange
      const error = new Error("Validation failed");
      mockRequest.params = { bakeryId: "bakery123" };
      mockRequest.body = mockProduct;
      productService.createProduct.mockRejectedValue(error);

      // Act
      await productController.createProduct(mockRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Validation failed",
      });
    });
  });

  describe("getProduct", () => {
    const mockProduct = {
      id: "product123",
      name: "Chocolate Cake",
    };

    it("should retrieve a product successfully", async () => {
      // Arrange
      mockRequest.params = { bakeryId: "bakery123", id: "product123" };
      productService.getProductById.mockResolvedValue(mockProduct);

      // Act
      await productController.getProduct(mockRequest, mockResponse);

      // Assert
      expect(productService.getProductById).toHaveBeenCalledWith(
        "bakery123",
        "product123"
      );
      expect(mockResponse.json).toHaveBeenCalledWith(mockProduct);
    });

    it("should return 404 when product is not found", async () => {
      // Arrange
      mockRequest.params = { bakeryId: "bakery123", id: "nonexistent" };
      productService.getProductById.mockResolvedValue(null);

      // Act
      await productController.getProduct(mockRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Product not found",
      });
    });

    it("should handle server errors", async () => {
      // Arrange
      mockRequest.params = { bakeryId: "bakery123", id: "product123" };
      productService.getProductById.mockRejectedValue(
        new Error("Server error")
      );

      // Act
      await productController.getProduct(mockRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Server error",
      });
    });
  });

  describe("getProducts", () => {
    const mockProducts = [
      { id: "product1", name: "Chocolate Cake" },
      { id: "product2", name: "Vanilla Cake" },
    ];

    it("should retrieve all products for a bakery", async () => {
      // Arrange
      mockRequest.params = { bakeryId: "bakery123" };
      productService.getProductsByBakery.mockResolvedValue(mockProducts);

      // Act
      await productController.getProducts(mockRequest, mockResponse);

      // Assert
      expect(productService.getProductsByBakery).toHaveBeenCalledWith(
        "bakery123"
      );
      expect(mockResponse.json).toHaveBeenCalledWith(mockProducts);
    });

    it("should search products with filters", async () => {
      // Arrange
      mockRequest.params = { bakeryId: "bakery123" };
      mockRequest.query = { category: "Cakes", name: "Chocolate" };
      productService.searchProducts.mockResolvedValue(mockProducts);

      // Act
      await productController.getProducts(mockRequest, mockResponse);

      // Assert
      expect(productService.searchProducts).toHaveBeenCalledWith("bakery123", {
        category: "Cakes",
        name: "Chocolate",
      });
      expect(mockResponse.json).toHaveBeenCalledWith(mockProducts);
    });

    it("should handle errors during product retrieval", async () => {
      // Arrange
      mockRequest.params = { bakeryId: "bakery123" };
      productService.getProductsByBakery.mockRejectedValue(
        new Error("Database error")
      );

      // Act
      await productController.getProducts(mockRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Database error",
      });
    });
  });

  describe("updateProduct", () => {
    const mockProduct = {
      id: "product123",
      name: "Updated Chocolate Cake",
    };

    it("should update a product successfully", async () => {
      // Arrange
      mockRequest.params = { bakeryId: "bakery123", id: "product123" };
      mockRequest.body = mockProduct;
      productService.updateProduct.mockResolvedValue(mockProduct);

      // Act
      await productController.updateProduct(mockRequest, mockResponse);

      // Assert
      expect(productService.updateProduct).toHaveBeenCalledWith(
        "bakery123",
        "product123",
        mockProduct
      );
      expect(mockResponse.json).toHaveBeenCalledWith(mockProduct);
    });

    it("should return 404 when updating non-existent product", async () => {
      // Arrange
      mockRequest.params = { bakeryId: "bakery123", id: "nonexistent" };
      mockRequest.body = mockProduct;
      productService.updateProduct.mockResolvedValue(null);

      // Act
      await productController.updateProduct(mockRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Product not found",
      });
    });
  });

  describe("deleteProduct", () => {
    it("should delete a product successfully", async () => {
      // Arrange
      mockRequest.params = { bakeryId: "bakery123", id: "product123" };
      productService.deleteProduct.mockResolvedValue();

      // Act
      await productController.deleteProduct(mockRequest, mockResponse);

      // Assert
      expect(productService.deleteProduct).toHaveBeenCalledWith(
        "bakery123",
        "product123"
      );
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it("should handle errors during product deletion", async () => {
      // Arrange
      mockRequest.params = { bakeryId: "bakery123", id: "product123" };
      productService.deleteProduct.mockRejectedValue(
        new Error("Deletion failed")
      );

      // Act
      await productController.deleteProduct(mockRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Deletion failed",
      });
    });
  });
});
