const express = require("express");
const {
  authenticateUser,
  requireSystemAdmin,
  requireBakeryAdmin,
  requireBakeryStaffOrAdmin,
} = require("../middleware/userAccess");
const hasBakeryAccess = require("../middleware/bakeryAccess");
const productController = require("../controllers/productController");

const router = express.Router();

// All routes
router.use(authenticateUser);
router.use(hasBakeryAccess);

// Get all products for a bakery
router.get("/bakeries/:bakeryId/products", productController.getProducts);

// Get a specific product
router.get("/bakeries/:bakeryId/products/:id", productController.getProduct);

// Create a new product (requires staff or admin)
router.post(
  "/bakeries/:bakeryId/products",
  requireBakeryStaffOrAdmin,
  productController.createProduct
);

// Update a product (requires staff or admin)
router.patch(
  "/bakeries/:bakeryId/products/:id",
  requireBakeryStaffOrAdmin,
  productController.updateProduct
);

// Delete a product (system admin only)
router.delete(
  "/bakeries/:bakeryId/products/:id",
  requireBakeryStaffOrAdmin,
  productController.deleteProduct
);

module.exports = router;
