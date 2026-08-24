// utils/periods.js
//
// Week/month/quincena bucketing helpers, moved out of SalesReport so
// ClientReport can share the exact same key generation (bucketing must
// match exactly).
//
// ponytail: date-fns is not installed on the backend (frontend-only dep per
// package.json), so labels are hand-rolled Spanish month abbreviations
// instead of date-fns/locale/es.

const SPANISH_MONTHS_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function getWeekRange(date) {
  const current = new Date(date);
  current.setHours(0, 0, 0, 0);

  const day = current.getDay() || 7;

  const monday = new Date(current);
  monday.setDate(current.getDate() - (day - 1));

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const mondayStr = monday.toISOString().split('T')[0];
  const sundayStr = sunday.toISOString().split('T')[0];

  return `${mondayStr}/${sundayStr}`;
}

function getMonthKey(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

// Calendar quincena: day 1-15 is Q1, day 16-end-of-month is Q2.
function getQuincenaKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const isFirstHalf = d.getDate() <= 15;
  const start = isFirstHalf
    ? new Date(d.getFullYear(), d.getMonth(), 1)
    : new Date(d.getFullYear(), d.getMonth(), 16);
  const end = isFirstHalf
    ? new Date(d.getFullYear(), d.getMonth(), 15)
    : new Date(d.getFullYear(), d.getMonth() + 1, 0);

  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];
  return `${startStr}/${endStr}`;
}

// Returns { periods, completeCount }, OLDEST FIRST.
// periods: [{ key, label, start, end, isPartial }]
// The period containing `endDate` (always the last one) is marked partial —
// it is by definition the period we're currently in, so it can't be complete.
function buildPeriods(endDate, period, count) {
  const periods = [];

  if (period === 'weekly') {
    const current = new Date(endDate);
    current.setHours(0, 0, 0, 0);
    const day = current.getDay() || 7;
    const currentMonday = new Date(current);
    currentMonday.setDate(current.getDate() - (day - 1));

    for (let i = count - 1; i >= 0; i--) {
      const monday = new Date(currentMonday);
      monday.setDate(currentMonday.getDate() - i * 7);
      const end = new Date(monday);
      end.setDate(monday.getDate() + 6);
      const label = `${monday.getDate()}–${end.getDate()} ${SPANISH_MONTHS_ABBR[end.getMonth()]}`;
      periods.push({ key: getWeekRange(monday), label, start: monday, end });
    }
  } else if (period === 'biweekly') {
    const current = new Date(endDate);
    current.setHours(0, 0, 0, 0);
    const currentQOffset = current.getDate() <= 15 ? 0 : 1;
    const currentTotalQ = (current.getFullYear() * 12 + current.getMonth()) * 2 + currentQOffset;

    for (let i = count - 1; i >= 0; i--) {
      const totalQ = currentTotalQ - i;
      const totalMonths = Math.floor(totalQ / 2);
      const year = Math.floor(totalMonths / 12);
      const month = totalMonths % 12;
      const qOffset = ((totalQ % 2) + 2) % 2;
      const start = qOffset === 0 ? new Date(year, month, 1) : new Date(year, month, 16);
      const end = qOffset === 0 ? new Date(year, month, 15) : new Date(year, month + 1, 0);
      const key = getQuincenaKey(start);
      const label = `Q${qOffset + 1} ${SPANISH_MONTHS_ABBR[month]}`;
      periods.push({ key, label, start, end });
    }
  } else {
    const current = new Date(endDate);
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(current.getFullYear(), current.getMonth() - i, 1);
      const key = getMonthKey(d);
      const label = `${SPANISH_MONTHS_ABBR[d.getMonth()]} ${d.getFullYear()}`;
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      periods.push({ key, label, start: d, end });
    }
  }

  periods.forEach((p, i) => { p.isPartial = i === periods.length - 1; });
  const completeCount = periods.length - 1;

  return { periods, completeCount };
}

module.exports = { getWeekRange, getMonthKey, getQuincenaKey, buildPeriods };
