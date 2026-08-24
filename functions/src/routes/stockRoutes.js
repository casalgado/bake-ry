const express = require('express');
const stockController = require('../controllers/stockController');
const {
  authenticateUser,
  requireBakeryAssistant,
  requireBakeryStaffOrAdmin,
} = require('../middleware/userAccess');
const hasBakeryAccess = require('../middleware/bakeryAccess');

const router = express.Router({ mergeParams: true });

router.use(authenticateUser);

const bakeryRouter = express.Router({ mergeParams: true });

bakeryRouter.use(hasBakeryAccess);

// Reading stock is open to any assistant role; moving it by hand is not.
// (§12.2 role access stays open for counts and purchases — this is the
// conservative starting point for adjustments, easy to widen later.)
bakeryRouter.get('/stocks', requireBakeryAssistant, stockController.getAll);
bakeryRouter.get(
  '/stocks/:itemKey/movements',
  requireBakeryAssistant,
  stockController.getMovements,
);
bakeryRouter.get(
  '/stockMovements',
  requireBakeryAssistant,
  stockController.getOrderMovements,
);
bakeryRouter.post(
  '/stocks/:itemKey/adjust',
  requireBakeryStaffOrAdmin,
  stockController.adjust,
);

// No PUT/PATCH/DELETE anywhere in this router: movements are append-only and
// stocks docs are a derived cache. Corrections are adjustments or counts.

router.use('/:bakeryId', bakeryRouter);

module.exports = router;
