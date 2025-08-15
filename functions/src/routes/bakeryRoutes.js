// routes/bakeryRoutes.js
const express = require('express');
const bakeryController = require('../controllers/bakeryController');
const {
  authenticateUser,
  requireSystemAdmin,
  requireBakeryAdmin,
} = require('../middleware/userAccess');
const hasBakeryAccess = require('../middleware/bakeryAccess');

const mapBakeryIdToId = (req, res, next) => {
  if (req.params.bakeryId) {
    req.params.id = req.params.bakeryId;
  }
  next();
};

const router = express.Router();

// Public route for bakery creation (no authentication required)
router.post('/', bakeryController.create);

// Apply authentication to all other routes
router.use(authenticateUser);

// System admin routes
router.get('/', requireSystemAdmin, mapBakeryIdToId, bakeryController.getAll);
router.delete('/:bakeryId', requireSystemAdmin, mapBakeryIdToId, bakeryController.remove);
router.patch(
  '/:bakeryId',
  requireBakeryAdmin,
  hasBakeryAccess,
  mapBakeryIdToId,
  bakeryController.patch,
);
router.put(
  '/:bakeryId',
  requireBakeryAdmin,
  hasBakeryAccess,
  mapBakeryIdToId,
  bakeryController.update,
);

// General access routes (with bakery access check)
router.get('/:bakeryId', hasBakeryAccess, mapBakeryIdToId, bakeryController.getById);

module.exports = router;
