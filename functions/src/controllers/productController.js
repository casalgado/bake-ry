const createBaseController = require('./base/controllerFactory');
const productService = require('../services/productService');

const validateProductData = (productData) => {
  const errors = [];
  if (!productData.name) errors.push('Product name is required');
  if (!productData.collection) errors.push('Product collection is required');
  return errors;
};

const productController = createBaseController(productService, validateProductData);

module.exports = productController;
