const crypto = require('crypto');
const request = require('supertest');
const express = require('express');
const { dkimSign } = require('mailauth/lib/dkim/sign');
const { admin, db } = require('../../config/firebase');
const { clearFirestoreData } = require('../setup/firebase');
const inboundEmailRoutes = require('../../routes/inboundEmailRoutes');

// Real DKIM crypto, fake DNS: each test domain publishes the test key under selector "test".
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const mockDkimTxt = `v=DKIM1; k=rsa; p=${publicKey.export({ type: 'spki', format: 'der' }).toString('base64')}`;

jest.mock('mailauth/lib/dkim/verify', () => {
  const actual = jest.requireActual('mailauth/lib/dkim/verify');
  const resolver = async (name, type) => {
    if (type === 'TXT' && name.startsWith('test._domainkey.')) return [[mockDkimTxt]];
    throw Object.assign(new Error('not found'), { code: 'ENOTFOUND' });
  };
  return { dkimVerify: (raw, options) => actual.dkimVerify(raw, { ...options, resolver }) };
});

const SECRET = 'test-secret';
const STAFF_EMAIL = 'ana@gmail.com';

const buildEmail = ({ from = STAFF_EMAIL, messageId = `${crypto.randomUUID()}@gmail.com`, extraHeaders = '' } = {}) =>
  `From: Ana <${from}>\r\n${extraHeaders}To: facturas@mentedigital.app\r\nSubject: Fwd: factura\r\n` +
  `Message-ID: <${messageId}>\r\nContent-Type: text/plain\r\n\r\nver adjunto\r\n`;

const sign = async (message, signingDomain) => {
  const { signatures } = await dkimSign(message, {
    signatureData: [{ signingDomain, selector: 'test', privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }) }],
  });
  return signatures + message;
};

describe('POST /inbound-email', () => {
  let app;
  let staffUid;

  const send = (raw, secret = SECRET) =>
    request(app)
      .post('/inbound-email')
      .set('Content-Type', 'message/rfc822')
      .set('X-Inbound-Secret', secret)
      .send(Buffer.from(raw));

  beforeAll(async () => {
    process.env.INBOUND_EMAIL_SECRET = SECRET;
    app = express();
    app.use('/inbound-email', inboundEmailRoutes);

    const user = await admin.auth().createUser({ email: STAFF_EMAIL, password: 'secret123' });
    await admin.auth().setCustomUserClaims(user.uid, { role: 'bakery_staff', bakeryId: 'bakery-1' });
    staffUid = user.uid;
  });

  afterAll(async () => {
    await admin.auth().deleteUser(staffUid);
  });

  beforeEach(async () => {
    await clearFirestoreData(db);
  });

  it('rejects a wrong secret with 401', async () => {
    const res = await send(await sign(buildEmail(), 'gmail.com'), 'wrong');
    expect(res.status).toBe(401);
  });

  it('receives a DKIM-signed email from a staff member', async () => {
    const res = await send(await sign(buildEmail(), 'gmail.com')).expect(200);

    expect(res.body.status).toBe('received');
    const doc = (await db.collection('inbound_emails').doc(res.body.id).get()).data();
    expect(doc).toMatchObject({ from: STAFF_EMAIL, userId: staffUid, bakeryId: 'bakery-1', role: 'bakery_staff' });
    expect(doc.dkim).toEqual({ result: 'pass', domain: 'gmail.com' });

    const [stored] = await admin.storage().bucket().file(doc.rawPath).download();
    expect(stored.toString()).toContain('Subject: Fwd: factura');
  });

  it('rejects an unsigned email even from a staff address', async () => {
    const res = await send(buildEmail()).expect(200);
    expect(res.body.status).toBe('rejected_unverified');

    const doc = (await db.collection('inbound_emails').doc(res.body.id).get()).data();
    expect(doc.rawPath).toBeNull();
  });

  it('rejects a spoofed From signed by another domain', async () => {
    const res = await send(await sign(buildEmail(), 'attacker.com')).expect(200);
    expect(res.body.status).toBe('rejected_unverified');
  });

  it('rejects a duplicated From header', async () => {
    const raw = await sign(buildEmail({ extraHeaders: 'From: x@attacker.com\r\n' }), 'gmail.com');
    const res = await send(raw).expect(200);
    expect(res.body.status).toBe('rejected_unverified');
  });

  it('rejects a From header with several addresses', async () => {
    const raw = await sign(buildEmail().replace(`Ana <${STAFF_EMAIL}>`, `${STAFF_EMAIL}, x@attacker.com`), 'gmail.com');
    const res = await send(raw).expect(200);
    expect(res.body.status).toBe('rejected_unverified');
  });

  it('rejects a verified sender without a staff account', async () => {
    const res = await send(await sign(buildEmail({ from: 'stranger@gmail.com' }), 'gmail.com')).expect(200);
    expect(res.body.status).toBe('rejected_unknown_sender');
  });

  it('stores the same Message-ID only once', async () => {
    const raw = await sign(buildEmail({ messageId: 'same@gmail.com' }), 'gmail.com');
    const first = await send(raw).expect(200);
    const second = await send(raw).expect(200);

    expect(second.body).toEqual(first.body);
    expect((await db.collection('inbound_emails').get()).size).toBe(1);
  });
});
