const crypto = require('crypto');
const { Order } = require('../../../models/Order');
const { buildInvoiceData } = require('../../../services/dian/invoiceData');
const { buildInvoiceXml } = require('../../../services/dian/buildInvoiceXml');
const { computeCufe } = require('../../../services/dian/cufe');

const issuer = {
  nit: '900123456',
  checkDigit: '7',
  legalName: 'Panadería Ñandú & Cía S.A.S.',
  personType: '1',
  taxLevelCode: 'O-13',
  environment: '2',
  phone: '3001234567',
  email: 'facturas@panaderia.test',
  address: { line: 'Calle 1 # 2-3', cityCode: '11001', cityName: 'Bogotá, D.C.', deptCode: '11', deptName: 'Bogotá' },
  software: { id: 'soft-id-123', pin: '12345' },
  resolution: {
    number: '18760000001',
    prefix: 'SETP',
    from: '990000000',
    to: '995000000',
    startDate: '2019-01-19',
    endDate: '2030-01-19',
    technicalKey: 'fc8eac422eba16e22ffd8c6f94b3f40a6e38162c',
  },
};

const makeOrder = (overrides = {}) => new Order({
  bakeryId: 'b1',
  userId: 'u1',
  isPaid: true,
  paymentMethod: 'cash',
  dueDate: new Date('2026-10-20T15:00:00Z'),
  orderItems: [
    { productId: 'p1', productName: 'Torta', quantity: 2, basePrice: 11900, currentPrice: 11900, taxPercentage: 19 },
    { productId: 'p2', productName: 'Pan <integral> "grande"', quantity: 1, basePrice: 5000, currentPrice: 5000, taxPercentage: 0 },
  ],
  ...overrides,
});

const order = makeOrder();

// 2026-10-20 14:30:05 in Bogotá (UTC-5)
const issuedAt = new Date('2026-10-20T19:30:05Z');

