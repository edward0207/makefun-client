// How this client says numbers, money and time. The API sends dollars as strings ('516.00'),
// instants as ISO 8601 and leaderboard metrics as integers with a unit hidden in the column's
// `source` — all of it is turned into something readable here and nowhere else.

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const USD_WHOLE = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const COUNT = new Intl.NumberFormat('en-US');
const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const MINUTE = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' });

/** A dollar amount, cents shown only when there are any: '$516', '$0.50'. */
export function usd(value) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return '—';
  return Number.isInteger(amount) ? USD_WHOLE.format(amount) : USD.format(amount);
}

/** A whole number with thousands separators: '7,873'. */
export const count = (value) => COUNT.format(Number(value ?? 0));

/** A plural that reads: `plural(1, 'entry', 'entries')`. */
export const plural = (n, one, many) => `${count(n)} ${Number(n) === 1 ? one : many}`;

/** An instant in UTC: '17 Nov 2026, 12:30 UTC'. */
export const stamp = (iso) => (iso ? `${DAY.format(new Date(iso))}, ${MINUTE.format(new Date(iso))} UTC` : '—');

/** An instant as a date alone: '17 Nov 2026'. */
export const day = (iso) => (iso ? DAY.format(new Date(iso)) : '—');

/** How long ago something happened: '4m ago', '3h ago', '2d ago'. */
export function since(iso) {
  if (!iso) return '—';
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 90) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  if (seconds < 2592000) return `${Math.round(seconds / 86400)}d ago`;
  return day(iso);
}

/**
 * The time until a deadline, as the board shows it: a label and how much it matters.
 * Under 6 hours is 'urgent', under 48 is 'soon', past the deadline is 'ended'.
 */
export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return { ms: 0, label: '—', urgency: 'ended' };
  if (ms <= 0) return { ms, label: 'closed', urgency: 'ended' };
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const label = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s).padStart(2, '0')}s`;
  return { ms, label, urgency: ms < 21600000 ? 'urgent' : ms < 172800000 ? 'soon' : 'open' };
}

/** How far a bounty has run, 0 to 1, from the hour it opened to its deadline. */
export function elapsed(openedAt, deadline) {
  const from = new Date(openedAt ?? 0).getTime();
  const to = new Date(deadline).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 1;
  return Math.min(1, Math.max(0, (Date.now() - from) / (to - from)));
}

/** A byte count as a leaderboard shows an artifact's size: '888 B', '14.2 KB'. */
export function bytes(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

/** A fraction of a million (the API's `*_micro` metrics) as a percentage: 937047 → '93.7%'. */
export const fromMicro = (value) => `${(Number(value) / 10000).toFixed(1)}%`;

/**
 * One measured figure. The API hands over a `display` string already rounded to its column's
 * precision, so it is used as it stands — except where the column's `source` names a unit the
 * raw integer hides: a `*_micro` rate is really a percentage, and `artifact_bytes` is a size.
 */
export function measure({ source, value, display }) {
  if (value != null && /_micro$/.test(source ?? '')) return fromMicro(value);
  if (value != null && /bytes$/.test(source ?? '')) return bytes(value);
  if (display != null) return display;
  return value != null ? String(value) : '—';
}

/** One leaderboard cell: `measure` applied to a column of an entry's values. */
export const metric = (column, values = {}, display = {}) =>
  measure({ source: column.source, value: values?.[column.key], display: display?.[column.key] });
