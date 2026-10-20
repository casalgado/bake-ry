const crypto = require('crypto');
const { computeCufe, toAmount } = require('./cufe');
const { getDateInColombia, getTimeInColombia } = require('../../utils/dateUtils');

// The DIAN's own tax id, used as authorization provider (annex example).
const DIAN_NIT = '800197268';
const AGENCY = 'schemeAgencyID="195" schemeAgencyName="CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)"';

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const money = (tag, n) => `<cbc:${tag} currencyID="COP">${toAmount(n)}</cbc:${tag}>`;

const address = (a) => `
<cbc:ID>${esc(a.cityCode)}</cbc:ID>
<cbc:CityName>${esc(a.cityName)}</cbc:CityName>
<cbc:CountrySubentity>${esc(a.deptName)}</cbc:CountrySubentity>
<cbc:CountrySubentityCode>${esc(a.deptCode)}</cbc:CountrySubentityCode>
<cac:AddressLine><cbc:Line>${esc(a.line)}</cbc:Line></cac:AddressLine>
<cac:Country><cbc:IdentificationCode>CO</cbc:IdentificationCode><cbc:Name languageID="es">Colombia</cbc:Name></cac:Country>`;

const companyId = (idNumber, checkDigit, idType) => {
  const dv = checkDigit != null ? ` schemeID="${esc(checkDigit)}"` : '';
  return `<cbc:CompanyID ${AGENCY}${dv} schemeName="${esc(idType)}">${esc(idNumber)}</cbc:CompanyID>`;
};

// Tax scheme codes, annex table 13.2.2. Keys match Product.TAX_TYPES.
const TAX_SCHEMES = { IVA: '01', INC: '04' };

const taxSubtotal = (base, amount, rate, type) => {
  const schemeId = TAX_SCHEMES[type];
  if (!schemeId) throw new Error(`Unknown tax type: ${type}`);
  return `
<cac:TaxSubtotal>
  ${money('TaxableAmount', base)}
  ${money('TaxAmount', amount)}
  <cac:TaxCategory>
    <cbc:Percent>${toAmount(rate)}</cbc:Percent>
    <cac:TaxScheme><cbc:ID>${schemeId}</cbc:ID><cbc:Name>${type}</cbc:Name></cac:TaxScheme>
  </cac:TaxCategory>
</cac:TaxSubtotal>`;
};

/** One TaxTotal per tax type (annex: one group per tribute), none when nothing is taxed. */
const invoiceTaxTotals = (taxes) => Object.keys(TAX_SCHEMES).map((type) => {
  const groups = taxes.filter((t) => t.type === type);
  if (!groups.length) return '';
  const amount = groups.reduce((sum, t) => sum + t.amount, 0);
  return `
<cac:TaxTotal>
  ${money('TaxAmount', amount)}
  ${groups.map((t) => taxSubtotal(t.base, t.amount, t.rate, t.type)).join('')}
</cac:TaxTotal>`;
}).join('');

const supplierParty = (issuer) => `
<cac:AccountingSupplierParty>
  <cbc:AdditionalAccountID>${esc(issuer.personType)}</cbc:AdditionalAccountID>
  <cac:Party>
    <cac:PartyName><cbc:Name>${esc(issuer.tradeName || issuer.legalName)}</cbc:Name></cac:PartyName>
    <cac:PhysicalLocation><cac:Address>${address(issuer.address)}</cac:Address></cac:PhysicalLocation>
    <cac:PartyTaxScheme>
      <cbc:RegistrationName>${esc(issuer.legalName)}</cbc:RegistrationName>
      ${companyId(issuer.nit, issuer.checkDigit, '31')}
      <cbc:TaxLevelCode>${esc(issuer.taxLevelCode)}</cbc:TaxLevelCode>
      <cac:RegistrationAddress>${address(issuer.address)}</cac:RegistrationAddress>
      <cac:TaxScheme><cbc:ID>01</cbc:ID><cbc:Name>IVA</cbc:Name></cac:TaxScheme>
    </cac:PartyTaxScheme>
    <cac:PartyLegalEntity>
      <cbc:RegistrationName>${esc(issuer.legalName)}</cbc:RegistrationName>
      ${companyId(issuer.nit, issuer.checkDigit, '31')}
      <cac:CorporateRegistrationScheme><cbc:ID>${esc(issuer.resolution.prefix)}</cbc:ID></cac:CorporateRegistrationScheme>
    </cac:PartyLegalEntity>
    <cac:Contact>
      <cbc:Telephone>${esc(issuer.phone)}</cbc:Telephone>
      <cbc:ElectronicMail>${esc(issuer.email)}</cbc:ElectronicMail>
    </cac:Contact>
  </cac:Party>
</cac:AccountingSupplierParty>`;

