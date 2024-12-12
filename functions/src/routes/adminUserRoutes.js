const express = require('express');
const adminController = require('../controllers/adminController');
const {
  authenticateUser,
  requireSystemAdmin,
} = require('../middleware/userAccess');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateUser);

// Apply system admin requirement to all routes
router.use(requireSystemAdmin);

// CRUD routes
router.post('/admin-users', adminController.create);
router.get('/admin-users', adminController.getAll);
router.get('/admin-users/:id', adminController.getById);
router.put('/admin-users/:id', adminController.update);
router.delete('/admin-users/:id', adminController.delete);

module.exports = router;
