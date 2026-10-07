// Cloudflare Email Worker. Paste into the dashboard (Workers & Pages → inbound-email).
// Secrets: INBOUND_URL, INBOUND_EMAIL_SECRET.
//
// Deliberately a pass-through: the free plan allows 10 ms of CPU per message, and
// waiting on fetch() does not count. All parsing and verification happen in the
// backend, on the untouched raw bytes, so DKIM signatures stay verifiable.
export default {
  async email(message, env) {
    const res = await fetch(env.INBOUND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'message/rfc822',
        'X-Inbound-Secret': env.INBOUND_EMAIL_SECRET,
      },
      body: message.raw,
    });

    const { status, reason } = await res.json().catch(() => ({}));

    // Anything but a stored email bounces, so the sender knows it did not go through.
    if (!res.ok) {
      message.setReject('No pudimos procesar tu correo. Intenta de nuevo más tarde.');
      return;
    }
    if (status !== 'received') {
      message.setReject(reason || 'Correo rechazado.');
    }
  },
};
