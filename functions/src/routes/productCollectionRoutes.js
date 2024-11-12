const express = require('express');
const ProductCollectionController = require('../controllers/ProductCollectionController');
const ProductCollectionService = require('../services/ProductCollectionService');
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

const controller = new ProductCollectionController(new ProductCollectionService());
const productCollectionController = bindController(controller);

const router = express.Router({ mergeParams: true });

// Apply authentication to all routes
router.use(authenticateUser);

// Create a sub-router for bakery-specific routes
const bakeryRouter = express.Router({ mergeParams: true });

// Apply bakery access middleware to the sub-router
bakeryRouter.use(hasBakeryAccess);
bakeryRouter.use(requireBakeryStaffOrAdmin);

// CRUD routes
bakeryRouter.post('/productCollections', productCollectionController.create);
bakeryRouter.get('/productCollections', productCollectionController.getAll);
bakeryRouter.get('/productCollections/:id', productCollectionController.getById);
bakeryRouter.patch('/productCollections/:id', productCollectionController.patch);
bakeryRouter.put('/productCollections/:id', productCollectionController.update);
bakeryRouter.delete('/productCollections/:id', productCollectionController.delete);

// Mount the bakery router
router.use('/:bakeryId', bakeryRouter);

module.exports = router;
