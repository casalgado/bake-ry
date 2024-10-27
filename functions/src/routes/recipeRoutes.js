const express = require("express");
const recipeController = require("../controllers/recipeController");
const {
  authenticateUser,
  requireBakeryStaffOrAdmin,
} = require("../middleware/userAccess");
const hasBakeryAccess = require("../middleware/bakeryAccess");

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateUser);

// Create a sub-router for bakery-specific routes
const bakeryRouter = express.Router({ mergeParams: true });

// Apply bakery access middleware to the sub-router
bakeryRouter.use(hasBakeryAccess);
bakeryRouter.use(requireBakeryStaffOrAdmin);

// CRUD routes
bakeryRouter.post("/recipes", recipeController.createRecipe);
bakeryRouter.get("/recipes", recipeController.getAllRecipes);
bakeryRouter.get("/recipes/:recipeId", recipeController.getRecipe);
bakeryRouter.patch("/recipes/:recipeId", recipeController.updateRecipe);
bakeryRouter.delete("/recipes/:recipeId", recipeController.deleteRecipe);

// Recipe scaling (kept separate as it's a specific operation)
bakeryRouter.patch("/recipes/:recipeId/scale", recipeController.scaleRecipe);

// Mount the bakery router
router.use("/:bakeryId", bakeryRouter);

module.exports = router;
