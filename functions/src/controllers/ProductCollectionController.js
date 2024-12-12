const createBaseController = require('./base/controllerFactory');
const ProductCollectionService = require('../services/ProductCollectionService');

const validateCollectionData = (data) => {
  const errors = [];

  return errors;
};

const productCollectionService = new ProductCollectionService();
const baseController = createBaseController(productCollectionService, validateCollectionData);

const productCollectionController = {
  ...baseController,
};

module.exports = productCollectionController;
