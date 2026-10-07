const express = require('express');
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

bakeryRouter.get('/purchases', requireBakeryAssistant, purchaseController.getAll);
bakeryRouter.get('/purchases/:id', requireBakeryAssistant, purchaseController.getById);
bakeryRouter.post('/purchases', requireBakeryStaffOrAdmin, purchaseController.create);

router.use('/:bakeryId', bakeryRouter);

module.exports = router;
