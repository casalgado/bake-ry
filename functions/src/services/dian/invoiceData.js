const { BadRequestError } = require('../../utils/errors');
const { getDateInColombia } = require('../../utils/dateUtils');
const Product = require('../../models/Product');

// Annex v1.9 §5.2.1.1: monetary values may be off by ±2.00 COP.
const TOLERANCE = 2;

// Anonymous buyer the DIAN accepts when the customer is not identified.
const CONSUMIDOR_FINAL = {
  idType: '13', // CC
  idNumber: '222222222222',
  checkDigit: null,
  name: 'consumidor final',
  personType: '2', // natural
  taxLevelCode: 'R-99-PN',
  taxScheme: { id: 'ZZ', name: 'No aplica' },
  email: null,
  address: null,
};

// PaymentMeansCode, annex table 13.3.4.2. Anything unmapped is "no definido".
// ponytail: verify codes against the DIAN test set; card methods not mapped yet.
// transfer = 31 ("transferencia débito"), as in the bakery's invoices the DIAN already accepted.
const PAYMENT_MEANS_CODES = { cash: '10', transfer: '31' };

const round2 = (n) => Math.round(n * 100) / 100;

/** Share of the order discount, applied the same way Order.calculatePricing does. */
const discountRatio = (order) => {
  const base = order.taxMode === 'exclusive' ? order.preTaxSubtotal : order.postTaxSubtotal;
  return order.orderDiscountAmount > 0 && base > 0 ? order.orderDiscountAmount / base : 0;
};

/**
 * One invoice line. The order discount is spread into the lines instead of
 * being sent as a document-level allowance: the DIAN subtracts allowances
 * *after* tax, while Order reduces the tax too.
 * ponytail: item-level discounts are already inside currentPrice, so lines
 * show the net price only. Add per-line AllowanceCharge if the client wants it shown.
 */
const toLine = (item, ratio) => {
  const common = {
    description: item.invoiceTitle,
    code: item.productId,
    quantity: item.quantity,
    taxType: item.taxType,
    taxRate: item.taxPercentage,
  };

  // TODO(accountant Q9, docs/einvoice/preguntas-contador.md): confirm how
  // obsequios must be declared (price, tax base, reference price type).
  // Placeholder: free lines go out at 0 with the reference price and no tax.
  // The DIAN may require the tax on the reference value; check before go-live.
  if (item.isComplimentary) {
    return { ...common, unitPrice: 0, base: 0, taxAmount: 0, free: true, referencePrice: item.currentPrice };
  }

  const keep = 1 - ratio;
  const base = round2(item.quantity * item.preTaxPrice * keep);
  const taxAmount = round2(item.quantity * item.taxAmount * keep);
  return { ...common, unitPrice: round2(base / item.quantity), base, taxAmount, free: false };
};

/** Delivery is charged without tax in Order, so it is its own untaxed line. */
const deliveryLine = (fee) => ({
  description: 'Domicilio',
  code: 'DOMICILIO',
  quantity: 1,
  taxRate: 0,
  unitPrice: fee,
  base: fee,
  taxAmount: 0,
  free: false,
});

/**
 * Tax subtotals grouped by type and rate. 0% lines are excluded products: they
 * carry no tax and stay out of the taxable base, as in the invoices the DIAN
 * already accepted from this bakery.
 */
const groupTaxes = (lines) => {
  // Checked here, before einvoiceService reserves a number: a bad type found
  // later would leave that number stuck in a draft. Free lines count too, since
  // the XML writes their tax block.
  const badLine = lines.find((l) => l.taxRate > 0 && !Object.values(Product.TAX_TYPES).includes(l.taxType));
  if (badLine) {
    throw new BadRequestError(`Tipo de impuesto inválido en "${badLine.description}": ${badLine.taxType}`);
  }

  const byKey = new Map();
  lines.filter((l) => !l.free && l.taxRate > 0).forEach((l) => {
    const key = `${l.taxType}-${l.taxRate}`;
    const group = byKey.get(key) || { type: l.taxType, rate: l.taxRate, base: 0, amount: 0 };
    group.base = round2(group.base + l.base);
    group.amount = round2(group.amount + l.taxAmount);
    byKey.set(key, group);
  });
  return [...byKey.values()];
};

const sumBy = (groups, field, type) => round2(groups
  .filter((g) => !type || g.type === type)
  .reduce((sum, g) => sum + g[field], 0));

/**
 * Normalizes an Order into what the invoice needs. No XML here: all the
 * money logic lives in this file so it can be tested without parsing XML.
 * Throws if the invoice would not add up to what the customer was charged.
 *
 * `buyer` is already shaped like CONSUMIDOR_FINAL; mapping real clients to it
 * comes with the billing fields on User.
 */
const buildInvoiceData = (order, { buyer = CONSUMIDOR_FINAL } = {}) => {
  const ratio = discountRatio(order);
  const lines = order.orderItems.map((item) => toLine(item, ratio));

  if (order.fulfillmentType === 'delivery' && order.deliveryFee > 0) {
    lines.push(deliveryLine(order.deliveryFee));
  }
  if (!lines.some((l) => !l.free)) {
    throw new BadRequestError('El pedido no tiene líneas para facturar');
  }
  lines.forEach((line, i) => { line.id = i + 1; });

  const taxes = groupTaxes(lines);
  const lineExtension = round2(lines.reduce((sum, l) => sum + l.base, 0));
  const taxTotal = sumBy(taxes, 'amount');
  const payable = round2(lineExtension + taxTotal);

  if (Math.abs(payable - order.total) > TOLERANCE) {
    throw new BadRequestError(
      `El total de la factura (${payable}) no coincide con el del pedido (${order.total})`,
    );
  }

  const dueDate = getDateInColombia(order.dueDate);
  if (!order.isPaid && !dueDate) {
    throw new BadRequestError('Una venta a crédito necesita fecha de vencimiento');
  }

  return {
    buyer,
    lines,
    taxes,
    // taxExclusive: taxable base only. iva/inc: per-type tax, for the CUFE.
    totals: {
      lineExtension,
      taxExclusive: sumBy(taxes, 'base'),
      taxTotal,
      iva: sumBy(taxes, 'amount', 'IVA'),
      inc: sumBy(taxes, 'amount', 'INC'),
      payable,
    },
    // ponytail: partial payments are ignored; paid = cash sale, unpaid = credit (accountant Q11).
    payment: {
      form: order.isPaid ? '1' : '2', // 1 contado, 2 crédito
      meansCode: PAYMENT_MEANS_CODES[order.paymentMethod] || '1',
      dueDate,
    },
  };
};

module.exports = { buildInvoiceData, CONSUMIDOR_FINAL, TOLERANCE };
