const express = require('express');
const BakeryController = require('../controllers/BakeryController');
const bakeryService = require('../services/BakeryService');
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

const bindController = (controller) => ({
  create: controller.create.bind(controller),
  getById: controller.getById.bind(controller),
  getAll: controller.getAll.bind(controller),
  update: controller.update.bind(controller),
  patch: controller.patch.bind(controller),
  delete: controller.delete.bind(controller),
});

const controller = new BakeryController(bakeryService);
const bakeryController = bindController(controller);

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateUser);

// System admin routes
router.get('/', requireSystemAdmin, mapBakeryIdToId, bakeryController.getAll);
router.delete('/:bakeryId', requireSystemAdmin, mapBakeryIdToId, bakeryController.delete);

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
