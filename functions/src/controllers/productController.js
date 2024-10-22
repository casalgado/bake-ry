const productService = require("../services/productService");

const productController = {
  async getProducts(req, res) {
    try {
      const { bakeryId } = req.params;
      const { category, name } = req.query;

      // If search params are provided, use search function
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
      console.error("Error in getProducts controller:", error);
      res.status(500).json({ error: error.message });
    }
  },

  async getProduct(req, res) {
    try {
      const { bakeryId, id } = req.params;

      const product = await productService.getProductById(bakeryId, id);

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      res.json(product);
    } catch (error) {
      console.error("Error in getProduct controller:", error);
      res.status(500).json({ error: error.message });
    }
  },

  async createProduct(req, res) {
    try {
      const { bakeryId } = req.params;
      const productData = req.body;

      // Create new product
      const newProduct = await productService.createProduct(
        bakeryId,
        productData
      );

      res.status(201).json(newProduct);
    } catch (error) {
      console.error("Error in createProduct controller:", error);

      if (error.message === "Required fields missing") {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: error.message });
    }
  },

  async updateProduct(req, res) {
    try {
      const { bakeryId, id } = req.params;
      const updateData = req.body;

      const updatedProduct = await productService.updateProduct(
        bakeryId,
        id,
        updateData
      );

      res.json(updatedProduct);
    } catch (error) {
      console.error("Error in updateProduct controller:", error);

      if (error.message === "Product not found") {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: error.message });
    }
  },

  async deleteProduct(req, res) {
    try {
      const { bakeryId, id } = req.params;

      await productService.deleteProduct(bakeryId, id);

      res.status(204).send();
    } catch (error) {
      console.error("Error in deleteProduct controller:", error);

      if (error.message === "Product not found") {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = productController;
