const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const int = new Intl.NumberFormat('en-US');

export const money = (n) => usd.format(Number.isFinite(n) ? n : 0);
export const money0 = (n) => usd0.format(Number.isFinite(n) ? n : 0);
export const number = (n) => int.format(Number.isFinite(n) ? n : 0);
export const pct = (n, digits = 0) => `${((Number.isFinite(n) ? n : 0) * 100).toFixed(digits)}%`;

export function moneyShort(n) {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return money0(n);
}

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const d = (iso) => (iso instanceof Date ? iso : new Date(iso));

export const date = (iso) => (iso ? d(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
export const dateShort = (iso) => (iso ? d(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—');
export const weekday = (iso) => d(iso).toLocaleDateString('en-US', { weekday: 'short' });
export const time = (iso) => d(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
export const dateTime = (iso) => `${dateShort(iso)}, ${time(iso)}`;

export function relTime(iso, now = new Date()) {
  const diff = (now - d(iso)) / 1000;
  const future = diff < 0;
  const s = Math.abs(diff);
  let out;
  if (s < 60) out = 'just now';
  else if (s < 3600) out = `${Math.floor(s / 60)}m`;
  else if (s < 86400) out = `${Math.floor(s / 3600)}h`;
  else if (s < 86400 * 2) return future ? 'Tomorrow' : 'Yesterday';
  else if (s < 86400 * 7) out = `${Math.floor(s / 86400)}d`;
  else return dateShort(iso);
  if (out === 'just now') return out;
  return future ? `in ${out}` : `${out} ago`;
}

export const startOfDay = (x = new Date()) => {
  const t = new Date(x);
  t.setHours(0, 0, 0, 0);
  return t;
};
export const addDays = (x, n) => {
  const t = new Date(x);
  t.setDate(t.getDate() + n);
  return t;
};
export const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();
export const isoDate = (x) => {
  const t = new Date(x);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

export function phone(p = '') {
  const digits = p.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1') return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return p;
}
export const telHref = (p = '') => `tel:${p.replace(/[^\d+]/g, '')}`;
export const smsHref = (p = '', body = '') => `sms:${p.replace(/[^\d+]/g, '')}${body ? `?&body=${encodeURIComponent(body)}` : ''}`;
export const mailHref = (to = '', subject = '', body = '') =>
  `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

export const fullName = (c) => (c ? [c.firstName, c.lastName].filter(Boolean).join(' ') || c.company || 'Unnamed' : 'Walk-in');
export const initials = (c) => {
  const n = fullName(c).split(' ').filter(Boolean);
  return ((n[0]?.[0] || '') + (n[1]?.[0] || '')).toUpperCase() || '?';
};
export const vehicleName = (v, { trim = false } = {}) =>
  v ? [v.year, v.make, v.model, trim ? v.trim : null].filter(Boolean).join(' ') : 'No vehicle';

export const titleCase = (s = '') => s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());

let counter = 0;
export const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const plural = (n, one, many = `${one}s`) => `${number(n)} ${n === 1 ? one : many}`;
