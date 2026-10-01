// Fleet and business accounts: invoices on terms, receivables aging, statements, batch payments
// and preventive-maintenance (PM) schedules for each unit.
import { orderTotals } from './pricing';
import { round2 } from './format';

export const TERMS = [
  { value: 'due', label: 'Due on receipt', days: 0 },
  { value: 'net7', label: 'Net 7', days: 7 },
  { value: 'net15', label: 'Net 15', days: 15 },
  { value: 'net30', label: 'Net 30', days: 30 },
  { value: 'net45', label: 'Net 45', days: 45 },
  { value: 'net60', label: 'Net 60', days: 60 },
];
export const termsLabel = (value) => TERMS.find((t) => t.value === value)?.label || 'Due on receipt';
export const termsDays = (value) => TERMS.find((t) => t.value === value)?.days || 0;

export const BLANK_ACCOUNT = {
  terms: 'net30',
  creditLimit: null,
  poRequired: false,
  preApproved: null,
  taxExempt: false,
  taxId: '',
  billingEmail: '',
  invoiceNote: '',
  contacts: [],
  pmPlans: [],
  portal: null,
};

/** Common PM programs to start from (intervals are the shop's to set; these are typical fleet defaults). */
export const PM_PRESETS = [
  { label: 'Oil & filter service', miles: 5000, months: 6, jobId: 'cj-oil' },
  { label: 'Tire rotation', miles: 7500, months: null, jobId: 'cj-rotate' },
  { label: 'Annual safety inspection', miles: null, months: 12, jobId: null },
];

export const isAccount = (c) => Boolean(c?.account);
export const hasTerms = (c) => isAccount(c) && termsDays(c.account.terms) > 0;

const DAY = 86_400_000;
const addDays = (iso, n) => new Date(new Date(iso).getTime() + n * DAY).toISOString();
const daysBetween = (a, b) => Math.floor((new Date(b).setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0)) / DAY);

/** When an invoice is due: the date set when it was charged to the account, or its invoice date plus terms. */
export function dueDate(order, customer) {
  if (order.charge?.dueAt) return order.charge.dueAt;
  const from = order.invoicedAt || order.closedAt || order.createdAt;
  return addDays(from, isAccount(customer) ? termsDays(customer.account.terms) : 0);
}

/** Invoices with money still owed (oldest first), with due dates and days past due. */
export function openInvoices(state, { customerId, now = new Date() } = {}) {
  const customers = new Map(state.customers.map((c) => [c.id, c]));
  return state.orders
    .filter((o) => (o.status === 'ready' || o.status === 'closed') && (!customerId || o.customerId === customerId))
    .map((o) => {
      const t = orderTotals(o, state.shop);
      if (t.balance <= 0.004) return null;
      const customer = customers.get(o.customerId);
      const due = dueDate(o, customer);
      return { order: o, customer, total: t.total, paid: t.paid, balance: round2(t.balance), invoiced: o.invoicedAt || o.closedAt || o.createdAt, due, pastDue: Math.max(0, daysBetween(due, now)) };
    })
    .filter(Boolean)
    .sort((a, b) => a.invoiced.localeCompare(b.invoiced));
}

export const AGING = [
  { key: 'current', label: 'Current', test: (d) => d <= 0 },
  { key: 'd30', label: '1–30 days', test: (d) => d > 0 && d <= 30 },
  { key: 'd60', label: '31–60 days', test: (d) => d > 30 && d <= 60 },
  { key: 'd90', label: '61–90 days', test: (d) => d > 60 && d <= 90 },
  { key: 'd90p', label: 'Over 90 days', test: (d) => d > 90 },
];

/** Aging buckets by days past the due date. */
export function aging(invoices) {
  return AGING.map((b) => {
    const list = invoices.filter((i) => b.test(i.pastDue));
    return { key: b.key, label: b.label, count: list.length, amount: round2(list.reduce((s, i) => s + i.balance, 0)) };
  });
}

