const express = require('express');
const systemSettingsController = require('../controllers/systemSettingsController');
const {
  authenticateUser,
  requireSystemAdmin,
} = require('../middleware/userAccess');

const router = express.Router();

// GET: All authenticated users can read system settings
router.get('/system-settings', authenticateUser, systemSettingsController.getById);

// PATCH/PUT: Only system admins can modify system settings
router.patch('/system-settings', authenticateUser, requireSystemAdmin, systemSettingsController.patch);
router.put('/system-settings', authenticateUser, requireSystemAdmin, systemSettingsController.update);

module.exports = router;
