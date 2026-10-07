const createBaseController = require('./base/controllerFactory');
const providerService = require('../services/providerService');

const validateProviderData = (data) => {
  const errors = [];
  if (!data.name?.trim()) errors.push('El nombre del proveedor es obligatorio');
  return errors;
};

module.exports = createBaseController(providerService, validateProviderData);
