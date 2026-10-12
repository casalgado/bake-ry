const crypto = require('crypto');

// Annex v1.9 §11.2: amounts are truncated (never rounded) to 2 decimals.
// Rounding to 3 decimals first washes out float noise (1.15 * 100 = 114.999…).
// ponytail: assumes inputs carry at most 3 decimals, true for COP amounts.
const toAmount = (n) => (Math.trunc(Math.round(Number(n) * 1000) / 10) / 100).toFixed(2);

/**
 * CUFE of an electronic sales invoice: SHA-384 over the concatenated fields,
 * in the exact order of the annex (§11.2). Tax codes are fixed literals:
 * 01 = IVA, 04 = INC (consumo), 03 = ICA.
 *
 * `environment`: '1' production, '2' habilitación (test).
 * `number` is prefix + consecutive, e.g. "SETP990000001".
 */
const computeCufe = ({
  number,
  issueDate, // YYYY-MM-DD
  issueTime, // HH:mm:ss-05:00
  subtotal, // LineExtensionAmount: gross value, before taxes
  iva = 0,
  inc = 0,
  ica = 0,
  total,
  sellerNit, // no check digit
  buyerId, // no check digit
  technicalKey,
  environment,
}) => {
  const payload = [
    number,
    issueDate,
    issueTime,
    toAmount(subtotal),
    '01', toAmount(iva),
    '04', toAmount(inc),
    '03', toAmount(ica),
    toAmount(total),
    sellerNit,
    buyerId,
    technicalKey,
    environment,
  ].join('');

  return crypto.createHash('sha384').update(payload).digest('hex');
};

module.exports = { computeCufe, toAmount };
