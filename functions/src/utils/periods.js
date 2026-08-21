// utils/periods.js
//
// Week/month bucketing helpers, moved out of SalesReport so ClientReport can
// share the exact same key generation (bucketing must match exactly).
//
// ponytail: date-fns is not installed on the backend (frontend-only dep per
// package.json), so labels are hand-rolled Spanish month abbreviations
// instead of date-fns/locale/es as the plan assumed.

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

// Returns `count` period descriptors ending at endDate, OLDEST FIRST.
// [{ key: '2026-08-10/2026-08-16', label: '10–16 Ago' }, ...]
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
      const key = getWeekRange(monday);
      const [startStr, endStr] = key.split('/');
      const start = new Date(startStr + 'T00:00:00');
      const end = new Date(endStr + 'T00:00:00');
      const label = `${start.getDate()}–${end.getDate()} ${SPANISH_MONTHS_ABBR[end.getMonth()]}`;
      periods.push({ key, label });
    }
  } else {
    const current = new Date(endDate);
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(current.getFullYear(), current.getMonth() - i, 1);
      const key = getMonthKey(d);
      const label = `${SPANISH_MONTHS_ABBR[d.getMonth()]} ${d.getFullYear()}`;
      periods.push({ key, label });
    }
  }

  return periods;
}

module.exports = { getWeekRange, getMonthKey, buildPeriods };
