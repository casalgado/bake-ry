const BaseModel = require('./base/BaseModel');
const { BadRequestError } = require('../utils/errors');

// draft: number reserved, nothing built yet (a crash here is safe to retry).
// signed: XML built and signed, not yet sent to the DIAN.
// sent / accepted / rejected: what the DIAN answered; a rejected invoice is
// resent with the same number.
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
    createdBy = null,
    createdAt,
    updatedAt,
  }) {
    super({ id, createdAt, updatedAt, issuedAt });

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
    this.createdBy = createdBy;
  }

  static get dateFields() {
    return [...super.dateFields, 'issuedAt'];
  }
}

module.exports = Einvoice;
