const crypto = require('crypto');
const zlib = require('zlib');
const { DOMParser } = require('@xmldom/xmldom');
const { ExclusiveCanonicalization } = require('xml-crypto');

// Not in the annex; the URL the habilitación portal shows, and its production twin.
const URLS = {
  1: 'https://vpfe.dian.gov.co/WcfDianCustomerServices.svc',
  2: 'https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc',
};

const NS = {
  soap: 'http://www.w3.org/2003/05/soap-envelope',
  wcf: 'http://wcf.dian.colombia',
  wsa: 'http://www.w3.org/2005/08/addressing',
  wsse: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd',
  wsu: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd',
  ds: 'http://www.w3.org/2000/09/xmldsig#',
  ec: 'http://www.w3.org/2001/10/xml-exc-c14n#',
};
const X509_TOKEN = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3';
const BASE64_BINARY = 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary';
const RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';

const TIMESTAMP_TTL_MS = 5 * 60 * 1000;

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

/**
 * A zip with one deflated entry: all the DIAN wants, without a zip dependency.
 * DOS date 1980-01-01; the DIAN reads the date from the XML, not the zip.
 */
const zip = (name, content) => {
  const data = Buffer.from(content, 'utf8');
  const deflated = zlib.deflateRawSync(data);
  const crc = zlib.crc32(data);
  const fileName = Buffer.from(name, 'utf8');
  const DOS_DATE = (0 << 9) | (1 << 5) | 1;

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(deflated.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(fileName.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4); // version made by
  central.writeUInt16LE(20, 6); // version needed
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(deflated.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(fileName.length, 28);
  // local header offset (42) is 0: the entry is the first thing in the file

  const centralSize = central.length + fileName.length;
  const centralOffset = local.length + fileName.length + deflated.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8); // entries on this disk
  end.writeUInt16LE(1, 10); // entries total
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);

  return Buffer.concat([local, fileName, deflated, central, fileName, end]);
};

/**
 * File names per the annex: prefix + issuer NIT (10 digits) + provider code
 * (000 for software propio) + 2-digit year + consecutive (8 hex digits).
 * ponytail: the invoice consecutive stands in for "files sent this year";
 * unique per prefix, which is what the DIAN needs from it.
 */
const fileBaseName = ({ nit, consecutive, issuedAt }) => {
  const year = String(issuedAt.getUTCFullYear()).slice(-2);
  const hex = Number(consecutive).toString(16).padStart(8, '0').slice(-8);
  return `${String(nit).padStart(10, '0')}000${year}${hex}`;
};

/** The signed invoice, zipped, ready for SendTestSetAsync / SendBillSync. */
const packInvoice = ({ nit, consecutive, issuedAt, xml }) => {
  const base = fileBaseName({ nit, consecutive, issuedAt });
  return { fileName: `z${base}.zip`, contentFile: zip(`fv${base}.xml`, xml).toString('base64') };
};

const parse = (xml) => new DOMParser().parseFromString(xml, 'text/xml');

/** Namespaces declared on the element and its ancestors, for exclusive C14N's prefix list. */
const namespacesInScope = (node) => {
  const found = [];
  for (let n = node.parentNode; n && n.attributes; n = n.parentNode) {
    Array.from(n.attributes)
      .filter((a) => a.name.startsWith('xmlns:'))
      .forEach((a) => found.push({ prefix: a.name.slice(6), namespaceURI: a.value }));
  }
  return found;
};

const excC14n = (node, prefixes) => new ExclusiveCanonicalization().process(node, {
  inclusiveNamespacesPrefixList: prefixes,
  ancestorNamespaces: namespacesInScope(node),
});

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('base64');

/**
 * SOAP 1.2 envelope with WS-Security as the DIAN expects (cross-checked with a
 * client that passed habilitación, see README): Timestamp, BinarySecurityToken,
 * then a Signature over wsa:To only, exclusive C14N with prefixes
 * "wsa soap wcf". Every element carrying wsu:Id declares xmlns:wsu itself;
 * without it the DIAN answers an empty 400.
 */
