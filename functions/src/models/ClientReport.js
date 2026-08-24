// models/ClientReport.js
//
// Answers: which clients are new, and which recurring clients are healthy
// vs. quietly churning. Reads full order history (no date-range filter)
// because "new" requires the client's whole past, not just the visible
// window.
//
// Each client gets a `.`/`0`/`1` vector over the report's complete periods
// (the current, still-open period is excluded from the vector — ordering in
// it can only promote a client, never demote one) and is sorted into one of
// six buckets from that vector. See zplanning/CLIENT_PERSISTENCY_REDESIGN.md
// (bake-ry-front) for the full decision tree and worked examples.

const { Order } = require('./Order');
const { BadRequestError } = require('../utils/errors');
const { getWeekRange, getMonthKey, getQuincenaKey, buildPeriods } = require('../utils/periods');

const REACTIVADO_QUIET_THRESHOLD = 3; // consecutive quiet periods before a comeback reads as "reactivado" rather than "intermitente" (same threshold defines "perdido" — a reactivado is a perdido who came back)
const CAIDO_MAX_MISSED = 2; // periods missed since the last order before a non-recent client is "perdido" instead of "caido"

function periodKeyForDate(date, period) {
  if (period === 'weekly') return getWeekRange(date);
  if (period === 'biweekly') return getQuincenaKey(date);
  return getMonthKey(date);
}

// Pure function over a vector STRING (e.g. "..11011"), decoupled from dates
// so it can be unit-tested directly against the design doc's example
// vectors. Precondition: the vector must contain at least one non-'.'
// character (guaranteed by ClientReport, which filters out clients with no
// activity in range before calling this), and '.' only ever appears as a
// prefix (periods before the client's first order).
function classifyVector(vectorString, orderedInPartial) {
  const N = vectorString.length;
  const start = vectorString.lastIndexOf('.') + 1;
  const last = vectorString.lastIndexOf('1');

  const missed = last === -1 ? undefined : N - 1 - last;
  const hasGaps = vectorString.includes('0', start);
  const recent = orderedInPartial || missed === 0;

  // Consecutive quiet periods immediately before the client's latest order:
  // counted back from the end when that order is in the partial period,
  // otherwise from the last '1'.
  let quietBeforeLast = 0;
  for (let i = orderedInPartial ? N - 1 : last - 1; i >= 0 && vectorString[i] === '0'; i--) quietBeforeLast++;

  if (!hasGaps) return start === 0 ? 'estrella' : 'futuraEstrella';
  if (recent) return quietBeforeLast >= REACTIVADO_QUIET_THRESHOLD ? 'reactivado' : 'intermitente';
  if (missed <= CAIDO_MAX_MISSED) return 'caido';
  return 'perdido';
}

class ClientReport {
  constructor(orders, b2b_clients, options = {}) {
    this.options = this.validateOptions(options);

    const { periods, completeCount } = buildPeriods(this.options.endDate, this.options.period, this.options.count);
    this.periods = periods;
    this.completeCount = completeCount;

    // E5 cutoff: end of the LAST period, not `endDate`. Orders are placed days
    // ahead, so a dueDate later this week still belongs to the current period
    // and must count. Only orders past the window (next week, next month) are
    // dropped — they have no bucket to land in and would make lastOrderDate
    // point at an order that hasn't happened. `end` is that day at 00:00, so
    // the cutoff is the following midnight to cover the whole final day.
    const lastPeriodEnd = periods[periods.length - 1].end;
    const cutoff = new Date(lastPeriodEnd);
    cutoff.setDate(cutoff.getDate() + 1);

    const b2bClientIds = new Set((b2b_clients || []).map(client => client.id));
    const allOrders = orders
      .map(order => order instanceof Order ? order : new Order(order))
      .filter(order => !order.isComplimentary)
      .filter(order => b2bClientIds.has(order.userId) === (this.options.segment === 'b2b'))
      // E4: a null paymentDate can't be sorted/bucketed when dateField is paymentDate.
      .filter(order => this.options.dateField !== 'paymentDate' || order.paymentDate !== null)
      .filter(order => order[this.options.dateField] < cutoff);

    this.ordersByClient = new Map();
    allOrders.forEach(order => {
      if (!this.ordersByClient.has(order.userId)) {
        this.ordersByClient.set(order.userId, []);
      }
      this.ordersByClient.get(order.userId).push(order);
    });
    this.ordersByClient.forEach(clientOrders => {
      clientOrders.sort((a, b) => a[this.options.dateField] - b[this.options.dateField]);
    });
  }

  validateOptions(options) {
    const validated = {
      period: options.period,
      count: options.count,
      segment: options.segment,
      dateField: options.dateField,
      endDate: options.endDate ? new Date(options.endDate) : new Date(),
    };

    // These come straight off the query string, so a bad value is a 400, not a 500.
    if (!['weekly', 'biweekly', 'monthly'].includes(validated.period)) {
      throw new BadRequestError('Invalid period: must be "weekly", "biweekly" or "monthly"');
    }
    if (!Number.isInteger(validated.count) || validated.count < 1 || validated.count > 12) {
      throw new BadRequestError('Invalid count: must be an integer between 1 and 12');
    }
    if (!['b2b', 'b2c'].includes(validated.segment)) {
      throw new BadRequestError('Invalid segment: must be "b2b" or "b2c"');
    }
    if (!['dueDate', 'paymentDate'].includes(validated.dateField)) {
      throw new BadRequestError('Invalid dateField: must be "dueDate" or "paymentDate"');
    }

    return validated;
  }

