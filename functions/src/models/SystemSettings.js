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
    { value: 'complimentary', label: 'Regalo', displayText: 'RE' },
  ];

  static DEFAULT_VARIATION_TEMPLATES = {
    WEIGHT: {
      label: 'Weight',
      unit: 'g',
      defaults: [
        { name: 'mini', value: 50, basePrice: 0, recipeId: '' },
        { name: 'pequeño', value: 100, basePrice: 0, recipeId: '' },
        { name: 'mediano', value: 200, basePrice: 0, recipeId: '' },
        { name: 'grande', value: 300, basePrice: 0, recipeId: '' },
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
        { name: 'pequeño', value: 2, basePrice: 0, recipeId: '' },
        { name: 'mediano', value: 4, basePrice: 0, recipeId: '' },
        { name: 'grande', value: 6, basePrice: 0, recipeId: '' },
        { id: 'fixed-fallback-variation', name: 'otra', value: 1, basePrice: 0, recipeId: '', displayOrder: 999 },
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
