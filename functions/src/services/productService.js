const { db } = require("../config/firebase");
const Product = require("../models/Product");

const productService = {
  getProductsCollection(bakeryId) {
    return db.collection("bakeries").doc(bakeryId).collection("products");
  },

  async createProduct(bakeryId, productData) {
    try {
      // Validate required fields
      const requiredFields = ["name", "category", "basePrice", "currentPrice"];
      const missingFields = requiredFields.filter(
        (field) => !productData[field]
      );

      if (missingFields.length > 0) {
        throw new Error("Required fields missing");
      }

      // Create new product with bakeryId
      const newProduct = new Product({
        ...productData,
        bakeryId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Add to Firestore
      const productsRef = this.getProductsCollection(bakeryId);
      const docRef = await productsRef.add(newProduct.toFirestore());
      newProduct.id = docRef.id;

      return newProduct;
    } catch (error) {
      console.error("Error in createProduct:", error);
      throw error;
    }
  },

  async getProductById(bakeryId, productId) {
    try {
      const productDoc = await this.getProductsCollection(bakeryId)
        .doc(productId)
        .get();

      if (!productDoc.exists) {
        return null;
      }

      const product = Product.fromFirestore(productDoc);
      product.bakeryId = bakeryId;

      return product;
    } catch (error) {
      console.error("Error in getProductById:", error);
      throw error;
    }
  },

  async getProductsByBakery(bakeryId) {
    try {
      const snapshot = await this.getProductsCollection(bakeryId).get();

      return snapshot.docs.map((doc) => {
        const product = Product.fromFirestore(doc);
        product.bakeryId = bakeryId;
        return product;
      });
    } catch (error) {
      console.error("Error in getProductsByBakery:", error);
      throw error;
    }
  },

  async updateProduct(bakeryId, productId, productData) {
    try {
      const productRef = this.getProductsCollection(bakeryId).doc(productId);
      const productDoc = await productRef.get();

      if (!productDoc.exists) {
        throw new Error("Product not found");
      }

      const updatedProduct = new Product({
        ...Product.fromFirestore(productDoc),
        ...productData,
        id: productId,
        bakeryId,
        updatedAt: new Date(),
      });

      await productRef.update(updatedProduct.toFirestore());
      return updatedProduct;
    } catch (error) {
      console.error("Error in updateProduct:", error);
      throw error;
    }
  },

  async deleteProduct(bakeryId, productId) {
    try {
      const productRef = this.getProductsCollection(bakeryId).doc(productId);
      const productDoc = await productRef.get();

      if (!productDoc.exists) {
        throw new Error("Product not found");
      }

      await productRef.delete();
    } catch (error) {
      console.error("Error in deleteProduct:", error);
      throw error;
    }
  },

  async searchProducts(bakeryId, searchParams) {
    try {
      let query = this.getProductsCollection(bakeryId);

      if (searchParams.category) {
        query = query.where("category", "==", searchParams.category);
      }

      if (searchParams.name) {
        query = query
          .where("name", ">=", searchParams.name)
          .where("name", "<=", searchParams.name + "\uf8ff");
      }

      const snapshot = await query.get();

      return snapshot.docs.map((doc) => {
        const product = Product.fromFirestore(doc);
        product.bakeryId = bakeryId;
        return product;
      });
    } catch (error) {
      console.error("Error in searchProducts:", error);
      throw error;
    }
  },
};

module.exports = productService;
