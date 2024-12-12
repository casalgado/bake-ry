const express = require('express');
const bakerySettingsController = require('../controllers/BakerySettingsController');
const {
  authenticateUser,
  requireBakeryStaffOrAdmin,
} = require('../middleware/userAccess');
const hasBakeryAccess = require('../middleware/bakeryAccess');

const router = express.Router({ mergeParams: true });

// Apply authentication to all routes
router.use(authenticateUser);

// Create a sub-router for bakery-specific routes
const bakeryRouter = express.Router({ mergeParams: true });

// Apply bakery access middleware to the sub-router
bakeryRouter.use(hasBakeryAccess);
bakeryRouter.use(requireBakeryStaffOrAdmin);

// CRUD routes
bakeryRouter.get('/settings/:id', bakerySettingsController.getById);
bakeryRouter.patch('/settings/:id', bakerySettingsController.patch);
bakeryRouter.get('/settings/:id/staff', bakerySettingsController.getStaffList);

// Mount the bakery router
router.use('/:bakeryId', bakeryRouter);

module.exports = router;
