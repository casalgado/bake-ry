// models/BakerySettings.js
const BaseModel = require('./base/BaseModel');
const { BadRequestError } = require('../utils/errors');
const { generateId } = require('../utils/helpers');

class ProductCategory {
  static DISPLAY_TYPES = {
    WEIGHT: {

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
    'Completada',
  ];

  static PRODUCT_CATEGORIES = [
    {
      'name': 'Café',
      'description': 'Cafe de la sierra nevada',
      'displayType': null,
      'suggestedVariations': [],
      'isActive': true,
    },
    {
      'name': 'Masa Madre',
      'description': 'Panes artesanales fermentados naturalmente',
      'displayType': 'weight',
      'suggestedVariations': [
        {
          'name': 'Mini',
          'value': 100,
          'recipeMultiplier': 0.2,
        },
        {
          'name': 'Pequeño',
          'value': 500,
          'recipeMultiplier': 1,
        },
        {
          'name': 'Mediano',
          'value': 950,
          'recipeMultiplier': 2,
        },
        {
          'name': 'Grande',
          'value': 1700,
          'recipeMultiplier': 3.5,
        },
      ],
      'isActive': true,
    },
    {
      'name': 'Productos Congelados',
      'description': 'Para hornear en casa cuando quieras',
      'displayType': 'quantity',
      'suggestedVariations': [
        {
          'name': 'Media Docena',
          'value': 6,
          'recipeMultiplier': 1,
        },
        {
          'name': 'Docena',
          'value': 12,
          'recipeMultiplier': 2,
        },
        {
          'name': 'Docena y Media',
          'value': 18,
          'recipeMultiplier': 3,
        },
      ],
      'isActive': true,
    },
  ];

  static FULFILLMENT_TYPES = ['delivery', 'pickup'];
  static PAYMENT_METHODS = ['transfer', 'cash', 'card'];

  constructor({
    id,
    bakeryId,
    theme = {},
    createdAt,
    updatedAt,
  }) {
    super({ id, createdAt, updatedAt });

    this.bakeryId = bakeryId;

    // Initialize categories
    this.productCategories = BakerySettings.PRODUCT_CATEGORIES.map(cat =>
      cat instanceof ProductCategory ? cat : new ProductCategory(cat),
    );

    this.ingredientCategories = BakerySettings.INGREDIENT_CATEGORIES.map(string =>
      new IngredientCategory({ name: string, description: '', isActive: true }),
    );

    this.orderStatuses = BakerySettings.ORDER_STATUSES;
    this.fulfillmentTypes = BakerySettings.FULFILLMENT_TYPES;
    this.paymentMethods = BakerySettings.PAYMENT_METHODS;
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
