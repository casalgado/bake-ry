// services/inboundEmailService.js
const crypto = require('crypto');
const PostalMime = require('postal-mime').default;
const { dkimVerify } = require('mailauth/lib/dkim/verify');
const { admin } = require('../config/firebase');
const InboundEmail = require('../models/InboundEmail');
const createBaseService = require('./base/serviceFactory');

const { STATUSES } = InboundEmail;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

/**
 * The From header is free text anyone can write, and gmail.com publishes
 * DMARC p=none, so Cloudflare delivers spoofed @gmail.com mail. A valid DKIM
 * signature whose domain aligns with From is what proves who sent it.
 */
const verifySender = async (raw) => {
  const { headerFrom, fromFields, results } = await dkimVerify(raw);

  // Two From headers is the classic trick to make the parser and the
  // verifier disagree on who the sender is. Same for one header with zero or
  // several addresses: alignment only checks the first.
  if (fromFields !== 1 || headerFrom.length !== 1) return { from: null, dkim: { result: 'invalid_from' } };

  const from = headerFrom[0].toLowerCase();
  const aligned = results.find((r) => r.status?.result === 'pass' && r.status?.aligned);
  if (aligned) return { from, dkim: { result: 'pass', domain: aligned.signingDomain } };

  // A valid signature from another domain proves nothing about From — never report it as 'pass'.
  const valid = results.find((r) => r.status?.result === 'pass');
  if (valid) return { from, dkim: { result: 'unaligned', domain: valid.signingDomain } };

  return { from, dkim: { result: results[0]?.status?.result || 'none' } };
};

/** Staff and admins all have Auth accounts with role + bakeryId claims; clients don't. */
const findStaffByEmail = async (email) => {
  try {
    const user = await admin.auth().getUserByEmail(email);
    const { role, bakeryId } = user.customClaims || {};
    if (user.disabled || !bakeryId) return null;
    return { userId: user.uid, role, bakeryId };
  } catch (error) {
    if (error.code === 'auth/user-not-found') return null;
    throw error;
  }
};

const createInboundEmailService = () => {
  const baseService = createBaseService('inbound_emails', InboundEmail);

  const receive = async (raw) => {
    const email = await PostalMime.parse(raw);

    // Message-ID makes retries and double-forwards idempotent. Hashed because
    // it can contain characters a Firestore doc id cannot.
    const messageId = email.messageId || sha256(raw);
    const ref = baseService.getCollectionRef().doc(sha256(messageId));

    // Only an accepted email is final; a rejected one is re-evaluated, e.g. after
    // the sender is added to the team.
    const existing = await ref.get();
    if (existing.exists && existing.data().status === STATUSES.RECEIVED) {
      return InboundEmail.fromFirestore(existing);
    }

    const { from, dkim } = await verifySender(raw);
    const sender = dkim.result === 'pass' ? await findStaffByEmail(from) : null;

    let status = STATUSES.RECEIVED;
    let reason = '';
    if (dkim.result !== 'pass') {
      status = STATUSES.REJECTED_UNVERIFIED;
      reason = 'No pudimos verificar el remitente (firma DKIM). Reenvía el correo desde tu cuenta habitual.';
    } else if (!sender) {
      status = STATUSES.REJECTED_UNKNOWN_SENDER;
      reason = `${from} no pertenece al equipo de ninguna panadería.`;
    }

    // Keep the untouched .eml of accepted mail so future parsers can reprocess it
    // (DIAN also requires 5-year retention). Rejected mail is spam or noise.
    // Outside bakeries/ on purpose: storage.rules deny this path to every client.
    // Uploaded before the Firestore write so a doc never points at a missing file.
    let rawPath = null;
    if (status === STATUSES.RECEIVED) {
      // Per-bakery folder: browsable in the console, one folder to export or delete.
      rawPath = `inbound_emails/${sender.bakeryId}/${ref.id}.eml`;
      await admin.storage().bucket().file(rawPath).save(raw, { contentType: 'message/rfc822' });
    }

    const inboundEmail = new InboundEmail({
      id: ref.id,
      messageId,
      from: from || email.from?.address || null,
      to: (email.to || []).map((t) => t.address),
      subject: email.subject || '',
      attachments: email.attachments.map((a) => ({
        filename: a.filename,
        contentType: a.mimeType,
        size: a.content.byteLength,
      })),
      rawPath,
      dkim,
      ...sender,
      status,
      reason,
    });

    await ref.set(inboundEmail.toFirestore());
    return inboundEmail;
  };

  return {
    ...baseService,
    receive,
  };
};

module.exports = createInboundEmailService();
