const express = require('express');
const ingredientController = require('../controllers/IngredientController');
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
bakeryRouter.post('/ingredients', ingredientController.create);
bakeryRouter.get('/ingredients', ingredientController.getAll);
bakeryRouter.get('/ingredients/:id', ingredientController.getById);
bakeryRouter.patch('/ingredients/:id', ingredientController.patch);
bakeryRouter.put('/ingredients/:id', ingredientController.update);
bakeryRouter.delete('/ingredients/:id', ingredientController.delete);

// Mount the bakery router
router.use('/:bakeryId', bakeryRouter);

module.exports = router;
