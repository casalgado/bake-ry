const BaseModel = require('./base/BaseModel');

class OrderItem {
  constructor({
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
    status = 0,
  }) {
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

  toHistoryObject() {
    return {
      productId: this.productId,
      productName: this.productName,
      collectionId: this.collectionId,
      collectionName: this.collectionName,
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
    deliveryFee = 0,

    // Notes
    customerNotes = '',
    internalNotes = '',

    // Flags
    isComplimentary = false,
  } = {}) {
    super({ id, createdAt, updatedAt, preparationDate, dueDate });

    // Basic Information
    this.bakeryId = bakeryId;
    this.userId = userId;
    this.userName = userName;
    this.userEmail = userEmail;
    this.userPhone = userPhone;
    this.orderItems = orderItems.map(item =>
      item instanceof OrderItem ? item : new OrderItem({ ...item, isComplimentary }),
    );

    // Status and Payment
    this.status = status;
    this.isPaid = isPaid;
    this.paymentMethod = paymentMethod;

    // Fulfillment
    this.fulfillmentType = fulfillmentType;
    this.deliveryAddress = deliveryAddress;
    this.deliveryInstructions = deliveryInstructions;
    this.deliveryFee = deliveryFee;

    // Pricing
    this.subtotal = this.calculateSubtotal();
    this.total = this.calculateTotal();

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
    return this.isComplimentary ? 0 : this.orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  }

  calculateTotal() {
    return this.isComplimentary ? 0 : this.subtotal + this.deliveryFee;
  }

  toFirestore() {
    const data = super.toFirestore();
    if (this.orderItems.length > 0) {
      data.orderItems = this.orderItems.map(item => item.toPlainObject());
    }
    return data;
  }

  toHistoryObject() {
    return {
      id: this.id,
      bakeryId: this.bakeryId,
      dueDate: this.dueDate,
      address: this.deliveryAddress,
      total: this.total,
      orderItems: this.orderItems.map(item => item.toHistoryObject()),
      fulfillmentType: this.fulfillmentType,
    };
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
