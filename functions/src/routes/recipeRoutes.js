const express = require('express');
const RecipeController = require('../controllers/recipeController');
const recipeService = require('../services/RecipeService');
const {
  authenticateUser,
  requireBakeryStaffOrAdmin,
} = require('../middleware/userAccess');
const hasBakeryAccess = require('../middleware/bakeryAccess');

const bindController = (controller) => ({
  create: controller.create.bind(controller),
  getById: controller.getById.bind(controller),
  getAll: controller.getAll.bind(controller),
  update: controller.update.bind(controller),
  patch: controller.patch.bind(controller),
  delete: controller.delete.bind(controller),
});

const controller = new RecipeController(recipeService);
const recipeController = bindController(controller);

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateUser);

// Create a sub-router for bakery-specific routes
const bakeryRouter = express.Router({ mergeParams: true });

// Apply bakery access middleware to the sub-router
bakeryRouter.use(hasBakeryAccess);
bakeryRouter.use(requireBakeryStaffOrAdmin);

// CRUD routes
bakeryRouter.post('/recipes', recipeController.create);
bakeryRouter.get('/recipes', recipeController.getAll);
bakeryRouter.get('/recipes/:id', recipeController.getById);
bakeryRouter.patch('/recipes/:id', recipeController.patch);
bakeryRouter.put('/recipes/:id', recipeController.update);
bakeryRouter.delete('/recipes/:id', recipeController.delete);

// Mount the bakery router
router.use('/:bakeryId', bakeryRouter);

module.exports = router;
