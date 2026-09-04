const express = require('express');
const ingredientController = require('../controllers/ingredientController');
const {
  authenticateUser,
  requireBakeryAssistant,
} = require('../middleware/userAccess');
const hasBakeryAccess = require('../middleware/bakeryAccess');

const router = express.Router({ mergeParams: true });

// Apply authentication to all routes
router.use(authenticateUser);

// Create a sub-router for bakery-specific routes
const bakeryRouter = express.Router({ mergeParams: true });

// Apply bakery access middleware to the sub-router
bakeryRouter.use(hasBakeryAccess);
bakeryRouter.use(requireBakeryAssistant);

// CRUD routes
bakeryRouter.post('/ingredients', ingredientController.create);
bakeryRouter.get('/ingredients', ingredientController.getAll);
bakeryRouter.get('/ingredients/:id/cost-impact', ingredientController.costImpact);
bakeryRouter.get('/ingredients/:id', ingredientController.getById);
// PATCH intentionally not routed: it would hit the generic factory patch,
// which skips ingredientService's cost-propagation transaction. Use PUT.
bakeryRouter.put('/ingredients/:id', ingredientController.update);
bakeryRouter.delete('/ingredients/:id', ingredientController.remove);

// Mount the bakery router
router.use('/:bakeryId', bakeryRouter);

module.exports = router;
