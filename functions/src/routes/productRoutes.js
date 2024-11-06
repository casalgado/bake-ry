const express = require('express');
const ProductController = require('../controllers/ProductController');
const ProductService = require('../services/ProductService');
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
  delete: controller.delete.bind(controller),
});

const controller = new ProductController(new ProductService());
const productController = bindController(controller);

const router = express.Router({ mergeParams: true });

// Apply authentication to all routes
router.use(authenticateUser);

// Create a sub-router for bakery-specific routes
const bakeryRouter = express.Router({ mergeParams: true });

// Apply bakery access middleware to the sub-router
bakeryRouter.use(hasBakeryAccess);

// CRUD routes
bakeryRouter.get('/products', productController.getAll);
bakeryRouter.get('/products/:id', productController.getById);

// Routes requiring staff or admin access
bakeryRouter.post('/products', requireBakeryStaffOrAdmin, productController.create);
bakeryRouter.put('/products/:id', requireBakeryStaffOrAdmin, productController.update);
bakeryRouter.delete('/products/:id', requireBakeryStaffOrAdmin, productController.delete);

// Mount the bakery router
router.use('/:bakeryId', bakeryRouter);

module.exports = router;
