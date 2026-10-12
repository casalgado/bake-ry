const { DOMParser } = require('@xmldom/xmldom');
const { SignedXml } = require('xml-crypto');
const { loadCertificate } = require('../../../services/dian/loadCertificate');
const { signXml } = require('../../../services/dian/signXml');
const { makeP12 } = require('./testCertificate');

const DS = 'http://www.w3.org/2000/09/xmldsig#';
const XADES = 'http://uri.etsi.org/01903/v1.3.2#';

// Same root namespaces and empty slot as buildInvoiceXml produces.
const UNSIGNED = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ds="${DS}" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:xades="${XADES}">
<ext:UBLExtensions>
  <ext:UBLExtension><ext:ExtensionContent><data>dian</data></ext:ExtensionContent></ext:UBLExtension>
  <ext:UBLExtension><ext:ExtensionContent></ext:ExtensionContent></ext:UBLExtension>
</ext:UBLExtensions>
<cbc:ID>SETP990000001</cbc:ID>
<cbc:Note>Pan &amp; café</cbc:Note>
</Invoice>`;

describe('dian/signXml', () => {
  const { p12, certPem } = makeP12('secret');
  const { privateKeyPem, certChainPem } = loadCertificate(p12, 'secret');
  const signed = signXml(UNSIGNED, {
    privateKeyPem,
    certChainPem,
    signingTime: new Date('2026-10-20T19:30:05Z'),
  });
  const doc = new DOMParser().parseFromString(signed, 'text/xml');

  const verify = (xml) => {
    const sig = new SignedXml({ publicCert: certPem });
    sig.loadSignature(new DOMParser().parseFromString(xml, 'text/xml').getElementsByTagNameNS(DS, 'Signature')[0]);
    return { valid: sig.checkSignature(xml) };
  };

  it('loads key and chain from a .p12, and rejects a wrong password', () => {
    expect(privateKeyPem).toContain('BEGIN RSA PRIVATE KEY');
    expect(certChainPem).toHaveLength(1);
    expect(() => loadCertificate(p12, 'wrong')).toThrow();
  });

  it('produces a signature the library verifies', () => {
    expect(verify(signed)).toMatchObject({ valid: true });
  });

  it('breaks the signature if the document is changed afterwards', () => {
    expect(verify(signed.replace('SETP990000001', 'SETP990000002')).valid).toBe(false);
  });

  it('references the document, the key info and the signed properties', () => {
    const refs = Array.from(doc.getElementsByTagNameNS(DS, 'Reference'));
    expect(refs.map((r) => r.getAttribute('URI').replace(/^#.*-/, '#'))).toEqual(['', '#keyinfo', '#signedprops']);
    expect(signed).toContain('http://www.w3.org/2000/09/xmldsig#enveloped-signature');
    expect(signed).toContain('http://www.w3.org/2001/04/xmldsig-more#rsa-sha256');
  });

  it('puts the signature in the second extension and leaves the first one alone', () => {
    const contents = doc.getElementsByTagName('ext:ExtensionContent');
    expect(contents[0].getElementsByTagNameNS(DS, 'Signature')).toHaveLength(0);
    expect(contents[1].getElementsByTagNameNS(DS, 'Signature')).toHaveLength(1);
  });

  it('adds the XAdES-EPES properties', () => {
    expect(signed).toContain('<xades:SigningTime>2026-10-20T14:30:05-05:00</xades:SigningTime>');
    expect(signed).toContain('politicadefirmav2.pdf');
    expect(signed).toContain('<xades:ClaimedRole>supplier</xades:ClaimedRole>');
    expect(signed).toContain(`<ds:X509SerialNumber>${0x0a1b2c3d4e5f}</ds:X509SerialNumber>`);
  });

  it('writes the issuer in RFC 2253 order, with the email as an OID', () => {
    // Certificate order: CN, C, email. RFC 2253 reverses it.
    const emailHex = Buffer.concat([Buffer.from([0x16, 14]), Buffer.from('ca@prueba.test')]).toString('hex');
    expect(signed).toContain(`<ds:X509IssuerName>1.2.840.113549.1.9.1=#${emailHex},C=CO,CN=Panaderia de Prueba SAS</ds:X509IssuerName>`);
  });

  it('refuses an invoice with no empty signature slot', () => {
    expect(() => signXml(signed, { privateKeyPem, certChainPem })).toThrow('signature slot');
  });
});
