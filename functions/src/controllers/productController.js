const createBaseController = require('./base/controllerFactory');
const productService = require('../services/productService');

const validateProductData = (productData) => {
  const errors = [];
  if (!productData.name) errors.push('Product name is required');
  return errors;
};

const baseController = createBaseController(productService, validateProductData);

const productController = {
  ...baseController,

  async patchAll(req, res) {
    try {
      const { bakeryId } = req.params;
      const updates = req.body.updates;

      const results = await productService.patchAll(
        bakeryId,
        updates,
        req.user,
      );

      baseController.handleResponse(res, results);
    } catch (error) {
      baseController.handleError(res, error);
    }
  },
};

module.exports = productController;
