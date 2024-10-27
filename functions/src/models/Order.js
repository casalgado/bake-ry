class OrderItem {
  constructor({
    productId,
    productName, // Denormalized for order history
    quantity,
    unitPrice, // Price at time of order
    notes, // Special instructions
    recipe, // Reference to recipe used
    status, // In preparation, completed, etc.
    isComplimentary = false,
    complimentaryReason = null,
  }) {
    this.productId = productId;
    this.productName = productName;
    this.quantity = quantity;
    this.unitPrice = unitPrice;
    this.notes = notes || "";
    this.recipe = recipe;
    this.status = status || "pending";
    this.isComplimentary = isComplimentary;
    this.complimentaryReason = complimentaryReason;
    this.subtotal = this.calculateSubtotal();
  }

  calculateSubtotal() {
    return this.isComplimentary ? 0 : this.quantity * this.unitPrice;
  }

  updateStatus(newStatus) {
    this.status = newStatus;
  }
}

class Order {
  constructor({
    id,
    bakeryId,
    userId, // Customer who placed the order
    userName, // Denormalized for quick access
    userEmail, // Denormalized for quick access
    userPhone, // Denormalized for quick access

    // Order Items
    items, // Array of OrderItem objects

    // Dates
    orderDate, // When the order was placed
    requiredDate, // When the customer needs it
    preparationDate, // When we'll start preparing
    completedDate, // When it was completed

    // Status Information
    status, // pending, confirmed, in_preparation, ready, completed, cancelled
    statusHistory, // Track status changes

    // Payment Information
    subtotal,
    tax,
    deliveryFee,
    total,
    paymentStatus, // pending, paid, refunded
    paymentMethod, // cash, card, transfer
    paymentDetails, // Reference number, last 4 digits, etc.

    // Delivery/Pickup Information
    fulfillmentType, // delivery or pickup
    deliveryAddress,
    deliveryInstructions,

    // Notes
    customerNotes, // Notes from customer
    internalNotes, // Notes for staff

    // Metadata
    createdAt,
    updatedAt,

    // Complimentary Order Information
    isComplimentary = false,
    complimentaryReason = null,
    orderMessage = null,
  }) {
    // Basic Information
    this.id = id;
    this.bakeryId = bakeryId;
    this.userId = userId;
    this.userName = userName;
    this.userEmail = userEmail;
    this.userPhone = userPhone;

    // Order Items
    this.items =
      items?.map(
        (item) =>
          new OrderItem({
            ...item,
            isComplimentary: isComplimentary,
            complimentaryReason: complimentaryReason,
          })
      ) || [];

    // Dates
    this.orderDate = orderDate || new Date();
    this.requiredDate = requiredDate;
    this.preparationDate = preparationDate;
    this.completedDate = completedDate;

    // Status Information
    this.status = status || "pending";
    this.statusHistory = statusHistory || [
      {
        status: "pending",
        date: new Date(),
        note: "Order created",
      },
    ];

    // Complimentary Information
    this.isComplimentary = isComplimentary;
    this.complimentaryReason = complimentaryReason;
    this.orderMessage = orderMessage;

    // Payment Information
    this.subtotal = subtotal || this.calculateSubtotal();
    this.tax = tax || this.calculateTax();
    this.deliveryFee = deliveryFee || 0;
    this.total = total || this.calculateTotal();
    this.paymentStatus = isComplimentary
      ? "complimentary"
      : paymentStatus || "pending";
    this.paymentMethod = paymentMethod;
    this.paymentDetails = paymentDetails;

    // Delivery/Pickup Information
    this.fulfillmentType = fulfillmentType || "pickup";
    this.deliveryAddress = deliveryAddress;
    this.deliveryInstructions = deliveryInstructions;

    // Notes
    this.customerNotes = customerNotes || "";
    this.internalNotes = internalNotes || "";

    // Metadata
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
  }

  // Firestore Data Conversion
  toFirestore() {
    const data = { ...this };
    delete data.id;
    // Remove undefined values
    Object.keys(data).forEach((key) => {
      if (data[key] === undefined) {
        delete data[key];
      }
    });
    return data;
  }

  static fromFirestore(doc) {
    const data = doc.data();
    return new Order({
      id: doc.id,
      ...data,
      orderDate: data.orderDate?.toDate(),
      requiredDate: data.requiredDate?.toDate(),
      preparationDate: data.preparationDate?.toDate(),
      completedDate: data.completedDate?.toDate(),
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
      statusHistory: data.statusHistory?.map((sh) => ({
        ...sh,
        date: sh.date?.toDate(),
      })),
    });
  }

  // Calculations
  calculateSubtotal() {
    return this.isComplimentary
      ? 0
      : this.items.reduce((sum, item) => sum + item.subtotal, 0);
  }

  calculateTax() {
    return this.isComplimentary ? 0 : this.subtotal * 0.1; // 10% tax, adjust as needed
  }

  calculateTotal() {
    return this.isComplimentary
      ? 0
      : this.subtotal + this.tax + this.deliveryFee;
  }

  // Order Management
  addItem(item) {
    const orderItem = new OrderItem({
      ...item,
      isComplimentary: this.isComplimentary,
      complimentaryReason: this.complimentaryReason,
    });
    this.items.push(orderItem);
    this.updateTotals();
    return orderItem;
  }

  removeItem(productId) {
    this.items = this.items.filter((item) => item.productId !== productId);
    this.updateTotals();
  }

  updateTotals() {
    this.subtotal = this.calculateSubtotal();
    this.tax = this.calculateTax();
    this.total = this.calculateTotal();
    this.updatedAt = new Date();
  }

  // Status Management
  updateStatus(newStatus, note = "") {
    this.status = newStatus;
    this.statusHistory.push({
      status: newStatus,
      date: new Date(),
      note,
    });
    this.updatedAt = new Date();

    if (newStatus === "completed") {
      this.completedDate = new Date();
    }
  }

  // Payment Management
  updatePaymentStatus(newStatus, details = {}) {
    this.paymentStatus = newStatus;
    this.paymentDetails = { ...this.paymentDetails, ...details };
    this.updatedAt = new Date();
  }

  // Validation Methods
  canBePrepared() {
    if (this.isComplimentary) return true;
    return (
      this.paymentStatus === "paid" &&
      this.status === "confirmed" &&
      this.requiredDate > new Date()
    );
  }

  isOverdue() {
    return (
      this.requiredDate < new Date() &&
      !["completed", "cancelled"].includes(this.status)
    );
  }

  // Timeline Management
  setPreparationDate(date) {
    this.preparationDate = date;
    this.updatedAt = new Date();
  }
}

module.exports = { Order, OrderItem };
