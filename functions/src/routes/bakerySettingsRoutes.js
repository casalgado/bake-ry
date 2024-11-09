const express = require('express');
const BakerySettingsController = require('../controllers/bakerySettingsController');
const bakerySettingsService = require('../services/bakerySettingsService');
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

const controller = new BakerySettingsController(bakerySettingsService);
const settingsController = bindController(controller);

const router = express.Router({ mergeParams: true });

// Apply authentication to all routes
router.use(authenticateUser);

// Create a sub-router for bakery-specific routes
const bakeryRouter = express.Router({ mergeParams: true });

// Apply bakery access middleware to the sub-router
bakeryRouter.use(hasBakeryAccess);
bakeryRouter.use(requireBakeryStaffOrAdmin);

// CRUD routes
bakeryRouter.get('/settings/:id', settingsController.getById);
bakeryRouter.patch('/settings/:id', settingsController.patch);

// Mount the bakery router
router.use('/:bakeryId', bakeryRouter);

module.exports = router;