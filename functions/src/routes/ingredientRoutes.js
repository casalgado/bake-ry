const express = require("express");
const ingredientController = require("../controllers/ingredientController");
const {
  authenticateUser,
  requireBakeryStaffOrAdmin,
} = require("../middleware/userAccess");
const hasBakeryAccess = require("../middleware/bakeryAccess");

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateUser);

// Create a sub-router for bakery-specific routes
const bakeryRouter = express.Router({ mergeParams: true }); // Add mergeParams: true

// Apply bakery access middleware to the sub-router
bakeryRouter.use(hasBakeryAccess);
bakeryRouter.use(requireBakeryStaffOrAdmin);

// CRUD routes
bakeryRouter.post("/ingredients", ingredientController.createIngredient);
bakeryRouter.get("/ingredients", ingredientController.getAllIngredients);
bakeryRouter.get(
  "/ingredients/:ingredientId",
  ingredientController.getIngredient
);
bakeryRouter.patch(
  "/ingredients/:ingredientId",
  ingredientController.updateIngredient
);
bakeryRouter.delete(
  "/ingredients/:ingredientId",
  ingredientController.deleteIngredient
);
bakeryRouter.patch(
  "/ingredients/:ingredientId/stock",
  ingredientController.updateStock
);

// Mount the bakery router
router.use("/:bakeryId", bakeryRouter);

module.exports = router;
