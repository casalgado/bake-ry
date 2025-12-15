// models/Product.js
const BaseModel = require('./base/BaseModel');
const VariationGroups = require('./VariationGroups');

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
    costPrice,
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

    // Handle variations - create instances
    this.variations = Array.isArray(variations) ? VariationGroups.fromLegacyVariations(variations) : variations;

    this.hasVariations = this.variations?.combinations?.length > 0 || hasVariations;

    // Basic price
    this.basePrice = basePrice;
    this.costPrice = costPrice;
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

  // Override toFirestore to handle variations
  toFirestore() {
    const data = super.toFirestore();

    // Handle variations based on type
    if (this.variations) {
      if (this.variations instanceof VariationGroups) {
        // VariationGroups instance - convert to plain object
        data.variations = this.variations.toPlainObject();
      } else if (typeof this.variations === 'object' && !Array.isArray(this.variations)) {
        // Already a plain object (from new products) - pass through
        data.variations = this.variations;
      } else if (Array.isArray(this.variations)) {
        // Legacy array format - shouldn't happen after constructor conversion
        // but include for safety
        data.variations = this.variations;
      }
    }

    return data;
  }

  static fromFirestore(doc) {
    const data = super.fromFirestore(doc);
    return new Product({
      id: doc.id,
      ...data,
    });
  }
}
module.exports = Product;
