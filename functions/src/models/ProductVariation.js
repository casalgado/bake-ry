const { BadRequestError } = require('../utils/errors');
const { generateId } = require('../utils/helpers');

class ProductVariation {
  constructor({
    id,
    name = '',
    value,
    basePrice,
    recipeId,
    isWholeGrain = false,
    unit = '',
    type = 'SIZE', // 'WEIGHT', 'QUANTITY', 'SIZE'
    displayOrder,
  }) {
    this.id = id || generateId();
    this.name = name.trim().toLowerCase();
    this.value = value;
    this.basePrice = basePrice;
    this.recipeId = recipeId;
    this.isWholeGrain = isWholeGrain;
    this.unit = unit;
    this.type = type == '' ? 'SIZE' : type;

    this.displayOrder = this.setDisplayOrder(displayOrder, name, isWholeGrain);
  }

  setDisplayOrder(displayOrder, name, isWholeGrain) {
    if (displayOrder !== undefined) return displayOrder;
    if (name && name.trim().toLowerCase() === 'otra') return 999;
    if (isWholeGrain) return 2;
    return 1;
  }

  validate() {
    if (!this.name || this.name.trim() === '') {
      throw new BadRequestError('Variation name is required');
    }

    if (this.value === undefined || this.value === null) {
      throw new BadRequestError('Variation value is required');
    }

    // basePrice is optional for templates (collection templates don't have pricing)
    if (this.basePrice !== undefined && this.basePrice !== null && this.basePrice < 0) {
      throw new BadRequestError('Variation base price cannot be negative');
    }
  }

  getDisplayValue() {
    if (!this.unit) {
      return this.value.toString();
    }

    // Handle special formatting for different types
    switch (this.type) {
    case 'QUANTITY':
      return `x${this.value}`;
    case 'WEIGHT':
      return `${this.value}${this.unit}`;
    case 'SIZE':
      return this.name; // For size, display the name (mini, pequeño, etc.)
    default:
      return `${this.value}${this.unit ? ` ${this.unit}` : ''}`;
    }
  }

  getDisplayName() {
    return this.name;
  }

  // Create variation from system template
  static fromTemplate(template, { basePrice, recipeId = '' } = {}) {
    return new ProductVariation({
      ...template,
      basePrice: basePrice || template.basePrice,
      recipeId,
    });
  }

  // Compare variations for sorting
  compareTo(other) {
    if (this.displayOrder !== other.displayOrder) {
      return this.displayOrder - other.displayOrder;
    }

    // If display order is the same, sort by value
    return this.value - other.value;
  }

  toPlainObject() {
    const data = { ...this };
    // Remove undefined values
    Object.keys(data).forEach(key => {
      if (data[key] === undefined) {
        delete data[key];
      }
    });
    return data;
  }

  // Backward compatibility: handle old format with currentPrice
  static fromLegacy(data) {
    const variation = new ProductVariation(data);

    // If there's a currentPrice but no basePrice, use currentPrice as basePrice
    if (data.currentPrice && !data.basePrice) {
      variation.basePrice = data.currentPrice;
    }

    return variation;
  }
}

module.exports = ProductVariation;
