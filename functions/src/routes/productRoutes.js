const express = require("express");
const {
  authenticateUser,
  requireStaffOrAdmin,
} = require("../middleware/userAccess");
const bakeryAccess = require("../middleware/bakeryAccess");
const productController = require("../controllers/productController");

const router = express.Router();

// All routes require authentication
router.use(authenticateUser);

// Get all products for a bakery
router.get(
  "/bakeries/:bakeryId/products",
  bakeryAccess,
  productController.getProducts
);

// Get a specific product
router.get(
  "/bakeries/:bakeryId/products/:id",
  bakeryAccess,
  productController.getProduct
);

// Create a new product (requires staff or admin)
router.post(
  "/bakeries/:bakeryId/products",
  bakeryAccess,
  requireStaffOrAdmin,
  productController.createProduct
);

// Update a product (requires staff or admin)
router.patch(
  "/bakeries/:bakeryId/products/:id",
  bakeryAccess,
  requireStaffOrAdmin,
  productController.updateProduct
);

// Delete a product (system admin only)
router.delete(
  "/bakeries/:bakeryId/products/:id",
  bakeryAccess,
  requireStaffOrAdmin,
  productController.deleteProduct
);

module.exports = router;
