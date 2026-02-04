const BaseModel = require('./base/BaseModel');
const Combination = require('./Combination');
const { generateId } = require('../utils/helpers');

class OrderItem {
  constructor({
    id,
    productId,
    productName,
    productDescription,
    collectionId,
    collectionName,
    quantity,
    basePrice,
    currentPrice,
    costPrice = 0,
    variation,
    combination,
    recipeId,
    taxPercentage = 0,
    isComplimentary = false,
    productionBatch = 1,
    status = 0,
    taxMode = 'inclusive',
    displayOrder = 0,
    referencePrice,
    discountType = null,
    discountValue = 0,
    invoiceTitle = '',
  }) {
    this.id = id || generateId();
    this.productId = productId;
    this.productName = productName;
    this.productDescription = productDescription || '';
    this.collectionId = collectionId;
    this.collectionName = collectionName;
    this.quantity = quantity;
    this.basePrice = basePrice;
    this.currentPrice = currentPrice;
    this.costPrice = costPrice;
    this.recipeId = recipeId;
    this.taxPercentage = Number(Number(taxPercentage).toFixed(1));
    this.isComplimentary = isComplimentary;
    this.productionBatch = productionBatch;
    this.status = status;
    this.taxMode = taxMode;
    this.displayOrder = displayOrder;

    // Discount tracking fields
    this.referencePrice = basePrice > 0 ? basePrice : (referencePrice ?? currentPrice);
    this.discountType = discountType;
    this.discountValue = discountValue;

    // Auto-migration: Convert old variation to new combination
    if (variation && !combination) {
      this.combination = Combination.fromLegacyVariation(variation, currentPrice, basePrice);
      this.variation = variation; // Keep for historical reference
    } else if (combination) {
      this.combination = new Combination(combination);
      this.variation = variation; // May be null for new orders
    } else {
      // Handle case where variation is null/undefined and no combination exists
      this.variation = null; // Explicitly set to null instead of leaving undefined
      this.combination = null;
    }

    // Generate invoice title (use provided or generate default)
    this.invoiceTitle = invoiceTitle || this.generateDefaultInvoiceTitle();

    // Calculate derived values
    this.taxAmount = this.calculateTaxAmount();
    this.preTaxPrice = this.calculatePreTaxPrice();
    this.subtotal = this.calculateSubtotal();
  }

  calculateTaxAmount() {
    if (this.isComplimentary) return 0;
    if (!this.taxPercentage) return 0;
    if (this.taxMode === 'exclusive') {
      return Math.round((this.currentPrice * this.taxPercentage) / 100);
    }
    return Math.round((this.currentPrice * this.taxPercentage) / (100 + this.taxPercentage));
  }

  calculatePreTaxPrice() {
    if (this.isComplimentary) return 0;
    if (this.taxMode === 'exclusive') {
      return this.currentPrice;
    }
    return this.currentPrice - this.taxAmount;
  }

  calculateSubtotal() {
    if (this.isComplimentary) return 0;
    if (this.taxMode === 'exclusive') {
      return this.quantity * (this.currentPrice + this.taxAmount);
    }
    return this.quantity * this.currentPrice;
  }

  // Helper to get display name from combination or variation
  getVariationName() {
    if (this.combination) {
      return this.combination.getDisplayName();
    }
    return this.variation?.name || '';
  }

  getItemTotal() {
    if (this.isComplimentary) return 0;

    const price = this.combination ?
      this.combination.currentPrice :
      this.currentPrice;

    return price * this.quantity;
  }

  // Get the effective price from combination or fallback to currentPrice
  getEffectivePrice() {
    return this.combination ? this.combination.currentPrice : this.currentPrice;
  }

  // Generate default invoice title from product name and combination/variation
  generateDefaultInvoiceTitle() {
    const capitalize = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
    let title = capitalize(this.productName || 'Producto');

    if (this.combination?.name) {
      const combinationText = this.combination.name
        .split('+')
        .map(e => e.trim().toLowerCase())
        .join(', ');
      title += ` - ${combinationText}`;
    } else if (this.variation?.name) {
      title += ` (${capitalize(this.variation.name)})`;
    }

    return title;
  }

