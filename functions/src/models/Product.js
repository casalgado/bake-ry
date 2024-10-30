// ProductVariation.js
class ProductVariation {
  constructor({
    id,
    name,
    size,
    weight,
    basePrice,
    currentPrice,
    recipeMultiplier,
  }) {
    this.id = id || this.generateVariationId();
    this.name = name;
    this.size = size;
    this.weight = weight;
    this.basePrice = basePrice;
    this.currentPrice = currentPrice || basePrice; // Default to basePrice if not provided
    this.recipeMultiplier = recipeMultiplier || 1;
  }

  generateVariationId() {
    const timestamp = new Date().getTime().toString().slice(-4);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `var_${timestamp}_${random}`;
  }

  toPlainObject() {
    const data = {
      id: this.id,
      name: this.name,
      size: this.size,
      weight: this.weight,
      basePrice: this.basePrice,
      currentPrice: this.currentPrice,
      recipeMultiplier: this.recipeMultiplier,
    };

    // Remove any undefined values
    Object.keys(data).forEach((key) => {
      if (data[key] === undefined || data[key] === null) {
        delete data[key];
      }
    });

    return data;
  }

  // Utility methods
  applyDiscount(percentage) {
    if (percentage < 0 || percentage > 100) {
      throw new Error("Discount percentage must be between 0 and 100");
    }
    this.currentPrice = this.basePrice * (1 - percentage / 100);
    return this.currentPrice;
  }

  resetPrice() {
    this.currentPrice = this.basePrice;
    return this.currentPrice;
  }
}

class Product {
  constructor({
    // Basic Information
    id,
    bakeryId,
    name,
    description,
    category, // e.g., "Panaderia de Masa Madre", "Panaderia Tradicional", "Untables", "Tortas", ...
    type, // e.g., "Fabricado", "Reventa"
    recipeId, // reference to recipe document
    recipeMultiplier, // multiplier for recipe

    // Sizing and Variations
    variations, // array of available variations

    // Pricing
    basePrice, // base price before customization
    currentPrice, // current selling price
    discountable, // boolean - can this product be discounted?

    // Inventory & Production
    sku, // Stock Keeping Unit
    barcode, // Optional barcode number
    minimumStock, // minimum stock to maintain
    currentStock, // current available stock
    restockThreshold, // when to restock
    productionTime, // time needed to make in minutes

    // Display & Marketing
    image, // URL to product image
    thumbnailImage, // URL to thumbnail
    displayOrder, // for ordering in catalog
    featured, // boolean - is this a featured product?
    tags, // array of searchable tags

    // Dietary & Allergen Information
    allergens, // array of allergens
    nutritionalInfo, // nutritional information
    dietary, // array: ["Vegetarian", "Vegan", "Gluten-Free"]

    // Availability
    isActive, // boolean - is this product currently for sale?
    isSeasonalItem, // boolean - is this a seasonal product?
    seasonalPeriod, // { start: Date, end: Date }
    availableDays, // array of days when product is available
    leadTime, // advance order time needed in hours

    // Timestamps
    createdAt,
    updatedAt,

    // Analytics & Metrics
    totalSold, // total quantity sold
    averageRating, // average customer rating
    reviewCount, // number of reviews

    // Custom Attributes for Flexibility
    customAttributes, // object for bakery-specific attributes
  }) {
    // Basic Information
    this.id = id;
    this.bakeryId = bakeryId;
    this.name = name;
    this.description = description;
    this.category = category;
    this.type = type;
    this.recipeId = recipeId;
    this.recipeMultiplier = recipeMultiplier || 1;

    // Convert variations to ProductVariation instances if they aren't already
    this.variations = (variations || []).map((variation) =>
      variation instanceof ProductVariation
        ? variation
        : new ProductVariation(variation)
    );

    // Pricing
    this.basePrice = basePrice;
    this.currentPrice = currentPrice || basePrice;
    this.discountable = discountable;

    // Inventory & Production
    this.sku = sku;
    this.barcode = barcode;
    this.minimumStock = minimumStock;
    this.currentStock = currentStock;
    this.restockThreshold = restockThreshold;
    this.productionTime = productionTime;

    // Display & Marketing
    this.image = image;
    this.thumbnailImage = thumbnailImage;
    this.displayOrder = displayOrder;
    this.featured = featured || false;
    this.tags = tags || [];

    // Dietary & Allergen Information
    this.allergens = allergens || [];
    this.nutritionalInfo = nutritionalInfo || {};
    this.dietary = dietary || [];

    // Availability
    this.isActive = isActive || true;
    this.isSeasonalItem = isSeasonalItem || false;
    this.seasonalPeriod = seasonalPeriod;
    this.availableDays = availableDays;
    this.leadTime = leadTime;

    // Timestamps
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();

    // Analytics & Metrics
    this.totalSold = totalSold;
    this.averageRating = averageRating;
    this.reviewCount = reviewCount;

    // Custom Attributes
    this.customAttributes = customAttributes || {};
  }

  // Firestore Data Conversion
  toFirestore() {
    const data = { ...this };
    delete data.id; // Remove id as it's stored as document ID

    // Convert ProductVariation instances to plain objects
    data.variations = this.variations.map((variation) =>
      variation instanceof ProductVariation
        ? variation.toPlainObject()
        : variation
    );

    // Remove undefined values
    Object.keys(data).forEach((key) => {
      if (data[key] === undefined || data[key] === null) {
        delete data[key];
      }
    });

    return data;
  }

  static fromFirestore(doc) {
    const data = doc.data();
    // Convert plain variation objects back to ProductVariation instances
    const variations = (data.variations || []).map(
      (variation) => new ProductVariation(variation)
    );

    return new Product({
      id: doc.id,
      ...data,
      variations,
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
      seasonalPeriod: data.seasonalPeriod
        ? {
            start: data.seasonalPeriod.start?.toDate(),
            end: data.seasonalPeriod.end?.toDate(),
          }
        : null,
    });
  }

  needsRestock() {
    return this.currentStock <= this.restockThreshold;
  }

  // Variation Management Methods
  addVariation(variationData) {
    const variation = new ProductVariation(variationData);
    this.variations.push(variation);
    return variation;
  }

  getVariation(id) {
    return this.variations.find((v) => v.id === id);
  }

  updateVariation(id, updateData) {
    const variation = this.getVariation(id);
    if (variation) {
      Object.assign(variation, updateData);
      return true;
    }
    return false;
  }

  removeVariation(id) {
    const index = this.variations.findIndex((v) => v.id === id);
    if (index !== -1) {
      this.variations.splice(index, 1);
      return true;
    }
    return false;
  }
}

module.exports = {
  Product,
  ProductVariation,
};
