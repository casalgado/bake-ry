# ACTIVE: Supplier e-invoice parsing (research)

> Started 2026-10-06. **Status: research only. Don't build a parser yet.**
> **Next step:** collect more real invoices (§4). Revisit this doc once there are enough to cover the cases in §4.
> Intake (how emails arrive and how senders are verified) lives in `ACTIVE_INBOUND_EMAIL.md` and is done. This doc only covers what's *inside* the emails.

---

## 1. Sample so far (3 invoices, es-alimento, all from 2026-10-05)

Stored in prod at `gs://bake-ry.appspot.com/inbound_emails/es-alimento/*.eml`. All three were manually forwarded. The chain was: supplier → `contabilidadproductorash@gmail.com` → … → `dev@carsalhaz.com` → `facturas@`.

| Supplier (NIT) | Invoicing system | Lines | Payable (COP) | What was bought |
|---|---|---|---|---|
| Sonia Delgado (63346951) | Siigo | 1 | 210,000 | cheese |
| Jerónimo Martins / Ara (900480569) | edocnube | 7 | 120,110 | eggs, milk, yogurt, sugar, dish soap, detergent, disposables |
| Countryplas (901101863) | mayasisla | 4 | 134,500 | bags, containers |

Real supplier data: keep the `.eml`s and anything extracted from them **out of git**.

## 2. What the files look like

- **Email:** the subject follows the DIAN format `NIT;Name;DocNumber;TypeCode;Name[;extra]`. One subject has an extra trailing field (`;CDMYS:11547`), so split on `;` and read by position.
- **Attachment:** one ZIP per email. Each ZIP holds 1 XML + 1 PDF, and **file names vary** (`ad….xml`, `fv….xml`, `FEV160243.xml`), so take whichever `.xml` is inside.
- **XML:** always an `AttachedDocument` wrapper with **2 CDATA blocks**: the embedded `Invoice` (UBL 2.1), and DIAN's `ApplicationResponse` ("Documento validado por la DIAN"). Everything useful is in the `Invoice`.
- About 540 flattened fields per invoice, mostly noise: signatures, DIAN extensions, addresses, tax-regime codes, the QR string. **Element order differs between issuers**, so look fields up by name, never by position.

## 3. Fields that matter (found in all 3)

Paths are relative to the embedded `Invoice` (`cbc:`/`cac:` prefixes omitted).

| Field | Path | Notes |
|---|---|---|
| Invoice number | `ID` | |
| CUFE | `UUID` (schemeName `CUFE-SHA384`) | Unique invoice key; use it for dedupe |
| Type | `InvoiceTypeCode` | `01` = sales invoice on all 3 |
| Issue date / time | `IssueDate`, `IssueTime` | |
| Supplier NIT / name | `AccountingSupplierParty/Party/PartyTaxScheme/CompanyID`, `RegistrationName` | |
| Buyer NIT | `AccountingCustomerParty/Party/PartyTaxScheme/CompanyID` | `901417532` on all 3. **Match the bakery on this, never on the name**: the buyer name is spelled 3 different ways |
| Buyer email | `AccountingCustomerParty/Party/Contact/ElectronicMail` | `contabilidadproductorash@gmail.com`, the bakery's reception email |
| Payment | `PaymentMeans/ID` (1 = cash, 2 = credit), `PaymentMeansCode`, `PaymentDueDate` | All 3 were cash (`ID` 1), each paid a different way (`10`, `48`, `45`) |
| Totals | `LegalMonetaryTotal/LineExtensionAmount` (net), `TaxInclusiveAmount`, `PayableAmount`; tax in `TaxTotal/TaxAmount` | |
| Line | `InvoiceLine/ID`, `Item/Description`, `InvoicedQuantity` (+ `@unitCode`), `LineExtensionAmount` (net), `TaxTotal/TaxAmount`, `TaxTotal/TaxSubtotal/TaxCategory/Percent` | |
| Item code | `Item/StandardItemIdentification/ID`, fallback `Item/SellersItemIdentification/ID` | Ara: real EAN barcodes. Others: supplier-internal codes (`03`, `848`) |

