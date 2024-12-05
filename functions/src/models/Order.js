const BaseModel = require('./base/BaseModel');
const { generateId } = require('../utils/helpers');

class OrderItem {
  constructor({
    id,
    productId,
    productName,
    collectionId,
    collectionName,
    quantity,
    basePrice,
    currentPrice, // prices here are of orderitem total
    variation,
    recipeId,
    isComplimentary = false,
    productionBatch = 1,
    status = 0,
  }) {
    this.id = id || generateId();
    this.productId = productId;
    this.productName = productName;
    this.collectionId = collectionId;
    this.collectionName = collectionName;
    this.quantity = quantity;
    this.basePrice = basePrice; // prices here are of variation in order item
    this.currentPrice = currentPrice;
    this.variation = variation;  // stores the full variation object
    this.recipeId = recipeId;
    this.isComplimentary = isComplimentary;
    this.productionBatch = productionBatch;
    this.status = status;

    this.subtotal = this.calculateSubtotal();
  }

  calculateSubtotal() {
    return this.isComplimentary ? 0 : this.quantity * this.currentPrice;
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

  toClientHistoryObject() {
    return {
      productId: this.productId,
      productName: this.productName,
      collectionId: this.collectionId,
      collectionName: this.collectionName,
      isComplimentary: this.isComplimentary,
      quantity: this.quantity,
      currentPrice: this.currentPrice,
      variation: this.variation,
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
    orderItems = [],

    // Dates
    preparationDate,
    dueDate,
    createdAt,
    updatedAt,

    // Status and Payment
    status = 0,
    isPaid = false,
    paymentMethod = 'transfer',
    // Fulfillment
    fulfillmentType = 'pickup',
    deliveryAddress = null,
    deliveryInstructions = '',
    deliveryDriver = '-',
    deliveryFee = 0,
    deliveryCost = 0,
    numberOfBags = 1,

    // Notes
    customerNotes = '',
    internalNotes = '',
    isDeleted = false,

  } = {}) {
    super({ id, createdAt, updatedAt, preparationDate, dueDate });

    // Basic Information
    this.bakeryId = bakeryId;
    this.userId = userId;
    this.userName = userName;
    this.userEmail = userEmail;
    this.userPhone = userPhone;
    this.orderItems = orderItems.map(item =>
      item instanceof OrderItem ? item : new OrderItem({ ...item }),
    );

    // Status and Payment
    this.status = status;
    this.isPaid = isPaid;
    this.paymentMethod = paymentMethod;

    // Fulfillment
    this.fulfillmentType = fulfillmentType;
    this.deliveryAddress = deliveryAddress;
    this.deliveryInstructions = deliveryInstructions;
    this.deliveryDriver = deliveryDriver;
    this.deliveryFee = deliveryFee;
    this.deliveryCost = deliveryCost;
    this.numberOfBags = numberOfBags;

    // Pricing
    this.subtotal = this.calculateSubtotal();
    this.total = this.calculateTotal();

    // Notes
    this.customerNotes = customerNotes;
    this.internalNotes = internalNotes;

    // Flags
    this.isComplimentary = paymentMethod === 'complimentary';
    this.isDeleted = isDeleted;
  }

  static get dateFields() {
    return [
      ...super.dateFields,
      'preparationDate',
      'dueDate',
    ];
  }

  calculateSubtotal() {
    return this.isComplimentary ? 0 : this.orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  }

  calculateTotal() {
    return this.isComplimentary ? 0 : this.subtotal + this.deliveryFee;
  }

  toClientHistoryObject() {
    return {
      id: this.id,
      bakeryId: this.bakeryId,
      dueDate: this.dueDate,
      address: this.deliveryAddress,
      total: this.total,
      isDeleted: this.isDeleted,
      isComplimentary: this.isComplimentary,
      orderItems: this.orderItems.map(item => item.toClientHistoryObject()),
      fulfillmentType: this.fulfillmentType,
    };
  }

  toFirestore() {
    const data = super.toFirestore();
    if (this.orderItems.length > 0) {
      data.orderItems = this.orderItems.map(item => item.toPlainObject());
    }
    return data;
  }

  static fromFirestore(doc) {
    const data = super.fromFirestore(doc);
    return new Order({
      ...data,
      id: doc.id,
      orderItems: data.orderItems?.map(item => new OrderItem(item)),
    });
  }
}

module.exports = { Order, OrderItem };
