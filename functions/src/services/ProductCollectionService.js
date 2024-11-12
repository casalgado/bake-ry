const BaseService = require('./base/BaseService');
const ProductCollection = require('../models/ProductCollection');

class ProductCollectionService extends BaseService {
  constructor() {
    super('productCollections', ProductCollection, 'bakeries/{bakeryId}');
  }

}

module.exports = ProductCollectionService;
