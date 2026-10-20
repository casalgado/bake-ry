const BaseModel = require('./base/BaseModel');
const { BadRequestError } = require('../utils/errors');

// draft: number reserved, nothing built yet (a crash here is safe to retry).
// signed: XML built and signed, not yet sent to the DIAN.
// sent: the DIAN took the zip (zipKey) and is validating it.
// accepted / rejected: what the DIAN answered (`dian`). A rejected invoice is
// rebuilt and resent with the same number.
const STATUSES = ['draft', 'signed', 'sent', 'accepted', 'rejected'];

// One invoice per order: the document id is the order id, so issuing twice
// finds the first one instead of burning another number.
class Einvoice extends BaseModel {
  static STATUSES = STATUSES;

  constructor({
    id,
    bakeryId,
    orderId,
    prefix,
    consecutive,
    number,
    environment,
    status = 'draft',
    cufe = null,
    xml = null,
    issuedAt = null,
    buyer = null,
    totals = null,
    zipKey = null,
    sentAt = null,
    dian = null,
    createdBy = null,
    createdAt,
    updatedAt,
  }) {
    super({ id, createdAt, updatedAt, issuedAt, sentAt });

    if (!STATUSES.includes(status)) {
      throw new BadRequestError(`Invalid einvoice status: ${status}`);
    }

    this.bakeryId = bakeryId;
    this.orderId = orderId;
    this.prefix = prefix;
    this.consecutive = consecutive;
    this.number = number;
    this.environment = environment;
    this.status = status;
    this.cufe = cufe;
    this.xml = xml;
    this.buyer = buyer;
    this.totals = totals;
    this.zipKey = zipKey;
    // Last DIAN answer: { statusCode, statusDescription, statusMessage, errors, applicationResponse }.
    this.dian = dian;
    this.createdBy = createdBy;
  }

  static get dateFields() {
    return [...super.dateFields, 'issuedAt', 'sentAt'];
  }
}

module.exports = Einvoice;
