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

// Apply authentication to all routes
router.use(authenticateUser);

// System admin routes
router.get('/', requireSystemAdmin, mapBakeryIdToId, bakeryController.getAll);
router.delete('/:bakeryId', requireSystemAdmin, mapBakeryIdToId, bakeryController.remove);

// Bakery admin routes
router.post('/', requireBakeryAdmin, mapBakeryIdToId, bakeryController.create);
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
