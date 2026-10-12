const forge = require('node-forge');

const bagsOf = (p12, bagType) => p12.getBags({ bagType })[bagType] || [];

/**
 * Reads a .p12 / .pfx file: the signing key plus the certificate chain, as PEM.
 * The chain is ordered leaf first, because the key belongs to the leaf.
 * Checked by hand with openssl 1.1.1 files: default (3DES, SHA-1 MAC) and
 * modern-style (AES-256, SHA-256 MAC) both load. Not checked: files made by
 * openssl 3.x, which also derives the key with SHA-256 (forge reads that from
 * the file, so it should work). The unit test only uses a forge-made file.
 * If a client's real .p12 fails to load, convert it once with openssl to PEM.
 * Check the client's real .p12 before habilitación.
 */
const loadCertificate = (p12Buffer, password) => {
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(p12Buffer.toString('binary')), password);

  const keyBag = [
    ...bagsOf(p12, forge.pki.oids.pkcs8ShroudedKeyBag),
    ...bagsOf(p12, forge.pki.oids.keyBag),
  ][0];
  if (!keyBag) throw new Error('The .p12 file has no private key');

  const certs = bagsOf(p12, forge.pki.oids.certBag).map((bag) => bag.cert);
  const isLeaf = (cert) => cert.publicKey.n.compareTo(keyBag.key.n) === 0;
  const leaf = certs.find(isLeaf);
  if (!leaf) throw new Error('The .p12 file has no certificate for its private key');

  return {
    privateKeyPem: forge.pki.privateKeyToPem(keyBag.key),
    certChainPem: [leaf, ...certs.filter((c) => c !== leaf)].map((c) => forge.pki.certificateToPem(c)),
  };
};

module.exports = { loadCertificate };