### Gotchas found
1. **`Price/PriceAmount` is not consistent.** Ara's price *includes* VAT (dish soap: 7,950 = 6,680.67 net + 19%). Countryplas's price *excludes* VAT. → Calculate unit cost as `LineExtensionAmount / InvoicedQuantity` and take tax from the line's `TaxTotal`. Don't trust `PriceAmount`.
2. **`Price/BaseQuantity` is misused**: all 3 put the purchased quantity there. Ignore it.
3. **Number precision varies** (`10`, `10.000`, `5.000000`). Parse numbers; don't compare strings.
4. **Totals can be off by a cent from rounding** (Countryplas: `TaxInclusiveAmount` 134,500.01 vs `PayableAmount` 134,500.00).
5. **Units are uninformative.** `unitCode` is `94` (DIAN "unidad") or `EA`. The real pack size lives in the description text ("HUEVO TIPO A X 30 UN", "AZUCAR BLANC X5000g", "LECH ENT 6 UN X 900"). Converting to kg/L will need a conversion factor stored per supplier item.
6. **VAT rates mixed within one invoice:** 0%, 5% and 19% (Ara).

### Domain observations (for phase 3, not now)
- Only 5 of 12 lines are ingredients (cheese, eggs, yogurt, milk, sugar). The rest is cleaning, packaging and disposables, so each line needs a destination: an ingredient (stock `purchase`), an expense category, or ignored.
- The natural mapping key is **(supplier NIT, item code)**: map it once, then it matches automatically. EAN barcodes also work across suppliers.

## 4. Next step: collect more invoices

**Goal:** about 15–20 invoices from at least 8 different suppliers before designing the parser. Specifically look for the cases the sample doesn't cover yet:

- [ ] **Flour / bulk ingredient suppliers**, the core use case (sold by kg, by the sack)
- [ ] **Credit notes** (`CreditNote`, a return or discount), and debit notes
- [ ] **Credit-term invoices** (`PaymentMeans/ID` = 2, with a later due date)
- [ ] **Discounts or surcharges** (`AllowanceCharge`, non-zero `AllowanceTotalAmount`)
- [ ] **Withholdings** (`WithholdingTaxTotal`: ReteFuente / ReteIVA / ReteICA), likely from larger suppliers
- [ ] **Weight units** (`KGM`, `GRM`, `LTR`) instead of `94`/`EA`
- [ ] **POS electronic receipts** (*documento equivalente electrónico POS*) from supermarkets, in case it's a different document type
- [ ] **Odd packaging**: XML attached without a ZIP, a ZIP with several XMLs, or a PDF only (not a valid e-invoice)
- [ ] **More invoicing systems** (Siigo, Alegra, World Office, …), to see how much each one varies

**How to collect**
- Forward invoices to `facturas@mentedigital.app`. The forwarder must be a prod Auth user with a `bakeryId` claim: `dev@carsalhaz.com`, `es.alimento@gmail.com`, and `contabilidadproductorash@gmail.com` (created in prod 2026-10-06). The last one is the inbox where invoices actually arrive, so it can forward directly.
- Forward old invoices too, not just new ones: the backlog in that inbox is the quickest source of variety.

**How to inspect what arrived**
```
gcloud storage ls -l gs://bake-ry.appspot.com/inbound_emails/es-alimento/
gcloud storage cp "gs://bake-ry.appspot.com/inbound_emails/es-alimento/*.eml" <local dir outside the repo>
node scripts/inspect-invoices.mjs <that dir>
```
`scripts/inspect-invoices.mjs` prints the header, totals and line items of each invoice inside the `.eml`s. It handles ZIP or plain-XML attachments, and Invoice, CreditNote or DebitNote documents, and it flags withholdings or allowances when present. It's a regex-based research tool, **not** the parser: delete it once the parser exists. If `gcloud` says "Reauthentication failed", run `gcloud auth login`.

## 5. Open questions (answer once more data is in)
- Is `contabilidadproductorash@gmail.com` the only reception inbox es-alimento uses?
- Which invoice types beyond `01` actually show up?
- What do the bakery's flour/dairy suppliers' item descriptions look like? Could a per-item conversion factor work, or is a manual step needed per invoice?
- Does the bakery want expenses (non-ingredient lines) tracked at all, or only inventory?
