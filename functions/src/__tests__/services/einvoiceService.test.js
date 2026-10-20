const { initializeFirebase, clearFirestoreData } = require('../setup/firebase');
const { Order } = require('../../models/Order');
const { loadCertificate } = require('../../services/dian/loadCertificate');
const { makeP12 } = require('./dian/testCertificate');

// Issuing an invoice (number reservation, build, sign, store) and sending it.
// The DIAN is a fake fetch. Needs the Firestore emulator.
describe('Einvoice service', () => {
  let db;
  let einvoiceService;
  let secrets;
  const bakeryId = 'test-bakery';
  const user = { uid: 'u1', email: 'caja@test.com', role: 'bakery_staff' };

  const col = (name) => db.collection(`bakeries/${bakeryId}/${name}`);

  const einvoicing = (overrides = {}) => ({
    enabled: true,
    environment: '2',
    softwareId: '20980788-349c-427a-aefd-a5674e7faf63',
    issuer: {
      nit: '900123456',
      checkDigit: '7',
      legalName: 'Panadería de Prueba S.A.S.',
      personType: '1',
      taxLevelCode: 'O-13',
      phone: '3001234567',
      email: 'facturas@panaderia.test',
      address: { line: 'Calle 1 # 2-3', cityCode: '11001', cityName: 'Bogotá, D.C.', deptCode: '11', deptName: 'Bogotá' },
    },
    resolution: {
      number: '18760000001',
      prefix: 'SETP',
      from: 100,
      to: 101,
      startDate: '2019-01-19',
      endDate: '2030-01-19',
      technicalKey: 'fc8eac422eba16e22ffd8c6f94b3f40a6e38162c',
    },
    ...overrides,
  });

  const seedSettings = (config) =>
    col('settings').doc('default').set({ bakeryId, features: { einvoicing: config } });

  const seedOrder = (id) =>
    col('orders').doc(id).set(new Order({
      bakeryId,
      userId: 'u1',
      isPaid: true,
      paymentMethod: 'cash',
      dueDate: new Date('2026-10-20T15:00:00Z'),
      orderItems: [
        { productId: 'p1', productName: 'Torta', quantity: 2, basePrice: 11900, currentPrice: 11900, taxPercentage: 19 },
      ],
    }).toFirestore());

  const counterOf = async (prefix = 'SETP') => {
    const doc = await col('einvoiceCounters').doc(prefix).get();
    return doc.exists ? doc.data().last : null;
  };

  beforeAll(() => {
    ({ db } = initializeFirebase());
    einvoiceService = require('../../services/einvoiceService');
    const { privateKeyPem, certChainPem } = loadCertificate(makeP12('secret').p12, 'secret');
    secrets = { privateKeyPem, certChainPem, softwarePin: '12345' };
  });

  beforeEach(async () => {
    await clearFirestoreData(db);
    await seedSettings(einvoicing());
    await seedOrder('o1');
    await seedOrder('o2');
  });

  it('issues a signed invoice with the first number of the resolution', async () => {
    const einvoice = await einvoiceService.issue(bakeryId, 'o1', user, { secrets });

    expect(einvoice).toMatchObject({ id: 'o1', orderId: 'o1', number: 'SETP100', status: 'signed', environment: '2' });
    expect(einvoice.cufe).toMatch(/^[0-9a-f]{96}$/);
    expect(einvoice.totals.payable).toBe(23800);

    const stored = (await col('einvoices').doc('o1').get()).data();
    expect(stored.xml).toContain('<ds:SignatureValue');
    expect(stored.xml).toContain(`>${einvoice.cufe}</cbc:UUID>`);
    expect(await counterOf()).toBe(100);
  });

  it('records the draft and the signing in the history', async () => {
    await einvoiceService.issue(bakeryId, 'o1', user, { secrets });

    const history = await col('einvoices').doc('o1').collection('updateHistory').get();
    const transitions = history.docs.map((d) => d.data().changes.status).sort((a, b) => (a.to < b.to ? -1 : 1));
    expect(transitions).toEqual([{ from: null, to: 'draft' }, { from: 'draft', to: 'signed' }]);
  });

  it('returns the same invoice when an order is issued twice, without using another number', async () => {
    const first = await einvoiceService.issue(bakeryId, 'o1', user, { secrets });
    const second = await einvoiceService.issue(bakeryId, 'o1', user, { secrets });

    expect(second.number).toBe(first.number);
    expect(second.cufe).toBe(first.cufe);
    expect(await counterOf()).toBe(100);
  });

  it('hands out distinct numbers to concurrent requests', async () => {
    const [a, b] = await Promise.all([
      einvoiceService.issue(bakeryId, 'o1', user, { secrets }),
      einvoiceService.issue(bakeryId, 'o2', user, { secrets }),
    ]);

    expect([a.number, b.number].sort()).toEqual(['SETP100', 'SETP101']);
  });

  it('refuses when the authorized range is exhausted', async () => {
    await einvoiceService.issue(bakeryId, 'o1', user, { secrets });
    await einvoiceService.issue(bakeryId, 'o2', user, { secrets });
    await seedOrder('o3');

    await expect(einvoiceService.issue(bakeryId, 'o3', user, { secrets })).rejects.toThrow('se agotó');
    expect(await counterOf()).toBe(101);
  });

  it('finishes a draft left by a crash with the number it already holds', async () => {
    await col('einvoiceCounters').doc('SETP').set({ last: 100 });
    await col('einvoices').doc('o1').set({
      bakeryId, orderId: 'o1', prefix: 'SETP', consecutive: 100, number: 'SETP100', environment: '2', status: 'draft',
    });

    const einvoice = await einvoiceService.issue(bakeryId, 'o1', user, { secrets });

    expect(einvoice).toMatchObject({ number: 'SETP100', status: 'signed' });
    expect(await counterOf()).toBe(100);
  });

  it('refuses when electronic invoicing is off for the bakery', async () => {
    await seedSettings(einvoicing({ enabled: false }));

    await expect(einvoiceService.issue(bakeryId, 'o1', user, { secrets })).rejects.toThrow('no está activada');
    expect(await counterOf()).toBeNull();
  });

  it('does not use a number for an order that cannot be invoiced', async () => {
    await col('orders').doc('o1').update({ orderItems: [] });

    await expect(einvoiceService.issue(bakeryId, 'o1', user, { secrets })).rejects.toThrow('no tiene líneas');
    expect(await counterOf()).toBeNull();
    expect((await col('einvoices').doc('o1').get()).exists).toBe(false);
  });

  it('answers the same invoice to two simultaneous calls for one order', async () => {
    const [a, b] = await Promise.all([
      einvoiceService.issue(bakeryId, 'o1', user, { secrets }),
      einvoiceService.issue(bakeryId, 'o1', user, { secrets }),
    ]);

    const stored = (await col('einvoices').doc('o1').get()).data();
    expect(a.cufe).toBe(stored.cufe);
    expect(b.cufe).toBe(stored.cufe);
    expect(await counterOf()).toBe(100);
  });

  it('keeps answering the invoice after the order is edited', async () => {
    const first = await einvoiceService.issue(bakeryId, 'o1', user, { secrets });
    await col('orders').doc('o1').update({ orderItems: [] });

    const again = await einvoiceService.issue(bakeryId, 'o1', user, { secrets });

    expect(again.number).toBe(first.number);
    expect(again.cufe).toBe(first.cufe);
  });

  it('refuses a deleted order without using a number', async () => {
    await col('orders').doc('o1').update({ isDeleted: true });

    await expect(einvoiceService.issue(bakeryId, 'o1', user, { secrets })).rejects.toThrow('eliminado');
    expect(await counterOf()).toBeNull();
  });

  describe('sending to the DIAN', () => {
    const testSetId = 'set-123';

    /** A fetch that answers like the DIAN, and records what it was sent. */
    const fakeDian = (body, status = 200) => {
      const calls = [];
      const fetch = async (url, init) => {
        calls.push({ url, ...init });
        return { ok: status < 400, status, text: async () => body };
      };
      return { fetch, calls };
    };

    const zipAccepted = (zipKey) => `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body>
      <SendTestSetAsyncResult xmlns:b="x"><b:ErrorMessageList/><b:ZipKey>${zipKey}</b:ZipKey></SendTestSetAsyncResult>
      </s:Body></s:Envelope>`;

    const zipRefused = `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body>
      <SendTestSetAsyncResult xmlns:b="x"><b:ErrorMessageList><b:XmlParamsResponseTrackId>
      <b:processedMessage>Nombre de archivo inválido</b:processedMessage></b:XmlParamsResponseTrackId></b:ErrorMessageList><b:ZipKey/></SendTestSetAsyncResult>
      </s:Body></s:Envelope>`;

    const status = ({ code, valid, errors = [] }) => `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body>
      <GetStatusZipResult xmlns:b="x" xmlns:c="y"><b:DianResponse>
      <b:ErrorMessage>${errors.map((e) => `<c:string>${e}</c:string>`).join('')}</b:ErrorMessage>
      <b:IsValid>${valid}</b:IsValid><b:StatusCode>${code ?? ''}</b:StatusCode>
      <b:StatusDescription>desc</b:StatusDescription><b:StatusMessage>msg</b:StatusMessage>
      <b:XmlBase64Bytes>PEFwcC8+</b:XmlBase64Bytes><b:XmlDocumentKey>k</b:XmlDocumentKey>
      </b:DianResponse></GetStatusZipResult></s:Body></s:Envelope>`;

    beforeEach(() => seedSettings(einvoicing({ testSetId })));

    const issueAndSend = async (fetch) => {
      await einvoiceService.issue(bakeryId, 'o1', user, { secrets });
      return einvoiceService.send(bakeryId, 'o1', user, { secrets, fetch });
    };

    it('sends a signed invoice as a zipped test-set file and stores the zipKey', async () => {
      const dian = fakeDian(zipAccepted('zip-1'));

      const sent = await issueAndSend(dian.fetch);

      expect(sent).toMatchObject({ status: 'sent', zipKey: 'zip-1' });
      expect(sent.sentAt).toBeInstanceOf(Date);
      expect(dian.calls[0].body).toMatch(/<wcf:fileName>z0900123456000\d{2}00000064\.zip<\/wcf:fileName>/);
      expect(dian.calls[0].body).toContain(`<wcf:testSetId>${testSetId}</wcf:testSetId>`);
      expect((await col('einvoices').doc('o1').get()).data()).toMatchObject({ status: 'sent', zipKey: 'zip-1' });
    });

    it('marks the invoice rejected when the DIAN refuses the zip up front', async () => {
      const rejected = await issueAndSend(fakeDian(zipRefused).fetch);

      expect(rejected).toMatchObject({ status: 'rejected', zipKey: null });
      expect(rejected.dian.errors).toEqual(['Nombre de archivo inválido']);
    });

    it('refuses to send in production, without a TestSetId, or when not signed', async () => {
      await expect(einvoiceService.send(bakeryId, 'o1', user, { secrets, fetch: fakeDian('').fetch }))
        .rejects.toThrow('no tiene factura');

      await einvoiceService.issue(bakeryId, 'o1', user, { secrets });
      await seedSettings(einvoicing({ testSetId: '' }));
      await expect(einvoiceService.send(bakeryId, 'o1', user, { secrets })).rejects.toThrow('TestSetId');

      await seedSettings(einvoicing({ environment: '1', testSetId }));
      await expect(einvoiceService.send(bakeryId, 'o1', user, { secrets })).rejects.toThrow('producción');
    });

    it('accepts the invoice when the DIAN answers 00', async () => {
      await issueAndSend(fakeDian(zipAccepted('zip-1')).fetch);

      const checked = await einvoiceService.checkStatus(bakeryId, 'o1', user, {
        secrets, fetch: fakeDian(status({ code: '00', valid: true })).fetch,
      });

      expect(checked.status).toBe('accepted');
      expect(checked.dian).toMatchObject({ statusCode: '00', applicationResponse: 'PEFwcC8+' });
    });

    it('stays sent while the DIAN has no verdict yet', async () => {
      await issueAndSend(fakeDian(zipAccepted('zip-1')).fetch);

      const checked = await einvoiceService.checkStatus(bakeryId, 'o1', user, {
        secrets, fetch: fakeDian(status({ code: null, valid: false })).fetch,
      });

      expect(checked.status).toBe('sent');
    });

    it('rejects, then rebuilds with the same number and a new CUFE', async () => {
      const sent = await issueAndSend(fakeDian(zipAccepted('zip-1')).fetch);
      const before = (await col('einvoices').doc('o1').get()).data();

      const rejected = await einvoiceService.checkStatus(bakeryId, 'o1', user, {
        secrets, fetch: fakeDian(status({ code: '99', valid: false, errors: ['Regla: FAJ44, Rechazo: DV'] })).fetch,
      });
      expect(rejected.status).toBe('rejected');
      expect(rejected.dian.errors).toEqual(['Regla: FAJ44, Rechazo: DV']);

      const rebuilt = await einvoiceService.issue(bakeryId, 'o1', user, { secrets, now: new Date(Date.now() + 1000) });
      expect(rebuilt).toMatchObject({ status: 'signed', number: sent.number, zipKey: null, dian: null });
      expect(rebuilt.cufe).not.toBe(before.cufe);
      expect(await counterOf()).toBe(100);
    });
  });
});
