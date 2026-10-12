const express = require('express');
const productionRunController = require('../controllers/productionRunController');
const {
  authenticateUser,
  requireBakeryAssistant,
  requireBakeryProduction,
  requireBakeryStaffOrAdmin,
} = require('../middleware/userAccess');
const hasBakeryAccess = require('../middleware/bakeryAccess');

const router = express.Router({ mergeParams: true });

router.use(authenticateUser);

const bakeryRouter = express.Router({ mergeParams: true });

bakeryRouter.use(hasBakeryAccess);

// The counter sends; the kitchen receives. Receive, undo, cancel and edit move
// stock, so they are for the kitchen (production assistants) and staff/admin;
// any assistant may read.
bakeryRouter.get('/productionRuns', requireBakeryAssistant, productionRunController.getAll);
bakeryRouter.post('/productionRuns/preview', requireBakeryStaffOrAdmin, productionRunController.preview);
bakeryRouter.get('/productionRuns/:id', requireBakeryAssistant, productionRunController.getById);
bakeryRouter.post('/productionRuns', requireBakeryStaffOrAdmin, productionRunController.create);
bakeryRouter.post(
  '/productionRuns/:id/lines/:lineId/receive',
  requireBakeryProduction,
  productionRunController.receiveLine,
);
bakeryRouter.post(
  '/productionRuns/:id/lines/:lineId/undo',
  requireBakeryProduction,
  productionRunController.undoLine,
);
bakeryRouter.post(
  '/productionRuns/:id/lines/:lineId/cancel',
  requireBakeryProduction,
  productionRunController.cancelLine,
);
bakeryRouter.patch(
  '/productionRuns/:id/lines/:lineId',
  requireBakeryProduction,
  productionRunController.updateLine,
);

router.use('/:bakeryId', bakeryRouter);

module.exports = router;
