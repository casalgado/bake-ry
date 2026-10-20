const crypto = require('crypto');
const zlib = require('zlib');
const { DOMParser } = require('@xmldom/xmldom');
const { ExclusiveCanonicalization } = require('xml-crypto');
const { makeP12 } = require('./testCertificate');
const { loadCertificate } = require('../../../services/dian/loadCertificate');
const { createDianClient, packInvoice, buildEnvelope, zip, URLS } = require('../../../services/dian/dianClient');

const { p12 } = makeP12('secret');
const { privateKeyPem, certChainPem } = loadCertificate(p12, 'secret');
const certDer = new crypto.X509Certificate(certChainPem[0]).raw.toString('base64');

const parse = (xml) => new DOMParser().parseFromString(xml, 'text/xml');
const WSA = 'http://www.w3.org/2005/08/addressing';
const DS = 'http://www.w3.org/2000/09/xmldsig#';

/** Reads back the single entry of a zip built by zip(). */
const unzip = (buf) => {
  const nameLength = buf.readUInt16LE(26);
  const compressedSize = buf.readUInt32LE(18);
  const start = 30 + nameLength;
  return {
    name: buf.subarray(30, start).toString('utf8'),
    content: zlib.inflateRawSync(buf.subarray(start, start + compressedSize)).toString('utf8'),
    crc: buf.readUInt32LE(14),
  };
};

/** A fetch that answers like the DIAN, and records what it was sent. */
const fakeDian = (status, body) => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, ...init });
    return { ok: status < 400, status, text: async () => body };
  };
  return { fetch, calls };
};

