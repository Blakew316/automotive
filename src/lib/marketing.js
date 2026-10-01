// CRM lists built from service history: who is due, who declined work, who hasn't been back,
// and who should be asked for a review. Everything is computed from the shop's own records.
import { serviceTotal } from './pricing';
import { addDays, vehicleName } from './format';

const DAY = 86400000;
const OIL = /\b(oil|lube)\b/i;

const visitDate = (o) => o.invoicedAt || o.closedAt || o.createdAt;

/** Last visit per customer (latest invoiced or open RO). */
export function lastVisits(state) {
  const map = new Map();
  for (const o of state.orders) {
    if (!o.customerId) continue;
    const at = visitDate(o);
    if (!map.has(o.customerId) || at > map.get(o.customerId).at) map.set(o.customerId, { at, order: o });
  }
  return map;
}

const contactable = (c) => c && (c.phone || c.email);

/**
 * Vehicles due for oil service by time or estimated mileage since their last oil change here.
 * Mileage is projected from the last odometer reading at the shop's average miles per day.
 */
export function serviceReminders(state, now = new Date()) {
  const m = state.shop.marketing || {};
  const months = m.oilMonths || 6;
  const miles = m.oilMiles || 5000;
  const perDay = m.milesPerDay || 35;
  const open = new Set(state.orders.filter((o) => !o.invoicedAt && o.status !== 'closed').map((o) => o.vehicleId));
  // Already booked in? No reminder needed.
  upcoming(state, now).forEach((a) => open.add(a.vehicleId));
  const contacted = recentlyMessaged(state, 'service', 21, now);
  const out = [];
  for (const v of state.vehicles) {
    if (open.has(v.id)) continue;
    const c = state.customers.find((x) => x.id === v.customerId);
    if (!contactable(c)) continue;
    const oil = state.orders
      .filter((o) => o.vehicleId === v.id && o.invoicedAt && o.services.some((s) => s.status !== 'declined' && OIL.test(s.title)))
      .sort((a, b) => b.invoicedAt.localeCompare(a.invoicedAt))[0];
    if (!oil) continue;
    const last = new Date(oil.invoicedAt);
    const days = (now - last) / DAY;
    const lastMiles = Number(oil.mileageOut || oil.mileageIn) || 0;
    const estMiles = lastMiles ? Math.round(lastMiles + days * perDay) : null;
    const dueDate = addDays(last, Math.round(months * 30.4));
    const byMiles = lastMiles ? estMiles - lastMiles >= miles : false;
    const byTime = now >= dueDate;
    // Include anything due within the next two weeks so reminders go out ahead of time.
    const soon = !byTime && !byMiles && (dueDate - now) / DAY <= 14;
    if (!byTime && !byMiles && !soon) continue;
    out.push({
      key: v.id,
      customer: c,
      vehicle: v,
      lastOrder: oil,
      last: oil.invoicedAt,
      lastMiles,
      estMiles,
      due: byMiles ? 'mileage' : byTime ? 'time' : 'soon',
      overdueDays: Math.round((now - dueDate) / DAY),
      service: 'an oil change',
      contacted: contacted.get(c.id),
    });
  }
  return out.sort((a, b) => b.overdueDays - a.overdueDays);
}

/** Recommended work the customer declined that hasn't been done since. */
export function declinedWork(state, { maxDays = 365 } = {}, now = new Date()) {
  const contacted = recentlyMessaged(state, 'declined', 30, now);
  const out = [];
  for (const o of state.orders) {
    if (!o.invoicedAt && o.status !== 'closed') continue;
    const age = (now - new Date(visitDate(o))) / DAY;
    if (age > maxDays) continue;
    const c = state.customers.find((x) => x.id === o.customerId);
    if (!contactable(c)) continue;
    for (const s of o.services) {
      if (s.status !== 'declined') continue;
      const later = state.orders.some((x) => x.vehicleId === o.vehicleId && x.createdAt > o.createdAt && x.services.some((y) => y.status !== 'declined' && y.title === s.title));
      if (later) continue;
      out.push({ key: `${o.id}:${s.id}`, customer: c, vehicle: state.vehicles.find((x) => x.id === o.vehicleId), order: o, service: s, value: serviceTotal(s), at: visitDate(o), contacted: contacted.get(c.id) });
    }
  }
  return out.sort((a, b) => b.value - a.value);
}

