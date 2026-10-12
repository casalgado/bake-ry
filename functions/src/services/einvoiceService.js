const { db } = require('../config/firebase');
const Einvoice = require('../models/Einvoice');
const createBaseService = require('./base/serviceFactory');
const recordHistory = require('./base/recordHistory');
const orderService = require('./orderService');
const bakerySettingsService = require('./bakerySettingsService');
const { buildInvoiceData } = require('./dian/invoiceData');
const { buildInvoiceXml } = require('./dian/buildInvoiceXml');
const { signXml } = require('./dian/signXml');
const { BadRequestError } = require('../utils/errors');

/**
 * Electronic sales invoices, one per order. `issue` reserves the number,
 * builds and signs the XML, and stores it: everything short of talking to the
 * DIAN. Sending, and answering what the DIAN says, is a later step.
 *
 * The signing material (`secrets`: privateKeyPem, certChainPem, softwarePin)
 * is passed in by the caller. It never lives in Firestore.
 */
const createEinvoiceService = () => {
  const baseService = createBaseService('einvoices', Einvoice, 'bakeries/{bakeryId}');

  // One counter per prefix: the last consecutive handed out.
  const counterRef = (bakeryId, prefix) =>
    db.doc(`bakeries/${bakeryId}/einvoiceCounters/${prefix}`);

  const einvoiceRef = (bakeryId, orderId) => baseService.getCollectionRef(bakeryId).doc(orderId);

  /**
   * Takes the next number of the resolution and creates the draft, in one
   * transaction, so two requests never share a number and a crash never
   * leaves a gap. If the order already has an invoice, returns it.
   */
  const reserveNumber = (bakeryId, orderId, { environment, resolution }, user) =>
    db.runTransaction(async (t) => {
      const ref = einvoiceRef(bakeryId, orderId);
      const counter = counterRef(bakeryId, resolution.prefix);
      const [existing, counterDoc] = await Promise.all([t.get(ref), t.get(counter)]);

      if (existing.exists) return Einvoice.fromFirestore(existing);

      const consecutive = (counterDoc.exists ? counterDoc.data().last : Number(resolution.from) - 1) + 1;
      if (consecutive > Number(resolution.to)) {
        throw new BadRequestError('El rango de numeración autorizado se agotó');
      }

      const einvoice = new Einvoice({
        id: orderId,
        bakeryId,
        orderId,
        prefix: resolution.prefix,
        consecutive,
        number: `${resolution.prefix}${consecutive}`,
        environment,
        createdBy: user?.uid || null,
      });

      t.set(counter, { last: consecutive });
      t.set(ref, einvoice.toFirestore());
      recordHistory(t, ref, { status: { from: null, to: 'draft' }, number: einvoice.number }, null, user);
      return einvoice;
    });

  const getConfig = async (bakeryId) => {
    const settings = await bakerySettingsService.getById('default', bakeryId);
    const config = settings.features.einvoicing;
    if (!config?.enabled) throw new BadRequestError('La facturación electrónica no está activada');
    return config;
  };

  /**
   * Issues the invoice of an order, or returns the one it already has.
   * A draft left by a crash is finished with the number it already holds.
   */
  const issue = async (bakeryId, orderId, user, { secrets, now = new Date() }) => {
    const config = await getConfig(bakeryId);

    // Already issued: answer with it, whatever has happened to the order since.
    const existing = await einvoiceRef(bakeryId, orderId).get();
    if (existing.exists && existing.data().status !== 'draft') return Einvoice.fromFirestore(existing);

    const order = await orderService.getById(orderId, bakeryId);
    if (order.isDeleted) throw new BadRequestError('El pedido está eliminado');

    // Built before a number is taken: an order that cannot be invoiced must not use one.
    const invoice = buildInvoiceData(order);

    const einvoice = await reserveNumber(bakeryId, orderId, config, user);
    if (einvoice.status !== 'draft') return einvoice;

    const { softwarePin, ...signingKey } = secrets;
    const issuer = {
      ...config.issuer,
      environment: config.environment,
      software: { id: config.softwareId, pin: softwarePin },
      resolution: config.resolution,
    };
    const { xml, cufe } = buildInvoiceXml({ invoice, issuer, number: einvoice.number, issuedAt: now });
    const signed = signXml(xml, { ...signingKey, signingTime: now });

    const changes = {
      status: 'signed',
      cufe,
      xml: signed,
      issuedAt: now,
      buyer: invoice.buyer,
      totals: invoice.totals,
      updatedAt: new Date(),
    };

    // Two calls can both reach this point with the same draft, each with its own
    // issuedAt and so its own CUFE. The first write wins; the other returns it.
    return db.runTransaction(async (t) => {
      const ref = einvoiceRef(bakeryId, orderId);
      const current = await t.get(ref);
      if (current.data().status !== 'draft') return Einvoice.fromFirestore(current);

      t.update(ref, changes);
      // The XML is big and already on the document: the history keeps the transition.
      recordHistory(t, ref, { status: { from: 'draft', to: 'signed' }, cufe }, null, user);
      return new Einvoice({ ...einvoice, ...changes });
    });
  };

  return {
    ...baseService,
    issue,
  };
};

module.exports = createEinvoiceService();
