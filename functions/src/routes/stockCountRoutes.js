const express = require('express');
const stockCountController = require('../controllers/stockCountController');
const { authenticateUser, requireBakeryStaffOrAdmin } = require('../middleware/userAccess');
const hasBakeryAccess = require('../middleware/bakeryAccess');

const router = express.Router({ mergeParams: true });

router.use(authenticateUser);

const bakeryRouter = express.Router({ mergeParams: true });

bakeryRouter.use(hasBakeryAccess);

// Counting is a supervisor's job: admin and staff only, for every route.
bakeryRouter.get('/stockCounts', requireBakeryStaffOrAdmin, stockCountController.getAll);
bakeryRouter.get('/stockCounts/:id', requireBakeryStaffOrAdmin, stockCountController.getById);
bakeryRouter.post('/stockCounts', requireBakeryStaffOrAdmin, stockCountController.open);
bakeryRouter.put('/stockCounts/:id/items/:itemKey', requireBakeryStaffOrAdmin, stockCountController.setItem);
bakeryRouter.post('/stockCounts/:id/close', requireBakeryStaffOrAdmin, stockCountController.close);
bakeryRouter.post('/stockCounts/:id/discard', requireBakeryStaffOrAdmin, stockCountController.discard);

router.use('/:bakeryId', bakeryRouter);

module.exports = router;
