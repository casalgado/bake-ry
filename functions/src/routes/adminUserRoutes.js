const express = require('express');
const AdminUserController = require('../controllers/AdminUserController');
const AdminUserService = require('../services/AdminUserService');
const {
  authenticateUser,
  requireSystemAdmin,
} = require('../middleware/userAccess');

const bindController = (controller) => ({
  create: controller.create.bind(controller),
  getById: controller.getById.bind(controller),
  getAll: controller.getAll.bind(controller),
  update: controller.update.bind(controller),
  delete: controller.delete.bind(controller),
});

const controller = new AdminUserController(new AdminUserService());
const adminUserController = bindController(controller);

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateUser);

// Apply system admin requirement to all routes
router.use(requireSystemAdmin);

// CRUD routes
router.post('/admin-users', adminUserController.create);
router.get('/admin-users', adminUserController.getAll);
router.get('/admin-users/:id', adminUserController.getById);
router.put('/admin-users/:id', adminUserController.update);
router.delete('/admin-users/:id', adminUserController.delete);

module.exports = router;
