const createBaseController = require('./base/controllerFactory');
const productCollectionService = require('../services/productCollectionService');

const validateCollectionData = (data) => {
  const errors = [];

  return errors;
};

const baseController = createBaseController(productCollectionService, validateCollectionData);

const productCollectionController = {
  ...baseController,
};

module.exports = productCollectionController;
