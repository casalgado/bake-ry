const BaseModel = require('./base/BaseModel');

class ProductVariation {
  constructor({
    name,
    size,
    weight,
    basePrice,
    currentPrice,
    recipeMultiplier = 1,
  }) {
    this.name = name;
    this.size = size;
    this.weight = weight;
    this.basePrice = basePrice;
    this.currentPrice = currentPrice || basePrice;
    this.recipeMultiplier = recipeMultiplier;
  }

  toPlainObject() {
    const data = { ...this };
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
    description,
    categoryId,
    recipeId,
    recipeMultiplier = 1,
    createdAt,
    updatedAt,

    // Variations
    variations = [],

    // Pricing
    basePrice,
    currentPrice,

    // Display & Marketing
    displayOrder,
    featured = false,
    tags = [],

    // Status
    isActive = true,

    // Custom Attributes
    customAttributes = {},
  } = {}) {
    super({ id, createdAt, updatedAt });

    // Basic Information
    this.bakeryId = bakeryId;
    this.name = name;
    this.description = description;
    this.categoryId = categoryId;
    this.recipeId = recipeId;
    this.recipeMultiplier = recipeMultiplier;

    // Variations
    this.variations = variations.map(variation =>
      variation instanceof ProductVariation
        ? variation
        : new ProductVariation(variation),
    );

    // Pricing
    this.basePrice = basePrice;
    this.currentPrice = currentPrice || basePrice;

    // Display & Marketing
    this.displayOrder = displayOrder;
    this.featured = featured;
    this.tags = tags;

    // Status
    this.isActive = isActive;

    // Custom Attributes
    this.customAttributes = customAttributes;
  }

  toFirestore() {
    const data = super.toFirestore();
    data.variations = this.variations.map(variation => variation.toPlainObject());
    return data;
  }

  static fromFirestore(doc) {
    const data = doc.data();
    return new Product({
      id: doc.id,
      ...data,
      variations: data.variations?.map(v => new ProductVariation(v)),
    });
  }
}

module.exports = { Product, ProductVariation };
