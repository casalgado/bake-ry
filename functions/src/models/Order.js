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
    currentPrice,
    variation,
    recipeId,
    taxPercentage = 0,
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
    this.basePrice = basePrice;
    this.currentPrice = currentPrice;
    this.variation = variation;
    this.recipeId = recipeId;
    this.taxPercentage = Number(Number(taxPercentage).toFixed(1));
    this.isComplimentary = isComplimentary;
    this.productionBatch = productionBatch;
    this.status = status;

    // Calculate derived values
    this.taxAmount = this.calculateTaxAmount();
    this.preTaxPrice = this.calculatePreTaxPrice();
    this.subtotal = this.calculateSubtotal();
  }

  calculateTaxAmount() {
    if (this.isComplimentary) return 0;
    return this.taxPercentage ?
      Math.round((this.currentPrice * this.taxPercentage) / (100 + this.taxPercentage)) : 0;
  }

  calculatePreTaxPrice() {
    if (this.isComplimentary) return 0;
    return this.currentPrice - this.taxAmount;
  }

  calculateSubtotal() {
    if (this.isComplimentary) return 0;
    return this.quantity * this.currentPrice;
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
      taxAmount: this.taxAmount,
      preTaxPrice: this.preTaxPrice,
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
    isDeliveryPaid = false,
    paymentMethod = 'transfer',

    // Fulfillment
    fulfillmentType = 'pickup',
    deliveryAddress = null,
    deliveryInstructions = '',
    deliveryDriverId = '-',
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
    this.isDeliveryPaid = isDeliveryPaid;
    this.paymentMethod = paymentMethod;

    // Fulfillment
    this.fulfillmentType = fulfillmentType;
    this.deliveryAddress = deliveryAddress;
    this.deliveryInstructions = deliveryInstructions;
    this.deliveryDriverId = deliveryDriverId;
    this.deliveryFee = deliveryFee;
    this.deliveryCost = deliveryCost;
    this.numberOfBags = numberOfBags;

    // Set isComplimentary based on paymentMethod
    this.isComplimentary = paymentMethod === 'complimentary';

    // Calculate all pricing components
    this.calculatePricing();

    // Notes and Flags
    this.customerNotes = customerNotes;
    this.internalNotes = internalNotes;
    this.isDeleted = isDeleted;
  }

  calculatePricing() {
    if (this.isComplimentary) {
      this.taxableSubtotal = 0;
      this.nonTaxableSubtotal = 0;
      this.subtotal = 0;
      this.totalTaxAmount = 0;
      this.preTaxTotal = 0;
      this.total = 0;
      return;
    }

    // Calculate subtotals
    this.taxableSubtotal = this.orderItems
      .filter(item => item.taxPercentage > 0)
      .reduce((sum, item) => sum + item.subtotal, 0);

    this.nonTaxableSubtotal = this.orderItems
      .filter(item => !item.taxPercentage)
      .reduce((sum, item) => sum + item.subtotal, 0);

    this.subtotal = this.taxableSubtotal + this.nonTaxableSubtotal;

    // Calculate tax amounts
    this.totalTaxAmount = this.orderItems
      .reduce((sum, item) => sum + (item.taxAmount * item.quantity), 0);

    // Calculate pre-tax total
    this.preTaxTotal = this.subtotal - this.totalTaxAmount;

    // Calculate final total
    if (this.fulfillmentType === 'delivery') {
      this.total = this.subtotal + this.deliveryFee;
    } else {
      this.total = this.subtotal;
    }
  }

  static get dateFields() {
    return [
      ...super.dateFields,
      'preparationDate',
      'dueDate',
    ];
  }

  toClientHistoryObject() {
    return {
      id: this.id,
      bakeryId: this.bakeryId,
      dueDate: this.dueDate,
      preparationDate: this.preparationDate,
      address: this.deliveryAddress,
      subtotal: this.subtotal,
      preTaxTotal: this.preTaxTotal,
      totalTaxAmount: this.totalTaxAmount,
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
