const createBaseController = require('./base/controllerFactory');
const ProductService = require('../services/ProductService');

const validateProductData = (productData) => {
  const errors = [];
  if (!productData.name) errors.push('Product name is required');
  if (!productData.collection) errors.push('Product collection is required');
  return errors;
};

const productService = new ProductService();
const productController = createBaseController(productService, validateProductData);

module.exports = productController;
