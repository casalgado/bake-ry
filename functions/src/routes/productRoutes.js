const express = require('express');
const productController = require('../controllers/productController');
const {
  authenticateUser,
  requireBakeryStaffOrAdmin,
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
bakeryRouter.post('/products', requireBakeryStaffOrAdmin, productController.create);
bakeryRouter.put('/products/:id', requireBakeryStaffOrAdmin, productController.update);
bakeryRouter.delete('/products/:id', requireBakeryStaffOrAdmin, productController.remove);

router.use('/:bakeryId', bakeryRouter);

module.exports = router;
