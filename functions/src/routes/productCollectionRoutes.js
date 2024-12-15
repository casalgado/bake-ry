const express = require('express');
const productCollectionController = require('../controllers/productCollectionController');
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
bakeryRouter.post('/productCollections', productCollectionController.create);
bakeryRouter.get('/productCollections', productCollectionController.getAll);
bakeryRouter.get('/productCollections/:id', productCollectionController.getById);
bakeryRouter.patch('/productCollections/:id', productCollectionController.patch);
bakeryRouter.put('/productCollections/:id', productCollectionController.update);
bakeryRouter.delete('/productCollections/:id', productCollectionController.remove);

// Mount the bakery router
router.use('/:bakeryId', bakeryRouter);

module.exports = router;
