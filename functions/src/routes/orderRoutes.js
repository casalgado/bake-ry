const express = require('express');
const OrderController = require('../controllers/OrderController');
const OrderService = require('../services/OrderService');
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
  patchAll: controller.patchAll.bind(controller),
  delete: controller.delete.bind(controller),
});

const controller = new OrderController(new OrderService());
const orderController = bindController(controller);

const router = express.Router({ mergeParams: true });
// Apply authentication to all routes
router.use(authenticateUser);

// Create a sub-router for bakery-specific routes
const bakeryRouter = express.Router({ mergeParams: true });

// Apply bakery access middleware to the sub-router
bakeryRouter.use(hasBakeryAccess);
bakeryRouter.use(requireBakeryStaffOrAdmin);

// CRUD routes
bakeryRouter.post('/orders', orderController.create);
bakeryRouter.get('/orders', orderController.getAll);
bakeryRouter.get('/orders/:id', orderController.getById);
bakeryRouter.patch('/orders/bulk-update', orderController.patchAll);
bakeryRouter.patch('/orders/:id', orderController.patch);
bakeryRouter.put('/orders/:id', orderController.update);
bakeryRouter.delete('/orders/:id', orderController.delete);

// Mount the bakery router
router.use('/:bakeryId', bakeryRouter);

module.exports = router;
