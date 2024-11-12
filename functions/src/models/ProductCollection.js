const BaseModel = require('./base/BaseModel');
const { BadRequestError } = require('../utils/errors');

class ProductCollection extends BaseModel {
  static DISPLAY_TYPES = {
    WEIGHT: {
      label: 'Weight',
      unit: 'g',
      formatValue: (value) => `${value}${ProductCollection.DISPLAY_TYPES.WEIGHT.unit}`,
    },
    QUANTITY: {
      label: 'Quantity',
      prefix: 'x',
      formatValue: (value) => `${ProductCollection.DISPLAY_TYPES.QUANTITY.prefix}${value}`,
    },
  };

  constructor({
    id,
    bakeryId,
    name,
    description,
    displayType = null, // 'weight' or 'quantity' or null
    displayOrder = 0,
    suggestedVariations = [],
    isActive = true,
    createdAt,
    updatedAt,
  }) {
    super({ id, createdAt, updatedAt });

    this.bakeryId = bakeryId;
    this.name = name;
    this.description = description;
    this.displayType = displayType;
    this.displayOrder = displayOrder;
    this.suggestedVariations = suggestedVariations;
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
