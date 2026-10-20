const { db } = require('../config/firebase');
const Einvoice = require('../models/Einvoice');
const createBaseService = require('./base/serviceFactory');
const recordHistory = require('./base/recordHistory');
const orderService = require('./orderService');
const bakerySettingsService = require('./bakerySettingsService');
const { buildInvoiceData } = require('./dian/invoiceData');
const { buildInvoiceXml } = require('./dian/buildInvoiceXml');
const { signXml } = require('./dian/signXml');
const { loadSecrets } = require('./dian/loadSecrets');
const { createDianClient, packInvoice } = require('./dian/dianClient');
const { BadRequestError } = require('../utils/errors');

// Statuses issue() (re)builds from: a draft left by a crash, or an invoice the
// DIAN rejected, which goes out again with the same number.
const BUILDABLE = ['draft', 'rejected'];

/**
 * Electronic sales invoices, one per order. `issue` reserves the number,
 * builds and signs the XML, and stores it. `send` hands it to the DIAN and
 * `checkStatus` reads the DIAN's verdict.
 *
 * The signing material (`secrets`: privateKeyPem, certChainPem, softwarePin)
 * comes from Secret Manager (loadSecrets) unless the caller passes it, as
 * tests do. It never lives in Firestore.
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
  const issue = async (bakeryId, orderId, user, { secrets, now = new Date() } = {}) => {
    const config = await getConfig(bakeryId);

    // Already issued: answer with it, whatever has happened to the order since.
    const existing = await einvoiceRef(bakeryId, orderId).get();
    if (existing.exists && !BUILDABLE.includes(existing.data().status)) return Einvoice.fromFirestore(existing);

    const order = await orderService.getById(orderId, bakeryId);
    if (order.isDeleted) throw new BadRequestError('El pedido está eliminado');

    // Built before a number is taken: an order that cannot be invoiced must not use one.
    const invoice = buildInvoiceData(order);

    // A rejected invoice keeps its number: it is resent as the same document.
    const einvoice = await reserveNumber(bakeryId, orderId, config, user);
    if (!BUILDABLE.includes(einvoice.status)) return einvoice;

    const { softwarePin, ...signingKey } = secrets || await loadSecrets(config.issuer.nit);
    const issuer = {
      ...config.issuer,
      environment: config.environment,
      software: { id: config.softwareId, pin: softwarePin },
      resolution: config.resolution,
    };
    const { xml, cufe } = buildInvoiceXml({
      invoice, issuer, number: einvoice.number, issuedAt: now, notes: config.notes,
    });
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
    // The XML is big and already on the document: the history keeps the transition.
    return transition(bakeryId, orderId, einvoice.status, { ...changes, zipKey: null, dian: null }, user, { cufe });
  };

  /**
   * Moves an invoice from `from` to `changes.status` and records it, unless a
   * concurrent call already moved it: then returns it as it is.
   */
  const transition = (bakeryId, orderId, from, changes, user, extraHistory = {}) =>
    db.runTransaction(async (t) => {
      const ref = einvoiceRef(bakeryId, orderId);
      const current = await t.get(ref);
      if (current.data().status !== from) return Einvoice.fromFirestore(current);

      const update = { ...changes, updatedAt: new Date() };
      t.update(ref, update);
      recordHistory(t, ref, { status: { from, to: changes.status }, ...extraHistory }, null, user);
      return new Einvoice({ ...Einvoice.fromFirestore(current), ...update });
    });

  const clientFor = async (config, { secrets, fetch }) => {
    const { privateKeyPem, certChainPem } = secrets || await loadSecrets(config.issuer.nit);
    return createDianClient({ environment: config.environment, privateKeyPem, certChainPem, fetch });
  };

  const getEinvoice = async (bakeryId, orderId) => {
    const doc = await einvoiceRef(bakeryId, orderId).get();
    if (!doc.exists) throw new BadRequestError('El pedido no tiene factura electrónica');
    return Einvoice.fromFirestore(doc);
  };

  /**
   * Hands a signed invoice to the DIAN. Habilitación only for now: the test
   * set goes through SendTestSetAsync, which answers with a zipKey to poll.
   * ponytail: production (SendBillSync, synchronous) comes with go-live.
   */
  const send = async (bakeryId, orderId, user, { secrets, fetch, now = new Date() } = {}) => {
    const config = await getConfig(bakeryId);
    if (config.environment !== '2') throw new BadRequestError('El envío en producción aún no está disponible');
    if (!config.testSetId) throw new BadRequestError('Falta el TestSetId de habilitación');

    const einvoice = await getEinvoice(bakeryId, orderId);
    if (einvoice.status !== 'signed') {
      throw new BadRequestError(`Solo se envía una factura firmada (estado actual: ${einvoice.status})`);
    }

    const client = await clientFor(config, { secrets, fetch });
    const packed = packInvoice({
      nit: config.issuer.nit, consecutive: einvoice.consecutive, issuedAt: einvoice.issuedAt, xml: einvoice.xml,
    });
    const { zipKey, errors } = await client.sendTestSetAsync({ ...packed, testSetId: config.testSetId });

    // No zipKey: the DIAN refused the zip before validating it.
    const changes = zipKey
      ? { status: 'sent', zipKey, sentAt: now }
      : { status: 'rejected', sentAt: now, dian: { statusCode: null, errors } };
    return transition(bakeryId, orderId, 'signed', changes, user, zipKey ? { zipKey } : { errors });
  };

  /**
   * Asks the DIAN how a sent invoice did. Leaves it `sent` while the DIAN is
   * still processing; otherwise stores the answer as accepted or rejected.
   */
  const checkStatus = async (bakeryId, orderId, user, { secrets, fetch } = {}) => {
    const config = await getConfig(bakeryId);
    const einvoice = await getEinvoice(bakeryId, orderId);
    if (einvoice.status !== 'sent') return einvoice;

    const client = await clientFor(config, { secrets, fetch });
    const [answer] = await client.getStatusZip(einvoice.zipKey);

    // ponytail: "still processing" is read as no answer or no status code; tune it
    // with what the DIAN really returns during habilitación.
    if (!answer || !answer.statusCode) return einvoice;

    const accepted = answer.isValid && answer.statusCode === '00';
    const { statusCode, statusDescription, statusMessage, errors, applicationResponse } = answer;
    const dian = { statusCode, statusDescription, statusMessage, errors, applicationResponse };
    return transition(bakeryId, orderId, 'sent', { status: accepted ? 'accepted' : 'rejected', dian }, user, {
      statusCode: answer.statusCode,
    });
  };

  return {
    ...baseService,
    issue,
    send,
    checkStatus,
  };
};

module.exports = createEinvoiceService();
