const BaseModel = require('./base/BaseModel');

class PayuCard extends BaseModel {
  constructor({
    id,
    bakeryId,

    // PayU Token Information
    tokenId,
    maskedNumber,
    paymentMethod,
    cardholderName,
    expirationDate,

    // Customer Information
    payerId,
    payerIdentificationNumber,

    // Status and Metadata
    status = 'ACTIVE', // ACTIVE, DELETED
    isDeleted = false,
    lastEditedBy = null,

    // Dates
    createdAt,
    updatedAt,

  } = {}) {
    super({ id, createdAt, updatedAt });

    // Basic Information
    this.bakeryId = bakeryId;

    // PayU Token Information
    this.tokenId = tokenId;
    this.maskedNumber = maskedNumber;
    this.paymentMethod = paymentMethod;
    this.cardholderName = cardholderName;
    this.expirationDate = expirationDate;

    // Customer Information
    this.payerId = payerId;
    this.payerIdentificationNumber = payerIdentificationNumber;

    // Status and Metadata
    this.status = status;
    this.isDeleted = isDeleted;
    this.lastEditedBy = lastEditedBy ? {
      userId: lastEditedBy.userId || null,
      email: lastEditedBy.email || null,
      role: lastEditedBy.role || null,
    } : null;
  }

  static get dateFields() {
    return [
      ...super.dateFields,
      'expirationDate',
    ];
  }

  // Check if card is active
  isActive() {
    return this.status === 'ACTIVE' && !this.isDeleted;
  }

  // Create card information object for frontend
  toClientObject() {
    return {
      id: this.id,
      maskedNumber: this.maskedNumber,
      paymentMethod: this.paymentMethod,
      cardholderName: this.cardholderName,
      expirationDate: this.expirationDate,
      status: this.status,
      createdAt: this.createdAt,
    };
  }

  toFirestore() {
    const data = super.toFirestore();
    data.lastEditedBy = this.lastEditedBy || null;
    return data;
  }

  static fromFirestore(doc) {
    const data = super.fromFirestore(doc);
    return new PayuCard({
      ...data,
      id: doc.id,
    });
  }
}

module.exports = PayuCard;
