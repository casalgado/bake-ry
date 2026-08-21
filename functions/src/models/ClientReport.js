// models/ClientReport.js
//
// Answers: how many new clients are we getting, and which clients keep
// ordering vs. quietly stopped. Reads full order history (no date-range
// filter) because "new" and the median gap both require the client's whole
// past, not just the visible window.

const { Order } = require('./Order');
const { getWeekRange, getMonthKey, buildPeriods } = require('../utils/periods');

const DAY_MS = 1000 * 60 * 60 * 24;
const ACTIVE_FLOOR_DAYS = 20;
const LAPSED_CEILING_DAYS = 540;
const RETURN_WINDOW_DAYS = 90;

function median(numbers) {
  if (numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function daysBetween(from, to) {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

function periodKeyForDate(date, period) {
  return period === 'weekly' ? getWeekRange(date) : getMonthKey(date);
}

function clampGap(days) {
  return Math.min(Math.max(days, ACTIVE_FLOOR_DAYS), LAPSED_CEILING_DAYS);
}

class ClientReport {
  constructor(orders, b2b_clients, options = {}) {
    this.options = this.validateOptions(options);

    const b2bClientIds = new Set((b2b_clients || []).map(client => client.id));
    const allOrders = orders
      .map(order => order instanceof Order ? order : new Order(order))
      .filter(order => !order.isComplimentary)
      .filter(order => b2bClientIds.has(order.userId) === (this.options.segment === 'b2b'));

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

    this.periods = buildPeriods(this.options.endDate, this.options.period, this.options.count);
    this.periodKeys = new Set(this.periods.map(p => p.key));
  }

  validateOptions(options) {
    const validated = {
      period: options.period,
      count: options.count,
      segment: options.segment,
      dateField: options.dateField,
      endDate: options.endDate ? new Date(options.endDate) : new Date(),
    };

    if (!['weekly', 'monthly'].includes(validated.period)) {
      throw new Error('Invalid period: must be "weekly" or "monthly"');
    }
    if (!Number.isInteger(validated.count) || validated.count < 1 || validated.count > 12) {
      throw new Error('Invalid count: must be an integer between 1 and 12');
    }
    if (!['b2b', 'b2c'].includes(validated.segment)) {
      throw new Error('Invalid segment: must be "b2b" or "b2c"');
    }
    if (!['dueDate', 'paymentDate'].includes(validated.dateField)) {
      throw new Error('Invalid dateField: must be "dueDate" or "paymentDate"');
    }

    return validated;
  }

  generateReport() {
    const clientStats = this.computeClientStats();
    const baselineGap = this.computeBaselineGap(clientStats);
    clientStats.forEach(stats => this.applyLifetimeStatus(stats, baselineGap));

    const clientRows = new Map(clientStats.map(stats => [stats.userId, this.buildClientRow(stats)]));
    const clients = clientStats
      .filter(stats =>
        clientRows.get(stats.userId).cells.some(cell => cell.orderCount > 0) ||
        ['at_risk', 'lapsed', 'one_time'].includes(stats.status),
      )
      .map(stats => clientRows.get(stats.userId));

    return {
      meta: {
        period: this.options.period,
        count: this.options.count,
        segment: this.options.segment,
        dateField: this.options.dateField,
        generatedAt: new Date(),
      },
      periods: this.periods,
      clients,
      summary: this.generateSummary(clients, clientStats),
    };
  }

  computeClientStats() {
    const stats = [];

    this.ordersByClient.forEach((clientOrders, userId) => {
      const dates = clientOrders.map(order => order[this.options.dateField]);
      const gaps = [];
      for (let i = 1; i < dates.length; i++) {
        gaps.push(daysBetween(dates[i - 1], dates[i]));
      }

      stats.push({
        userId,
        name: clientOrders[clientOrders.length - 1].userName,
        orders: clientOrders,
        firstOrderDate: dates[0],
        lastOrderDate: dates[dates.length - 1],
        orderCount: clientOrders.length,
        ltv: clientOrders.reduce((sum, order) => sum + order.total, 0),
        medianGapDays: clientOrders.length >= 3 ? median(gaps) : null,
      });
    });

    return stats;
  }

  computeBaselineGap(clientStats) {
    const knownGaps = clientStats
      .filter(stats => stats.medianGapDays !== null)
      .map(stats => stats.medianGapDays);
    return median(knownGaps);
  }

  applyLifetimeStatus(stats, segmentBaselineGap) {
    stats.daysSinceLast = daysBetween(stats.lastOrderDate, this.options.endDate);
    stats.baselineGap = stats.orderCount >= 3 ? stats.medianGapDays : segmentBaselineGap;
    stats.gapRatio = stats.baselineGap ? stats.daysSinceLast / stats.baselineGap : null;

    if (stats.daysSinceLast < ACTIVE_FLOOR_DAYS) {
      stats.status = 'active';
    } else if (stats.daysSinceLast > LAPSED_CEILING_DAYS) {
      stats.status = 'lapsed';
    } else if (stats.orderCount === 1 && stats.baselineGap !== null && stats.daysSinceLast > stats.baselineGap) {
      stats.status = 'one_time';
    } else if (stats.gapRatio !== null && stats.gapRatio > 3) {
      stats.status = 'lapsed';
    } else if (stats.gapRatio !== null && stats.gapRatio > 1.5) {
      stats.status = 'at_risk';
    } else if (stats.gapRatio !== null && stats.gapRatio > 1) {
      stats.status = 'overdue';
    } else {
      stats.status = 'active';
    }
  }

  buildClientRow(stats) {
    const totals = new Map();
    stats.orders.forEach(order => {
      const key = periodKeyForDate(order[this.options.dateField], this.options.period);
      if (!this.periodKeys.has(key)) return;
      if (!totals.has(key)) totals.set(key, { total: 0, orderCount: 0 });
      const bucket = totals.get(key);
      bucket.total += order.total;
      bucket.orderCount += 1;
    });

    const firstOrderPeriodKey = periodKeyForDate(stats.firstOrderDate, this.options.period);

    let previousTotal = 0;
    let firstSeenIndex = -1;
    const cells = this.periods.map((period, index) => {
      const bucket = totals.get(period.key) || { total: 0, orderCount: 0 };
      let status;
      if (bucket.total === 0) {
        status = 'absent';
      } else if (period.key === firstOrderPeriodKey) {
        status = 'new';
      } else if (index > 0 && previousTotal > 0) {
        status = 'persistent';
      } else {
        status = 'old';
      }
      if (status !== 'absent' && firstSeenIndex === -1) firstSeenIndex = index;
      previousTotal = bucket.total;
      return { total: bucket.total, orderCount: bucket.orderCount, status };
    });

    const windowTotal = cells.reduce((sum, cell) => sum + cell.total, 0);
    const persistentCount = cells.filter(cell => cell.status === 'persistent').length;

    return {
      userId: stats.userId,
      name: stats.name,
      cells,
      windowTotal,
      persistentCount,
      firstSeenIndex,
      orderCount: stats.orderCount,
      ltv: stats.ltv,
      firstOrderDate: stats.firstOrderDate,
      lastOrderDate: stats.lastOrderDate,
      medianGapDays: stats.medianGapDays,
      daysSinceLast: stats.daysSinceLast,
      gapRatio: stats.gapRatio,
      status: stats.status,
    };
  }

  generateSummary(clients, clientStats) {
    const windowedClients = clients.filter(client => client.cells.some(cell => cell.orderCount > 0));

    const perPeriod = this.periods.map((period, index) => {
      const counts = { nuevos: 0, persistentes: 0, viejos: 0, ausentes: 0 };
      windowedClients.forEach(client => {
        const status = client.cells[index].status;
        if (status === 'new') counts.nuevos += 1;
        else if (status === 'persistent') counts.persistentes += 1;
        else if (status === 'old') counts.viejos += 1;
        else counts.ausentes += 1;
      });
      return { ...counts, activos: windowedClients.length - counts.ausentes };
    });

    return {
      perPeriod,
      tiles: {
        newClients: this.computeNewClientsTile(clientStats),
        returnRate: this.computeReturnRateTile(clientStats),
        atRisk: { count: clientStats.filter(c => c.status === 'at_risk').length },
        lapsed: { count: clientStats.filter(c => c.status === 'lapsed').length },
        quickRatio: this.computeQuickRatioTile(clientStats),
      },
    };
  }

  computeNewClientsTile(clientStats) {
    const lastPeriod = this.periods[this.periods.length - 1];
    const prevPeriod = this.periods.length >= 2 ? this.periods[this.periods.length - 2] : null;
    const lastYearEndDate = this.shiftOneYearBack(this.options.endDate);
    const lastYearPeriod = buildPeriods(lastYearEndDate, this.options.period, 1)[0];

    const countInPeriod = periodKey => clientStats.filter(client =>
      periodKeyForDate(client.firstOrderDate, this.options.period) === periodKey,
    ).length;

    return {
      value: countInPeriod(lastPeriod.key),
      prevPeriod: prevPeriod ? countInPeriod(prevPeriod.key) : null,
      lastYear: countInPeriod(lastYearPeriod.key),
    };
  }

  shiftOneYearBack(date) {
    const shifted = new Date(date);
    if (this.options.period === 'weekly') {
      shifted.setDate(shifted.getDate() - 52 * 7);
    } else {
      shifted.setFullYear(shifted.getFullYear() - 1);
    }
    return shifted;
  }

  computeReturnRateTile(clientStats) {
    let judged = 0;
    let returned = 0;
    let tooEarly = 0;

    clientStats.forEach(client => {
      const clientAgeDays = daysBetween(client.firstOrderDate, this.options.endDate);
      if (clientAgeDays < RETURN_WINDOW_DAYS) {
        tooEarly += 1;
        return;
      }
      judged += 1;
      if (client.orderCount >= 2) {
        const secondOrderDate = client.orders[1][this.options.dateField];
        if (daysBetween(client.firstOrderDate, secondOrderDate) <= RETURN_WINDOW_DAYS) returned += 1;
      }
    });

    return {
      judged,
      value: judged > 0 ? Math.round((returned / judged) * 100) : null,
      tooEarly,
    };
  }

  computeQuickRatioTile(clientStats) {
    const lastPeriod = this.periods[this.periods.length - 1];

    let gained = 0;
    let lost = 0;

    clientStats.forEach(client => {
      const firstOrderInLastPeriod = periodKeyForDate(client.firstOrderDate, this.options.period) === lastPeriod.key;

      let returnedFromLapseInLastPeriod = false;
      if (!firstOrderInLastPeriod) {
        const lastOrderInLastPeriod = periodKeyForDate(client.lastOrderDate, this.options.period) === lastPeriod.key;
        if (lastOrderInLastPeriod && client.orders.length >= 2 && client.medianGapDays !== null) {
          // Gap before the most recent order, measured against the client's own baseline.
          const gapBeforeLast = daysBetween(client.orders[client.orders.length - 2][this.options.dateField], client.lastOrderDate);
          returnedFromLapseInLastPeriod = gapBeforeLast > 3 * client.medianGapDays;
        }
      }

      if (firstOrderInLastPeriod || returnedFromLapseInLastPeriod) gained += 1;

      if (client.baselineGap) {
        const lapseDate = new Date(client.lastOrderDate.getTime() + clampGap(3 * client.baselineGap) * DAY_MS);
        if (periodKeyForDate(lapseDate, this.options.period) === lastPeriod.key) lost += 1;
      }
    });

    return { gained, lost, value: lost > 0 ? gained / lost : (gained > 0 ? Infinity : 0) };
  }
}

module.exports = ClientReport;
