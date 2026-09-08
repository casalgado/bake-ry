// models/Ingredient.js
const BaseModel = require('./base/BaseModel');
const { BadRequestError } = require('../utils/errors');

class Ingredient extends BaseModel {
  // What deduction does when it reaches this ingredient (§4).
  // passThrough (default): hold no stock, deduct this ingredient's own recipe
  // components instead — correct raw-material deduction with zero user effort.
  // stocked: deduction stops here and moves this ingredient's stock.
  static STOCK_BEHAVIORS = {
    PASS_THROUGH: 'passThrough',
    STOCKED: 'stocked',
  };

  constructor({
    // Basic Information
    id,
    bakeryId,
    name,
    categoryId,
    categoryName,
    createdAt,
    updatedAt,

    // Usage and Recipes
    usedInRecipes = [],
    // An ingredient may be produced from its own recipe — a preparación (§4).
    recipeId = null,
    stockBehavior = Ingredient.STOCK_BEHAVIORS.PASS_THROUGH,
    notes,

    // Cost and Pricing
    costPerUnit = 0,
    currency = 'COP',

    // "Where do I buy this" — free text, pre-fills a purchase entry (§4).
    // Deliberately not an entity: suppliers belong to the balance-sheet epic.
    preferredSupplier = '',

    // Units and Measurements
    unit,

    // Storage Requirements
    storageTemp,

    // Status
    isActive = true,
    isDiscontinued = false,
    isDeleted = false,

    // Custom Attributes
    customAttributes = {},
  } = {}) {
    // Pass common fields to BaseModel
    super({ id, createdAt, updatedAt });

    if (!Object.values(Ingredient.STOCK_BEHAVIORS).includes(stockBehavior)) {
      throw new BadRequestError('Invalid ingredient stock behavior');
    }

    // Basic Information
    this.bakeryId = bakeryId;
    this.name = name;
    this.categoryId = categoryId;
    this.categoryName = categoryName;

    // Usage and Recipes
    this.usedInRecipes = usedInRecipes;
    this.recipeId = recipeId;
    this.stockBehavior = stockBehavior;
    this.notes = notes;

    // Cost and Pricing
    this.costPerUnit = costPerUnit;
    this.currency = currency;
    this.preferredSupplier = preferredSupplier;

    // Current stock is NOT held here — it lives on the stocks docs
    // (INVENTORY-IMPLEMENTATION.md §8.1). Legacy `currentStock` values remain in
    // stored docs and are simply ignored.

    // Units and Measurements
    this.unit = unit;

    // Storage Requirements
    this.storageTemp = storageTemp;

    // Status
    this.isActive = isActive;
    this.isDiscontinued = isDiscontinued;
    this.isDeleted = isDeleted;
    // Custom Attributes
    this.customAttributes = customAttributes;
  }
}

module.exports = Ingredient;
