const express = require('express');
const bakeryUserController = require('../controllers/bakeryUserController');
const {
  authenticateUser,
  requireBakeryAdmin,
} = require('../middleware/userAccess');
const hasBakeryAccess = require('../middleware/bakeryAccess');

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
bakeryRouter.delete('/users/:id', bakeryUserController.remove);

// Mount the bakery router
router.use('/:bakeryId', bakeryRouter);

module.exports = router;
