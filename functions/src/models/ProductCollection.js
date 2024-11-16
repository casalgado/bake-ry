const BaseModel = require('./base/BaseModel');
const { BadRequestError } = require('../utils/errors');

class ProductCollection extends BaseModel {

  constructor({
    id,
    bakeryId,
    name,
    description,
    isActive = true,
    createdAt,
    updatedAt,
  }) {
    super({ id, createdAt, updatedAt });

    this.bakeryId = bakeryId;
    this.name = name;
    this.description = description;
    this.isActive = isActive;
  }

  hasVariations() {
    return this.displayType !== null;
  }

  formatVariationValue(value) {
    if (!this.hasVariations()) {
      throw new BadRequestError('Collection does not support variations');
    }

    const displayTypeConfig = ProductCollection.DISPLAY_TYPES[this.displayType.toUpperCase()];
    return displayTypeConfig.formatValue(value);
  }

  // Override toFirestore to ensure proper data structure
  toFirestore() {
    const data = super.toFirestore();
    if (this.suggestedVariations) {
      data.suggestedVariations = this.suggestedVariations.map(variation => {
        const plainVariation = { ...variation };
        // Remove any undefined values
        Object.keys(plainVariation).forEach(key => {
          if (plainVariation[key] === undefined) {
            delete plainVariation[key];
          }
        });
        return plainVariation;
      });
    }
    return data;
  }
}

module.exports = ProductCollection;
