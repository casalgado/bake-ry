const BaseModel = require('./base/BaseModel');
const { generateId } = require('../utils/helpers');

class IngredientCategory {
  constructor({
    id = generateId(),
    name,
    description = '',
    displayOrder = 0,
    isActive = true,
  }) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.displayOrder = displayOrder;
    this.isActive = isActive;
  }

  toPlainObject() {
    const data = { ...this };
    Object.keys(data).forEach(key => {
      if (data[key] === undefined) {
        delete data[key];
      }
    });
    return data;
  }
}

class BakerySettings extends BaseModel {
  static ORDER_STATUSES = [
    'Recibida',
    'En Produccion',
    'Preparada',
    'En Camino',
    'Completada',
  ];

  static FULFILLMENT_TYPES = ['delivery', 'pickup'];
  static PAYMENT_METHODS = ['transfer', 'cash', 'card'];
  static UNIT_OPTIONS = ['kg', 'g', 'L', 'ml', 'unidades', 'docena', 'paquete'];
  static STORAGE_TEMPERATURES = ['Ambiente', 'Refrigeracion', 'Congelacion'];

  constructor({
    id,
    bakeryId,
    ingredientCategories = [],
    theme = {},
    features = {},
    suggestedProductVariations = {},
    createdAt,
    updatedAt,

  }) {
    super({ id, createdAt, updatedAt });

    this.bakeryId = bakeryId;
    this.ingredientCategories = ingredientCategories.map(cat =>
      cat instanceof IngredientCategory ? cat : new IngredientCategory(cat),
    );

    // Initialize other settings
    this.orderStatuses = BakerySettings.ORDER_STATUSES;
    this.fulfillmentTypes = BakerySettings.FULFILLMENT_TYPES;
    this.paymentMethods = BakerySettings.PAYMENT_METHODS;
    this.unitOptions = BakerySettings.UNIT_OPTIONS;
    this.storageTemperatures = BakerySettings.STORAGE_TEMPERATURES;
    this.suggestedProductVariations = suggestedProductVariations;
    this.theme = theme;
    this.features = features;

  }

  getCategoryById(categoryId) {
    return this.ingredientCategories.find(cat => cat.id === categoryId);
  }

  // Firestore data conversion
  toFirestore() {
    const data = super.toFirestore();
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
  IngredientCategory,
};
