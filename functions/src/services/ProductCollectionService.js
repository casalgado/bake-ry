// services/productCollectionService.js
const createBaseService = require('./base/serviceFactory');
const ProductCollection = require('../models/ProductCollection');

const createProductCollectionService = () => {
  const baseService = createBaseService(
    'productCollections',
    ProductCollection,
    'bakeries/{bakeryId}',
  );

  // Add any custom methods here if needed

  return {
    ...baseService,
  };
};

// Export a singleton instance
module.exports = createProductCollectionService();
