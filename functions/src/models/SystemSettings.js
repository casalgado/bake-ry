const BaseModel = require('./base/BaseModel');

class SystemSettings extends BaseModel {
  static ORDER_STATUSES = [
    'Recibida',
    'En Produccion',
    'Preparada',
    'En Camino',
    'Completada',
  ];

  static FULFILLMENT_TYPES = [
    { key: 'delivery', value: 'Delivery' },
    { key: 'pickup', value: 'Pickup' },
  ];
  static STORAGE_TEMPERATURES = [
    { key: 'dry', value: 'Dry Storage' },           // or 'shelf_stable'
    { key: 'refrigerated', value: 'Refrigerated' },  // or 'chilled'
    { key: 'frozen', value: 'Frozen' },
  ];
  static UNIT_OPTIONS = [

    { symbol: 'g', name: 'Gramo', type: 'weight', template: 'WEIGHT' },
    { symbol: 'lb', name: 'Libra', type: 'weight', template: 'WEIGHT' },

    { symbol: 'ml', name: 'Mililitro', type: 'volume', template: 'WEIGHT' },
    { symbol: 'uds', name: 'Unidades', type: 'count', template: 'QUANTITY' },
    { symbol: 'dz', name: 'Docena', type: 'count', template: 'QUANTITY' },
    { symbol: 'pkt', name: 'Paquete', type: 'count', template: 'QUANTITY' },

  ];

  static AVAILABLE_PAYMENT_METHODS = [
    { value: 'cash', label: 'Efectivo', displayText: 'EF' },
    { value: 'transfer', label: 'Transferencia', displayText: 'TR' },
    { value: 'card', label: 'Tarjeta', displayText: 'DF' },
    { value: 'davivienda', label: 'Davivienda', displayText: 'DV' },
    { value: 'bancolombia', label: 'Bancolombia', displayText: 'BC' },
    { value: 'quote', label: 'Cotización', displayText: 'CO' },
    { value: 'complimentary', label: 'Regalo', displayText: 'RE' },
  ];

  static DEFAULT_VARIATION_TEMPLATES = {
    WEIGHT: {
      label: 'Weight',
      unit: 'g',
      defaults: [
        { name: 'Mini', value: 50, basePrice: 0, recipeId: '' },
        { name: 'Pequeño', value: 100, basePrice: 0, recipeId: '' },
        { name: 'Mediano', value: 200, basePrice: 0, recipeId: '' },
        { name: 'Grande', value: 300, basePrice: 0, recipeId: '' },
        { id: 'fixed-fallback-variation', name: 'otra', value: 50, basePrice: 0, recipeId: '', displayOrder: 999 },
      ],
    },
    QUANTITY: {
      label: 'Quantity',
      unit: 'uds',
      prefix: 'x',
      defaults: [
        { name: 'x4', value: 4, basePrice: 0, recipeId: '' },
        { name: 'x6', value: 6, basePrice: 0, recipeId: '' },
        { name: 'x12', value: 12, basePrice: 0, recipeId: '' },
        { id: 'fixed-fallback-variation', name: 'otra', value: 1, basePrice: 0, recipeId: '', displayOrder: 999 },
      ],
    },
    SIZE: {
      label: 'Size',
      unit: '',
      defaults: [
        { name: 'Pequeño', value: 2, basePrice: 0, recipeId: '' },
        { name: 'Mediano', value: 4, basePrice: 0, recipeId: '' },
        { name: 'Grande', value: 6, basePrice: 0, recipeId: '' },
        { id: 'fixed-fallback-variation', name: 'otra', value: 1, basePrice: 0, recipeId: '', displayOrder: 999 },
      ],
    },
  };

  constructor({
    id = 'default',
    createdAt,
    updatedAt,
  }) {
    super({ id, createdAt, updatedAt });

    // Always use static constants as source of truth
    this.orderStatuses = SystemSettings.ORDER_STATUSES;
    this.fulfillmentTypes = SystemSettings.FULFILLMENT_TYPES;
    this.unitOptions = SystemSettings.UNIT_OPTIONS;
    this.storageTemperatures = SystemSettings.STORAGE_TEMPERATURES;
    this.availablePaymentMethods = SystemSettings.AVAILABLE_PAYMENT_METHODS;
    this.defaultVariationTemplates = SystemSettings.DEFAULT_VARIATION_TEMPLATES;
  }

  static fromFirestore(doc) {
    const data = doc.data();
    return new SystemSettings({
      id: doc.id,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}

module.exports = SystemSettings;
