# DIAN electronic invoicing (software propio)

Emits Colombian electronic sales invoices (*factura electrónica de venta*) straight to the DIAN, with no technology provider in between. Started 2026-10-12. Pilot client: a bakery that is a persona jurídica.

Spec followed: **Anexo Técnico v1.9, Resolución 165 de 2023** (still current when this was written; the toolbox labelled "v2026" ships the same annex).

## Status

| Phase | What | State |
|---|---|---|
| B1 | CUFE, invoice data, UBL 2.1 XML | Done, tested |
| B2 | Load `.p12`, XAdES-EPES signature | Done, tested |
| B3a | `Einvoice` record, numbering counter, history, `issue()` | Done, tested (emulator) |
| B3b | SOAP client, secrets, endpoint, DIAN responses | Done: SETP990000003 accepted by the DIAN test set (2026-10-19) |
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
  loadSecrets.js               Secret Manager -> { privateKeyPem, certChainPem, softwarePin }
  dianClient.js                zip + file names, SOAP 1.2 + WS-Security, SendTestSetAsync, GetStatusZip
models/Einvoice.js             one invoice per order (doc id = order id)
models/BakerySettings.js       features.einvoicing: config block, off by default
services/einvoiceService.js    issue(): reserve number -> build -> sign -> store
                               send(): signed -> SendTestSetAsync -> sent (zipKey) | rejected
                               checkStatus(): sent -> GetStatusZip -> accepted | rejected | still sent
routes/einvoiceRoutes.js       POST /bakeries/:id/orders/:orderId/einvoice (issue + send)
                               POST .../einvoice/status, GET /bakeries/:id/einvoices[/:id]
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
- **Taxes: type + rate per product.** `Product.taxType` is `IVA` (scheme 01) or `INC` (04); `taxPercentage` 0 means **excluded**: no tax block on the line and not part of `TaxExclusiveAmount`. One invoice-level `TaxTotal` per tax type, none if nothing is taxed. This matches an invoice the DIAN accepted from the pilot bakery (via Alegra), where bread and delivery carry no tax.
- **Delivery fee** is its own excluded line, as in `Order`.
- Copied from that accepted invoice: transfer = payment means `31`, unit code `94`, trade name as `PartyName` (`issuer.tradeName`), and `einvoicing.notes` printed as `cbc:Note`.
- **Amounts tolerate ±2.00 COP** (annex §5.2.1.1). `buildInvoiceData` throws if the invoice total differs from the order total by more.
- **Emitting is manual** (a call per order). Automatic emission waits for the accountant (question 6).
- **Certificate and software PIN go in Secret Manager**, not Firestore. Loaded by `loadSecrets.js` (cached per instance) when the caller doesn't pass secrets.
- Digests and signature use **SHA-256 / RSA-SHA256** (annex-recommended). The DIAN's own example uses SHA-384 digests; both are allowed.

## Known gaps and placeholders

Each of these is also marked in the code (`TODO`, `ponytail:` or `RISK`).

| Gap | Where | Waiting on |
|---|---|---|
| Free items (*obsequios*) go out at 0 with the reference price and **no tax**; the DIAN may require tax on the reference value | `invoiceData.js` (`TODO`) | Accountant Q9 |
| Order lines get `taxType` from the frontend, which doesn't send it yet: until it does, every order line reads as IVA. Products can't be set to INC from the UI either | `models/Order.js`, frontend | Frontend change |
| No "exento" (taxed at 0%): 0% always means excluded. ICA is never emitted | `models/Product.js` (`ponytail:`) | A client that needs it |
| Buyer is always **consumidor final**. `User` has no document type, check digit, municipality code, person type or tax responsibility | `invoiceData.js` | Billing fields on `User` (B3b or later) |
| Paid = cash sale, unpaid = credit sale; **partial payments ignored** | `invoiceData.js` | Accountant Q11 |
| Payment means codes (`10` cash, `31` transfer, else `1`) unverified against annex table 13.3.4.2 | `invoiceData.js` | The DIAN test set will flag a wrong code |
| `X509IssuerName` format in the XAdES block is the likeliest rejection; expect to tune it | `signXml.js` | Habilitación with the real certificate |
| Item-level discounts are inside `currentPrice`; lines show the net price only | `invoiceData.js` | Only if the client wants them shown |
| An invoiced order can still be **edited or deleted**; this must be blocked (or a credit note issued) | not built | B3b/B4 |
| The XSD check was run by hand (`xmllint` against the toolbox XSDs), not in the test suite. It passed once the empty signature slot was filled and the serial number shortened (libxml2 rejects 48-digit serials; real CA serials are shorter) | scratchpad only | Optional: a dev script |

