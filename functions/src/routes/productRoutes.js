const express = require('express');
const productController = require('../controllers/productController');
const {
  authenticateUser,
  requireBakeryAssistant,
} = require('../middleware/userAccess');
const hasBakeryAccess = require('../middleware/bakeryAccess');

const router = express.Router({ mergeParams: true });

router.use(authenticateUser);
const bakeryRouter = express.Router({ mergeParams: true });
bakeryRouter.use(hasBakeryAccess);

// Public routes (authenticated but no staff requirement)
bakeryRouter.get('/products', productController.getAll);
bakeryRouter.get('/products/:id', productController.getById);

// Staff/Admin only routes
bakeryRouter.post('/products', requireBakeryAssistant, productController.create);
bakeryRouter.patch('/products/bulk-update', requireBakeryAssistant, productController.patchAll);
bakeryRouter.put('/products/:id', requireBakeryAssistant, productController.update);
bakeryRouter.delete('/products/:id', requireBakeryAssistant, productController.remove);

router.use('/:bakeryId', bakeryRouter);

module.exports = router;
