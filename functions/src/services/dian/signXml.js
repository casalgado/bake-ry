const crypto = require('crypto');
const { DOMParser } = require('@xmldom/xmldom');
const { C14nCanonicalization } = require('xml-crypto');
const { getDateInColombia, getTimeInColombia } = require('../../utils/dateUtils');

const DS = 'http://www.w3.org/2000/09/xmldsig#';
const XADES = 'http://uri.etsi.org/01903/v1.3.2#';
const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';

// Annex v1.9 §10.10. The hash is the SHA-256 of the policy PDF at that URL.
const POLICY_URL = 'https://facturaelectronica.dian.gov.co/politicadefirma/v2/politicadefirmav2.pdf';
const POLICY_SHA256 = 'dMoMvtcG5aIzgYo0tIsSQeVJBDnUnfSOfBpxXrmor0Y=';
const POLICY_DESCRIPTION = 'Política de firma para facturas electrónicas de la República de Colombia.';

// Where buildInvoiceXml leaves room for the signature.
const SIGNATURE_SLOT = '<ext:ExtensionContent></ext:ExtensionContent>';

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('base64');

/** Hex of a DER IA5String, the form RFC 2253 uses for attributes it has no name for. */
const ia5Hex = (text) => {
  const bytes = Buffer.from(text, 'latin1');
  return Buffer.concat([Buffer.from([0x16, bytes.length]), bytes]).toString('hex');
};

/** Node lists the issuer in certificate order; RFC 2253 wants it reversed, comma separated. */
const issuerName = (issuer) => issuer
  .split('\n')
  .reverse()
  .map((rdn) => rdn.replace(/^emailAddress=(.*)$/, (_, email) => `1.2.840.113549.1.9.1=#${ia5Hex(email)}`))
  .join(',');

const describeCert = (pem) => {
  const cert = new crypto.X509Certificate(pem);
  return {
    der: cert.raw.toString('base64'),
    digest: sha256(cert.raw),
    issuer: issuerName(cert.issuer),
    serial: BigInt(`0x${cert.serialNumber}`).toString(),
  };
};

/** Every namespace the root declares: they are all in scope for the signature parts. */
const rootNamespaces = (root) => Array.from(root.attributes)
  .filter((attr) => attr.name === 'xmlns' || attr.name.startsWith('xmlns:'))
  .map((attr) => ({ prefix: attr.name === 'xmlns' ? '' : attr.name.slice(6), namespaceURI: attr.value }));

const parse = (xml) => new DOMParser().parseFromString(xml, 'text/xml');

const canonical = (node, ancestorNamespaces = []) =>
  new C14nCanonicalization().process(node, { ancestorNamespaces });

const reference = (attrs, digest, transforms = '') =>
  `<ds:Reference ${attrs}>${transforms}<ds:DigestMethod Algorithm="${SHA256}"/><ds:DigestValue>${digest}</ds:DigestValue></ds:Reference>`;

/**
 * Signs an unsigned invoice (see buildInvoiceXml) with XMLDSig enveloped +
 * XAdES-EPES, as the DIAN annex v1.9 §10 requires. Pure: key and chain in, XML out.
 *
 * The three references are the whole document, the KeyInfo and the
 * SignedProperties. The last two live inside the Signature, so digests are
 * computed on the assembled document, not with SignedXml.computeSignature.
 *
 * `certChainPem`: leaf first (see loadCertificate). `signingTime`: a Date.
 * ponytail: the X509IssuerName format is the likeliest thing the DIAN rejects;
 * tune it during habilitación.
 */
