// Live status page for customers: a link they can open any time to see where their vehicle is —
// checked in, inspected, approved, being worked on, waiting on parts, ready. The page reads a small
// public file that the shop's devices update whenever the repair order changes.
import { publishPublicJson, publicFolder, newShareId, trackLink } from './cloudShare';
import { orderTotals } from './pricing';
import { payLink } from './messaging';
import { vehicleName } from './format';

export const TRACK_STEPS = [
  { status: 'estimate', label: 'Checked in & inspected', detail: 'We’re looking your vehicle over and putting together an estimate.' },
  { status: 'approved', label: 'Work approved', detail: 'Thanks for approving the work — it’s next in line for a technician.' },
  { status: 'in_progress', label: 'Being worked on', detail: 'A technician is working on your vehicle now.' },
  { status: 'waiting_parts', label: 'Waiting on parts', detail: 'We’re waiting on a part to arrive and will keep going as soon as it does.' },
  { status: 'ready', label: 'Ready for pickup', detail: 'All done! Your vehicle is ready to pick up.' },
  { status: 'closed', label: 'Picked up', detail: 'Thanks for your business — drive safe.' },
];

export const newTrackId = () => newShareId();
export const trackBase = (cfg) => publicFolder(cfg, 'track');
export { trackLink };

/** When each step happened, from the status log (with older ROs falling back to their dates). */
function stepTimes(order) {
  const at = {};
  for (const e of order.statusLog || []) at[e.status] = e.at;
  at.estimate ||= order.createdAt;
  if (order.authorizedAt) at.approved ||= order.authorizedAt;
  if (order.invoicedAt) at.ready ||= order.invoicedAt;
  if (order.closedAt) at.closed ||= order.closedAt;
  return at;
}

/** Everything the public page shows (no prices beyond the balance due, no internal notes). */
export function trackPayload(state, order) {
  const shop = state.shop;
  const customer = state.customers.find((c) => c.id === order.customerId);
  const vehicle = state.vehicles.find((v) => v.id === order.vehicleId);
  const t = orderTotals(order, shop);
  const balance = Math.max(0, t.balance);
  const times = stepTimes(order);
  const reached = new Set(Object.keys(times));
  const inspection = Object.values(order.inspection || {}).reduce((m, e) => (e?.rating ? { ...m, [e.rating]: (m[e.rating] || 0) + 1 } : m), {});
  return {
    v: 1,
    shop: { name: shop.name, phone: shop.phone, address: [shop.address, [shop.city, shop.state].filter(Boolean).join(', ')].filter(Boolean).join(', ') },
    first: customer?.firstName || '',
    vehicle: vehicle ? vehicleName(vehicle) : 'Your vehicle',
    ro: order.number,
    status: order.status,
    steps: TRACK_STEPS.filter((s) => s.status !== 'waiting_parts' || order.status === 'waiting_parts' || reached.has('waiting_parts')).map((s) => ({ status: s.status, label: s.label, at: times[s.status] || null })),
    promisedAt: order.promisedAt || null,
    inspection,
    services: order.services.filter((s) => s.status !== 'declined').map((s) => ({ title: s.title, done: Boolean(s.done), approved: s.status !== 'pending' })),
    reportUrl: order.share && !order.share.revoked ? order.share.url : null,
    balance: ['ready', 'closed'].includes(order.status) && balance > 0.004 ? balance : 0,
    payLink: ['ready', 'closed'].includes(order.status) && balance > 0.004 ? payLink(shop, balance, `RO ${order.number}`) || null : null,
    updatedAt: new Date().toISOString(),
  };
}

/** A fingerprint of what the page shows, to republish only when something changed. */
export function trackFingerprint(state, order) {
  const p = trackPayload(state, order);
  delete p.updatedAt;
  return JSON.stringify(p);
}

export const publishTrack = (cfg, id, payload) => publishPublicJson(cfg, `track/${id}.json`, payload, 20);
/** Turn a status page off: the link shows a notice instead. */
export const revokeTrack = (cfg, id) => publishPublicJson(cfg, `track/${id}.json`, { v: 1, revoked: true }, 20);
