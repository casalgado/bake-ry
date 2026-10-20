const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const { loadCertificate } = require('./loadCertificate');

// One set of secrets per issuer NIT (no check digit):
//   einvoice-cert-<nit>       the .p12 file, raw bytes
//   einvoice-cert-pass-<nit>  its password
//   einvoice-pin-<nit>        the software PIN from the habilitación portal
let client;
// ponytail: cached per instance for its lifetime; a rotated certificate is picked
// up on the next cold start. Add a TTL if certificates get rotated mid-day.
const cache = new Map();

const access = async (projectId, name) => {
  client = client || new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({
    name: `projects/${projectId}/secrets/${name}/versions/latest`,
  });
  return version.payload.data; // Buffer
};

/**
 * The signing material einvoiceService.issue() expects:
 * { privateKeyPem, certChainPem, softwarePin }.
 */
const loadSecrets = async (nit, projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT) => {
  if (!cache.has(nit)) {
    const load = async () => {
      const [p12, password, pin] = await Promise.all([
        access(projectId, `einvoice-cert-${nit}`),
        access(projectId, `einvoice-cert-pass-${nit}`),
        access(projectId, `einvoice-pin-${nit}`),
      ]);
      return { ...loadCertificate(p12, password.toString('utf8')), softwarePin: pin.toString('utf8') };
    };
    // Cache the promise so concurrent calls share one fetch; drop it on failure so a retry refetches.
    cache.set(nit, load().catch((err) => { cache.delete(nit); throw err; }));
  }
  return cache.get(nit);
};

module.exports = { loadSecrets };
