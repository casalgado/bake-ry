// __tests__/models/ClientReport.test.js

const ClientReport = require('../../models/ClientReport');
const { Order } = require('../../models/Order');

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

function makeOrder(id, userId, userName, dueDate, subtotal = 10000) {
  return new Order({
    id,
    userId,
    userName,
    dueDate,
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

describe('ClientReport', () => {
  const NOW = new Date('2026-08-21T12:00:00Z');
  const THIS_MONDAY = mondayOf(NOW);

  const b2bClients = [
    { id: 'steady' },
    { id: 'atRisk' },
    { id: 'lapsedCeiling' },
    { id: 'activeFloor' },
    { id: 'oneTime' },
    { id: 'newInWindow' },
    { id: 'oldReturner' },
  ];

  const orders = [
    // steady: 4 orders, 7-day cadence, recent -> active, persistent after the first
    makeOrder('o1', 'steady', 'Steady Client', addDays(THIS_MONDAY, -21)),
    makeOrder('o2', 'steady', 'Steady Client', addDays(THIS_MONDAY, -14)),
    makeOrder('o3', 'steady', 'Steady Client', addDays(THIS_MONDAY, -7)),
    makeOrder('o4', 'steady', 'Steady Client', THIS_MONDAY),

    // atRisk: 3 orders on a 10-day median, then 25 days silent -> gapRatio 2.5 -> at_risk
    makeOrder('o5', 'atRisk', 'At Risk Client', addDays(NOW, -45)),
    makeOrder('o6', 'atRisk', 'At Risk Client', addDays(NOW, -35)),
    makeOrder('o7', 'atRisk', 'At Risk Client', addDays(NOW, -25)),

    // lapsedCeiling: silent 600 days -> lapsed via the ceiling, zero orders in the window
    makeOrder('o8', 'lapsedCeiling', 'Lapsed Client', addDays(NOW, -610)),
    makeOrder('o9', 'lapsedCeiling', 'Lapsed Client', addDays(NOW, -600)),

    // activeFloor: 2 orders 3 days apart, silent 8 days -> active via the floor
    makeOrder('o10', 'activeFloor', 'Floor Client', addDays(NOW, -11)),
    makeOrder('o11', 'activeFloor', 'Floor Client', addDays(NOW, -8)),

    // oneTime: 1 order ever, 100 days ago
    makeOrder('o12', 'oneTime', 'One Time Client', addDays(NOW, -100)),

    // newInWindow: first order inside the window (2 weeks back), reorder this week
    makeOrder('o13', 'newInWindow', 'New Client', addDays(THIS_MONDAY, -14)),
    makeOrder('o14', 'newInWindow', 'New Client', THIS_MONDAY),

    // oldReturner: first order 3 years ago, reorders inside the window -> not "new"
    makeOrder('o15', 'oldReturner', 'Old Returner', addDays(NOW, -3 * 365)),
    makeOrder('o16', 'oldReturner', 'Old Returner', THIS_MONDAY),
  ];

  const options = { period: 'weekly', count: 6, segment: 'b2b', dateField: 'dueDate', endDate: NOW };

  const report = new ClientReport(orders, b2bClients, options).generateReport();
  const clientsById = Object.fromEntries(report.clients.map(c => [c.userId, c]));

  it('marks a steady, recent client active with persistent cells after the first', () => {
    const client = clientsById.steady;
    expect(client.status).toBe('active');
    const nonAbsent = client.cells.filter(c => c.status !== 'absent');
    expect(nonAbsent[0].status).toBe('new');
    expect(nonAbsent.slice(1).every(c => c.status === 'persistent')).toBe(true);
  });

  it('flags a moderate gap past its median as at_risk', () => {
    expect(clientsById.atRisk.status).toBe('at_risk');
  });

  it('flags 600 days of silence as lapsed via the ceiling, with an all-absent row', () => {
    const client = clientsById.lapsedCeiling;
    expect(client.status).toBe('lapsed');
    expect(client.cells.every(c => c.status === 'absent')).toBe(true);
    expect(client.firstSeenIndex).toBe(-1);
  });

  it('keeps a short-gap client active via the floor, not overdue', () => {
    expect(clientsById.activeFloor.status).toBe('active');
  });

  it('marks a single lifetime order as one_time with a null median gap', () => {
    const client = clientsById.oneTime;
    expect(client.status).toBe('one_time');
    expect(client.medianGapDays).toBeNull();
  });

  it('marks exactly one cell "new" for a client whose first order is in the window', () => {
    const client = clientsById.newInWindow;
    const newCells = client.cells.filter(c => c.status === 'new');
    expect(newCells).toHaveLength(1);
  });

  it('does not mark a reorder as "new" when the first order was years ago', () => {
    const client = clientsById.oldReturner;
    const newCells = client.cells.filter(c => c.status === 'new');
    expect(newCells).toHaveLength(0);
  });

  it('includes zero-window lapsed/at_risk/one_time clients in clients[]', () => {
    expect(clientsById.lapsedCeiling).toBeDefined();
  });

  it('satisfies nuevos + persistentes + viejos + ausentes === windowed clients for every period', () => {
    const windowedCount = report.clients.filter(c => c.cells.some(cell => cell.orderCount > 0)).length;
    report.summary.perPeriod.forEach(period => {
      expect(period.nuevos + period.persistentes + period.viejos + period.ausentes).toBe(windowedCount);
    });
  });

  it('flags a gap ratio between 1 and 1.5 as overdue, not at_risk', () => {
    // median gap 20 days, silent 25 days -> ratio 1.25
    const overdueClients = [{ id: 'overdue' }];
    const overdueOrders = [
      makeOrder('d1', 'overdue', 'Overdue Client', addDays(NOW, -65)),
      makeOrder('d2', 'overdue', 'Overdue Client', addDays(NOW, -45)),
      makeOrder('d3', 'overdue', 'Overdue Client', addDays(NOW, -25)),
    ];
    const overdueReport = new ClientReport(overdueOrders, overdueClients, options).generateReport();
    expect(overdueReport.clients.find(c => c.userId === 'overdue').status).toBe('overdue');
  });

  describe('b2c segment', () => {
    const shopperOrders = [
      makeOrder('e1', 'shopBoss', 'Shop Boss', addDays(THIS_MONDAY, -7)),
      makeOrder('e2', 'shopBoss', 'Shop Boss', THIS_MONDAY),
    ];

    it('includes a client absent from the b2b list when segment is b2c', () => {
      const b2cReport = new ClientReport(shopperOrders, b2bClients, { ...options, segment: 'b2c' }).generateReport();
      expect(b2cReport.clients.some(c => c.userId === 'shopBoss')).toBe(true);
    });

    it('excludes that same client when segment is b2b', () => {
      const b2bReport = new ClientReport(shopperOrders, b2bClients, { ...options, segment: 'b2b' }).generateReport();
      expect(b2bReport.clients.some(c => c.userId === 'shopBoss')).toBe(false);
    });
  });

  describe('validateOptions', () => {
    const base = { period: 'weekly', count: 6, segment: 'b2b', dateField: 'dueDate' };

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

  describe('summary tiles', () => {
    const tileClients = [
      { id: 'tearly' }, { id: 'tjudgedReturn' }, { id: 'tjudgedNoReturn' },
      { id: 'tnewThisPeriod' }, { id: 'tnewLastPeriod' }, { id: 'tnewLastYear' },
      { id: 'tlapseReturn' }, { id: 'tprojectedLost' },
    ];

    const tileOrders = [
      // too early for the return-rate window (first order < 90 days ago), placed
      // in the oldest reporting period so it doesn't collide with the new-clients tile
      makeOrder('t1', 'tearly', 'Too Early', addDays(THIS_MONDAY, -35)),

      // judged, and returns inside the 90-day window
      makeOrder('t2', 'tjudgedReturn', 'Judged Return', addDays(NOW, -100)),
      makeOrder('t3', 'tjudgedReturn', 'Judged Return', addDays(NOW, -70)),

      // judged, single order, no return
      makeOrder('t4', 'tjudgedNoReturn', 'Judged No Return', addDays(NOW, -200)),

      // first (only) order lands in the current period -> "new" this period
      makeOrder('t5', 'tnewThisPeriod', 'New This Period', THIS_MONDAY),

      // first (only) order lands in the period right before the current one
      makeOrder('t6', 'tnewLastPeriod', 'New Last Period', addDays(THIS_MONDAY, -7)),

      // first (only) order lands exactly one reporting-year back (52 weeks)
      makeOrder('t7', 'tnewLastYear', 'New Last Year', addDays(THIS_MONDAY, -364)),

      // steady 10-day cadence, then returns this period after a 40-day gap -> gained via lapse-return
      makeOrder('t8', 'tlapseReturn', 'Lapse Return', addDays(THIS_MONDAY, -60)),
      makeOrder('t9', 'tlapseReturn', 'Lapse Return', addDays(THIS_MONDAY, -50)),
      makeOrder('t10', 'tlapseReturn', 'Lapse Return', addDays(THIS_MONDAY, -40)),
      makeOrder('t11', 'tlapseReturn', 'Lapse Return', THIS_MONDAY),

      // steady 10-day cadence, went quiet 30 days ago -> projected to lapse this period
      makeOrder('t12', 'tprojectedLost', 'Projected Lost', addDays(THIS_MONDAY, -50)),
      makeOrder('t13', 'tprojectedLost', 'Projected Lost', addDays(THIS_MONDAY, -40)),
      makeOrder('t14', 'tprojectedLost', 'Projected Lost', addDays(THIS_MONDAY, -30)),
    ];

    const tiles = new ClientReport(tileOrders, tileClients, options).generateReport().summary.tiles;

    it('counts new clients for the current period, the prior period, and the same period last year', () => {
      expect(tiles.newClients.value).toBe(1);
      expect(tiles.newClients.prevPeriod).toBe(1);
      expect(tiles.newClients.lastYear).toBe(1);
    });

    it('excludes clients under the return window and rates returns over the judged ones', () => {
      expect(tiles.returnRate.tooEarly).toBe(5);
      expect(tiles.returnRate.judged).toBe(3);
      expect(tiles.returnRate.value).toBe(33);
    });

    it('counts a lapse-return and a same-period new order as gained, a projected lapse as lost', () => {
      expect(tiles.quickRatio.gained).toBe(2);
      expect(tiles.quickRatio.lost).toBe(1);
      expect(tiles.quickRatio.value).toBe(2);
    });
  });
});
