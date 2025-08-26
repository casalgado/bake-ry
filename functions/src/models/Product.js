// models/Product.js
const BaseModel = require('./base/BaseModel');
const ProductVariation = require('./ProductVariation');

class Product extends BaseModel {
  constructor({
    // Basic Information
    id,
    bakeryId,
    name = '',
    collectionId,
    collectionName,
    // Variations
    variations = [],
    hasVariations,
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
    description,
  } = {}) {
    super({ id, createdAt, updatedAt });

    // Basic Information
    this.bakeryId = bakeryId;
    this.name = name.trim().toLowerCase();
    this.collectionId = collectionId;
    this.collectionName = collectionName;
    this.recipeId = recipeId;
    this.description = description;
    this.hasVariations = this.variations?.length > 0 || hasVariations;

    // Handle variations - create instances
    this.variations = variations.map(variation => {
      if (variation instanceof ProductVariation) {
        return variation;
      }

      return new ProductVariation(variation);
    });

    // Basic price
    this.basePrice = basePrice;
    this.currentPrice = currentPrice || basePrice;
    this.taxPercentage = Number(Number(taxPercentage).toFixed(1));

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
    this.variations = variations.map(variation => {
      if (variation instanceof ProductVariation) {
        return variation;
      }

      return new ProductVariation(variation);
    });
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
      variations: data.variations?.map(v => {
        return new ProductVariation(v);
      }),
    });
  }
}
module.exports = Product;
