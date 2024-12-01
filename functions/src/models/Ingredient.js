// models/Ingredient.js
const BaseModel = require('./base/BaseModel');
const { BadRequestError } = require('../utils/errors');

class Ingredient extends BaseModel {
  static TYPES = {
    MANUFACTURED: 'manufactured',
    RESALE: 'resale',
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
    notes,

    // Cost and Pricing
    costPerUnit = 0,
    currency = 'COP',

    // Inventory Management
    currentStock = 0,

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

    // Basic Information
    this.bakeryId = bakeryId;
    this.name = name;
    this.categoryId = categoryId;
    this.categoryName = categoryName;

    this.type = type;

    // Usage and Recipes
    this.usedInRecipes = usedInRecipes;
    this.notes = notes;

    // Cost and Pricing
    this.costPerUnit = costPerUnit;
    this.currency = currency;

    // Inventory Management
    this.currentStock = currentStock;

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
