const BaseModel = require('./base/BaseModel');

class Provider extends BaseModel {
  constructor({
    id,
    bakeryId,
    name,
    nationalId = null, // NIT; supplier e-invoices identify the issuer by it
    phone = null,
    isDeleted = false,
    createdAt,
    updatedAt,
  }) {
    super({ id, createdAt, updatedAt });
    this.bakeryId = bakeryId;
    this.name = typeof name === 'string' ? name.trim() : name;
    this.nationalId = nationalId;
    this.phone = phone;
    this.isDeleted = isDeleted;
  }
}

module.exports = Provider;
