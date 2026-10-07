const Provider = require('../models/Provider');
const createBaseService = require('./base/serviceFactory');

module.exports = createBaseService('providers', Provider, 'bakeries/{bakeryId}');
