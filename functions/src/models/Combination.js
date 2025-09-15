const { generateId, capitalize } = require('../utils/helpers');

class Combination {
  constructor(data = {}) {
    this.id = data.id;
    this.selection = (data.selection || []).map(item => capitalize(item));
    this.name = capitalize(data.name) || '';
    this.basePrice = data.basePrice || 0;
    this.currentPrice = data.currentPrice || this.basePrice;
    this.isWholeGrain = data.isWholeGrain || false;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
  }

  static fromLegacyVariation(variation, currentPrice = null) {
    // Handle legacy variations that might not have a proper name
    const name = variation.name || Object.keys(variation).find(key => key !== 'id' && variation[key]) || 'unknown';
    return new Combination({
      id: variation.id || generateId(),
      selection: [capitalize(name)].filter(Boolean), // Filter out undefined/null values
      name: capitalize(name),
      basePrice: variation.basePrice || 0,
      currentPrice: currentPrice || variation.currentPrice || variation.basePrice || 0,
      isWholeGrain: variation.isWholeGrain || false,
      isActive: true,
    });
  }

  getTotalPrice(quantity = 1) {
    return this.currentPrice * quantity;
  }

  getDisplayName() {
    return this.name || this.selection.join(' + ');
  }

  isLegacyVariation() {
    return this.selection.length === 1;
  }

  toPlainObject() {
    const obj = {
      id: this.id,
      selection: this.selection.filter(item => item !== undefined && item !== null),
      name: this.name,
      basePrice: this.basePrice,
      currentPrice: this.currentPrice,
      isWholeGrain: this.isWholeGrain,
      isActive: this.isActive,
    };

    // Exclude createdAt and updatedAt for combinations

    return obj;
  }

  toFirestore() {
    return {
      id: this.id,
      selection: this.selection.filter(item => item !== undefined && item !== null),
      name: this.name,
      basePrice: this.basePrice,
      currentPrice: this.currentPrice,
      isWholeGrain: this.isWholeGrain,
      isActive: this.isActive,
    };
  }
}

module.exports = Combination;
