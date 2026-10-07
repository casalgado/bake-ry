const BaseModel = require('./base/BaseModel');

class InboundEmail extends BaseModel {
  static STATUSES = {
    RECEIVED: 'received',
    REJECTED_UNVERIFIED: 'rejected_unverified',
    REJECTED_UNKNOWN_SENDER: 'rejected_unknown_sender',
  };

  constructor({
    id,
    createdAt,
    updatedAt,
    messageId,
    from,
    to = [],
    subject = '',
    // Metadata only. The raw email (attachments included) lives in Storage at
    // rawPath, because Firestore docs cap at 1 MB.
    attachments = [],
    rawPath = null,
    dkim = null,
    userId = null,
    bakeryId = null,
    role = null,
    status,
    reason = '',
  } = {}) {
    super({ id, createdAt, updatedAt });

    this.messageId = messageId;
    this.from = from;
    this.to = to;
    this.subject = subject;
    this.attachments = attachments;
    this.rawPath = rawPath;
    this.dkim = dkim;
    this.userId = userId;
    this.bakeryId = bakeryId;
    this.role = role;
    this.status = status;
    this.reason = reason;
  }
}

module.exports = InboundEmail;
