const express = require('express');
const providerController = require('../controllers/providerController');
const purchaseController = require('../controllers/purchaseController');
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

bakeryRouter.get('/providers', requireBakeryAssistant, providerController.getAll);
bakeryRouter.get('/providers/:id', requireBakeryAssistant, providerController.getById);
bakeryRouter.post('/providers', requireBakeryStaffOrAdmin, providerController.create);
bakeryRouter.patch('/providers/:id', requireBakeryStaffOrAdmin, providerController.patch);
bakeryRouter.delete('/providers/:id', requireBakeryStaffOrAdmin, providerController.remove);
bakeryRouter.get(
  '/providers/:id/last-purchase',
  requireBakeryAssistant,
  purchaseController.getLastPurchase,
);

router.use('/:bakeryId', bakeryRouter);

module.exports = router;