// Buyer's ID document; required for natural persons (rule FAK61).
const partyId = ({ idNumber, checkDigit, idType }) => {
  const dv = checkDigit != null ? ` schemeID="${esc(checkDigit)}"` : '';
  return `<cbc:ID${dv} schemeName="${esc(idType)}">${esc(idNumber)}</cbc:ID>`;
};

const customerParty = (buyer) => `
<cac:AccountingCustomerParty>
  <cbc:AdditionalAccountID>${esc(buyer.personType)}</cbc:AdditionalAccountID>
  <cac:Party>
    <cac:PartyIdentification>${partyId(buyer)}</cac:PartyIdentification>
    <cac:PartyName><cbc:Name>${esc(buyer.name)}</cbc:Name></cac:PartyName>
    ${buyer.address ? `<cac:PhysicalLocation><cac:Address>${address(buyer.address)}</cac:Address></cac:PhysicalLocation>` : ''}
    <cac:PartyTaxScheme>
      <cbc:RegistrationName>${esc(buyer.name)}</cbc:RegistrationName>
      ${companyId(buyer.idNumber, buyer.checkDigit, buyer.idType)}
      <cbc:TaxLevelCode>${esc(buyer.taxLevelCode)}</cbc:TaxLevelCode>
      <cac:TaxScheme><cbc:ID>${esc(buyer.taxScheme.id)}</cbc:ID><cbc:Name>${esc(buyer.taxScheme.name)}</cbc:Name></cac:TaxScheme>
    </cac:PartyTaxScheme>
    <cac:PartyLegalEntity>
      <cbc:RegistrationName>${esc(buyer.name)}</cbc:RegistrationName>
      ${companyId(buyer.idNumber, buyer.checkDigit, buyer.idType)}
    </cac:PartyLegalEntity>
    ${buyer.email ? `<cac:Contact><cbc:ElectronicMail>${esc(buyer.email)}</cbc:ElectronicMail></cac:Contact>` : ''}
  </cac:Party>
</cac:AccountingCustomerParty>`;

const invoiceLine = (line) => `
<cac:InvoiceLine>
  <cbc:ID>${line.id}</cbc:ID>
  <cbc:InvoicedQuantity unitCode="94">${line.quantity}</cbc:InvoicedQuantity>
  ${money('LineExtensionAmount', line.base)}
  <cbc:FreeOfChargeIndicator>${line.free}</cbc:FreeOfChargeIndicator>
  ${line.free ? `<cac:PricingReference><cac:AlternativeConditionPrice>
    ${money('PriceAmount', line.referencePrice)}
    <cbc:PriceTypeCode>03</cbc:PriceTypeCode>
  </cac:AlternativeConditionPrice></cac:PricingReference>` : ''}
  ${line.taxRate > 0 ? `<cac:TaxTotal>
    ${money('TaxAmount', line.taxAmount)}
    ${taxSubtotal(line.base, line.taxAmount, line.taxRate, line.taxType)}
  </cac:TaxTotal>` : ''}
  <cac:Item>
    <cbc:Description>${esc(line.description)}</cbc:Description>
    <cac:StandardItemIdentification><cbc:ID schemeID="999">${esc(line.code)}</cbc:ID></cac:StandardItemIdentification>
  </cac:Item>
  <cac:Price>
    ${money('PriceAmount', line.unitPrice)}
    <cbc:BaseQuantity unitCode="94">1</cbc:BaseQuantity>
  </cac:Price>
</cac:InvoiceLine>`;

const dianExtensions = ({ issuer, number, cufe, environment }) => {
  const { resolution, software } = issuer;
  const securityCode = crypto.createHash('sha384')
    .update(`${software.id}${software.pin}${number}`).digest('hex');
  const qrHost = environment === '2' ? 'catalogo-vpfe-hab' : 'catalogo-vpfe';

  return `
<sts:DianExtensions>
  <sts:InvoiceControl>
    <sts:InvoiceAuthorization>${esc(resolution.number)}</sts:InvoiceAuthorization>
    <sts:AuthorizationPeriod>
      <cbc:StartDate>${esc(resolution.startDate)}</cbc:StartDate>
      <cbc:EndDate>${esc(resolution.endDate)}</cbc:EndDate>
    </sts:AuthorizationPeriod>
    <sts:AuthorizedInvoices>
      <sts:Prefix>${esc(resolution.prefix)}</sts:Prefix>
      <sts:From>${esc(resolution.from)}</sts:From>
      <sts:To>${esc(resolution.to)}</sts:To>
    </sts:AuthorizedInvoices>
  </sts:InvoiceControl>
  <sts:InvoiceSource>
    <cbc:IdentificationCode listAgencyID="6" listAgencyName="United Nations Economic Commission for Europe" listSchemeURI="urn:oasis:names:specification:ubl:codelist:gc:CountryIdentificationCode-2.1">CO</cbc:IdentificationCode>
  </sts:InvoiceSource>
  <sts:SoftwareProvider>
    <sts:ProviderID ${AGENCY} schemeID="${esc(issuer.checkDigit)}" schemeName="31">${esc(issuer.nit)}</sts:ProviderID>
    <sts:SoftwareID ${AGENCY}>${esc(software.id)}</sts:SoftwareID>
  </sts:SoftwareProvider>
  <sts:SoftwareSecurityCode ${AGENCY}>${securityCode}</sts:SoftwareSecurityCode>
  <sts:AuthorizationProvider>
    <sts:AuthorizationProviderID ${AGENCY} schemeID="4" schemeName="31">${DIAN_NIT}</sts:AuthorizationProviderID>
  </sts:AuthorizationProvider>
  <sts:QRCode>https://${qrHost}.dian.gov.co/document/searchqr?documentkey=${cufe}</sts:QRCode>
</sts:DianExtensions>`;
};