describe('dian/buildInvoiceXml', () => {
  const { xml, cufe } = buildInvoiceXml({
    invoice: buildInvoiceData(order),
    issuer,
    number: 'SETP990000001',
    issuedAt,
  });

  it('puts the same CUFE in the XML and the return value', () => {
    expect(xml).toContain(`schemeName="CUFE-SHA384">${cufe}</cbc:UUID>`);
    expect(cufe).toBe(computeCufe({
      number: 'SETP990000001',
      issueDate: '2026-10-20',
      issueTime: '14:30:05-05:00',
      subtotal: 25000,
      iva: 3800,
      inc: 0,
      total: 28800,
      sellerNit: '900123456',
      buyerId: '222222222222',
      technicalKey: issuer.resolution.technicalKey,
      environment: '2',
    }));
  });

  it('writes header, totals and line count', () => {
    expect(xml).toContain('<cbc:ID>SETP990000001</cbc:ID>');
    expect(xml).toContain('<cbc:IssueTime>14:30:05-05:00</cbc:IssueTime>');
    expect(xml).toContain('<cbc:ProfileExecutionID>2</cbc:ProfileExecutionID>');
    expect(xml).toContain('<cbc:LineCountNumeric>2</cbc:LineCountNumeric>');
    expect(xml).toContain('<cbc:PayableAmount currencyID="COP">28800.00</cbc:PayableAmount>');
    expect(xml.match(/<cac:InvoiceLine>/g)).toHaveLength(2);
  });

  it('puts tax only on taxed lines, and only taxed bases in TaxExclusiveAmount', () => {
    expect(xml.match(/<cac:TaxTotal>/g)).toHaveLength(2); // the 19% line + the invoice level
    expect(xml).toContain('<cbc:TaxExclusiveAmount currencyID="COP">20000.00</cbc:TaxExclusiveAmount>');
    expect(xml).not.toContain('<cbc:Percent>0.00</cbc:Percent>');
  });

  it('writes no TaxTotal at all when every line is excluded', () => {
    const { xml: untaxed } = buildInvoiceXml({
      invoice: buildInvoiceData(makeOrder({
        orderItems: [{ productId: 'p2', productName: 'Pan', quantity: 2, basePrice: 5000, currentPrice: 5000, taxPercentage: 0 }],
      })),
      issuer,
      number: 'SETP990000003',
      issuedAt,
    });
    expect(untaxed).not.toContain('<cac:TaxTotal>');
    expect(untaxed).toContain('<cbc:TaxExclusiveAmount currencyID="COP">0.00</cbc:TaxExclusiveAmount>');
    expect(untaxed).toContain('<cbc:PayableAmount currencyID="COP">10000.00</cbc:PayableAmount>');
  });

  it('writes one invoice-level TaxTotal per tax type and feeds INC to the CUFE', () => {
    const mixed = makeOrder({
      orderItems: [
        { productId: 'p1', productName: 'Torta', quantity: 1, basePrice: 11900, currentPrice: 11900, taxPercentage: 19 },
        { productId: 'p4', productName: 'Café', quantity: 1, basePrice: 10800, currentPrice: 10800, taxPercentage: 8, taxType: 'INC' },
      ],
    });
    const result = buildInvoiceXml({ invoice: buildInvoiceData(mixed), issuer, number: 'SETP990000004', issuedAt });

    expect(result.xml.match(/<cac:TaxTotal>/g)).toHaveLength(4); // 2 lines + IVA + INC
    expect(result.xml).toContain('<cbc:ID>04</cbc:ID><cbc:Name>INC</cbc:Name>');
    expect(result.cufe).toBe(computeCufe({
      number: 'SETP990000004',
      issueDate: '2026-10-20',
      issueTime: '14:30:05-05:00',
      subtotal: 20000,
      iva: 1900,
      inc: 800,
      total: 22700,
      sellerNit: '900123456',
      buyerId: '222222222222',
      technicalKey: issuer.resolution.technicalKey,
      environment: '2',
    }));
  });

  it('uses the trade name as party name and writes notes', () => {
    const { xml: named } = buildInvoiceXml({
      invoice: buildInvoiceData(order),
      issuer: { ...issuer, tradeName: 'ÑANDÚ' },
      number: 'SETP990000005',
      issuedAt,
      notes: ['Régimen simple: abstenerse de practicar retención.'],
    });
    expect(named).toContain('<cac:PartyName><cbc:Name>ÑANDÚ</cbc:Name></cac:PartyName>');
    expect(named).toContain('<cbc:Note>Régimen simple: abstenerse de practicar retención.</cbc:Note>');
    expect(named).toContain('unitCode="94"');
  });

  it('identifies the buyer in PartyIdentification (FAK61)', () => {
    expect(xml).toContain('<cac:PartyIdentification><cbc:ID schemeName="13">222222222222</cbc:ID></cac:PartyIdentification>');
  });

  it('escapes special characters', () => {
    expect(xml).toContain('Panadería Ñandú &amp; Cía S.A.S.');
    expect(xml).toContain('Pan &lt;integral&gt; &quot;grande&quot;');
    expect(xml).not.toContain('<integral>');
  });

  it('computes the software security code from id + pin + number', () => {
    const expected = crypto.createHash('sha384').update('soft-id-123' + '12345' + 'SETP990000001').digest('hex');
    expect(xml).toContain(`>${expected}</sts:SoftwareSecurityCode>`);
  });

  it('points the QR at the habilitación catalog in the test environment', () => {
    expect(xml).toContain(`https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey=${cufe}`);
  });

  it('leaves an empty extension slot for the signature', () => {
    expect(xml).toContain('<ext:UBLExtension><ext:ExtensionContent></ext:ExtensionContent></ext:UBLExtension>');
  });

  it('adds DueDate only for credit sales', () => {
    expect(xml).not.toContain('<cbc:DueDate>');

    const credit = buildInvoiceXml({
      invoice: buildInvoiceData(makeOrder({ isPaid: false })),
      issuer,
      number: 'SETP990000002',
      issuedAt,
    });
    expect(credit.xml).toContain('<cbc:DueDate>2026-10-20</cbc:DueDate>');
  });
});
