# DIAN electronic invoicing (software propio)

Emits Colombian electronic sales invoices (*factura electrónica de venta*) straight to the DIAN, with no technology provider in between. Started 2026-10-12. Pilot client: a bakery that is a persona jurídica.

Spec followed: **Anexo Técnico v1.9, Resolución 165 de 2023** (still current when this was written; the toolbox labelled "v2026" ships the same annex).

## Status

| Phase | What | State |
|---|---|---|
| B1 | CUFE, invoice data, UBL 2.1 XML | Done, tested |
| B2 | Load `.p12`, XAdES-EPES signature | Done, tested |
| B3a | `Einvoice` record, numbering counter, history, `issue()` | Done, tested (emulator) |
| B3b | SOAP client, secrets, endpoint, DIAN responses | **Not started** |
| B4 | PDF with QR, email to the buyer, rejection handling | Not started |
| B5 | Credit and debit notes | Not started |
| B6 | POS equivalent document (separate habilitación) | Not started |

Nothing here has ever talked to the DIAN. **Passing tests means the numbers add up, the XML validates against the DIAN's XSD, and our own verifier accepts the signature. It does not mean the DIAN accepts it.** That is only proven in habilitación with a real certificate.

## What exists

```
services/dian/                 pure functions, no Firestore
  cufe.js                      CUFE = SHA-384 over the annex §11.2 fields
  invoiceData.js               Order (+ buyer) -> lines, taxes, totals, payment
  buildInvoiceXml.js           invoice data -> unsigned UBL 2.1 XML + CUFE
  loadCertificate.js           .p12 + password -> private key + chain (PEM)
  signXml.js                   unsigned XML -> XML signed XAdES-EPES
models/Einvoice.js             one invoice per order (doc id = order id)
models/BakerySettings.js       features.einvoicing: config block, off by default
services/einvoiceService.js    issue(): reserve number -> build -> sign -> store
```

Tests: `__tests__/services/dian/*` (pure) and `__tests__/services/einvoiceService.test.js` (needs the Firestore emulator).

### Flow of `einvoiceService.issue(bakeryId, orderId, user, { secrets })`

1. Check `features.einvoicing.enabled`. If the order already has a non-draft invoice, return it (even if the order was edited since).
2. Check the order is not deleted, then `buildInvoiceData(order)`. This runs **before** a number is taken, so an order that cannot be invoiced (totals mismatch, no lines, credit without due date) never uses one.
3. In one transaction, take the next number of the resolution and create a `draft` record. Two requests never share a number, and a crash never leaves a gap (the draft keeps its number; a retry finishes it).
4. `buildInvoiceXml(...)` -> `signXml(...)`.
5. In a transaction, re-read the record: if it is no longer a draft (a simultaneous call won), return the stored invoice. Otherwise store the signed XML, CUFE and totals; status becomes `signed`. Every transition goes to the `updateHistory` subcollection through `recordHistory`.

`secrets` = `{ privateKeyPem, certChainPem, softwarePin }`. The caller supplies them; they never live in Firestore.

### Where the data lives

- `bakeries/{id}/settings/default` -> `features.einvoicing`: environment (`"2"` habilitación, `"1"` production), software ID, issuer data, numbering resolution (prefix, range, technical key). Nothing secret.
- `bakeries/{id}/einvoices/{orderId}`: the invoice. Status: `draft`, `signed`, `sent`, `accepted`, `rejected`.
- `bakeries/{id}/einvoiceCounters/{prefix}`: `{ last }`, the last consecutive handed out.

## Decisions taken

- **One invoice per order**, id = order id. A rejected invoice is resent **with the same number**. Credit notes will be separate records.
- **The order discount is spread into the lines** instead of sent as a document-level allowance. The DIAN subtracts allowances *after* tax, while `Order` reduces the tax too.
- **Delivery fee** is its own untaxed line, as in `Order`.
- **Amounts tolerate ±2.00 COP** (annex §5.2.1.1). `buildInvoiceData` throws if the invoice total differs from the order total by more.
- **Emitting is manual** (a call per order). Automatic emission waits for the accountant (question 6).
- **Certificate and software PIN go in Secret Manager**, not Firestore. Not built yet.
- Digests and signature use **SHA-256 / RSA-SHA256** (annex-recommended). The DIAN's own example uses SHA-384 digests; both are allowed.

