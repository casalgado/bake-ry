const BaseModel = require('./base/BaseModel');

class PayuTransaction extends BaseModel {
  constructor({
    id,
    bakeryId,

    // PayU Transaction Information
    payuTransactionId,
    payuOrderId,
    payuState,
    payuResponseCode,
    payuAuthorizationCode,
    payuTrazabilityCode,
    payuPaymentNetworkResponseCode,
    payuPaymentNetworkResponseErrorMessage,
    cardId,

    // Token Information (if used)
    tokenId,
    paymentMethod,

    // Transaction Details
    amount,
    currency = 'COP',
    description,
    reference,

    // Customer Information
    payerId,
    payerFullName,
    payerEmail,
    payerPhone,
    payerIdentificationNumber,

    // Transaction Type and Context
    transactionType = 'AUTHORIZATION_AND_CAPTURE', // AUTHORIZATION, CAPTURE, AUTHORIZATION_AND_CAPTURE
    paymentContext, // 'ORDER_PAYMENT', 'SUBSCRIPTION', 'STANDALONE', etc.
    relatedOrderId, // If this payment is for an order

    // Recurring Payment Information
    isRecurring = false,
    recurringFrequency, // 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'
    recurringStartDate,
    parentRecurringId, // If this is a recurring payment instance

    // Status and Metadata
    status = 'PENDING', // PENDING, APPROVED, DECLINED, ERROR, CANCELLED
    isDeleted = false,
    lastEditedBy = null,

    // Dates
    createdAt,
    updatedAt,
    processedAt,

    // Extra PayU Data
    extraParameters = {},
    additionalInfo = {},

  } = {}) {
    super({ id, createdAt, updatedAt });

    // Basic Information
    this.bakeryId = bakeryId;

    // PayU Transaction Information
    this.payuTransactionId = payuTransactionId;
    this.payuOrderId = payuOrderId;
    this.payuState = payuState;
    this.payuResponseCode = payuResponseCode;
    this.payuAuthorizationCode = payuAuthorizationCode;
    this.payuTrazabilityCode = payuTrazabilityCode;
    this.payuPaymentNetworkResponseCode = payuPaymentNetworkResponseCode;
    this.payuPaymentNetworkResponseErrorMessage = payuPaymentNetworkResponseErrorMessage;
    this.cardId = cardId; // If using a saved card, this is the card ID

    // Token Information
    this.tokenId = tokenId;
    this.paymentMethod = paymentMethod;

    // Transaction Details
    this.amount = amount;
    this.currency = currency;
    this.description = description;
    this.reference = reference;

    // Customer Information
    this.payerId = payerId;
    this.payerFullName = payerFullName;
    this.payerEmail = payerEmail;
    this.payerPhone = payerPhone;
    this.payerIdentificationNumber = payerIdentificationNumber;

    // Transaction Type and Context
    this.transactionType = transactionType;
    this.paymentContext = paymentContext;
    this.relatedOrderId = relatedOrderId;

    // Recurring Payment Information
    this.isRecurring = isRecurring;
    this.recurringFrequency = recurringFrequency;
    this.recurringStartDate = this.constructor.ensureDate(recurringStartDate);
    this.parentRecurringId = parentRecurringId;

    // Status and Metadata
    this.status = status;
    this.isDeleted = isDeleted;
    this.processedAt = this.constructor.ensureDate(processedAt);
    this.lastEditedBy = lastEditedBy ? {
      userId: lastEditedBy.userId || null,
      email: lastEditedBy.email || null,
      role: lastEditedBy.role || null,
    } : null;

    // Extra PayU Data
    this.extraParameters = extraParameters || {};
    this.additionalInfo = additionalInfo || {};
  }

  static get dateFields() {
    return [
      ...super.dateFields,
      'processedAt',
      'recurringStartDate',
    ];
  }

  // Check if payment is approved
  isApproved() {
    return this.status === 'APPROVED' || this.payuState === 'APPROVED';
  }

  // Check if payment is pending
  isPending() {
    return this.status === 'PENDING' || this.payuState === 'PENDING';
  }

  // Check if payment failed
  isFailed() {
    return this.status === 'DECLINED' || this.payuState === 'DECLINED' || this.status === 'ERROR';
  }

  // Get display status for UI
  getDisplayStatus() {
    if (this.isApproved()) return 'Aprobado';
    if (this.isPending()) return 'Pendiente';
    if (this.isFailed()) return 'Rechazado';
    return 'Desconocido';
  }

  // Create a safe object for client-side use
  toClientObject() {
    return {
      id: this.id,
      payuTransactionId: this.payuTransactionId,
      payuOrderId: this.payuOrderId,
      amount: this.amount,
      currency: this.currency,
      description: this.description,
      reference: this.reference,
      paymentMethod: this.paymentMethod,
      status: this.status,
      payuState: this.payuState,
      displayStatus: this.getDisplayStatus(),
      paymentContext: this.paymentContext,
      relatedOrderId: this.relatedOrderId,
      isRecurring: this.isRecurring,
      recurringFrequency: this.recurringFrequency,
      parentRecurringId: this.parentRecurringId,
      payuAuthorizationCode: this.payuAuthorizationCode,
      payuTrazabilityCode: this.payuTrazabilityCode,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      processedAt: this.processedAt,
    };
  }

  toFirestore() {
    const data = super.toFirestore();
    data.lastEditedBy = this.lastEditedBy || null;
    data.extraParameters = this.extraParameters || {};
    data.additionalInfo = this.additionalInfo || {};
    return data;
  }

  static fromFirestore(doc) {
    const data = super.fromFirestore(doc);
    return new PayuTransaction({
      ...data,
      id: doc.id,
    });
  }
}

module.exports = PayuTransaction;
