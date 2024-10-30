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

  // Basic required fields that all products need
  const basicRequiredFields = ["name", "category", "recipeId"];

  // Check basic required fields
  basicRequiredFields.forEach((field) => {
    if (!productData[field]) {
      errors.push(`${field} is required`);
    }
  });

  // Validate based on whether the product has variations
  if (productData.variations && productData.variations.length > 0) {
    // Products with variations should not have a base price
    if (productData.basePrice !== undefined) {
      errors.push(
        "Products with variations should not have a base price. Price should be set per variation"
      );
    }

    // Validate variations
    productData.variations.forEach((variation, index) => {
      // Required fields for each variation
      if (!variation.name) {
        errors.push(`Variation at index ${index} is missing a name`);
      }

      if (variation.basePrice === undefined || variation.basePrice === null) {
        errors.push(
          `Variation "${
            variation.name || `at index ${index}`
          }" is missing a base price`
        );
      } else if (variation.basePrice <= 0) {
        errors.push(
          `Variation "${
            variation.name || `at index ${index}`
          }" must have a base price greater than 0`
        );
      }

      if (!variation.recipeMultiplier) {
        errors.push(
          `Variation "${
            variation.name || `at index ${index}`
          }" must have a recipe multiplier`
        );
      } else if (variation.recipeMultiplier <= 0) {
        errors.push(
          `Variation "${
            variation.name || `at index ${index}`
          }" must have a recipe multiplier greater than 0`
        );
      }
    });
  } else {
    // For products without variations, validate base price
    if (productData.basePrice === undefined || productData.basePrice === null) {
      errors.push("Products without variations must have a base price");
    } else if (productData.basePrice <= 0) {
      errors.push("basePrice must be greater than 0");
    }

    // For products without variations, validate recipe multiplier
    if (!productData.recipeMultiplier) {
      errors.push(
        "Recipe multiplier is required for products without variations"
      );
    } else if (productData.recipeMultiplier <= 0) {
      errors.push("Recipe multiplier must be greater than 0");
    }
  }

  return errors;
}

module.exports = productController;
