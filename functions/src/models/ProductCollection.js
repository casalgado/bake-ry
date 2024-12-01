const BaseModel = require('./base/BaseModel');

class ProductCollection extends BaseModel {

  constructor({
    id,
    bakeryId,
    name,
    isActive = true,
    createdAt,
    updatedAt,
    isDeleted = false,
  }) {
    super({ id, createdAt, updatedAt });

    this.bakeryId = bakeryId;
    this.name = name;
    this.isActive = isActive;
    this.isDeleted = isDeleted;
  }

}

module.exports = ProductCollection;
