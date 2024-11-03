// models/Ingredient.js

const BaseModel = require('./base/BaseModel');

class Ingredient extends BaseModel {
  constructor({
    // Basic Information
    id,
    bakeryId,
    name,
    description,
    category,
    createdAt,
    updatedAt,

    // Usage and Recipes
    usedInRecipes = [],
    isResaleProduct = false,
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
    isActive,
    isDiscontinued,

    // Custom Attributes
    customAttributes = {},
  } = {}) {
    // Pass common fields to BaseModel
    super({ id, createdAt, updatedAt });

    // Basic Information
    this.bakeryId = bakeryId;
    this.name = name;
    this.description = description;
    this.category = category;

    // Usage and Recipes
    this.usedInRecipes = usedInRecipes;
    this.isResaleProduct = isResaleProduct;
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
    this.isActive = isActive ?? true;
    this.isDiscontinued = isDiscontinued ?? false;

    // Custom Attributes
    this.customAttributes = customAttributes;
  }
}

module.exports = Ingredient;
