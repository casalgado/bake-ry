const express = require('express');
const bakerySettingsController = require('../controllers/bakerySettingsController');
const {
  authenticateUser,
  requireBakeryAssistant,
} = require('../middleware/userAccess');
const hasBakeryAccess = require('../middleware/bakeryAccess');

const router = express.Router({ mergeParams: true });

// Apply authentication to all routes
router.use(authenticateUser);

// Create a sub-router for bakery-specific routes
const bakeryRouter = express.Router({ mergeParams: true });

// Apply bakery access middleware to the sub-router
bakeryRouter.use(hasBakeryAccess);
bakeryRouter.use(requireBakeryAssistant);

// CRUD routes
bakeryRouter.get('/settings/:id', bakerySettingsController.getById);
bakeryRouter.patch('/settings/:id', bakerySettingsController.patch);
bakeryRouter.get('/settings/:id/staff', bakerySettingsController.getStaffList);
bakeryRouter.get('/settings/:id/b2b_clients', bakerySettingsController.getB2bClientsList);

// Mount the bakery router
router.use('/:bakeryId', bakeryRouter);

module.exports = router;