  generateReport() {
    const rangeStart = this.periods[0].start;
    const completePeriods = this.periods.slice(0, this.completeCount);
    const partialPeriod = this.periods[this.periods.length - 1];
    // End of the last period, not `endDate`: the E5 cutoff admits orders through
    // the end of the current period, so `endDate` would understate the window.
    const rangeEnd = partialPeriod.end;
    const periodIndexByKey = new Map(this.periods.map((p, i) => [p.key, i]));

    const buckets = { estrella: [], futuraEstrella: [], reactivado: [], intermitente: [], caido: [], perdido: [] };
    const recurringBuckets = new Set(['estrella', 'futuraEstrella', 'reactivado', 'intermitente']);
    const nuevosPorPeriodo = this.periods.map(p => ({ periodKey: p.key, clients: [] }));

    let activeClients = 0;
    let newClients = 0;
    let newClientsInCompletePeriods = 0;
    let recurringCount = 0;

    this.ordersByClient.forEach((clientOrders, userId) => {
      const firstOrder = clientOrders[0];
      const lastOrder = clientOrders[clientOrders.length - 1];
      const firstOrderDate = firstOrder[this.options.dateField];
      const veteran = firstOrderDate < rangeStart;

      const keyOf = order => periodKeyForDate(order[this.options.dateField], this.options.period);
      const clientPeriodKeys = new Set(clientOrders.map(keyOf));
      const ordersInRange = clientOrders.filter(o => periodIndexByKey.has(keyOf(o)));

      // "New" = first-ever order falls within the reported window (any period, partial included).
      if (!veteran) {
        const firstOrderPeriodIndex = periodIndexByKey.get(keyOf(firstOrder));

        if (firstOrderPeriodIndex !== undefined) {
          newClients += 1;
          if (firstOrderPeriodIndex < this.completeCount) newClientsInCompletePeriods += 1;
          const periodObj = this.periods[firstOrderPeriodIndex];
          const ordersInPeriod = clientOrders.filter(o => keyOf(o) === periodObj.key);
          nuevosPorPeriodo[firstOrderPeriodIndex].clients.push({
            userId,
            name: lastOrder.userName,
            total: ordersInPeriod.reduce((sum, o) => sum + o.total, 0),
            orderCount: ordersInPeriod.length,
            lastOrderDate: lastOrder[this.options.dateField],
          });

          activeClients += 1;

          // E1: first-ever order lands in the still-open period — lives only in nuevosPorPeriodo.
          if (firstOrderPeriodIndex === this.periods.length - 1) return;
        }
      }

      const orderedInPartial = clientPeriodKeys.has(partialPeriod.key);
      const bornIndex = completePeriods.findIndex(p => clientPeriodKeys.has(p.key));

      const vector = completePeriods.map((period, i) => {
        if (!veteran && i < bornIndex) return '.';
        return clientPeriodKeys.has(period.key) ? '1' : '0';
      }).join('');

      // E2: veteran with no activity anywhere in the window (not even the partial period) — skip entirely.
      if (!vector.includes('1') && !orderedInPartial) return;

      // Only counted here for veterans; "new" clients already counted above.
      if (veteran) activeClients += 1;

      const bucket = classifyVector(vector, orderedInPartial);
      buckets[bucket].push({
        userId,
        name: lastOrder.userName,
        email: lastOrder.userEmail,
        phone: lastOrder.userPhone,
        rangeTotal: ordersInRange.reduce((sum, o) => sum + o.total, 0),
        orderCount: ordersInRange.length,
        lastOrderDate: lastOrder[this.options.dateField],
        vector,
        orderedInPartial,
      });
      if (recurringBuckets.has(bucket)) recurringCount += 1;
    });

    const classifiedClients = Object.values(buckets).reduce((sum, rows) => sum + rows.length, 0);

    return {
      meta: {
        period: this.options.period,
        count: this.options.count,
        segment: this.options.segment,
        dateField: this.options.dateField,
        generatedAt: new Date(),
        rangeStart,
        rangeEnd,
      },
      periods: this.periods,
      kpis: {
        activeClients,
        newClients,
        // Complete periods only — the still-open period would drag the average down.
        avgNewPerPeriod: this.completeCount > 0
          ? Math.round(10 * newClientsInCompletePeriods / this.completeCount) / 10
          : null,
        // Share of CLASSIFIED clients that are recurring. E1 clients (first-ever order
        // in the still-open period) are active but have no vector to judge — one order
        // is neither loyal nor churning — so they're out of both sides of the ratio.
        // Denominator is every bucketed client; activeClients is the wider count.
        returningPct: classifiedClients > 0 ? Math.round(100 * recurringCount / classifiedClients) : null,
      },
      nuevosPorPeriodo,
      buckets,
    };
  }
}

ClientReport.classifyVector = classifyVector;
module.exports = ClientReport;
