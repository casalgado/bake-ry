// models/BakerySettings.js
const BaseModel = require('./base/BaseModel');
const { BadRequestError } = require('../utils/errors');
const { generateId } = require('../utils/helpers');

class ProductCategory {
  static DISPLAY_TYPES = {
    WEIGHT: {
      id: 'weight',
      label: 'Weight',
      unit: 'g',
      validateValue: (value) => {
        if (typeof value !== 'number' || value <= 0) {
          throw new BadRequestError('Weight must be a positive number');
        }
      },
      formatValue: (value) => `${value}${ProductCategory.DISPLAY_TYPES.WEIGHT.unit}`,
    },
    QUANTITY: {
      id: 'quantity',
      label: 'Quantity',
      prefix: 'x',
      validateValue: (value) => {
        if (!Number.isInteger(value) || value <= 0) {
          throw new BadRequestError('Quantity must be a positive integer');
        }
      },
      formatValue: (value) => `${ProductCategory.DISPLAY_TYPES.QUANTITY.prefix}${value}`,
    },
  };

  constructor({
    id = generateId(),
    name,
    description,
    displayType = null, // 'weight' or 'quantity' or null
    suggestedVariations = [],
    isActive = true,
  }) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.displayType = displayType;
    this.suggestedVariations = this.validateSuggestedVariations(suggestedVariations);
    this.isActive = isActive;
  }

  hasVariations() {
    return this.displayType !== null;
  }

  validateSuggestedVariations(variations) {
    // If category doesn't support variations, ensure array is empty
    if (!this.hasVariations()) {
      if (variations.length > 0) {
        throw new BadRequestError('Category does not support variations');
      }
      return [];
    }

    // Validate each suggested variation
    variations.forEach(variation => {
      this.validateVariation(variation);
    });

    return variations;
  }

  validateVariation(variation) {
    if (!this.hasVariations()) {
      throw new BadRequestError('Category does not support variations');
    }

    // Validate required fields
    if (!variation.name) {
      throw new BadRequestError('Variation name is required');
    }

    if (variation.value === undefined || variation.value === null) {
      throw new BadRequestError('Variation value is required');
    }

    if (variation.recipeMultiplier === undefined || variation.recipeMultiplier === null) {
      throw new BadRequestError('Recipe multiplier is required');
    }

    // Validate value based on display type
    const displayTypeConfig = ProductCategory.DISPLAY_TYPES[this.displayType.toUpperCase()];
    displayTypeConfig.validateValue(variation.value);

    // Validate recipe multiplier
    if (typeof variation.recipeMultiplier !== 'number' || variation.recipeMultiplier <= 0) {
      throw new BadRequestError('Recipe multiplier must be a positive number');
    }

    return true;
  }

  formatVariationValue(value) {
    if (!this.hasVariations()) {
      throw new BadRequestError('Category does not support variations');
    }

    const displayTypeConfig = ProductCategory.DISPLAY_TYPES[this.displayType.toUpperCase()];
    return displayTypeConfig.formatValue(value);
  }

  // Helper method to generate variation display
  getVariationDisplay(variation) {
    if (!this.hasVariations()) {
      throw new BadRequestError('Category does not support variations');
    }

    return {
      name: variation.name,
      displayValue: this.formatVariationValue(variation.value),
      value: variation.value,
      recipeMultiplier: variation.recipeMultiplier,
    };
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

class IngredientCategory {
  constructor({
    name,
    description,
    isActive = true,
  }) {
    this.name = name;
    this.description = description;
    this.isActive = isActive;
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

class BakerySettings extends BaseModel {
  static INGREDIENT_CATEGORIES = [
    'Harinas y Almidones',
    'Líquidos Base',
    'Sazonadores Básicos',
    'Fermentos',
    'Lácteos y Proteínas',
    'Semillas y Granos',
    'Frutas y Vegetales',
    'Especias y Aromáticos',
    'Chocolates y Cocoa',
  ];

  static ORDER_STATUSES = [
    'Recibida',
    'En Produccion',
    'Preparada',
    'En Camino',
    'Entregada',
    'Cancelada',
  ];
  constructor({
    id,
    bakeryId,
    // Categories
    productCategories = [],
    ingredientCategories = [],
    // Order Statuses
    orderStatuses = [],
    // Theme
    theme = {},
    // Other settings...
    createdAt,
    updatedAt,
  }) {
    super({ id, createdAt, updatedAt });

    this.bakeryId = bakeryId;

    // Initialize categories
    this.productCategories = productCategories.map(cat =>
      cat instanceof ProductCategory ? cat : new ProductCategory(cat),
    );

    this.ingredientCategories = BakerySettings.INGREDIENT_CATEGORIES.map(string =>
      new IngredientCategory({ name: string, description: '', isActive: true }),
    );

    this.orderStatuses = BakerySettings.ORDER_STATUSES;
    this.theme = theme;
  }

  // Firestore data conversion
  toFirestore() {
    const data = super.toFirestore();
    // Ensure proper serialization of categories
    data.productCategories = this.productCategories.map(cat => cat.toPlainObject());
    data.ingredientCategories = this.ingredientCategories.map(cat => cat.toPlainObject());
    return data;
  }

  static fromFirestore(doc) {
    const data = doc.data();
    return new BakerySettings({
      id: doc.id,
      ...data,
    });
  }
}

module.exports = {
  BakerySettings,
  ProductCategory,
  IngredientCategory,
};