## Known gaps and placeholders

Each of these is also marked in the code (`TODO`, `ponytail:` or `RISK`).

| Gap | Where | Waiting on |
|---|---|---|
| Free items (*obsequios*) go out at 0 with the reference price and **no tax**; the DIAN may require tax on the reference value | `invoiceData.js` (`TODO`) | Accountant Q9 |
| **IVA only.** Consumption tax (INC) and ICA are not emitted | `invoiceData.js` | Accountant Q4 |
| Buyer is always **consumidor final**. `User` has no document type, check digit, municipality code, person type or tax responsibility | `invoiceData.js` | Billing fields on `User` (B3b or later) |
| Paid = cash sale, unpaid = credit sale; **partial payments ignored** | `invoiceData.js` | Accountant Q11 |
| Payment means codes (`10` cash, `47` transfer, else `1`) unverified against annex table 13.3.4.2 | `invoiceData.js` | The DIAN test set will flag a wrong code |
| `X509IssuerName` format in the XAdES block is the likeliest rejection; expect to tune it | `signXml.js` | Habilitación with the real certificate |
| `.p12` loading checked with openssl 1.1.1 files only (3DES/SHA-1 and AES-256/SHA-256). Files from openssl 3.x not tested | `loadCertificate.js` (`RISK`) | The client's real `.p12` |
| Item-level discounts are inside `currentPrice`; lines show the net price only | `invoiceData.js` | Only if the client wants them shown |
| An invoiced order can still be **edited or deleted**; this must be blocked (or a credit note issued) | not built | B3b/B4 |
| The XSD check was run by hand (`xmllint` against the toolbox XSDs), not in the test suite. It passed once the empty signature slot was filled and the serial number shortened (libxml2 rejects 48-digit serials; real CA serials are shorter) | scratchpad only | Optional: a dev script |

## Next steps

**Needs nothing from outside (can be done now):**
1. B3b, offline part: write `dianClient` against a **fake server**. Read the *Guía Herramienta para el Consumo de Web Services* and annex §7 first. **WS-Security (how the SOAP request is signed with the certificate) has not been read yet** and is the main unknown.
2. Secrets loader (`@google-cloud/secret-manager`, new dependency, needs approval): one secret per bakery with `{ p12 (base64), password, softwarePin }`.
3. Endpoint `POST /bakeries/:bakeryId/orders/:orderId/einvoice` plus reads (`GET /einvoices`, `/einvoices/:id`), reusing `controllerFactory` and the `requireBakeryStaffOrAdmin` middleware.
4. Block editing/deleting an order that has an invoice.
5. Billing fields on `User` (document type, check digit, municipality, etc.) and the mapping to the buyer.

**Needs outside input:**
- Accountant answers: `docs/einvoice/preguntas-contador.md` (they decide Q4, Q6, Q9, Q11, Q12 above).
- The client's **own** certificate (`.p12`, file form, not a USB token) and the habilitación: `docs/einvoice/tareas-hilo-a.md`. They have Alegra today; its certificate and numbering cannot be reused. Use a different prefix.
- Then: first real call to `SendTestSetAsync`, pass the test set (60 invoices, 20 credit notes, 20 debit notes), request the real numbering in MUISCA, go live.

## Reference

- Annex v1.9 and toolbox (XSDs, example XMLs, code tables): https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documentacion-tecnica/
- Habilitación process: https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/proceso-de-registro-y-habilitacion-como-facturador-electronico/
- Habilitación portal: `catalogo-vpfe.dian.gov.co`. Numbering is requested in MUISCA.
- Web service endpoints (`vpfe-hab.dian.gov.co` / `vpfe.dian.gov.co`) are **not in the annex**; confirm them before use.
- Annex sections used: §5.2.1 (rounding), §10 (signature), §11.2 (CUFE), §11.8 (software security code), §7 (web services).
