// models/Ingredient.js
const BaseModel = require('./base/BaseModel');
const { BadRequestError } = require('../utils/errors');

class Ingredient extends BaseModel {
  static TYPES = {
    MANUFACTURED: 'manufactured',
    RESALE: 'resale',
  };

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
    type = Ingredient.TYPES.MANUFACTURED,
    categoryId,
    categoryName,
    createdAt,
    updatedAt,

    // Usage and Recipes
    usedInRecipes = [],
    // Manufactured ingredients may be produced from their own recipe (§4).
    recipeId = null,
    stockBehavior = Ingredient.STOCK_BEHAVIORS.PASS_THROUGH,
    notes,

    // Cost and Pricing
    costPerUnit = 0,
    currency = 'COP',

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

    // Validate type
    if (!Object.values(Ingredient.TYPES).includes(type)) {
      throw new BadRequestError('Invalid ingredient type');
    }

    if (!Object.values(Ingredient.STOCK_BEHAVIORS).includes(stockBehavior)) {
      throw new BadRequestError('Invalid ingredient stock behavior');
    }

    // Only something you make can have a recipe (§4).
    if (recipeId && type === Ingredient.TYPES.RESALE) {
      throw new BadRequestError('Resale ingredients cannot have a recipe');
    }

    // Basic Information
    this.bakeryId = bakeryId;
    this.name = name;
    this.categoryId = categoryId;
    this.categoryName = categoryName;

    this.type = type;

    // Usage and Recipes
    this.usedInRecipes = usedInRecipes;
    this.recipeId = recipeId;
    this.stockBehavior = stockBehavior;
    this.notes = notes;

    // Cost and Pricing
    this.costPerUnit = costPerUnit;
    this.currency = currency;

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

  // Helper methods
  isManufactured() {
    return this.type === Ingredient.TYPES.MANUFACTURED;
  }

  isResale() {
    return this.type === Ingredient.TYPES.RESALE;
  }

}

module.exports = Ingredient;
