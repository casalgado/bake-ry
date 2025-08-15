const BaseModel = require('./base/BaseModel');

class SystemSettings extends BaseModel {
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
  static AVAILABLE_PAYMENT_METHODS = [
    { value: 'cash', label: 'Efectivo', displayText: 'E' },
    { value: 'transfer', label: 'Transferencia', displayText: 'T' },
    { value: 'card', label: 'Tarjeta', displayText: 'DF' },
    { value: 'davivienda', label: 'Davivienda', displayText: 'D' },
    { value: 'bancolombia', label: 'Bancolombia', displayText: 'B' },
    { value: 'complimentary', label: 'Regalo', displayText: 'R' },
  ];

  constructor({
    id = 'default',
    orderStatuses = SystemSettings.ORDER_STATUSES,
    fulfillmentTypes = SystemSettings.FULFILLMENT_TYPES,
    paymentMethods = SystemSettings.PAYMENT_METHODS,
    unitOptions = SystemSettings.UNIT_OPTIONS,
    storageTemperatures = SystemSettings.STORAGE_TEMPERATURES,
    availablePaymentMethods = SystemSettings.AVAILABLE_PAYMENT_METHODS,
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