const signXml = (xml, { privateKeyPem, certChainPem, signingTime = new Date() }) => {
  if (!xml.includes(SIGNATURE_SLOT)) throw new Error('The invoice has no empty signature slot');

  const certs = certChainPem.map(describeCert);
  const sigId = `xmldsig-${crypto.randomUUID()}`;
  const keyInfoId = `${sigId}-keyinfo`;
  const propsId = `${sigId}-signedprops`;

  const keyInfo = `<ds:KeyInfo Id="${keyInfoId}"><ds:X509Data>${
    certs.map((c) => `<ds:X509Certificate>${c.der}</ds:X509Certificate>`).join('')
  }</ds:X509Data></ds:KeyInfo>`;

  const signedProps = `<xades:SignedProperties Id="${propsId}"><xades:SignedSignatureProperties>`
    + `<xades:SigningTime>${getDateInColombia(signingTime)}T${getTimeInColombia(signingTime)}-05:00</xades:SigningTime>`
    + `<xades:SigningCertificate>${certs.map((c) => `<xades:Cert><xades:CertDigest>`
      + `<ds:DigestMethod Algorithm="${SHA256}"/><ds:DigestValue>${c.digest}</ds:DigestValue></xades:CertDigest>`
      + `<xades:IssuerSerial><ds:X509IssuerName>${c.issuer}</ds:X509IssuerName>`
      + `<ds:X509SerialNumber>${c.serial}</ds:X509SerialNumber></xades:IssuerSerial></xades:Cert>`).join('')}</xades:SigningCertificate>`
    + `<xades:SignaturePolicyIdentifier><xades:SignaturePolicyId>`
    + `<xades:SigPolicyId><xades:Identifier>${POLICY_URL}</xades:Identifier><xades:Description>${POLICY_DESCRIPTION}</xades:Description></xades:SigPolicyId>`
    + `<xades:SigPolicyHash><ds:DigestMethod Algorithm="${SHA256}"/><ds:DigestValue>${POLICY_SHA256}</ds:DigestValue></xades:SigPolicyHash>`
    + `</xades:SignaturePolicyId></xades:SignaturePolicyIdentifier>`
    + `<xades:SignerRole><xades:ClaimedRoles><xades:ClaimedRole>supplier</xades:ClaimedRole></xades:ClaimedRoles></xades:SignerRole>`
    + `</xades:SignedSignatureProperties></xades:SignedProperties>`;

  const object = `<ds:Object><xades:QualifyingProperties Target="#${sigId}">${signedProps}</xades:QualifyingProperties></ds:Object>`;

  const signedInfo = (digests) => `<ds:SignedInfo>`
    + `<ds:CanonicalizationMethod Algorithm="${C14N}"/><ds:SignatureMethod Algorithm="${RSA_SHA256}"/>`
    + reference(`Id="${sigId}-ref0" URI=""`, digests.document,
      '<ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></ds:Transforms>')
    + reference(`URI="#${keyInfoId}"`, digests.keyInfo)
    + reference(`Type="http://uri.etsi.org/01903#SignedProperties" URI="#${propsId}"`, digests.signedProps)
    + `</ds:SignedInfo>`;

  const signature = (info, value) => `<ds:Signature Id="${sigId}">${info}`
    + `<ds:SignatureValue Id="${sigId}-sigvalue">${value}</ds:SignatureValue>${keyInfo}${object}</ds:Signature>`;

  const insert = (sig) => xml.replace(SIGNATURE_SLOT, `<ext:ExtensionContent>${sig}</ext:ExtensionContent>`);

  // Digest of the document without the signature (the enveloped transform).
  const unsignedDoc = parse(xml).documentElement;
  const documentDigest = sha256(canonical(unsignedDoc));

  // KeyInfo and SignedProperties are digested where they sit in the final document.
  const skeleton = parse(insert(signature('<ds:SignedInfo/>', '')));
  const namespaces = rootNamespaces(skeleton.documentElement);
  const digestOf = (ns, name) =>
    sha256(canonical(skeleton.getElementsByTagNameNS(ns, name)[0], namespaces));

  const info = signedInfo({
    document: documentDigest,
    keyInfo: digestOf(DS, 'KeyInfo'),
    signedProps: digestOf(XADES, 'SignedProperties'),
  });

  // SignatureValue is the signature over the canonical SignedInfo, in place.
  const withInfo = parse(insert(signature(info, '')));
  const canonicalInfo = canonical(withInfo.getElementsByTagNameNS(DS, 'SignedInfo')[0], namespaces);
  const value = crypto.createSign('RSA-SHA256').update(canonicalInfo).sign(privateKeyPem, 'base64');

  return insert(signature(info, value));
};

module.exports = { signXml };
