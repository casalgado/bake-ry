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
    { symbol: 'Kg', name: 'Kilogram', type: 'weight', template: 'WEIGHT' },
    { symbol: 'g', name: 'Gram', type: 'weight', template: 'WEIGHT' },
    { symbol: 'L', name: 'Liter', type: 'volume', template: 'WEIGHT' },
    { symbol: 'ml', name: 'Milliliter', type: 'volume', template: 'WEIGHT' },
    { symbol: 'uds', name: 'Units', type: 'count', template: 'QUANTITY' },
    { symbol: 'docena', name: 'Dozen', type: 'count', template: 'QUANTITY' },
    { symbol: 'paquete', name: 'Package', type: 'count', template: 'QUANTITY' },
  ];

  static AVAILABLE_PAYMENT_METHODS = [
    { value: 'cash', label: 'Efectivo', displayText: 'EF' },
    { value: 'transfer', label: 'Transferencia', displayText: 'TR' },
    { value: 'card', label: 'Tarjeta', displayText: 'DF' },
    { value: 'davivienda', label: 'Davivienda', displayText: 'DV' },
    { value: 'bancolombia', label: 'Bancolombia', displayText: 'BC' },
    { value: 'complimentary', label: 'Regalo', displayText: 'RE' },
  ];

  static DEFAULT_VARIATION_TEMPLATES = {
    WEIGHT: {
      label: 'Weight',
      unit: 'g',
      defaults: [
        { name: 'mini', value: 300, basePrice: 0, recipeId: '' },
        { name: 'pequeño', value: 550, basePrice: 0, recipeId: '' },
        { name: 'mediano', value: 950, basePrice: 0, recipeId: '' },
        { name: 'grande', value: 1700, basePrice: 0, recipeId: '' },
      ],
    },
    QUANTITY: {
      label: 'Quantity',
      unit: 'uds',
      prefix: 'x',
      defaults: [
        { name: 'x4', value: 4, basePrice: 0, recipeId: '' },
        { name: 'x5', value: 5, basePrice: 0, recipeId: '' },
        { name: 'x6', value: 6, basePrice: 0, recipeId: '' },
        { name: 'x10', value: 10, basePrice: 0, recipeId: '' },
        { name: 'x12', value: 12, basePrice: 0, recipeId: '' },
        { name: 'x16', value: 16, basePrice: 0, recipeId: '' },
      ],
    },
    SIZE: {
      label: 'Size',
      unit: '',
      defaults: [
        { name: 'mini', value: 1, basePrice: 0, recipeId: '' },
        { name: 'pequeño', value: 2, basePrice: 0, recipeId: '' },
        { name: 'mediano', value: 3, basePrice: 0, recipeId: '' },
        { name: 'grande', value: 4, basePrice: 0, recipeId: '' },
        { name: 'xl', value: 5, basePrice: 0, recipeId: '' },

      ],
    },
  };

  constructor({
    id = 'default',
    orderStatuses = SystemSettings.ORDER_STATUSES,
    fulfillmentTypes = SystemSettings.FULFILLMENT_TYPES,
    paymentMethods = SystemSettings.PAYMENT_METHODS,
    unitOptions = SystemSettings.UNIT_OPTIONS,
    storageTemperatures = SystemSettings.STORAGE_TEMPERATURES,
    availablePaymentMethods = SystemSettings.AVAILABLE_PAYMENT_METHODS,
    defaultVariationTemplates = SystemSettings.DEFAULT_VARIATION_TEMPLATES,
    createdAt,
    updatedAt,
  }) {
    super({ id, createdAt, updatedAt });

    this.orderStatuses = orderStatuses;
    this.fulfillmentTypes = fulfillmentTypes;
    this.paymentMethods = paymentMethods;
    this.unitOptions = unitOptions;
    this.storageTemperatures = storageTemperatures;
    this.availablePaymentMethods = availablePaymentMethods;
    this.defaultVariationTemplates = defaultVariationTemplates;
  }

  static fromFirestore(doc) {
    const data = doc.data();
    return new SystemSettings({
      id: doc.id,
      ...data,
    });
  }
}

module.exports = SystemSettings;
