// Shop KPIs for a period, period-over-period comparison, monthly goals and booking channels.
import { orderTotals, itemTotal } from './pricing';
import { addDays, startOfDay } from './format';

const inRange = (iso, f, t) => iso && iso >= f && iso < t;
const laborHours = (s) => s.items.filter((i) => i.type === 'labor').reduce((a, i) => a + (Number(i.hours) || 0), 0);

export function periodMetrics(state, from, to) {
  const f = from.toISOString();
  const t = to.toISOString();
  const shop = state.shop;
  const invoiced = state.orders.filter((o) => inRange(o.invoicedAt, f, t));
  const written = state.orders.filter((o) => inRange(o.createdAt, f, t));
  let sales = 0;
  let total = 0;
  let gp = 0;
  let labor = 0;
  let hoursSold = 0;
  let parts = 0;
  let partsCost = 0;
  for (const o of invoiced) {
    const tt = orderTotals(o, shop);
    total += tt.total;
    sales += tt.subtotal - tt.discount;
    gp += tt.grossProfit;
    labor += tt.labor;
    hoursSold += tt.hours;
    parts += tt.parts;
    partsCost += tt.partsCost;
  }
  let hoursPresented = 0;
  let quoted = 0;
  let approved = 0;
  for (const o of written)
    for (const s of o.services) {
      hoursPresented += laborHours(s);
      const v = s.items.reduce((a, i) => a + itemTotal(i), 0);
      quoted += v;
      if (s.status !== 'declined' && s.status !== 'pending') approved += v;
    }
  return {
    carCount: invoiced.length,
    sales,
    aro: invoiced.length ? total / invoiced.length : 0,
    hoursPresented,
    hoursSold,
    hoursPerRo: invoiced.length ? hoursSold / invoiced.length : 0,
    closeRate: quoted ? approved / quoted : 0,
    elr: hoursSold ? labor / hoursSold : 0,
    partsMargin: parts ? (parts - partsCost) / parts : 0,
    gpPct: sales ? gp / sales : 0,
  };
}

export const COMPARE_ROWS = [
  { key: 'carCount', label: 'Car count', kind: 'int' },
  { key: 'sales', label: 'Sales (before tax)', kind: 'money' },
  { key: 'aro', label: 'Average repair order', kind: 'money' },
  { key: 'hoursPresented', label: 'Hours presented', kind: 'hours' },
  { key: 'hoursSold', label: 'Hours sold', kind: 'hours' },
  { key: 'hoursPerRo', label: 'Hours per RO', kind: 'hours' },
  { key: 'closeRate', label: 'Close rate ($ approved ÷ quoted)', kind: 'pct' },
  { key: 'elr', label: 'Effective labor rate', kind: 'money' },
  { key: 'partsMargin', label: 'Parts margin', kind: 'pct' },
  { key: 'gpPct', label: 'Gross profit %', kind: 'pct' },
];

/** Online vs phone/walk-in visits per month (from how each invoiced RO was booked). */
export function bookingChannels(state, months = 6, now = new Date()) {
  const out = [];
  for (let m = months - 1; m >= 0; m--) {
    const start = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - m + 1, 1);
    const list = state.orders.filter((o) => inRange(o.invoicedAt, start.toISOString(), end.toISOString()));
    const online = list.filter((o) => o.source === 'online').length;
    out.push({ key: start.toISOString(), label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), short: start.toLocaleDateString('en-US', { month: 'short' }), values: [online, list.length - online] });
  }
  return out;
}

/** Month-to-date results against the shop's monthly targets, with a month-end projection for counts. */
export function goalProgress(state, now = new Date(), { last = false } = {}) {
  const start = new Date(now.getFullYear(), now.getMonth() - (last ? 1 : 0), 1);
  const end = last ? new Date(now.getFullYear(), now.getMonth(), 1) : addDays(startOfDay(now), 1);
  const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  // Business days elapsed vs in month (Mon–Sat) for a fair projection.
  const workdays = (a, b) => {
    let n = 0;
    for (let d = new Date(a); d < b; d.setDate(d.getDate() + 1)) if (d.getDay() !== 0) n += 1;
    return n;
  };
  const elapsed = Math.max(1, workdays(start, end));
  const total = workdays(start, new Date(start.getFullYear(), start.getMonth(), daysInMonth + 1));
  const m = periodMetrics(state, start, end);
  const g = state.shop.goals || {};
  return {
    metrics: m,
    start,
    complete: last,
    elapsed,
    total,
    rows: [
      { key: 'carCount', label: 'Car count', kind: 'int', actual: m.carCount, projected: last ? null : Math.round((m.carCount / elapsed) * total), target: g.carCount },
      { key: 'aro', label: 'Average repair order', kind: 'money', actual: m.aro, target: g.aro },
      { key: 'gpPct', label: 'Gross profit', kind: 'pct', actual: m.gpPct, target: (g.gpPct || 0) / 100 },
      { key: 'partsMargin', label: 'Parts margin', kind: 'pct', actual: m.partsMargin, target: (g.partsMargin || 0) / 100 },
      { key: 'elr', label: 'Effective labor rate', kind: 'money', actual: m.elr, target: g.elr },
      { key: 'closeRate', label: 'Close rate', kind: 'pct', actual: m.closeRate, target: (g.closeRate || 0) / 100 },
    ],
  };
}