const buildEnvelope = ({ operation, body, url, certDer, privateKeyPem, now = new Date() }) => {
  const id = crypto.randomUUID();
  const sigId = `SIG-${id}`;
  const toId = `TO-${id}`;
  const tokenId = `X509-${id}`;
  const action = `${NS.wcf}/IWcfDianCustomerServices/${operation}`;

  const signedInfo = (digest) => `<ds:SignedInfo>`
    + `<ds:CanonicalizationMethod Algorithm="${NS.ec}"><ec:InclusiveNamespaces xmlns:ec="${NS.ec}" PrefixList="wsa soap wcf"/></ds:CanonicalizationMethod>`
    + `<ds:SignatureMethod Algorithm="${RSA_SHA256}"/>`
    + `<ds:Reference URI="#${toId}"><ds:Transforms><ds:Transform Algorithm="${NS.ec}"><ec:InclusiveNamespaces xmlns:ec="${NS.ec}" PrefixList="soap wcf"/></ds:Transform></ds:Transforms>`
    + `<ds:DigestMethod Algorithm="${SHA256}"/><ds:DigestValue>${digest}</ds:DigestValue></ds:Reference>`
    + `</ds:SignedInfo>`;

  const envelope = (info, value) => `<soap:Envelope xmlns:soap="${NS.soap}" xmlns:wcf="${NS.wcf}">`
    + `<soap:Header xmlns:wsa="${NS.wsa}">`
    + `<wsse:Security xmlns:wsse="${NS.wsse}" xmlns:wsu="${NS.wsu}">`
    + `<wsu:Timestamp wsu:Id="TS-${id}"><wsu:Created>${now.toISOString()}</wsu:Created>`
    + `<wsu:Expires>${new Date(now.getTime() + TIMESTAMP_TTL_MS).toISOString()}</wsu:Expires></wsu:Timestamp>`
    + `<wsse:BinarySecurityToken EncodingType="${BASE64_BINARY}" ValueType="${X509_TOKEN}" wsu:Id="${tokenId}">${certDer}</wsse:BinarySecurityToken>`
    + `<ds:Signature xmlns:ds="${NS.ds}" Id="${sigId}">${info}<ds:SignatureValue>${value}</ds:SignatureValue>`
    + `<ds:KeyInfo><wsse:SecurityTokenReference><wsse:Reference URI="#${tokenId}" ValueType="${X509_TOKEN}"/></wsse:SecurityTokenReference></ds:KeyInfo>`
    + `</ds:Signature></wsse:Security>`
    + `<wsa:Action>${action}</wsa:Action>`
    + `<wsa:To xmlns:wsu="${NS.wsu}" wsu:Id="${toId}">${url}</wsa:To>`
    + `</soap:Header><soap:Body>${body}</soap:Body></soap:Envelope>`;

  // Digest wsa:To where it sits, then sign SignedInfo where it sits.
  const skeleton = parse(envelope(signedInfo(''), ''));
  const to = skeleton.getElementsByTagNameNS(NS.wsa, 'To')[0];
  const info = signedInfo(sha256(excC14n(to, ['soap', 'wcf'])));

  const withInfo = parse(envelope(info, ''));
  const signedInfoNode = withInfo.getElementsByTagNameNS(NS.ds, 'SignedInfo')[0];
  const value = crypto.createSign('RSA-SHA256')
    .update(excC14n(signedInfoNode, ['wsa', 'soap', 'wcf']))
    .sign(privateKeyPem, 'base64');

  return { xml: envelope(info, value), action };
};

const textOf = (node, localName) => node.getElementsByTagNameNS('*', localName)[0]?.textContent ?? null;
const textsOf = (node, localName) => Array.from(node.getElementsByTagNameNS('*', localName)).map((n) => n.textContent);

/** The SOAP fault's reason, for errors that should read well in logs. */
const faultReason = (doc) => textOf(doc, 'Text') || textOf(doc, 'Reason') || null;

/**
 * Client for the DIAN reception web service. Pure transport: it zips nothing
 * and stores nothing; see packInvoice and einvoiceService.
 *
 * `fetch` is injectable so tests can answer for the DIAN.
 */
const createDianClient = ({ environment, privateKeyPem, certChainPem, fetch = globalThis.fetch }) => {
  const url = URLS[environment];
  if (!url) throw new Error(`Unknown DIAN environment: ${environment}`);
  const certDer = new crypto.X509Certificate(certChainPem[0]).raw.toString('base64');

  const call = async (operation, body) => {
    const { xml, action } = buildEnvelope({ operation, body, url, certDer, privateKeyPem });
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': `application/soap+xml; charset=utf-8; action="${action}"` },
      body: xml,
    });
    const text = await res.text();
    const doc = text ? parse(text) : null;
    if (!res.ok) {
      throw new Error(`DIAN ${operation} HTTP ${res.status}: ${(doc && faultReason(doc)) || text.slice(0, 300) || 'empty body'}`);
    }
    return doc;
  };

  /** Habilitación only. An empty zipKey means the DIAN refused the zip up front; see errors. */
  const sendTestSetAsync = async ({ fileName, contentFile, testSetId }) => {
    const doc = await call('SendTestSetAsync', `<wcf:SendTestSetAsync>`
      + `<wcf:fileName>${esc(fileName)}</wcf:fileName>`
      + `<wcf:contentFile>${contentFile}</wcf:contentFile>`
      + `<wcf:testSetId>${esc(testSetId)}</wcf:testSetId>`
      + `</wcf:SendTestSetAsync>`);
    // ponytail: ErrorMessageList's inner shape isn't documented; keep every text leaf
    // until a real rejection shows it.
    const list = doc.getElementsByTagNameNS('*', 'ErrorMessageList')[0];
    const leaves = list ? Array.from(list.getElementsByTagNameNS('*', '*')).filter((n) => !Array.from(n.childNodes).some((c) => c.nodeType === 1)) : [];
    return {
      zipKey: textOf(doc, 'ZipKey') || null,
      errors: leaves.map((n) => n.textContent.trim()).filter(Boolean),
    };
  };

  /**
   * One entry per document in the zip. statusCode '00' = accepted; '2' / null
   * while the DIAN is still processing. `applicationResponse` is the DIAN's
   * signed answer (base64 XML), worth keeping with the invoice.
   */
  const getStatusZip = async (trackId) => {
    const doc = await call('GetStatusZip', `<wcf:GetStatusZip><wcf:trackId>${esc(trackId)}</wcf:trackId></wcf:GetStatusZip>`);
    return Array.from(doc.getElementsByTagNameNS('*', 'DianResponse')).map((r) => ({
      isValid: textOf(r, 'IsValid') === 'true',
      statusCode: textOf(r, 'StatusCode'),
      statusDescription: textOf(r, 'StatusDescription'),
      statusMessage: textOf(r, 'StatusMessage'),
      errors: textsOf(r, 'string'),
      documentKey: textOf(r, 'XmlDocumentKey'),
      applicationResponse: textOf(r, 'XmlBase64Bytes'),
    }));
  };

  return { sendTestSetAsync, getStatusZip };
};

module.exports = { createDianClient, packInvoice, buildEnvelope, zip, URLS };
