const BaseModel = require('./base/BaseModel');

class OrderItem {
  constructor({
    productId,
    productVariantId,
    productName,
    quantity,
    unitPrice,
    recipeId,
    recipeVersion,
    isComplimentary = false,
  }) {
    this.productId = productId;
    this.productVariantId = productVariantId;
    this.productName = productName;
    this.quantity = quantity;
    this.unitPrice = unitPrice;
    this.recipeId = recipeId;
    this.recipeVersion = recipeVersion;
    this.isComplimentary = isComplimentary;
    this.subtotal = this.calculateSubtotal();
  }

  calculateSubtotal() {
    return this.isComplimentary ? 0 : this.quantity * this.unitPrice;
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

  toHistoryObject() {
    return {
      productId: this.productId,
      productVariantId: this.productVariantId,
      productName: this.productName,
      quantity: this.quantity,
      unitPrice: this.unitPrice,
      subtotal: this.subtotal,
    };
  }
}

class Order extends BaseModel {
  constructor({
    // Basic Information
    id,
    bakeryId,
    userId,
    userName,
    userEmail,
    userPhone,
    items = [],

    // Dates
    preparationDate,
    dueDate,
    createdAt,
    updatedAt,

    // Status and Payment
    status = 0,
    isPaid = false,
    paymentMethod = 'transfer-',
    paymentDetails = null,

    // Fulfillment
    fulfillmentType = 'pickup',
    deliveryAddress = null,
    deliveryInstructions = '',
    deliveryFee = 0,

    // Pricing
    subtotal = null,
    tax = null,
    total = null,

    // Notes
    customerNotes = '',
    internalNotes = '',

    // Flags
    isComplimentary = false,
  } = {}) {
    super({ id, createdAt, updatedAt });

    // Basic Information
    this.bakeryId = bakeryId;
    this.userId = userId;
    this.userName = userName;
    this.userEmail = userEmail;
    this.userPhone = userPhone;
    this.items = items.map(item =>
      item instanceof OrderItem ? item : new OrderItem({ ...item, isComplimentary }),
    );

    // Dates
    this.preparationDate = preparationDate;
    this.dueDate = dueDate;

    // Status and Payment
    this.status = status;
    this.isPaid = isPaid;
    this.paymentMethod = paymentMethod;
    this.paymentDetails = paymentDetails;

    // Fulfillment
    this.fulfillmentType = fulfillmentType;
    this.deliveryAddress = deliveryAddress;
    this.deliveryInstructions = deliveryInstructions;
    this.deliveryFee = deliveryFee;

    // Pricing
    this.subtotal = subtotal || this.calculateSubtotal();
    this.tax = tax || this.calculateTax();
    this.total = total || this.calculateTotal();

    // Notes
    this.customerNotes = customerNotes;
    this.internalNotes = internalNotes;

    // Flags
    this.isComplimentary = isComplimentary;
  }

  static get dateFields() {
    return [
      ...super.dateFields,
      'preparationDate',
      'dueDate',
    ];
  }

  calculateSubtotal() {
    return this.isComplimentary ? 0 : this.items.reduce((sum, item) => sum + item.subtotal, 0);
  }

  calculateTax() {
    return this.isComplimentary ? 0 : this.subtotal * 0.1;
  }

  calculateTotal() {
    return this.isComplimentary ? 0 : this.subtotal + this.tax + this.deliveryFee;
  }

  toFirestore() {
    const data = super.toFirestore();
    if (this.items.length > 0) {
      data.items = this.items.map(item => item.toPlainObject());
    }
    return data;
  }

  toHistoryObject() {
    return {
      id: this.id,
      bakeryId: this.bakeryId,
      dueDate: this.dueDate,
      total: this.total,
      items: this.items.map(item => item.toHistoryObject()),
      fulfillmentType: this.fulfillmentType,
    };
  }

  static fromFirestore(doc) {
    const data = super.fromFirestore(doc);
    return new Order({
      ...data,
      id: doc.id,
      items: data.items?.map(item => new OrderItem(item)),
    });
  }
}

module.exports = { Order, OrderItem };