/**
 * Serializes an invoice (see buildInvoiceData) into an unsigned UBL 2.1 sales
 * invoice, and returns it with its CUFE. The second UBLExtension is the empty
 * slot where the XAdES signature goes (signXml.js).
 *
 * `issuer` carries the bakery's DIAN data: nit, checkDigit, legalName,
 * personType, taxLevelCode, address, phone, email, environment ('1' prod,
 * '2' habilitación), software { id, pin } and resolution { number, prefix,
 * from, to, startDate, endDate, technicalKey }.
 * `issuer.tradeName` (optional) is shown as the party name.
 * `number` is prefix + consecutive; `issuedAt` is a Date; `notes` are free-text
 * lines printed on the invoice (e.g. "abstenerse de practicar retención").
 */
const buildInvoiceXml = ({ invoice, issuer, number, issuedAt, notes = [] }) => {
  const { buyer, lines, taxes, totals, payment } = invoice;
  const { environment } = issuer;
  const issueDate = getDateInColombia(issuedAt);
  const issueTime = `${getTimeInColombia(issuedAt)}-05:00`;

  const cufe = computeCufe({
    number,
    issueDate,
    issueTime,
    subtotal: totals.lineExtension,
    iva: totals.iva,
    inc: totals.inc,
    total: totals.payable,
    sellerNit: issuer.nit,
    buyerId: buyer.idNumber,
    technicalKey: issuer.resolution.technicalKey,
    environment,
  });

  const credit = payment.form === '2';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:sts="dian:gov:co:facturaelectronica:Structures-2-1" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" xmlns:xades141="http://uri.etsi.org/01903/v1.4.1#" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<ext:UBLExtensions>
  <ext:UBLExtension><ext:ExtensionContent>${dianExtensions({ issuer, number, cufe, environment })}</ext:ExtensionContent></ext:UBLExtension>
  <ext:UBLExtension><ext:ExtensionContent></ext:ExtensionContent></ext:UBLExtension>
</ext:UBLExtensions>
<cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
<cbc:CustomizationID>10</cbc:CustomizationID>
<cbc:ProfileID>DIAN 2.1: Factura Electrónica de Venta</cbc:ProfileID>
<cbc:ProfileExecutionID>${environment}</cbc:ProfileExecutionID>
<cbc:ID>${esc(number)}</cbc:ID>
<cbc:UUID schemeID="${environment}" schemeName="CUFE-SHA384">${cufe}</cbc:UUID>
<cbc:IssueDate>${issueDate}</cbc:IssueDate>
<cbc:IssueTime>${issueTime}</cbc:IssueTime>
${credit ? `<cbc:DueDate>${esc(payment.dueDate)}</cbc:DueDate>` : ''}
<cbc:InvoiceTypeCode>01</cbc:InvoiceTypeCode>
${notes.map((n) => `<cbc:Note>${esc(n)}</cbc:Note>`).join('')}
<cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode>
<cbc:LineCountNumeric>${lines.length}</cbc:LineCountNumeric>
${supplierParty(issuer)}
${customerParty(buyer)}
<cac:PaymentMeans>
  <cbc:ID>${payment.form}</cbc:ID>
  <cbc:PaymentMeansCode>${payment.meansCode}</cbc:PaymentMeansCode>
  ${credit ? `<cbc:PaymentDueDate>${esc(payment.dueDate)}</cbc:PaymentDueDate>` : ''}
</cac:PaymentMeans>
${invoiceTaxTotals(taxes)}
<cac:LegalMonetaryTotal>
  ${money('LineExtensionAmount', totals.lineExtension)}
  ${money('TaxExclusiveAmount', totals.taxExclusive)}
  ${money('TaxInclusiveAmount', totals.payable)}
  ${money('PayableAmount', totals.payable)}
</cac:LegalMonetaryTotal>
${lines.map(invoiceLine).join('')}
</Invoice>`;

  return { xml, cufe };
};

module.exports = { buildInvoiceXml };
