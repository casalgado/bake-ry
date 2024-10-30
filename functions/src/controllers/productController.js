const productService = require("../services/productService");
const { ValidationError } = require("../utils/errors");

const productController = {
  async createProduct(req, res) {
    try {
      const { bakeryId } = req.params;
      const productData = req.body;

      const validationErrors = validateProductData(productData);
      if (validationErrors.length > 0) {
        throw new ValidationError(validationErrors.join(", "));
      }

      const newProduct = await productService.createProduct(
        bakeryId,
        productData
      );
      res.status(201).json(newProduct);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(400).json({ error: error.message });
    }
  },

  async getProduct(req, res) {
    try {
      const { bakeryId, id } = req.params;
      const product = await productService.getProductById(bakeryId, id);
      if (product) {
        res.json(product);
      } else {
        res.status(404).json({ error: "Product not found" });
      }
    } catch (error) {
      console.error("Error getting product:", error);
      res.status(500).json({ error: error.message });
    }
  },

  async getProducts(req, res) {
    try {
      const { bakeryId } = req.params;
      const { category, name } = req.query;

      // If search parameters are provided, use search function
      if (category || name) {
        const products = await productService.searchProducts(bakeryId, {
          category,
          name,
        });
        return res.json(products);
      }

      // Otherwise, get all products
      const products = await productService.getProductsByBakery(bakeryId);
      res.json(products);
    } catch (error) {
      console.error("Error getting products:", error);
      res.status(500).json({ error: error.message });
    }
  },

  async updateProduct(req, res) {
    try {
      const { bakeryId, id } = req.params;
      const productData = req.body;

      const validationErrors = validateProductData(productData);
      if (validationErrors.length > 0) {
        throw new ValidationError(validationErrors.join(", "));
      }

      const updatedProduct = await productService.updateProduct(
        bakeryId,
        id,
        productData
      );
      if (updatedProduct) {
        res.json(updatedProduct);
      } else {
        res.status(404).json({ error: "Product not found" });
      }
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(400).json({ error: error.message });
    }
  },

  async deleteProduct(req, res) {
    try {
      const { bakeryId, id } = req.params;
      await productService.deleteProduct(bakeryId, id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: error.message });
    }
  },
};

// Validation helper function
function validateProductData(productData) {
  const errors = [];
  const requiredFields = ["name", "category", "basePrice", "recipeId"];

  // Check required fields
  requiredFields.forEach((field) => {
    if (!productData[field]) {
      errors.push(`${field} is required`);
    }
  });

  // Validate prices are positive numbers
  if (productData.basePrice && productData.basePrice <= 0) {
    errors.push("basePrice must be greater than 0");
  }

  return errors;
}

module.exports = productController;

module.exports = productController;
