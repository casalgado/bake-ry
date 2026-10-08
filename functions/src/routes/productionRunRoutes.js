const express = require('express');
const productionRunController = require('../controllers/productionRunController');
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

// The counter sends; the kitchen receives. Receive/undo/cancel/edit are open to the
// same roles that tick order items producido today (orderRoutes), since both
// sit on one kitchen list.
bakeryRouter.get('/productionRuns', requireBakeryAssistant, productionRunController.getAll);
bakeryRouter.post('/productionRuns/preview', requireBakeryStaffOrAdmin, productionRunController.preview);
bakeryRouter.get('/productionRuns/:id', requireBakeryAssistant, productionRunController.getById);
bakeryRouter.post('/productionRuns', requireBakeryStaffOrAdmin, productionRunController.create);
bakeryRouter.post(
  '/productionRuns/:id/lines/:lineId/receive',
  requireBakeryAssistant,
  productionRunController.receiveLine,
);
bakeryRouter.post(
  '/productionRuns/:id/lines/:lineId/undo',
  requireBakeryAssistant,
  productionRunController.undoLine,
);
bakeryRouter.post(
  '/productionRuns/:id/lines/:lineId/cancel',
  requireBakeryAssistant,
  productionRunController.cancelLine,
);
bakeryRouter.patch(
  '/productionRuns/:id/lines/:lineId',
  requireBakeryAssistant,
  productionRunController.updateLine,
);

router.use('/:bakeryId', bakeryRouter);

module.exports = router;