/** Spread one payment across invoices, oldest first (or only the chosen ones). */
export function allocate(invoices, amount, onlyIds) {
  let left = round2(Number(amount) || 0);
  const out = [];
  for (const i of invoices) {
    if (onlyIds && !onlyIds.includes(i.order.id)) continue;
    if (left <= 0.004) break;
    const take = round2(Math.min(left, i.balance));
    out.push({ orderId: i.order.id, number: i.order.number, amount: take, closes: take >= i.balance - 0.004 });
    left = round2(left - take);
  }
  return { allocations: out, unapplied: left };
}

// ---------------------------------------------------------------- Preventive maintenance

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Does a service on an RO count as this PM? (Same canned job, or the plan's name in the service title.) */
function servicesMatch(state, plan, title) {
  const job = plan.jobId ? state.cannedJobs.find((j) => j.id === plan.jobId) : null;
  const t = norm(title);
  if (job && norm(job.title) === t) return true;
  const label = norm(plan.label);
  return Boolean(label) && (t.includes(label) || (job && t.includes(norm(job.title))));
}

/** Last time a PM was done on a unit: from its repair orders here, or a date recorded by hand. */
export function lastPm(state, vehicle, plan) {
  let last = null;
  for (const o of state.orders) {
    if (o.vehicleId !== vehicle.id || !['ready', 'closed'].includes(o.status)) continue;
    if (!o.services.some((s) => s.status !== 'declined' && servicesMatch(state, plan, s.title))) continue;
    const at = o.invoicedAt || o.closedAt || o.createdAt;
    if (!last || at > last.date) last = { date: at, miles: o.mileageOut || o.mileageIn || null, ro: o.number, orderId: o.id };
  }
  const manual = vehicle.pm?.[plan.id];
  if (manual?.date && (!last || manual.date > last.date)) last = { date: manual.date, miles: manual.miles ?? null, manual: true };
  return last;
}

/**
 * Where a unit stands on one PM plan. Due by whichever comes first, miles or months; "soon" within
 * 10% of the mileage interval (at least 500 mi) or 30 days.
 */
export function pmStatus(state, vehicle, plan, now = new Date()) {
  const last = lastPm(state, vehicle, plan);
  const miles = Number(vehicle.mileage) || null;
  if (!last) return { plan, last: null, status: 'unknown', text: 'No record yet' };
  const dueAt = plan.months ? new Date(new Date(last.date).setMonth(new Date(last.date).getMonth() + Number(plan.months))).toISOString() : null;
  const dueMiles = plan.miles && last.miles ? last.miles + Number(plan.miles) : null;
  const daysLeft = dueAt ? daysBetween(now, dueAt) : null;
  const milesLeft = dueMiles && miles ? dueMiles - miles : null;
  const soonMiles = plan.miles ? Math.max(500, Number(plan.miles) * 0.1) : 0;
  const overdue = (daysLeft != null && daysLeft < 0) || (milesLeft != null && milesLeft < 0);
  const soon = !overdue && ((daysLeft != null && daysLeft <= 30) || (milesLeft != null && milesLeft <= soonMiles));
  const mi = (n) => `${Math.abs(n).toLocaleString()} mi`;
  const days = (n) => `${Math.abs(n)} day${Math.abs(n) === 1 ? '' : 's'}`;
  let text;
  if (overdue) {
    const over = [milesLeft != null && milesLeft < 0 && mi(milesLeft), daysLeft != null && daysLeft < 0 && days(daysLeft)].filter(Boolean);
    text = `${over.join(' & ')} overdue`;
  } else if (daysLeft === 0) text = 'Due today';
  else {
    const left = [milesLeft != null && mi(milesLeft), daysLeft != null && days(daysLeft)].filter(Boolean);
    text = left.length ? (soon ? `Due in ${left.join(' or ')}` : `${left.join(' · ')} left`) : 'Up to date';
  }
  return { plan, last, dueAt, dueMiles, daysLeft, milesLeft, status: overdue ? 'overdue' : soon ? 'due' : 'ok', text };
}

export const PM_RANK = { overdue: 0, due: 1, unknown: 2, ok: 3 };

/** Every unit on an account with its PM status, worst first. */
export function fleetUnits(state, customer, now = new Date()) {
  const plans = customer?.account?.pmPlans || [];
  const open = new Map(state.orders.filter((o) => o.customerId === customer.id && o.status !== 'closed').map((o) => [o.vehicleId, o]));
  return state.vehicles
    .filter((v) => v.customerId === customer.id && !v.retired)
    .map((v) => {
      const pm = plans.map((p) => pmStatus(state, v, p, now));
      const worst = pm.reduce((w, p) => (PM_RANK[p.status] < PM_RANK[w] ? p.status : w), 'ok');
      return { vehicle: v, pm, worst: plans.length ? worst : null, openOrder: open.get(v.id) || null };
    })
    .sort((a, b) => (PM_RANK[a.worst] ?? 9) - (PM_RANK[b.worst] ?? 9) || String(a.vehicle.unit || '').localeCompare(String(b.vehicle.unit || ''), undefined, { numeric: true }));
}

/** Balance, past due, credit and PM picture for one account. */
export function accountSummary(state, customer, now = new Date()) {
  const invoices = openInvoices(state, { customerId: customer.id, now });
  const balance = round2(invoices.reduce((s, i) => s + i.balance, 0));
  const pastDue = round2(invoices.filter((i) => i.pastDue > 0).reduce((s, i) => s + i.balance, 0));
  const limit = Number(customer.account?.creditLimit) || 0;
  const units = isAccount(customer) ? fleetUnits(state, customer, now) : [];
  return {
    invoices,
    aging: aging(invoices),
    balance,
    pastDue,
    oldest: invoices.reduce((m, i) => Math.max(m, i.pastDue), 0),
    creditLimit: limit || null,
    available: limit ? round2(limit - balance) : null,
    units,
    pmOverdue: units.filter((u) => u.worst === 'overdue').length,
    pmDue: units.filter((u) => u.worst === 'due').length,
    openOrders: state.orders.filter((o) => o.customerId === customer.id && o.status !== 'closed' && o.status !== 'ready').length,
  };
}

/** Payments received on an account in a window (grouped by batch so one check shows once). */
export function accountPayments(state, customerId, sinceDays = 90, now = new Date()) {
  const since = new Date(now.getTime() - sinceDays * DAY).toISOString();
  const groups = new Map();
  for (const o of state.orders) {
    if (o.customerId !== customerId) continue;
    for (const p of o.payments || []) {
      if (p.at < since) continue;
      const key = p.batchId || p.id;
      const g = groups.get(key) || { id: key, at: p.at, method: p.method, ref: p.ref || '', amount: 0, orders: [] };
      g.amount = round2(g.amount + Number(p.amount || 0));
      g.orders.push(o.number);
      groups.set(key, g);
    }
  }
  return [...groups.values()].sort((a, b) => b.at.localeCompare(a.at));
}

/** Plain-text statement for an email to the account's billing contact. */
export function statementText(state, customer, summary, { portalUrl = '', now = new Date() } = {}) {
  const shop = state.shop;
  const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const day = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const vehicles = new Map(state.vehicles.map((v) => [v.id, v]));
  const lines = summary.invoices.map((i) => {
    const v = vehicles.get(i.order.vehicleId);
    const bits = [`RO #${i.order.number}`, day(i.invoiced), i.order.po && `PO ${i.order.po}`, v?.unit && `Unit ${v.unit}`, fmt(i.balance), i.pastDue > 0 ? `${i.pastDue} days past due` : `due ${day(i.due)}`];
    return `• ${bits.filter(Boolean).join(' — ')}`;
  });
  const greeting = customer.firstName ? `Hi ${customer.firstName},` : 'Hello,';
  return [
    greeting,
    '',
    `Here is the statement for ${customer.company || 'your account'} from ${shop.name} as of ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`,
    '',
    `Balance: ${fmt(summary.balance)}${summary.pastDue > 0 ? ` (${fmt(summary.pastDue)} past due)` : ''}`,
    `Terms: ${termsLabel(customer.account?.terms)}`,
    '',
    ...(lines.length ? ['Open invoices:', ...lines] : ['No open invoices — thank you!']),
    ...(portalUrl ? ['', `Invoices, payments and each unit’s maintenance schedule: ${portalUrl}`] : []),
    '',
    `Remit to: ${shop.name}, ${[shop.address, shop.city, shop.state].filter(Boolean).join(', ')} ${shop.zip || ''}`.trim(),
    `Questions: ${shop.phone || shop.email || ''}`,
  ].join('\n');
}
