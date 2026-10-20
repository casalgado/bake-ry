const express = require('express');
const einvoiceController = require('../controllers/einvoiceController');
const { authenticateUser, requireBakeryStaffOrAdmin } = require('../middleware/userAccess');
const hasBakeryAccess = require('../middleware/bakeryAccess');

const router = express.Router({ mergeParams: true });

router.use(authenticateUser);

const bakeryRouter = express.Router({ mergeParams: true });

bakeryRouter.use(hasBakeryAccess);

// DIAN electronic invoices: admin and staff only.
bakeryRouter.get('/einvoices', requireBakeryStaffOrAdmin, einvoiceController.getAll);
bakeryRouter.get('/einvoices/:id', requireBakeryStaffOrAdmin, einvoiceController.getById);
bakeryRouter.post('/orders/:orderId/einvoice', requireBakeryStaffOrAdmin, einvoiceController.issueAndSend);
bakeryRouter.post('/orders/:orderId/einvoice/status', requireBakeryStaffOrAdmin, einvoiceController.checkStatus);

router.use('/:bakeryId', bakeryRouter);

module.exports = router;
