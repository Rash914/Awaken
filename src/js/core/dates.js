// Local calendar-day keys ("YYYY-MM-DD"). Day math goes through UTC so DST never shifts a day.
const DAY_MS = 86400000;
const pad = (n) => String(n).padStart(2, '0');

export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isDateKey(k) {
  return typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && !Number.isNaN(toUTC(k));
}

function toUTC(k) {
  const [y, m, d] = k.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(k, n) {
  const d = new Date(toUTC(k) + n * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Whole days from a to b (b - a). */
export function diffDays(a, b) {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
}

export function weekday(k) {
  return new Date(toUTC(k)).getUTCDay(); // 0 = Sunday
}

export function formatKey(k, opts = { day: 'numeric', month: 'short' }) {
  return new Date(toUTC(k)).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });
}
