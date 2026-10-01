// Marketing automations: each recipe knows who is due today, how many came up in the last 30 days,
// and what's coming in the next 30. Messages go out from the shop's phone or email in one pass.
import { serviceReminders, declinedWork, lapsedCustomers, reviewCandidates } from './marketing';
import { addDays, startOfDay } from './format';

export const AUTOMATIONS = [
  { id: 'confirm', template: 'appt', title: 'Appointment confirmation', body: 'Confirm every new booking right away so customers know they’re on the schedule.', tone: 'blue' },
  { id: 'reminder', template: 'appt', title: 'Day-before reminder', body: 'A reminder the day before each appointment cuts no-shows.', tone: 'sky' },
  { id: 'review', template: 'review', title: 'Review request', body: 'Ask happy customers for a Google review after pickup.', tone: 'teal' },
  { id: 'service', template: 'service', title: 'Service due reminder', body: 'Oil service reminders by time or projected mileage.', tone: 'slate' },
  { id: 'declined', template: 'declined', title: 'Declined work follow-up', body: 'Bring back recommendations customers said “not now” to.', tone: 'graphite' },
  { id: 'winback', template: 'winback', title: 'We miss you', body: 'Reconnect with customers you haven’t seen in a while.', tone: 'blue' },
];

const DAY = 86400000;

function messagedSince(state, customerId, template, sinceIso) {
  return state.messages.some((m) => m.customerId === customerId && m.dir === 'out' && m.meta?.template === template && m.at >= sinceIso);
}

/** For each automation: recipients due now, count sent in the last 30 days, and count coming up. */
export function automationStatus(state, now = new Date()) {
  const since30 = addDays(now, -30).toISOString();
  const sent = (id, template) => state.messages.filter((m) => m.dir === 'out' && m.at >= since30 && (m.meta?.automation === id || (!m.meta?.automation && m.meta?.template === template && template !== 'appt'))).length;
  const customer = (id) => state.customers.find((c) => c.id === id);
  const vehicle = (id) => state.vehicles.find((v) => v.id === id);
  const appts = state.appointments.filter((a) => a.status !== 'cancelled' && a.status !== 'no_show' && new Date(a.start) > now);
  const tomorrow = addDays(startOfDay(now), 1);
  const dayAfter = addDays(tomorrow, 1);
  const in30 = addDays(now, 30);

  const toRecipient = (a) => ({ key: a.id, customer: customer(a.customerId), vehicle: vehicle(a.vehicleId), appointment: a });
  const confirmDue = appts.filter((a) => new Date(a.start) < addDays(now, 21) && !messagedSince(state, a.customerId, 'appt', addDays(now, -14).toISOString())).map(toRecipient);
  const reminderDue = appts.filter((a) => new Date(a.start) >= tomorrow && new Date(a.start) < dayAfter && !state.messages.some((m) => m.customerId === a.customerId && m.meta?.automation === 'reminder' && m.at >= addDays(now, -2).toISOString())).map(toRecipient);

  const service = serviceReminders(state, now).filter((r) => !r.contacted);
  const declined = declinedWork(state, {}, now).filter((r) => !r.contacted && (now - new Date(r.at)) / DAY >= 14);
  const lapsed = lapsedCustomers(state, now).filter((r) => !r.contacted);
  const reviews = reviewCandidates(state, now, 3);

  const dedupe = (rows) => {
    const seen = new Set();
    return rows.filter((r) => r.customer && !seen.has(r.customer.id) && seen.add(r.customer.id));
  };
  const asRecipients = (rows, extra) => dedupe(rows).map((r) => ({ key: r.key, customer: r.customer, vehicle: r.vehicle, order: r.order || r.lastOrder, extra: extra ? extra(r) : undefined }));

  return {
    confirm: { due: dedupe(confirmDue), upcoming: appts.filter((a) => new Date(a.start) < in30).length, sent: sent('confirm', 'appt') },
    reminder: { due: dedupe(reminderDue), upcoming: appts.filter((a) => new Date(a.start) < in30).length, sent: sent('reminder', 'appt') },
    review: { due: asRecipients(reviews), upcoming: state.orders.filter((o) => ['approved', 'in_progress', 'waiting_parts', 'ready'].includes(o.status)).length, sent: sent('review', 'review') },
    service: { due: asRecipients(service, () => ({ service: 'an oil change' })), upcoming: null, sent: sent('service', 'service') },
    declined: { due: asRecipients(declined, (r) => ({ service: r.service.title.toLowerCase() })), upcoming: null, sent: sent('declined', 'declined') },
    winback: { due: asRecipients(lapsed), upcoming: null, sent: sent('winback', 'winback') },
  };
}
