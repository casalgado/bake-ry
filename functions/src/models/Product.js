// models/Product.js
const BaseModel = require('./base/BaseModel');
const { BadRequestError } = require('../utils/errors');

class ProductVariation {

  constructor({
    name,
    value,
    basePrice,
    currentPrice,
    recipeId,
  }) {
    this.name = name;
    this.value = value;
    this.basePrice = basePrice;
    this.currentPrice = currentPrice || basePrice;
    this.recipeId = recipeId;
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
    collectionId,    // Changed from collectionId to categoryName to match BakerySettings
    collectionName,
    // Variations
    variations = [],
    // Basic price and recipe (for products without variations)
    recipeId,
    basePrice,
    currentPrice,

    // Display & Marketing
    displayOrder,
    // Status+
    isActive = true,
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

    // Handle variations based on category
    this.variations = [];
    this.basePrice = basePrice;
    this.currentPrice = currentPrice || basePrice;

    // Display & Marketing
    this.displayOrder = displayOrder;

    // Status
    this.isActive = isActive;

    // Custom Attributes
    this.customAttributes = customAttributes;
  }

  // Method to set variations after category is available
  setVariations(variations, category) {
    if (!category) {
      throw new BadRequestError('Category is required to set variations');
    }

    // If category doesn't support variations, ensure no variations are set
    if (!category.hasVariations()) {
      if (variations.length > 0) {
        throw new BadRequestError('This product category does not support variations');
      }
      this.variations = [];
      return;
    }

    // Validate and set each variation
    this.variations = variations.map(variation => {
      const productVariation = variation instanceof ProductVariation
        ? variation
        : new ProductVariation(variation);

      productVariation.validate(category);
      return productVariation;
    });
  }

  // Helper to apply suggested variations from category
  applyCategoryVariations(category) {
    if (!category.hasVariations() || !category.suggestedVariations.length) {
      return;
    }

    this.setVariations(category.suggestedVariations, category);
  }

  // Override toFirestore to handle variations
  toFirestore() {
    const data = super.toFirestore();
    if (this.variations.length > 0) {
      data.variations = this.variations.map(v => v.toPlainObject());
    }
    return data;
  }

  // Override fromFirestore to handle variations
  static fromFirestore(doc) {
    const data = super.fromFirestore(doc);
    return new Product({
      id: doc.id,
      ...data,
      variations: data.variations?.map(v => new ProductVariation(v)),
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
    });
  }
}

module.exports = { Product, ProductVariation };