/** Customers who haven't been in for a while. */
export function lapsedCustomers(state, now = new Date()) {
  const months = state.shop.marketing?.winbackMonths || 9;
  const cutoff = addDays(now, -Math.round(months * 30.4)).toISOString();
  const contacted = recentlyMessaged(state, 'winback', 60, now);
  const visits = lastVisits(state);
  const booked = new Set(upcoming(state, now).map((a) => a.customerId));
  const out = [];
  for (const c of state.customers) {
    const v = visits.get(c.id);
    if (!v || v.at > cutoff || !contactable(c) || booked.has(c.id)) continue;
    const spend = state.orders.filter((o) => o.customerId === c.id && o.invoicedAt).reduce((s, o) => s + o.services.filter((x) => x.status !== 'declined').reduce((a, x) => a + serviceTotal(x), 0), 0);
    out.push({ key: c.id, customer: c, vehicle: state.vehicles.find((x) => x.id === v.order.vehicleId), last: v.at, spend, contacted: contacted.get(c.id) });
  }
  return out.sort((a, b) => b.spend - a.spend);
}

/** Recently completed visits that haven't been asked for a review. */
export function reviewCandidates(state, now = new Date(), days = 14) {
  const asked = new Set(state.messages.filter((m) => m.meta?.template === 'review').map((m) => m.customerId));
  const since = addDays(now, -days).toISOString();
  const seen = new Set();
  return state.orders
    .filter((o) => o.status === 'closed' && (o.closedAt || o.invoicedAt) >= since)
    .sort((a, b) => (b.closedAt || b.invoicedAt).localeCompare(a.closedAt || a.invoicedAt))
    .map((o) => ({ key: o.id, order: o, customer: state.customers.find((c) => c.id === o.customerId), vehicle: state.vehicles.find((v) => v.id === o.vehicleId), at: o.closedAt || o.invoicedAt }))
    .filter((r) => contactable(r.customer) && !asked.has(r.customer.id) && !seen.has(r.customer.id) && seen.add(r.customer.id));
}

const upcoming = (state, now) => state.appointments.filter((a) => new Date(a.start) >= now && a.status !== 'cancelled' && a.status !== 'no_show');

/** customerId → last time a given template was sent within `days`. */
function recentlyMessaged(state, templateId, days, now) {
  const since = addDays(now, -days).toISOString();
  const map = new Map();
  for (const m of state.messages) if (m.meta?.template === templateId && m.at >= since && m.dir === 'out') map.set(m.customerId, m.at);
  return map;
}

/** Audience builder for custom campaigns. */
export function campaignAudience(state, { tag = '', make = '', visited = 'any', channel = 'sms' } = {}, now = new Date()) {
  const visits = lastVisits(state);
  return state.customers
    .filter((c) => (channel === 'sms' ? c.phone && c.textOptIn !== false : c.email))
    .filter((c) => !tag || (c.tags || []).includes(tag))
    .filter((c) => !make || state.vehicles.some((v) => v.customerId === c.id && v.make === make))
    .filter((c) => {
      if (visited === 'any') return true;
      const v = visits.get(c.id);
      if (!v) return visited === 'never';
      const days = (now - new Date(v.at)) / DAY;
      if (visited === '90') return days <= 90;
      if (visited === '365') return days <= 365;
      if (visited === 'lapsed') return days > 365;
      return false;
    })
    .map((c) => ({ key: c.id, customer: c, vehicle: state.vehicles.find((v) => v.customerId === c.id) }));
}

export const vehicleLabel = (v) => (v ? vehicleName(v) : '');
