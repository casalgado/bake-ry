const express = require('express');
const systemSettingsController = require('../controllers/systemSettingsController');
const {
  authenticateUser,
  requireSystemAdmin,
} = require('../middleware/userAccess');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateUser);

// Apply system admin requirement to all routes
router.use(requireSystemAdmin);

// System settings routes (no CREATE or DELETE - only GET, PATCH, PUT)
router.get('/system-settings', systemSettingsController.getById);
router.patch('/system-settings', systemSettingsController.patch);
router.put('/system-settings', systemSettingsController.update);

module.exports = router;
