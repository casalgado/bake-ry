const express = require("express");
const bakeryController = require("../controllers/bakeryController");
const {
  authenticateUser,
  requireSystemAdmin,
  requireBakeryAdmin,
} = require("../middleware/userAccess");
const hasBakeryAccess = require("../middleware/bakeryAccess");

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateUser);

// System admin routes
router.get("/", requireSystemAdmin, bakeryController.getAllBakeries);
router.delete("/:id", requireSystemAdmin, bakeryController.deleteBakery);

// Bakery admin routes
router.post("/", requireBakeryAdmin, bakeryController.createBakery);
router.patch(
  "/:id",
  requireBakeryAdmin,
  hasBakeryAccess,
  bakeryController.updateBakery
);

// General access routes (with bakery access check)
router.get("/:id", hasBakeryAccess, bakeryController.getBakery);

module.exports = router;
