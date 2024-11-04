const express = require('express');
const IngredientController = require('../controllers/IngredientController');
const ingredientService = require('../services/IngredientService');
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

const controller = new IngredientController(ingredientService);
const ingredientController = bindController(controller);

const router = express.Router({ mergeParams: true });
// Apply authentication to all routes
router.use(authenticateUser);
// Create a sub-router for bakery-specific routes
const bakeryRouter = express.Router({ mergeParams: true }); // Add mergeParams: true
// Apply bakery access middleware to the sub-router
bakeryRouter.use(hasBakeryAccess);
bakeryRouter.use(requireBakeryStaffOrAdmin);

// CRUD routes
bakeryRouter.post('/ingredients', ingredientController.create);
bakeryRouter.get('/ingredients', ingredientController.getAll);
bakeryRouter.get(
  '/ingredients/:id',
  ingredientController.getById,
);
bakeryRouter.patch(
  '/ingredients/:id',
  ingredientController.patch,
);
bakeryRouter.put('/ingredients/:id', ingredientController.update);
bakeryRouter.delete(
  '/ingredients/:id',
  ingredientController.delete,
);

// Mount the bakery router
router.use('/:bakeryId', bakeryRouter);

module.exports = router;