  toPlainObject() {
    const data = { ...this };

    // Serialize combination if it exists
    if (this.combination) {
      data.combination = this.combination.toFirestore();
    }

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
      productDescription: this.productDescription,
      invoiceTitle: this.invoiceTitle,
      collectionId: this.collectionId,
      collectionName: this.collectionName,
      isComplimentary: this.isComplimentary,
      taxPercentage: this.taxPercentage,
      taxMode: this.taxMode,
      quantity: this.quantity,
      currentPrice: this.currentPrice,
      costPrice: this.costPrice,
      variation: this.variation,
      combination: this.combination ? this.combination.toFirestore() : null,
      taxAmount: this.taxAmount,
      preTaxPrice: this.preTaxPrice,
      subtotal: this.subtotal,
      displayOrder: this.displayOrder,
      referencePrice: this.referencePrice,
      discountType: this.discountType,
      discountValue: this.discountValue,
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
    userCategory = '',
    userLegalName = '',
    userNationalId = '',
    orderItems = [],

    // Dates
    preparationDate,
    dueDate,
    dueTime,
    createdAt,
    updatedAt,
    paymentDate = null,
    partialPaymentDate = null,

    // Status and Payment
    status = 0,
    isPaid = false,

    isDeliveryPaid = false,
    paymentMethod = 'transfer',
    partialPaymentAmount = 0,

    // Fulfillment
    fulfillmentType = 'pickup',
    deliveryAddress = '',
    deliveryInstructions = '',
    deliveryDriverId = '-',
    driverMarkedAsPaid = false,
    deliverySequence = 1,
    deliveryFee = 0,
    deliveryCost = 0,
    numberOfBags = 1,

    // Notes
    customerNotes = '',
    deliveryNotes = '',
    internalNotes = '',
    isDeleted = false,
    lastEditedBy = null,

    // Invoice Customizations
    invoiceCustomizations = {},

    // Tax Mode
    taxMode = 'inclusive',

    // Order-level discount
    orderDiscountType = null,
    orderDiscountValue = 0,
  } = {}) {
    super({ id, createdAt, updatedAt, preparationDate, dueDate, paymentDate, partialPaymentDate });

    // Basic Information
    this.bakeryId = bakeryId;
    this.userId = userId;
    this.userName = userName;
    this.userEmail = userEmail;
    this.userPhone = userPhone;
    this.userLegalName = userLegalName;
    this.userCategory = userCategory;

    this.userNationalId = userNationalId;
    this.taxMode = taxMode;
    this.orderItems = orderItems.map(item =>
      item instanceof OrderItem ? item : new OrderItem({ ...item, taxMode }),
    );
    this.dueTime = dueTime;

    // Status and Payment
    this.status = status;
    this.isPaid = isPaid;
    this.isDeliveryPaid = isDeliveryPaid;
    this.paymentMethod = paymentMethod;
    this.partialPaymentAmount = partialPaymentAmount;

    // Fulfillment
    this.fulfillmentType = fulfillmentType;
    this.deliveryAddress = deliveryAddress;
    this.deliveryInstructions = deliveryInstructions;
    this.deliveryDriverId = deliveryDriverId;
    this.driverMarkedAsPaid = driverMarkedAsPaid;
    this.deliverySequence = deliverySequence;
    this.deliveryFee = deliveryFee == '' ? 0 : deliveryFee;
    this.deliveryCost = deliveryCost == '' ? 0 : deliveryCost;
    this.numberOfBags = numberOfBags == '' ? 0 : numberOfBags;

    // Set isComplimentary based on paymentMethod
    this.isComplimentary = paymentMethod === 'complimentary' || paymentMethod === 'quote';
    this.isQuote = paymentMethod === 'quote';

    // Order-level discount
    this.orderDiscountType = orderDiscountType;
    this.orderDiscountValue = orderDiscountValue || 0;

    // Calculate all pricing components
    this.calculatePricing();

    // Invoice Customizations - merge with defaults
    this.invoiceCustomizations = {
      termsAndConditions: '',
      notes: '',
      customTitle: '',
      ...(invoiceCustomizations || {}),
    };

    // Notes and Flags
    this.customerNotes = customerNotes;
    this.deliveryNotes = deliveryNotes;
    this.internalNotes = internalNotes;
    this.isDeleted = isDeleted;
    this.lastEditedBy = lastEditedBy ? {
      userId: lastEditedBy.userId || null,
      email: lastEditedBy.email || null,
      role: lastEditedBy.role || null,
    } : null;
  }

  calculatePricing() {
    if (this.isComplimentary && !this.isQuote) {
      this.taxableSubtotal = 0;
      this.nonTaxableSubtotal = 0;
      this.subtotal = 0;
      this.totalTaxAmount = 0;
      this.preTaxTotal = 0;
      this.orderDiscountAmount = 0;
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

    // Calculate tax amounts from items (before order discount)
    const itemsTotalTaxAmount = this.orderItems
      .reduce((sum, item) => sum + (item.taxAmount * item.quantity), 0);

    // Calculate pre-tax total from items (before order discount)
    const itemsPreTaxTotal = this.subtotal - itemsTotalTaxAmount;

    // Calculate order-level discount amount (applies to subtotal, not delivery)
    this.orderDiscountAmount = this.calculateOrderDiscountAmount();

    // Apply order discount proportionally to tax and pre-tax
    // totalTaxAmount and preTaxTotal store the ACTUAL values after discount
    if (this.orderDiscountAmount > 0 && this.subtotal > 0) {
      const discountRatio = this.orderDiscountAmount / this.subtotal;
      this.totalTaxAmount = Math.round(itemsTotalTaxAmount * (1 - discountRatio));
      this.preTaxTotal = Math.round(itemsPreTaxTotal * (1 - discountRatio));
    } else {
      this.totalTaxAmount = itemsTotalTaxAmount;
      this.preTaxTotal = itemsPreTaxTotal;
    }

    // Calculate final total: subtotal - order discount + delivery fee
    const discountedSubtotal = this.subtotal - this.orderDiscountAmount;
    if (this.fulfillmentType === 'delivery') {
      this.total = discountedSubtotal + this.deliveryFee;
    } else {
      this.total = discountedSubtotal;
    }
  }

  calculateOrderDiscountAmount() {
    if (!this.orderDiscountType || !this.orderDiscountValue) {
      return 0;
    }

    if (this.orderDiscountType === 'percentage') {
      return Math.round((this.subtotal * this.orderDiscountValue) / 100);
    } else if (this.orderDiscountType === 'fixed') {
      // Fixed discount cannot exceed subtotal
      return Math.min(this.orderDiscountValue, this.subtotal);
    }

    return 0;
  }

  // Get order items sorted by displayOrder
  getSortedOrderItems() {
    return [...this.orderItems].sort((a, b) => a.displayOrder - b.displayOrder);
  }

  // Normalize displayOrder values to be sequential (0, 1, 2, ...)
  normalizeItemDisplayOrders() {
    const sorted = this.getSortedOrderItems();
    sorted.forEach((item, index) => {
      item.displayOrder = index;
    });
  }

  // Move an item up or down by one position
  reorderItem(itemId, direction) {
    // Auto-normalize if all items have same displayOrder (handles legacy data)
    const allSame = this.orderItems.every(item => item.displayOrder === this.orderItems[0]?.displayOrder);
    if (allSame && this.orderItems.length > 1) {
      this.normalizeItemDisplayOrders();
    }

    const sorted = this.getSortedOrderItems();
    const currentIndex = sorted.findIndex(item => item.id === itemId);

    if (currentIndex === -1) return false;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    // Check boundaries
    if (targetIndex < 0 || targetIndex >= sorted.length) return false;

    // Swap displayOrder values
    const currentItem = sorted[currentIndex];
    const targetItem = sorted[targetIndex];
    const tempOrder = currentItem.displayOrder;
    currentItem.displayOrder = targetItem.displayOrder;
    targetItem.displayOrder = tempOrder;

    return true;
  }

  // Move an item to a specific position (1-indexed for UI consistency)
  moveItemToPosition(itemId, newPosition) {
    const sorted = this.getSortedOrderItems();
    const currentIndex = sorted.findIndex(item => item.id === itemId);

    if (currentIndex === -1) return false;

    // Convert 1-indexed position to 0-indexed
    const targetIndex = newPosition - 1;

    if (targetIndex < 0 || targetIndex >= sorted.length) return false;
    if (targetIndex === currentIndex) return false;

    // Remove item from current position and insert at new position
    const [item] = sorted.splice(currentIndex, 1);
    sorted.splice(targetIndex, 0, item);

    // Reassign displayOrder based on new positions
    sorted.forEach((item, index) => {
      item.displayOrder = index;
    });

    return true;
  }

  static get dateFields() {
    return [
      ...super.dateFields,
      'preparationDate',
      'paymentDate',
      'partialPaymentDate',
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
      orderDiscountType: this.orderDiscountType,
      orderDiscountValue: this.orderDiscountValue,
      orderDiscountAmount: this.orderDiscountAmount,
      total: this.total,
      taxMode: this.taxMode,
      isDeleted: this.isDeleted,
      isComplimentary: this.isComplimentary,
      orderItems: this.orderItems.map(item => item.toClientHistoryObject()),
      fulfillmentType: this.fulfillmentType,
      paymentMethod: this.paymentMethod,
      deliveryFee: this.deliveryFee,
    };
  }

  toFirestore() {
    const data = super.toFirestore();
    if (this.orderItems.length > 0) {
      data.orderItems = this.orderItems.map(item => item.toPlainObject());
    }
    data.lastEditedBy = this.lastEditedBy || null;
    data.invoiceCustomizations = this.invoiceCustomizations;
    return data;
  }

  static fromFirestore(doc) {
    const data = super.fromFirestore(doc);

    return new Order({
      ...data,
      id: doc.id,
      paymentDate: data.isPaid ? data.paymentDate : null,
      orderItems: data.orderItems?.map(item => new OrderItem(item)),
    });
  }
}

module.exports = { Order, OrderItem };
