const express = require('express');
const BakeryUserController = require('../controllers/BakeryUserController');
const BakeryUserService = require('../services/BakeryUserService');
const {
  authenticateUser,
  requireBakeryAdmin,
} = require('../middleware/userAccess');
const hasBakeryAccess = require('../middleware/bakeryAccess');

const bindController = (controller) => ({
  create: controller.create.bind(controller),
  getById: controller.getById.bind(controller),
  getAll: controller.getAll.bind(controller),
  update: controller.update.bind(controller),
  delete: controller.delete.bind(controller),
});

const controller = new BakeryUserController(new BakeryUserService());
const bakeryUserController = bindController(controller);

const router = express.Router({ mergeParams: true });

// Apply authentication to all routes
router.use(authenticateUser);

// Create a sub-router for bakery-specific routes
const bakeryRouter = express.Router({ mergeParams: true });

// Apply bakery access middleware to the sub-router
bakeryRouter.use(hasBakeryAccess);
bakeryRouter.use(requireBakeryAdmin);

// CRUD routes
bakeryRouter.post('/users', bakeryUserController.create);
bakeryRouter.get('/users', bakeryUserController.getAll);
bakeryRouter.get('/users/:id', bakeryUserController.getById);
bakeryRouter.put('/users/:id', bakeryUserController.update);
bakeryRouter.delete('/users/:id', bakeryUserController.delete);

// Mount the bakery router
router.use('/:bakeryId', bakeryRouter);

module.exports = router;
