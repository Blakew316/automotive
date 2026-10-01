// Front desk & operations: self check-in, loaners and shuttle, comebacks and no-charge work, core
// returns and the waiting-room display.
import { cloudConfig, publicSiteBase } from './cloudShare';
import { WIP_STATUSES } from './workflow';
import { vehicleName } from './format';

export const FRONT_DESK_DEFAULTS = {
  checkin: {
    enabled: true,
    diagLimit: 150,
    askKeyTag: true,
    afterHours: 'Leave your keys in the key drop slot by the front door with this form done — we’ll text you as soon as we’ve looked at your vehicle.',
    terms: 'I authorize the shop to inspect and diagnose my vehicle up to the amount shown and to road test it as needed. No other work will be done without my approval.',
    published: false,
  },
  loaners: [],
  loanerTerms: 'I’ll return the loaner with the same fuel level, drive it only myself (licensed and insured), and I’m responsible for tolls, tickets and damage while it’s in my care.',
  lobby: { messages: ['Ask us about our maintenance plans — a quick text keeps you on schedule.', 'Free multi-point inspection with every visit.'], wifiName: '', wifiPassword: '', lastInitial: true },
};

export const TRANSPORT = { waiting: 'Waiting', dropoff: 'Drop-off', shuttle: 'Shuttle ride', loaner: 'Loaner', rental: 'Rental car' };
export const FUEL = ['E', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8', 'F'];
export const NO_CHARGE_REASONS = { warranty: 'Shop warranty', comeback: 'Comeback', goodwill: 'Goodwill' };
export const CORE_STATUS = { owed: 'To return', returned: 'Returned', credited: 'Credited' };

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

/** Each loaner with whoever has it now. */
export function loanerBoard(state) {
  const loaners = state.shop.frontDesk?.loaners || [];
  return loaners
    .filter((l) => l.active !== false)
    .map((l) => {
      const order = state.orders.find((o) => o.loaner?.id === l.id && o.loaner.outAt && !o.loaner.inAt) || null;
      return { loaner: l, order, customer: order ? state.customers.find((c) => c.id === order.customerId) : null, vehicle: order ? state.vehicles.find((v) => v.id === order.vehicleId) : null };
    });
}

export const availableLoaners = (state) => loanerBoard(state).filter((r) => !r.order).map((r) => r.loaner);

/** Shuttle rides for a day: drop-offs (customer to home/work) and pick-ups (back to the shop). */
export function shuttleRuns(state, day = new Date()) {
  const out = [];
  for (const o of state.orders) {
    const sh = o.shuttle;
    if (!sh) continue;
    for (const leg of ['dropoff', 'pickup']) {
      const r = sh[leg];
      if (!r?.at || !sameDay(r.at, day)) continue;
      out.push({ order: o, leg, ...r, customer: state.customers.find((c) => c.id === o.customerId), vehicle: state.vehicles.find((v) => v.id === o.vehicleId) });
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

/** Parts with a core charge, newest first. */
export function coreList(state) {
  const out = [];
  for (const o of state.orders) {
    if (o.status === 'estimate') continue;
    for (const s of o.services) {
      if (s.status === 'declined') continue;
      for (const i of s.items) {
        if (i.type !== 'part' || !(Number(i.core?.amount) > 0)) continue;
        out.push({ order: o, service: s, item: i, amount: Number(i.core.amount) * (Number(i.qty) || 1), status: i.core.status || 'owed', vendor: i.vendor || i.brand || '', since: o.invoicedAt || o.updatedAt || o.createdAt });
      }
    }
  }
  return out.sort((a, b) => String(b.since).localeCompare(String(a.since)));
}

/** Comebacks in a period: rate, cost, by technician and reason. */
export function comebackStats(state, from, to = new Date(), totalsOf) {
  const inRange = (iso) => iso && new Date(iso) >= from && new Date(iso) <= to;
  const closed = state.orders.filter((o) => ['ready', 'closed'].includes(o.status) && inRange(o.invoicedAt || o.closedAt));
  const comebacks = state.orders.filter((o) => o.comeback && inRange(o.comeback.at || o.createdAt));
  const byTech = new Map();
  let cost = 0;
  for (const o of comebacks) {
    const t = totalsOf(o);
    cost += t.noChargeCost || 0;
    const key = o.comeback.techId || 'none';
    const row = byTech.get(key) || { techId: o.comeback.techId || null, count: 0, cost: 0 };
    row.count += 1;
    row.cost += t.noChargeCost || 0;
    byTech.set(key, row);
  }
  const reasons = new Map();
  for (const o of comebacks) {
    const r = (o.comeback.reason || 'Not given').trim();
    reasons.set(r, (reasons.get(r) || 0) + 1);
  }
  const noCharge = closed.reduce((s, o) => s + (totalsOf(o).noCharge || 0), 0);
  return {
    count: comebacks.length,
    rate: closed.length ? comebacks.length / closed.length : 0,
    cost,
    noCharge,
    byTech: [...byTech.values()].sort((a, b) => b.count - a.count),
    reasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]),
    list: comebacks.sort((a, b) => String(b.comeback.at || b.createdAt).localeCompare(String(a.comeback.at || a.createdAt))),
  };
}

/** Customer name for public screens: first name and last initial. */
export const lobbyName = (c, lastInitial = true) => (c ? [c.firstName, lastInitial && c.lastName ? `${c.lastName[0]}.` : ''].filter(Boolean).join(' ') || c.company || 'Customer' : 'Walk-in');

const LOBBY_STATUS = {
  estimate: 'Inspecting',
  approved: 'Up next',
  in_progress: 'Being worked on',
  waiting_parts: 'Waiting on parts',
  ready: 'Ready for pickup',
};

/** What the waiting-room screen shows: today's vehicles, ready ones first. */
export function lobbyRows(state, now = new Date()) {
  const lastInitial = state.shop.frontDesk?.lobby?.lastInitial !== false;
  return state.orders
    .filter((o) => [...WIP_STATUSES, 'estimate', 'ready'].includes(o.status) && (o.status !== 'estimate' || sameDay(o.createdAt, now)) && (o.status !== 'ready' || !o.invoicedAt || now - new Date(o.invoicedAt) < 3 * 86_400_000))
    .map((o) => {
      const c = state.customers.find((x) => x.id === o.customerId);
      const v = state.vehicles.find((x) => x.id === o.vehicleId);
      return { id: o.id, name: lobbyName(c, lastInitial), vehicle: v ? vehicleName(v) : '', status: o.status, label: LOBBY_STATUS[o.status] || '', promisedAt: o.promisedAt, waiting: o.transport === 'waiting' };
    })
    .sort((a, b) => (a.status === 'ready' ? -1 : 0) - (b.status === 'ready' ? -1 : 0) || Number(b.waiting) - Number(a.waiting) || String(a.promisedAt || '9').localeCompare(String(b.promisedAt || '9')));
}

/** Everything the public check-in page needs (no customer data). */
export function checkinConfig(state) {
  const shop = state.shop;
  const ci = { ...FRONT_DESK_DEFAULTS.checkin, ...(shop.frontDesk?.checkin || {}) };
  const cfg = cloudConfig(shop);
  return {
    v: 1,
    shop: { name: shop.name, phone: shop.phone, address: [shop.address, [shop.city, shop.state].filter(Boolean).join(', ')].filter(Boolean).join(', '), hours: shop.hours },
    enabled: Boolean(ci.enabled),
    diagLimit: Number(ci.diagLimit) || 0,
    askKeyTag: ci.askKeyTag !== false,
    afterHours: ci.afterHours,
    terms: ci.terms,
    loaners: (shop.frontDesk?.loaners || []).some((l) => l.active !== false),
    inbox: cfg ? { url: cfg.url, key: cfg.key } : null,
  };
}

/** Link to the public check-in page (published config when the shop's cloud is set up). */
export function checkinLink(state, locationId = null) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const base = `${origin}${import.meta.env?.BASE_URL || '/'}checkin`;
  const cfg = cloudConfig(state.shop);
  const loc = locationId && locationId !== 'all' && locationId !== 'main' ? `&loc=${encodeURIComponent(locationId)}` : '';
  return cfg ? `${base}?from=${encodeURIComponent(publicSiteBase(cfg))}${loc}` : '';
}

const digits = (s) => String(s || '').replace(/\D/g, '').slice(-10);
const words = (s) => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** Find the customer a check-in is from: phone first, then email. */
export function matchCustomer(state, p) {
  const ph = digits(p.phone);
  return (ph.length >= 7 && state.customers.find((c) => digits(c.phone) === ph)) || (p.email && state.customers.find((c) => c.email && c.email.toLowerCase() === String(p.email).toLowerCase())) || null;
}

/** Find the vehicle: plate or VIN anywhere, else one of the customer's vehicles that matches the description. */
export function matchVehicle(state, customer, p) {
  const plate = String(p.plate || '').replace(/\s+/g, '').toUpperCase();
  const vin = String(p.vin || '').toUpperCase();
  if (vin.length === 17) {
    const v = state.vehicles.find((x) => x.vin === vin);
    if (v) return v;
  }
  if (plate.length >= 3) {
    const v = state.vehicles.find((x) => String(x.plate || '').replace(/\s+/g, '').toUpperCase() === plate && (!customer || x.customerId === customer.id));
    if (v) return v;
  }
  if (!customer) return null;
  const mine = state.vehicles.filter((x) => x.customerId === customer.id);
  if (p.vehicleId && mine.some((x) => x.id === p.vehicleId)) return mine.find((x) => x.id === p.vehicleId);
  const want = words(p.vehicle);
  const scored = mine.map((v) => ({ v, score: words(`${v.year} ${v.make} ${v.model}`).filter((w) => want.includes(w)).length })).sort((a, b) => b.score - a.score);
  if (scored[0]?.score >= 2) return scored[0].v;
  return mine.length === 1 && !want.length ? mine[0] : null;
}

/** Parse "2019 Toyota Camry" into year/make/model for a new vehicle record. */
export function parseVehicle(text) {
  const t = String(text || '').trim();
  const m = /^((?:19|20)\d{2})\s+(\S+)\s*(.*)$/.exec(t);
  if (m) return { year: Number(m[1]), make: m[2], model: m[3] || '' };
  const [make = '', ...rest] = t.split(/\s+/);
  return { year: null, make, model: rest.join(' ') };
}
