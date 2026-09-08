// __tests__/models/ClientReport.test.js

const ClientReport = require('../../models/ClientReport');
const { classifyVector } = ClientReport;
const { Order } = require('../../models/Order');
const { buildPeriods } = require('../../utils/periods');

function mondayOf(date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - (day - 1));
  d.setHours(12, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function makeOrder(id, userId, userName, dueDate, { subtotal = 10000, paymentDate = null, userEmail = '', userPhone = '', userLegalName = '', userNationalId = '', deliveryAddress = '' } = {}) {
  return new Order({
    id,
    userId,
    userName,
    userEmail,
    userPhone,
    userLegalName,
    userNationalId,
    deliveryAddress,
    dueDate,
    paymentDate,
    orderItems: [{
      id: `${id}-item`,
      productId: 'p1',
      productName: 'Bread',
      collectionId: 'c1',
      collectionName: 'Bakery',
      quantity: 1,
      currentPrice: subtotal,
      subtotal,
      isComplimentary: false,
    }],
  });
}

describe('classifyVector (design doc example vectors)', () => {
  it('perfect streak since a veteran client existed -> estrella', () => {
    expect(classifyVector('11111111', false)).toBe('estrella');
  });

  it('perfect streak since birth, not a veteran -> futuraEstrella', () => {
    expect(classifyVector('...11111', false)).toBe('futuraEstrella');
  });

  it('5 quiet periods then a comeback -> reactivado', () => {
    expect(classifyVector('11000001', false)).toBe('reactivado');
  });

  it('gaps but never 3+ quiet before returning -> intermitente', () => {
    expect(classifyVector('10110101', false)).toBe('intermitente');
  });

  it('gaps, missed = 2 -> caido', () => {
    expect(classifyVector('.1101100', false)).toBe('caido');
  });

  it('comeback that fizzled, recency wins -> caido', () => {
    expect(classifyVector('10000010', false)).toBe('caido');
  });

  it('missed = 5 -> perdido', () => {
    expect(classifyVector('11100000', false)).toBe('perdido');
  });

  describe('E3: veteran, all-zero vector, ordered in the partial period', () => {
    it('reads quietBeforeLast as N when N >= threshold -> reactivado', () => {
      expect(classifyVector('00000000', true)).toBe('reactivado');
    });

    it('falls to intermitente when N is too small', () => {
      expect(classifyVector('00', true)).toBe('intermitente');
    });
  });
});

describe('buildPeriods', () => {
  it('marks only the last period as partial and reports the right completeCount', () => {
    const { periods, completeCount } = buildPeriods(new Date('2026-08-21T12:00:00Z'), 'weekly', 6);
    expect(periods).toHaveLength(6);
    expect(completeCount).toBe(5);
    expect(periods.slice(0, 5).every(p => !p.isPartial)).toBe(true);
    expect(periods[5].isPartial).toBe(true);
  });

  it('splits a quincena at day 15/16 and labels Q1/Q2', () => {
    const { periods } = buildPeriods(new Date('2026-02-16T12:00:00Z'), 'biweekly', 2);
    expect(periods[0].label).toBe('Q1 Feb');
    expect(periods[0].start.getDate()).toBe(1);
    expect(periods[0].end.getDate()).toBe(15);
    expect(periods[1].label).toBe('Q2 Feb');
    expect(periods[1].start.getDate()).toBe(16);
    expect(periods[1].end.getDate()).toBe(28); // 2026 is not a leap year
  });

  it('closes Q2 on the last calendar day of a 31-day month', () => {
    const { periods } = buildPeriods(new Date('2026-03-20T12:00:00Z'), 'biweekly', 1);
    expect(periods[0].label).toBe('Q2 Mar');
    expect(periods[0].end.getDate()).toBe(31);
  });
});

describe('ClientReport.generateReport', () => {
  const NOW = new Date('2026-08-21T12:00:00Z'); // a Friday, inside the partial week
  const THIS_MONDAY = mondayOf(NOW);
  const b2bClients = [{ id: 'estrella' }, { id: 'newInPartial' }, { id: 'veteranSilent' }, { id: 'reactivatedYesterday' }, { id: 'nullPayment' }];
  const options = { period: 'weekly', count: 6, segment: 'b2b', dateField: 'dueDate', endDate: NOW };

  it('classifies a steady veteran as estrella and counts it as active, not new', () => {
    // -42 predates rangeStart (veteran); -35..-7 cover the 5 complete periods.
    const orders = [-42, -35, -28, -21, -14, -7].map((offset, i) =>
      makeOrder(`s${i}`, 'estrella', 'Estrella Client', addDays(THIS_MONDAY, offset)),
    );
    const report = new ClientReport(orders, b2bClients, options).generateReport();
    expect(report.buckets.estrella.map(c => c.userId)).toContain('estrella');
    expect(report.kpis.activeClients).toBe(1);
    expect(report.kpis.newClients).toBe(0);

    const row = report.buckets.estrella.find(c => c.userId === 'estrella');
    expect(row.orderedInPartial).toBe(false);
  });

  it('E1: first-ever order in the partial period appears only in nuevosPorPeriodo, not in any bucket', () => {
    const orders = [makeOrder('n1', 'newInPartial', 'New Client', addDays(THIS_MONDAY, 1))];
    const report = new ClientReport(orders, b2bClients, options).generateReport();

    const allBucketed = Object.values(report.buckets).flat().map(c => c.userId);
    expect(allBucketed).not.toContain('newInPartial');

    const partialPeriodEntry = report.nuevosPorPeriodo[report.nuevosPorPeriodo.length - 1];
    expect(partialPeriodEntry.clients.map(c => c.userId)).toContain('newInPartial');
    expect(report.kpis.activeClients).toBe(1);
    expect(report.kpis.newClients).toBe(1);
    // Nobody classified, so there is no ratio to report — not 0%.
    expect(report.kpis.returningPct).toBeNull();
  });

  it('E1 clients do not drag returningPct down', () => {
    const steady = [-35, -28, -21, -14, -7].map((offset, i) =>
      makeOrder(`rp${i}`, 'estrella', 'Estrella Client', addDays(THIS_MONDAY, offset)),
    );
    const withNewcomer = [...steady, makeOrder('rpNew', 'newInPartial', 'New Client', addDays(THIS_MONDAY, 1))];

    const before = new ClientReport(steady, b2bClients, options).generateReport();
    const after = new ClientReport(withNewcomer, b2bClients, options).generateReport();

    expect(before.kpis.returningPct).toBe(100);
    expect(after.kpis.returningPct).toBe(100);
    expect(after.kpis.activeClients).toBe(2);
  });

  it('E2: veteran with orders only before the range is excluded entirely', () => {
    const orders = [makeOrder('v1', 'veteranSilent', 'Silent Veteran', addDays(THIS_MONDAY, -365))];
    const report = new ClientReport(orders, b2bClients, options).generateReport();

    const allBucketed = Object.values(report.buckets).flat().map(c => c.userId);
    expect(allBucketed).not.toContain('veteranSilent');
    expect(report.kpis.activeClients).toBe(0);
  });

  it('E3: veteran silent for the whole window but ordered in the partial period lands in reactivado', () => {
    const orders = [
      makeOrder('r1', 'reactivatedYesterday', 'Reactivated', addDays(THIS_MONDAY, -365)),
      makeOrder('r2', 'reactivatedYesterday', 'Reactivated', addDays(THIS_MONDAY, 1)),
    ];
    const report = new ClientReport(orders, b2bClients, options).generateReport();
    expect(report.buckets.reactivado.map(c => c.userId)).toContain('reactivatedYesterday');

    const row = report.buckets.reactivado.find(c => c.userId === 'reactivatedYesterday');
    expect(row.orderedInPartial).toBe(true);
  });

  it('E4: a null paymentDate is excluded when dateField is paymentDate', () => {
    const orders = [
      makeOrder('p1', 'nullPayment', 'Null Payment', THIS_MONDAY, { paymentDate: null }),
    ];
    const paymentOptions = { ...options, dateField: 'paymentDate' };
    const report = new ClientReport(orders, b2bClients, paymentOptions).generateReport();
    const allBucketed = Object.values(report.buckets).flat().map(c => c.userId);
    const allNuevos = report.nuevosPorPeriodo.flatMap(p => p.clients).map(c => c.userId);
    expect(allBucketed).not.toContain('nullPayment');
    expect(allNuevos).not.toContain('nullPayment');
  });

  it('E5: an order due later this week still counts — it belongs to the partial period', () => {
    // NOW is Friday; +6 is Sunday, past "now" but inside the current period.
    const orders = [makeOrder('ahead', 'newInPartial', 'Orders Ahead', addDays(THIS_MONDAY, 6))];
    const report = new ClientReport(orders, b2bClients, options).generateReport();

    const partialPeriodEntry = report.nuevosPorPeriodo[report.nuevosPorPeriodo.length - 1];
    expect(partialPeriodEntry.clients.map(c => c.userId)).toContain('newInPartial');
    expect(report.kpis.activeClients).toBe(1);
  });

  it('E5: a steady client ordering ahead keeps its current-period activity', () => {
    const orders = [
      ...[-35, -28, -21, -14, -7].map((offset, i) => makeOrder(`a${i}`, 'estrella', 'Estrella Client', addDays(THIS_MONDAY, offset))),
      makeOrder('ahead', 'estrella', 'Estrella Client', addDays(THIS_MONDAY, 6)),
    ];
    const report = new ClientReport(orders, b2bClients, options).generateReport();
    const row = Object.values(report.buckets).flat().find(c => c.userId === 'estrella');
    expect(row.orderedInPartial).toBe(true);
    expect(row.orderCount).toBe(6);
  });

  it('E5: an order dated beyond the window is ignored, so lastOrderDate stays inside it', () => {
    const orders = [
      ...[-35, -28, -21, -14, -7].map((offset, i) => makeOrder(`f${i}`, 'estrella', 'Estrella Client', addDays(THIS_MONDAY, offset))),
      makeOrder('future', 'estrella', 'Estrella Client', addDays(THIS_MONDAY, 30)),
    ];
    const report = new ClientReport(orders, b2bClients, options).generateReport();
    const row = Object.values(report.buckets).flat().find(c => c.userId === 'estrella');
    expect(row.lastOrderDate.getTime()).toBeLessThanOrEqual(NOW.getTime());
    expect(row.orderCount).toBe(5);
  });

  it('takes email/phone/name from the client\'s latest order', () => {
    const orders = [
      makeOrder('l1', 'estrella', 'Old Name', addDays(THIS_MONDAY, -35), { userEmail: 'old@x.com', userPhone: '111' }),
      makeOrder('l2', 'estrella', 'New Name', addDays(THIS_MONDAY, -7), { userEmail: 'new@x.com', userPhone: '222', userLegalName: 'ACME SAS', userNationalId: '900123' }),
    ];
    const report = new ClientReport(orders, b2bClients, options).generateReport();
    const row = Object.values(report.buckets).flat().find(c => c.userId === 'estrella');
    expect(row.name).toBe('New Name');
    expect(row.email).toBe('new@x.com');
    expect(row.phone).toBe('222');
    expect(row.legalName).toBe('ACME SAS');
    expect(row.nationalId).toBe('900123');
  });

  it('bucket rows carry per-period spend aligned to report.periods', () => {
    const orders = [
      makeOrder('t1', 'estrella', 'Client', addDays(THIS_MONDAY, -35), { subtotal: 100 }),
      makeOrder('t2', 'estrella', 'Client', addDays(THIS_MONDAY, -14), { subtotal: 200 }),
      makeOrder('t3', 'estrella', 'Client', addDays(THIS_MONDAY, -14), { subtotal: 50 }),
    ];
    const report = new ClientReport(orders, b2bClients, options).generateReport();
    const row = Object.values(report.buckets).flat().find(c => c.userId === 'estrella');
    expect(row.periodTotals).toHaveLength(report.periods.length);
    expect(row.periodTotals.reduce((a, b) => a + b, 0)).toBe(row.rangeTotal);
    expect(row.periodTotals.filter(t => t > 0).sort((a, b) => a - b)).toEqual([100, 250]);
  });

  it('takes address from the most recent order that has one', () => {
    const orders = [
      makeOrder('a1', 'estrella', 'Client', addDays(THIS_MONDAY, -35), { deliveryAddress: 'Calle 1' }),
      makeOrder('a2', 'estrella', 'Client', addDays(THIS_MONDAY, -14), { deliveryAddress: 'Calle 2' }),
      makeOrder('a3', 'estrella', 'Client', addDays(THIS_MONDAY, -7)), // pickup, no address
    ];
    const report = new ClientReport(orders, b2bClients, options).generateReport();
    const row = Object.values(report.buckets).flat().find(c => c.userId === 'estrella');
    expect(row.address).toBe('Calle 2');
  });

  it('satisfies bucket-sum and single-bucket-membership invariants across a mixed population', () => {
    const orders = [
      // estrella: veteran, orders every complete period
      ...[-42, -35, -28, -21, -14, -7].map((offset, i) => makeOrder(`e${i}`, 'c1', 'C1', addDays(THIS_MONDAY, offset))),
      // perdido: veteran, one order 4 periods ago then silence (missed = 4)
      ...[-42, -35].map((offset, i) => makeOrder(`p${i}`, 'c2', 'C2', addDays(THIS_MONDAY, offset))),
      // new, born mid-window (period 3), perfect since -> futuraEstrella
      ...[-14, -7].map((offset, i) => makeOrder(`f${i}`, 'c3', 'C3', addDays(THIS_MONDAY, offset))),
      // E1: brand new this (partial) period
      makeOrder('e1new', 'c4', 'C4', addDays(THIS_MONDAY, 1)),
      // E2: only ever ordered long before the window
      makeOrder('old', 'c5', 'C5', addDays(THIS_MONDAY, -400)),
    ];
    const report = new ClientReport(orders, b2bClients.concat([{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }, { id: 'c4' }, { id: 'c5' }]), options).generateReport();

    const bucketSizes = Object.values(report.buckets).reduce((sum, arr) => sum + arr.length, 0);
    const e1Count = 1; // c4
    expect(bucketSizes).toBe(report.kpis.activeClients - e1Count);

    const seen = new Set();
    Object.values(report.buckets).flat().forEach(row => {
      expect(seen.has(row.userId)).toBe(false);
      seen.add(row.userId);
    });

    expect(report.buckets.estrella.map(c => c.userId)).toContain('c1');
    expect(report.buckets.perdido.map(c => c.userId)).toContain('c2');
    expect(report.buckets.futuraEstrella.map(c => c.userId)).toContain('c3');
  });

  describe('validateOptions', () => {
    const base = { period: 'weekly', count: 6, segment: 'b2b', dateField: 'dueDate' };

    it('accepts biweekly', () => {
      expect(() => new ClientReport([], [], { ...base, period: 'biweekly' })).not.toThrow();
    });

    it('rejects an invalid period', () => {
      expect(() => new ClientReport([], [], { ...base, period: 'daily' })).toThrow(/period/);
    });

    it('rejects a count outside 1-12', () => {
      expect(() => new ClientReport([], [], { ...base, count: 13 })).toThrow(/count/);
    });

    it('rejects an invalid segment', () => {
      expect(() => new ClientReport([], [], { ...base, segment: 'b2z' })).toThrow(/segment/);
    });

    it('rejects an invalid dateField', () => {
      expect(() => new ClientReport([], [], { ...base, dateField: 'randomDate' })).toThrow(/dateField/);
    });
  });

  describe('b2c segment', () => {
    const shopperOrders = [
      makeOrder('sh1', 'shopBoss', 'Shop Boss', addDays(THIS_MONDAY, -7)),
      makeOrder('sh2', 'shopBoss', 'Shop Boss', THIS_MONDAY),
    ];

    it('includes a client absent from the b2b list when segment is b2c', () => {
      const report = new ClientReport(shopperOrders, b2bClients, { ...options, segment: 'b2c' }).generateReport();
      expect(Object.values(report.buckets).flat().some(c => c.userId === 'shopBoss')).toBe(true);
    });

    it('excludes that same client when segment is b2b', () => {
      const report = new ClientReport(shopperOrders, b2bClients, { ...options, segment: 'b2b' }).generateReport();
      expect(Object.values(report.buckets).flat().some(c => c.userId === 'shopBoss')).toBe(false);
    });
  });
});
