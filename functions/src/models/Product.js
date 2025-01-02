// models/Product.js
const BaseModel = require('./base/BaseModel');
const { BadRequestError } = require('../utils/errors');
const { generateId } = require('../utils/helpers');

class ProductVariation {

  constructor({
    id,
    name,
    value,
    basePrice,
    currentPrice,
    recipeId,
    isWholeGrain = false,
  }) {
    this.id = id || generateId();
    this.name = name;
    this.value = value;
    this.basePrice = basePrice;
    this.currentPrice = currentPrice || basePrice;
    this.recipeId = recipeId;
    this.isWholeGrain = isWholeGrain;
  }

  validate(category) {
    if (!category) {
      throw new BadRequestError('Category is required for validation');
    }

    // Validate using category's validation rules
    category.validateVariation(this);
  }

  getDisplayValue(category) {
    if (!category) {
      throw new BadRequestError('Category is required for display formatting');
    }

    return category.formatVariationValue(this.value);
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
}

class Product extends BaseModel {
  constructor({
    // Basic Information
    id,
    bakeryId,
    name,
    collectionId,
    collectionName,
    // Variations
    variations = [],
    // Basic price and recipe (for products without variations)
    recipeId,
    basePrice,
    currentPrice,
    taxPercentage = 0,

    // Display & Marketing
    displayOrder,
    // Status+
    isActive = true,
    isDeleted = false,
    // Common fields
    createdAt,
    updatedAt,
    // Custom Attributes
    customAttributes = {},
  } = {}) {
    super({ id, createdAt, updatedAt });

    // Basic Information
    this.bakeryId = bakeryId;
    this.name = name;
    this.collectionId = collectionId;
    this.collectionName = collectionName;
    this.recipeId = recipeId;

    // Handle variations - create instances right in constructor
    this.variations = variations.map(variation =>
      variation instanceof ProductVariation
        ? variation
        : new ProductVariation(variation),
    );

    // Basic price
    this.basePrice = basePrice;
    this.currentPrice = currentPrice || basePrice;
    this.taxPercentage = parseInt(taxPercentage);

    // Display & Marketing
    this.displayOrder = displayOrder;

    // Status
    this.isActive = isActive;
    this.isDeleted = isDeleted;

    // Custom Attributes
    this.customAttributes = customAttributes;
  }

  // Method to update variations
  setVariations(variations) {
    this.variations = variations.map(variation =>
      variation instanceof ProductVariation
        ? variation
        : new ProductVariation(variation),
    );
    return this.variations;
  }

  // Override toFirestore to handle variations
  toFirestore() {
    const data = super.toFirestore();
    if (this.variations.length > 0) {
      data.variations = this.variations.map(v => v.toPlainObject());
    }
    return data;
  }

  static fromFirestore(doc) {
    const data = super.fromFirestore(doc);
    return new Product({
      id: doc.id,
      ...data,
      variations: data.variations?.map(v => new ProductVariation(v)),
    });
  }
}
module.exports = { Product, ProductVariation };
