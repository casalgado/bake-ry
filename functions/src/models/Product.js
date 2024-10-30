class Product {
  constructor({
    // Basic Information
    id,
    bakeryId,
    name,
    description,
    category, // e.g., "Bread", "Cake", "Pastry"
    type, // e.g., "Regular", "Special", "Seasonal"
    recipeId, // reference to recipe document
    recipeMultiplier, // multiplier for recipe

    // Sizing and Variations
    size, // e.g., "Small", "Medium", "Large"
    weight, // in grams
    dimensions, // { length, width, height } for cakes
    customizable, // boolean - can this product be customized?
    variations, // array of available variations

    // Pricing
    basePrice, // base price before customization
    currentPrice, // current selling price
    costToMake, // calculated from recipe
    profitMargin, // percentage
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

    // Sizing and Variations
    this.size = size;
    this.weight = weight;
    this.dimensions = dimensions;
    this.customizable = customizable ?? false;
    this.variations = variations || [];

    // Pricing
    this.basePrice = basePrice;
    this.currentPrice = currentPrice;
    this.costToMake = costToMake;
    this.profitMargin = profitMargin;
    this.discountable = discountable ?? true;

    // Inventory & Production
    this.sku = sku;
    this.barcode = barcode;
    this.minimumStock = minimumStock || 0;
    this.currentStock = currentStock || 0;
    this.restockThreshold = restockThreshold;
    this.productionTime = productionTime;

    // Display & Marketing
    this.image = image;
    this.thumbnailImage = thumbnailImage;
    this.displayOrder = displayOrder || 0;
    this.featured = featured || false;
    this.tags = tags || [];

    // Dietary & Allergen Information
    this.allergens = allergens || [];
    this.nutritionalInfo = nutritionalInfo || {};
    this.dietary = dietary || [];

    // Availability
    this.isActive = isActive ?? true;
    this.isSeasonalItem = isSeasonalItem ?? false;
    this.seasonalPeriod = seasonalPeriod;
    this.availableDays = availableDays || [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    this.leadTime = leadTime || 0;

    // Timestamps
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();

    // Analytics & Metrics
    this.totalSold = totalSold || 0;
    this.averageRating = averageRating || 0;
    this.reviewCount = reviewCount || 0;

    // Custom Attributes
    this.customAttributes = customAttributes || {};
  }

  // Firestore Data Conversion
  toFirestore() {
    const data = { ...this };
    delete data.id; // Remove id as it's stored as document ID
    // Remove undefined values
    Object.keys(data).forEach((key) => {
      if (data[key] === undefined) {
        delete data[key];
      }
    });
    return data;
  }

  static fromFirestore(doc) {
    const data = doc.data();
    return new Product({
      id: doc.id,
      ...data,
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

  // Utility Methods
  calculateProfit() {
    return this.currentPrice - (this.costToMake || 0);
  }

  calculateProfitMargin() {
    if (!this.currentPrice || !this.costToMake) return 0;
    return ((this.currentPrice - this.costToMake) / this.currentPrice) * 100;
  }

  needsRestock() {
    return this.currentStock <= this.restockThreshold;
  }

  isAvailableOn(date) {
    const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" });
    if (!this.availableDays.includes(dayOfWeek)) return false;

    if (this.isSeasonalItem && this.seasonalPeriod) {
      const checkDate = date.getTime();
      return (
        checkDate >= this.seasonalPeriod.start.getTime() &&
        checkDate <= this.seasonalPeriod.end.getTime()
      );
    }

    return true;
  }

  canOrderFor(orderDate) {
    if (!this.isActive) return false;
    if (!this.isAvailableOn(orderDate)) return false;

    const now = new Date();
    const leadTimeMs = this.leadTime * 60 * 60 * 1000; // Convert hours to milliseconds
    const earliestPossibleOrder = new Date(now.getTime() + leadTimeMs);

    return orderDate >= earliestPossibleOrder;
  }
}

module.exports = Product;