describe('dian/dianClient', () => {
  describe('zip', () => {
    it('round-trips one entry with a correct CRC', () => {
      const xml = '<Invoice>ñandú & co</Invoice>';
      const entry = unzip(zip('fv1.xml', xml));
      expect(entry).toEqual({ name: 'fv1.xml', content: xml, crc: zlib.crc32(Buffer.from(xml)) });
    });

    it('ends with an end-of-central-directory record for one entry', () => {
      const buf = zip('a.xml', '<a/>');
      const end = buf.subarray(buf.length - 22);
      expect(end.readUInt32LE(0)).toBe(0x06054b50);
      expect(end.readUInt16LE(10)).toBe(1);
    });
  });

  describe('packInvoice', () => {
    it('names files with padded NIT, 000, year and hex consecutive', () => {
      const packed = packInvoice({
        nit: '901417532', consecutive: 990000001, issuedAt: new Date('2026-10-20T15:00:00Z'), xml: '<Invoice/>',
      });
      expect(packed.fileName).toBe('z0901417532000263b023381.zip');
      expect(unzip(Buffer.from(packed.contentFile, 'base64')).name).toBe('fv0901417532000263b023381.xml');
    });
  });

  describe('buildEnvelope', () => {
    const now = new Date('2026-10-20T15:00:00.000Z');
    const { xml, action } = buildEnvelope({
      operation: 'SendTestSetAsync', body: '<wcf:Ping/>', url: URLS[2], certDer, privateKeyPem, now,
    });
    const doc = parse(xml);

    it('uses the WCF action and points wsa:To at the service', () => {
      expect(action).toBe('http://wcf.dian.colombia/IWcfDianCustomerServices/SendTestSetAsync');
      expect(doc.getElementsByTagNameNS(WSA, 'Action')[0].textContent).toBe(action);
      expect(doc.getElementsByTagNameNS(WSA, 'To')[0].textContent).toBe(URLS[2]);
    });

    it('orders the security header Timestamp, token, Signature, with a 5-minute timestamp', () => {
      const security = doc.getElementsByTagNameNS('*', 'Security')[0];
      const children = Array.from(security.childNodes).filter((n) => n.nodeType === 1).map((n) => n.localName);
      expect(children).toEqual(['Timestamp', 'BinarySecurityToken', 'Signature']);
      expect(xml).toContain('<wsu:Created>2026-10-20T15:00:00.000Z</wsu:Created>');
      expect(xml).toContain('<wsu:Expires>2026-10-20T15:05:00.000Z</wsu:Expires>');
      expect(doc.getElementsByTagNameNS('*', 'BinarySecurityToken')[0].textContent).toBe(certDer);
    });

    it('declares wsu on wsa:To itself (the DIAN answers an empty 400 otherwise)', () => {
      expect(xml).toMatch(/<wsa:To xmlns:wsu="[^"]+" wsu:Id="TO-/);
    });

    it('signs wsa:To: the digest matches and the signature verifies with the certificate', () => {
      const ancestors = (node) => {
        const found = [];
        for (let n = node.parentNode; n && n.attributes; n = n.parentNode) {
          Array.from(n.attributes).filter((a) => a.name.startsWith('xmlns:'))
            .forEach((a) => found.push({ prefix: a.name.slice(6), namespaceURI: a.value }));
        }
        return found;
      };
      const c14n = (node, prefixes) => new ExclusiveCanonicalization().process(node, {
        inclusiveNamespacesPrefixList: prefixes, ancestorNamespaces: ancestors(node),
      });

      const to = doc.getElementsByTagNameNS(WSA, 'To')[0];
      const digest = crypto.createHash('sha256').update(c14n(to, ['soap', 'wcf'])).digest('base64');
      expect(doc.getElementsByTagNameNS(DS, 'DigestValue')[0].textContent).toBe(digest);

      const info = doc.getElementsByTagNameNS(DS, 'SignedInfo')[0];
      const canonicalInfo = c14n(info, ['wsa', 'soap', 'wcf']);
      // Exclusive C14N with the prefix list renders the outer namespaces on SignedInfo.
      expect(canonicalInfo).toMatch(/^<ds:SignedInfo xmlns:ds="[^"]+" xmlns:soap="[^"]+" xmlns:wcf="[^"]+" xmlns:wsa="[^"]+">/);
      const value = doc.getElementsByTagNameNS(DS, 'SignatureValue')[0].textContent;
      const ok = crypto.createVerify('RSA-SHA256').update(canonicalInfo)
        .verify(new crypto.X509Certificate(certChainPem[0]).publicKey, value, 'base64');
      expect(ok).toBe(true);
    });
  });

  describe('createDianClient', () => {
    it('refuses an unknown environment', () => {
      expect(() => createDianClient({ environment: '9', privateKeyPem, certChainPem })).toThrow('Unknown DIAN environment');
    });

    it('sends the test set with SOAP 1.2 headers and reads the ZipKey', async () => {
      const dian = fakeDian(200, `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body>
        <SendTestSetAsyncResponse xmlns="http://wcf.dian.colombia"><SendTestSetAsyncResult xmlns:b="http://schemas.datacontract.org/2004/07/UploadDocumentResponse">
        <b:ErrorMessageList/><b:ZipKey>abc-123</b:ZipKey></SendTestSetAsyncResult></SendTestSetAsyncResponse></s:Body></s:Envelope>`);
      const client = createDianClient({ environment: '2', privateKeyPem, certChainPem, fetch: dian.fetch });

      const result = await client.sendTestSetAsync({ fileName: 'z1.zip', contentFile: 'QUJD', testSetId: 'set-1' });

      expect(result).toEqual({ zipKey: 'abc-123', errors: [] });
      expect(dian.calls[0].url).toBe(URLS[2]);
      expect(dian.calls[0].headers['Content-Type'])
        .toBe('application/soap+xml; charset=utf-8; action="http://wcf.dian.colombia/IWcfDianCustomerServices/SendTestSetAsync"');
      expect(dian.calls[0].body).toContain('<wcf:fileName>z1.zip</wcf:fileName><wcf:contentFile>QUJD</wcf:contentFile><wcf:testSetId>set-1</wcf:testSetId>');
    });

    it('returns the errors when the DIAN refuses the zip up front', async () => {
      const dian = fakeDian(200, `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body>
        <SendTestSetAsyncResult xmlns:b="x"><b:ErrorMessageList><b:XmlParamsResponseTrackId><b:processedMessage>Nombre de archivo inválido</b:processedMessage></b:XmlParamsResponseTrackId></b:ErrorMessageList><b:ZipKey/></SendTestSetAsyncResult>
        </s:Body></s:Envelope>`);
      const client = createDianClient({ environment: '2', privateKeyPem, certChainPem, fetch: dian.fetch });

      expect(await client.sendTestSetAsync({ fileName: 'x', contentFile: '', testSetId: 's' }))
        .toEqual({ zipKey: null, errors: ['Nombre de archivo inválido'] });
    });

    it('throws with the SOAP fault reason on an HTTP error', async () => {
      const dian = fakeDian(500, `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body><s:Fault>
        <s:Reason><s:Text xml:lang="es">Error de validación de seguridad</s:Text></s:Reason></s:Fault></s:Body></s:Envelope>`);
      const client = createDianClient({ environment: '2', privateKeyPem, certChainPem, fetch: dian.fetch });

      await expect(client.getStatusZip('abc')).rejects.toThrow('DIAN GetStatusZip HTTP 500: Error de validación de seguridad');
    });

    it('throws on an empty 400', async () => {
      const client = createDianClient({ environment: '2', privateKeyPem, certChainPem, fetch: fakeDian(400, '').fetch });
      await expect(client.getStatusZip('abc')).rejects.toThrow('HTTP 400: empty body');
    });

    it('parses GetStatusZip responses', async () => {
      const dian = fakeDian(200, `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body>
        <GetStatusZipResponse xmlns="http://wcf.dian.colombia"><GetStatusZipResult xmlns:b="x" xmlns:c="y">
        <b:DianResponse><b:ErrorMessage><c:string>Regla: FAJ44, Rechazo: DV mal calculado</c:string></b:ErrorMessage>
        <b:IsValid>false</b:IsValid><b:StatusCode>99</b:StatusCode><b:StatusDescription>Validación contiene errores</b:StatusDescription>
        <b:StatusMessage>La Factura electrónica SETP990000001, ha sido rechazada.</b:StatusMessage>
        <b:XmlBase64Bytes>PEFwcC8+</b:XmlBase64Bytes><b:XmlDocumentKey>cufe-1</b:XmlDocumentKey></b:DianResponse>
        </GetStatusZipResult></GetStatusZipResponse></s:Body></s:Envelope>`);
      const client = createDianClient({ environment: '2', privateKeyPem, certChainPem, fetch: dian.fetch });

      expect(await client.getStatusZip('abc-123')).toEqual([{
        isValid: false,
        statusCode: '99',
        statusDescription: 'Validación contiene errores',
        statusMessage: 'La Factura electrónica SETP990000001, ha sido rechazada.',
        errors: ['Regla: FAJ44, Rechazo: DV mal calculado'],
        documentKey: 'cufe-1',
        applicationResponse: 'PEFwcC8+',
      }]);
      expect(dian.calls[0].body).toContain('<wcf:GetStatusZip><wcf:trackId>abc-123</wcf:trackId></wcf:GetStatusZip>');
    });
  });
});