## Next steps

**Needs nothing from outside (can be done now):**
1. **First real send** (habilitación): configure Es Alimento's `features.einvoicing` (RUT data, software id, `testSetId`, SETP resolution), deploy, issue one order. Expect to tune: the WS-Security envelope, the "still processing" status codes, `ErrorMessageList` parsing, file names (all marked `ponytail:`).
2. Block editing/deleting an order that has an invoice.
3. Billing fields on `User` (document type, check digit, municipality, etc.) and the mapping to the buyer.
4. Production send (`SendBillSync`), PDF + QR, email to the buyer (B4).

**Needs outside input:**
- Accountant answers: `docs/einvoice/preguntas-contador.md` (they decide Q4, Q6, Q9, Q11, Q12 above).
- The client's **own** certificate (`.p12`, file form, not a USB token) and the habilitación: `docs/einvoice/tareas-hilo-a.md`. They have Alegra today; its certificate and numbering cannot be reused. Use a different prefix.
- Then: first real call to `SendTestSetAsync`, pass the test set (for the pilot the portal asks for just 1 accepted invoice, out of up to 30 invoices + 10 credit + 10 debit notes), request the real numbering in MUISCA, go live.

## Secrets and WS-Security

- Three secrets per issuer NIT in Secret Manager (project `bake-ry`): `einvoice-cert-<nit>` (raw `.p12`), `einvoice-cert-pass-<nit>`, `einvoice-pin-<nit>`. Only the function's service account can read them. The pilot's `.p12` (Camerfirma) loads with `loadCertificate` (checked 2026-10-19).
- The SOAP envelope follows a client that reports passing habilitación (cofacture, Go) and a published signed request: SOAP 1.2, `wsse:Security` with Timestamp (5 min), BinarySecurityToken, Signature over `wsa:To` only, exclusive C14N with prefixes `wsa soap wcf`, RSA-SHA256. Not from an official DIAN guide, but confirmed by real sends (2026-10-19). While processing, GetStatusZip answers an empty StatusCode with "Batch en proceso de validación."; the verdict came within ~10 s.
- Zip: one deflated entry built by hand with `zlib` (no zip dependency). Names: `z`/`fv` + NIT (10) + `000` + yy + consecutive (8 hex).

## Checking an invoice locally against the DIAN rules

The DIAN toolbox (v1.9, kept at `Documents/Dian Facturacion Electronica/Caja-de-herramientas-FE-V1-9`) ships its business rules as an XSLT 3.0 file. Run it with Saxon-HE 9.9 (the toolbox's own `saxon.jar` is XSLT 1.0 and fails):

```
java -jar Saxon-HE-9.9.1-8.jar -s:invoice.xml -xsl:".../XSL/DIAN-UBL21-model-compiled.xsl" -o:report.xml
```

Errors print as `Fatal: [code] ...`. The 2026-10-19 run on a sample Es Alimento invoice (IVA 19% + INC 8% + excluded bread + delivery) passed totals, taxes and CUFE. Two messages are known false positives of this stale rules file: **FAD03** (also fires on the DIAN's own examples) and **FAJ26 for `O-47`** (the file predates the régimen simple; the v1.9 code list has it and the DIAN accepted it from Alegra). The same file wanted `TaxLevelCode/@listName` = 04/05; we omit the attribute, as Alegra's accepted invoices do.

## Reference

- Annex v1.9 and toolbox (XSDs, example XMLs, code tables): https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documentacion-tecnica/
- Habilitación process: https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/proceso-de-registro-y-habilitacion-como-facturador-electronico/
- Habilitación portal: `catalogo-vpfe.dian.gov.co`. Numbering is requested in MUISCA.
- Web service endpoints (`vpfe-hab.dian.gov.co` / `vpfe.dian.gov.co`) are **not in the annex**; confirm them before use.
- Annex sections used: §5.2.1 (rounding), §10 (signature), §11.2 (CUFE), §11.8 (software security code), §7 (web services).
