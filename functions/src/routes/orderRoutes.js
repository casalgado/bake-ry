const express = require('express');
const orderController = require('../controllers/orderController');
const {
  authenticateUser,
  requireBakeryStaffOrAdmin,
} = require('../middleware/userAccess');
const hasBakeryAccess = require('../middleware/bakeryAccess');

const router = express.Router({ mergeParams: true });

router.use(authenticateUser);

const bakeryRouter = express.Router({ mergeParams: true });
bakeryRouter.use(hasBakeryAccess);
bakeryRouter.use(requireBakeryStaffOrAdmin);

bakeryRouter.post('/orders', orderController.create);
bakeryRouter.get('/orders', orderController.getAll);
bakeryRouter.get('/orders/:id', orderController.getById);
bakeryRouter.patch('/orders/bulk-update', orderController.patchAll);
bakeryRouter.patch('/orders/:id', orderController.patch);
bakeryRouter.put('/orders/:id', orderController.update);
bakeryRouter.delete('/orders/:id', orderController.delete);

router.use('/:bakeryId', bakeryRouter);

module.exports = router;
