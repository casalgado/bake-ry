const express = require('express');
const recipeController = require('../controllers/recipeController');
const {
  authenticateUser,
  requireBakeryAssistant,
  requireBakeryAdmin,
} = require('../middleware/userAccess');
const hasBakeryAccess = require('../middleware/bakeryAccess');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateUser);

// Create a sub-router for bakery-specific routes
const bakeryRouter = express.Router({ mergeParams: true });

// Apply bakery access middleware to the sub-router
bakeryRouter.use(hasBakeryAccess);
bakeryRouter.use(requireBakeryAssistant);

// On-demand cost reconciliation (admin only).
bakeryRouter.post(
  '/recipes/reconcile-costs',
  requireBakeryAdmin,
  recipeController.reconcileCosts,
);

// CRUD routes
bakeryRouter.post('/recipes', recipeController.create);
bakeryRouter.get('/recipes', recipeController.getAll);
bakeryRouter.get('/recipes/:id', recipeController.getById);
// PATCH intentionally not routed: it would hit the generic factory patch,
// which skips recipeService's guardrails and cost-propagation transaction.
// Use PUT.
bakeryRouter.put('/recipes/:id', recipeController.update);
bakeryRouter.delete('/recipes/:id', recipeController.remove);

// Mount the bakery router
router.use('/:bakeryId', bakeryRouter);

module.exports = router;
