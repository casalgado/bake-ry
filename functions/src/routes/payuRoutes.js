const express = require('express');
const payuController = require('../controllers/payuController');
const {
  authenticateUser,
  requireBakeryAdmin,
} = require('../middleware/userAccess');
const hasBakeryAccess = require('../middleware/bakeryAccess');

const router = express.Router({ mergeParams: true });

router.use(authenticateUser);

const bakeryRouter = express.Router({ mergeParams: true });
bakeryRouter.use(hasBakeryAccess);
bakeryRouter.use(requireBakeryAdmin);

// Card management routes
bakeryRouter.post('/payu/cards', payuController.createCard);
bakeryRouter.get('/payu/cards', payuController.getCards);
bakeryRouter.delete('/payu/cards/:cardId', payuController.deleteCard);

// Payment processing routes
bakeryRouter.post('/payu/payments', payuController.processPayment);
bakeryRouter.post('/payu/recurring', payuController.createRecurringPayment);

// Transaction queries
bakeryRouter.get('/payu/:id/status', payuController.getPaymentStatus);

// Standard CRUD operations for payment records
bakeryRouter.post('/payu', payuController.create);
bakeryRouter.get('/payu', payuController.getAll);
bakeryRouter.get('/payu/:id', payuController.getById);
bakeryRouter.patch('/payu/:id', payuController.patch);
bakeryRouter.put('/payu/:id', payuController.update);
bakeryRouter.delete('/payu/:id', payuController.remove);

router.use('/:bakeryId', bakeryRouter);

module.exports = router;
