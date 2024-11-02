class Ingredient {
  constructor({
    // Basic Information
    id,
    bakeryId,
    name,
    description,
    category, // e.g., "Dairy", "Flour", "Sugar", "Flavoring"
    type, // e.g., "Raw Material", "Pre-made Mix", "Additive"

    // Inventory Management
    sku, // Stock Keeping Unit
    barcode, // Optional barcode number
    currentStock, // Current quantity in stock
    minimumStock, // Minimum stock level before reorder
    reorderPoint, // Stock level that triggers reorder
    reorderQuantity, // Standard quantity to reorder
    maximumStock, // Maximum storage capacity
    location, // Storage location in bakery

    // Units and Measurements
    unit, // Primary unit (e.g., "kg", "L", "units")
    alternativeUnits, // [{unit: "g", conversionFactor: 1000}]
    measurementType, // "weight", "volume", "unit"

    // Cost and Pricing
    costPerUnit, // Cost in primary unit
    lastPurchasePrice,
    averagePurchasePrice,
    currency, // Currency code

    // Supplier Information
    suppliers, // Array of supplier references
    preferredSupplierId,
    leadTime, // Time in days from order to delivery

    // Storage Requirements
    storageTemp, // Storage category
    shelfLife, // In days
    expiryDate, // For current batch
    storageInstructions,

    // Quality and Safety
    qualityStandards,
    allergens, // Array of allergens present
    nutritionalInfo, // Per 100g/100ml
    organicCertified,
    kosherCertified,
    halalCertified,

    // Usage and Recipes
    usedInRecipes, // Array of recipe IDs
    substitutes, // Array of substitute ingredient IDs
    notes, // Special handling notes

    // Tracking
    batchNumber, // Current batch number
    lotNumber, // Current lot number
    lastRestockDate,
    lastStockCheck,

    // Status
    isActive, // Whether ingredient is currently in use
    isDiscontinued,
    discontinuedReason,

    // Timestamps
    createdAt,
    updatedAt,

    // Custom Attributes
    customAttributes,

    // Purchase History
    purchaseHistory, // Array of recent purchases

    // Consumption Tracking
    averageMonthlyUsage,
    lastUsedDate,
    consumptionRate, // Units per day/week
  }) {
    // Basic Information
    this.id = id;
    this.bakeryId = bakeryId;
    this.name = name;
    this.description = description;
    this.category = category;
    this.type = type;

    // Inventory Management
    this.sku = sku;
    this.barcode = barcode;
    this.currentStock = currentStock || 0;
    this.minimumStock = minimumStock || 0;
    this.reorderPoint = reorderPoint;
    this.reorderQuantity = reorderQuantity;
    this.maximumStock = maximumStock;
    this.location = location;

    // Units and Measurements
    this.unit = unit;
    this.alternativeUnits = alternativeUnits || [];
    this.measurementType = measurementType;

    // Cost and Pricing
    this.costPerUnit = costPerUnit || 0;
    this.lastPurchasePrice = lastPurchasePrice;
    this.averagePurchasePrice = averagePurchasePrice;
    this.currency = currency || "USD";

    // Supplier Information
    this.suppliers = suppliers;
    this.preferredSupplierId;
    this.leadTime = leadTime;

    // Storage Requirements
    this.storageTemp = storageTemp;
    this.shelfLife = shelfLife;
    this.expiryDate = expiryDate;
    this.storageInstructions = storageInstructions;

    // Quality and Safety
    this.qualityStandards = qualityStandards;
    this.allergens = allergens;
    this.nutritionalInfo = nutritionalInfo;
    this.organicCertified = organicCertified;
    this.kosherCertified = kosherCertified;
    this.halalCertified = halalCertified;

    // Usage and Recipes
    this.usedInRecipes = usedInRecipes || [];
    this.substitutes = substitutes;
    this.notes = notes;

    // Tracking
    this.batchNumber = batchNumber;
    this.lotNumber = lotNumber;
    this.lastRestockDate = lastRestockDate;
    this.lastStockCheck = lastStockCheck;

    // Status
    this.isActive = isActive ?? true;
    this.isDiscontinued = isDiscontinued || false;
    this.discontinuedReason = discontinuedReason;

    // Timestamps
    this.createdAt = createdAt ? new Date(createdAt) : new Date();
    this.updatedAt = updatedAt || new Date();

    // Custom Attributes
    this.customAttributes = customAttributes || {};

    // Purchase History
    this.purchaseHistory = purchaseHistory || [];

    // Consumption Tracking
    this.averageMonthlyUsage = averageMonthlyUsage || 0;
    this.lastUsedDate = lastUsedDate;
    this.consumptionRate = consumptionRate || 0;
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
    return new Ingredient({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
      lastRestockDate: data.lastRestockDate?.toDate(),
      lastStockCheck: data.lastStockCheck?.toDate(),
      lastUsedDate: data.lastUsedDate?.toDate(),
      expiryDate: data.expiryDate?.toDate(),
    });
  }

  // Utility Methods
  needsRestock() {
    return this.currentStock <= this.reorderPoint;
  }

  canFulfillQuantity(quantity) {
    return this.currentStock >= quantity;
  }

  isExpired() {
    if (!this.expiryDate) return false;
    return new Date() > this.expiryDate;
  }

  isExpiringSoon(daysThreshold = 7) {
    if (!this.expiryDate) return false;
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + daysThreshold);
    return this.expiryDate <= warningDate;
  }

  // Unit Conversion
  convertUnit(quantity, fromUnit, toUnit) {
    if (fromUnit === toUnit) return quantity;

    const fromUnitData = this.alternativeUnits.find((u) => u.unit === fromUnit);
    const toUnitData = this.alternativeUnits.find((u) => u.unit === toUnit);

    if (!fromUnitData || !toUnitData) {
      throw new Error("Invalid unit conversion");
    }

    // Convert to base unit then to target unit
    return (
      (quantity * fromUnitData.conversionFactor) / toUnitData.conversionFactor
    );
  }

  // Stock Management
  updateStock(quantity, type = "decrease") {
    const newStock =
      type === "decrease"
        ? this.currentStock - quantity
        : this.currentStock + quantity;

    if (newStock < 0) {
      throw new Error("Insufficient stock");
    }

    this.currentStock = newStock;
    this.updatedAt = new Date();

    if (type === "increase") {
      this.lastRestockDate = new Date();
    }

    return this.currentStock;
  }

  // Cost Calculation
  calculateCost(quantity, unit = this.unit) {
    const quantityInBaseUnit =
      unit === this.unit
        ? quantity
        : this.convertUnit(quantity, unit, this.unit);

    return quantityInBaseUnit * this.costPerUnit;
  }

  // Purchase History Management
  addPurchase(purchase) {
    this.purchaseHistory.unshift({
      ...purchase,
      date: new Date(),
    });

    // Keep only last 10 purchases
    if (this.purchaseHistory.length > 10) {
      this.purchaseHistory.pop();
    }

    // Update average purchase price
    this.updateAveragePurchasePrice();
  }

  updateAveragePurchasePrice() {
    if (this.purchaseHistory.length === 0) return;

    const total = this.purchaseHistory.reduce(
      (sum, purchase) => sum + purchase.price,
      0
    );
    this.averagePurchasePrice = total / this.purchaseHistory.length;
  }
}

module.exports = Ingredient;
