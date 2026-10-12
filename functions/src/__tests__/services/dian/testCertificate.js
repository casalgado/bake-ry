const crypto = require('crypto');
const forge = require('node-forge');

/**
 * Throwaway self-signed certificate wrapped in a .p12, for tests only. Its
 * issuer carries an email, like the Colombian certificate authorities' do.
 * Returns the .p12 buffer and the certificate as PEM.
 */
const makeP12 = (password) => {
  const { privateKey: pem } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const key = forge.pki.privateKeyFromPem(pem);

  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.setRsaPublicKey(key.n, key.e);
  cert.serialNumber = '0a1b2c3d4e5f';
  cert.validity.notBefore = new Date(Date.now() - 86400000);
  cert.validity.notAfter = new Date(Date.now() + 86400000);
  const subject = [
    { name: 'commonName', value: 'Panaderia de Prueba SAS' },
    { name: 'countryName', value: 'CO' },
  ];
  cert.setSubject(subject);
  cert.setIssuer([...subject, { name: 'emailAddress', value: 'ca@prueba.test' }]);
  cert.sign(key, forge.md.sha256.create());

  const der = forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(key, [cert], password, { algorithm: '3des' })).getBytes();
  return { p12: Buffer.from(der, 'binary'), certPem: forge.pki.certificateToPem(cert) };
};

module.exports = { makeP12 };
