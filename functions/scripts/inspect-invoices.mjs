#!/usr/bin/env node
// READ-ONLY research tool for the invoice-collection phase (see ACTIVE_INVOICE_PARSING.md).
// Prints the fields that matter from DIAN e-invoice emails: header, totals and one row per line.
// Throwaway: delete it once the real parser exists. Regex-based on purpose, not a parser.
//
// Usage (keep the .eml files OUTSIDE the repo, they contain real supplier data):
//   gcloud storage cp "gs://bake-ry.appspot.com/inbound_emails/es-alimento/*.eml" <dir>
//   node scripts/inspect-invoices.mjs <dir | file.eml ...>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import PostalMime from 'postal-mime';

// Minimal ZIP reader (central directory; stored + deflate only). Enough for DIAN ZIPs.
function unzip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) return [];
  const files = [];
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < buf.readUInt16LE(eocd + 10); i++) {
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extra = buf.readUInt16LE(p + 30), comment = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42), name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    files.push({ name, content: method === 8 ? zlib.inflateRawSync(data) : data });
    p += 46 + nameLen + extra + comment;
  }
  return files;
}

const block = (x, tag) => x.match(new RegExp(`<cac:${tag}[ >][^]*?</cac:${tag}>`))?.[0] ?? '';
const blocks = (x, tag) => x.match(new RegExp(`<cac:${tag}[ >][^]*?</cac:${tag}>`, 'g')) ?? [];
const val = (x, tag) => x.match(new RegExp(`<cbc:${tag}(?: [^>]*)?>([^<]*)<`))?.[1]?.trim() ?? '';
const attr = (x, tag, a) => x.match(new RegExp(`<cbc:${tag} [^>]*${a}="([^"]*)"`))?.[1] ?? '';
const n = (s) => (s === '' ? '' : String(+s));

function printInvoice(xml) {
  // The real document sits in a CDATA block of the AttachedDocument wrapper (or is the file itself).
  const docs = [...xml.matchAll(/<!\[CDATA\[([^]*?)\]\]>/g)].map((m) => m[1]);
  const inv = docs.find((c) => /<(Invoice|CreditNote|DebitNote)[ >]/.test(c)) ?? xml;
  const root = inv.match(/<(Invoice|CreditNote|DebitNote)[ >]/)?.[1] ?? '?';
  const sup = block(block(inv, 'AccountingSupplierParty'), 'PartyTaxScheme');
  const cus = block(inv, 'AccountingCustomerParty');
  const tot = block(inv, 'LegalMonetaryTotal'), pay = block(inv, 'PaymentMeans');
  const typeCode = val(inv, 'InvoiceTypeCode') || val(inv, 'CreditNoteTypeCode');

  console.log(`  ${root} ${val(inv, 'ID')}  ${val(inv, 'IssueDate')} ${val(inv, 'IssueTime')}  type ${typeCode}`);
  console.log(`  CUFE      ${val(inv, 'UUID').slice(0, 20)}…`);
  console.log(`  Supplier  NIT ${val(sup, 'CompanyID')}  ${val(sup, 'RegistrationName')}`);
  console.log(`  Buyer     NIT ${val(block(cus, 'PartyTaxScheme'), 'CompanyID')}  ${val(block(cus, 'PartyTaxScheme'), 'RegistrationName')}  <${val(cus, 'ElectronicMail')}>`);
  console.log(`  Payment   method ${val(pay, 'ID')} (1 cash/2 credit), means ${val(pay, 'PaymentMeansCode')}, due ${val(pay, 'PaymentDueDate') || val(inv, 'DueDate')}`);
  console.log(`  Totals    net ${n(val(tot, 'LineExtensionAmount'))} | tax ${n(val(block(inv, 'TaxTotal'), 'TaxAmount'))} | allowances ${n(val(tot, 'AllowanceTotalAmount'))} | payable ${n(val(tot, 'PayableAmount'))} ${attr(tot, 'PayableAmount', 'currencyID')}`);
  // Flag the not-yet-seen cases from the collection checklist.
  const flags = ['WithholdingTaxTotal', 'AllowanceCharge'].filter((t) => inv.includes(`<cac:${t}`));
  if (flags.length) console.log(`  Has       ${flags.join(', ')}`);

  const lineTag = root === 'Invoice' ? 'InvoiceLine' : `${root}Line`;
  console.table(blocks(inv, lineTag).map((l) => {
    const qtyTag = root === 'Invoice' ? 'InvoicedQuantity' : root === 'CreditNote' ? 'CreditedQuantity' : 'DebitedQuantity';
    return {
      code: val(block(l, 'StandardItemIdentification'), 'ID') || val(block(l, 'SellersItemIdentification'), 'ID'),
      description: val(block(l, 'Item'), 'Description'),
      qty: n(val(l, qtyTag)),
      unit: attr(l, qtyTag, 'unitCode'),
      priceAmount: n(val(block(l, 'Price'), 'PriceAmount')), // not reliable: VAT included by some issuers
      net: n(val(l, 'LineExtensionAmount')),
      'tax%': n(val(block(l, 'TaxTotal'), 'Percent')),
      tax: n(val(block(l, 'TaxTotal'), 'TaxAmount')),
    };
  }));
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: node scripts/inspect-invoices.mjs <dir | file.eml ...>');
  process.exit(1);
}
const files = args.flatMap((a) => (fs.statSync(a).isDirectory()
  ? fs.readdirSync(a).filter((f) => f.endsWith('.eml')).map((f) => path.join(a, f))
  : [a]));

for (const file of files) {
  const email = await PostalMime.parse(fs.readFileSync(file));
  console.log(`\n=== ${path.basename(file).slice(0, 8)}  from ${email.from?.address}  "${email.subject}"`);
  const xmls = email.attachments.flatMap((a) => {
    const buf = Buffer.from(a.content);
    if (/\.zip$/i.test(a.filename ?? '')) return unzip(buf).filter((f) => /\.xml$/i.test(f.name));
    if (/\.xml$/i.test(a.filename ?? '')) return [{ name: a.filename, content: buf }];
    return [];
  });
  if (!xmls.length) console.log(`  No XML found. Attachments: ${email.attachments.map((a) => a.filename).join(', ') || 'none'}`);
  for (const x of xmls) {
    console.log(`  [${x.name}]`);
    printInvoice(x.content.toString('utf8'));
  }
}
