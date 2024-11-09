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
    description,
    type = Ingredient.TYPES.MANUFACTURED,
    categoryId, // Reference to category
    categoryName, // Denormalized category name
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

    // Supplier Information
    suppliers,
    preferredSupplierId,

    // Storage Requirements
    storageTemp,

    // Status
    isActive = true,
    isDiscontinued = false,

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
    this.description = description;
    this.type = type;
    this.categoryId = categoryId;
    this.categoryName = categoryName;

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

    // Supplier Information
    this.suppliers = suppliers;
    this.preferredSupplierId = preferredSupplierId;

    // Storage Requirements
    this.storageTemp = storageTemp;

    // Status
    this.isActive = isActive;
    this.isDiscontinued = isDiscontinued;

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

  // Validation helper
  validate() {
    if (!this.name) {
      throw new BadRequestError('Ingredient name is required');
    }
    if (!this.categoryId) {
      throw new BadRequestError('Category ID is required');
    }
    if (!this.categoryName) {
      throw new BadRequestError('Category name is required');
    }
    if (!this.unit) {
      throw new BadRequestError('Unit is required');
    }
    if (this.costPerUnit < 0) {
      throw new BadRequestError('Cost per unit cannot be negative');
    }
  }
}

module.exports = Ingredient;
