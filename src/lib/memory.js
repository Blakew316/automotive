// Labor & parts memory: what this shop actually spent on a job before. For a service on a repair
// order, it finds the same job done earlier — on the same model first, then the same make, then any
// vehicle — and reports the labor hours it took and the parts that went into it, with what they
// cost and where they came from. Everything comes from the shop's own repair orders.

// Filler words that don't change which job it is.
const STOP = new Set(['and', 'the', 'a', 'an', 'of', 'to', 'for', 'with', 'on', 'in', 'replace', 'replacement', 'service', 'inspect', 'inspection', 'check', 'pair', 'both']);

const words = (t) =>
  String(t || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w));

function similar(a, b) {
  const x = new Set(words(a));
  const y = new Set(words(b));
  if (!x.size || !y.size) return 0;
  // Front/rear must agree when either side says which.
  for (const side of ['front', 'rear']) if (x.has(side) !== y.has(side) && (x.has(side) || y.has(side))) return 0;
  let both = 0;
  for (const w of x) if (y.has(w)) both += 1;
  return both / (x.size + y.size - both);
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Past work like `service` (by title), most specific vehicle match first.
 * Returns null when the shop hasn't done it before.
 */
export function jobMemory(state, { title, orderId, serviceId, vehicle }) {
  if (!words(title).length) return null;
  const vById = new Map(state.vehicles.map((v) => [v.id, v]));
  const past = [];
  for (const o of state.orders) {
    // Work on this same repair order isn't history yet.
    if (o.id === orderId) continue;
    for (const s of o.services) {
      if (s.id === serviceId || s.status === 'declined' || !s.items?.length) continue;
      if (!['approved'].includes(s.status) && !s.done && !['ready', 'closed'].includes(o.status)) continue;
      const score = similar(title, s.title);
      if (score < 0.6) continue;
      const v = vById.get(o.vehicleId);
      const hours = s.items.filter((i) => i.type === 'labor').reduce((t, i) => t + (Number(i.hours) || 0), 0);
      past.push({ order: o, service: s, vehicle: v, hours, score, at: o.invoicedAt || o.createdAt });
    }
  }
  if (!past.length) return null;
  const same = (p, level) => {
    if (!vehicle || !p.vehicle) return level === 'any';
    if (level === 'model') return p.vehicle.make === vehicle.make && p.vehicle.model === vehicle.model && (!vehicle.engine || !p.vehicle.engine || p.vehicle.engine === vehicle.engine);
    if (level === 'make') return p.vehicle.make === vehicle.make;
    return true;
  };
  let level = 'any';
  let pool = past;
  for (const l of ['model', 'make']) {
    const m = past.filter((p) => same(p, l));
    if (m.length) {
      level = l;
      pool = m;
      break;
    }
  }
  pool.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const timed = pool.filter((p) => p.hours > 0);
  const hours = timed.map((p) => p.hours);

  // Parts that went into the job, most often used first, with the latest cost and vendor.
  const parts = new Map();
  for (const p of pool) {
    for (const i of p.service.items) {
      if (i.type !== 'part') continue;
      const key = (i.partNumber || i.description || '').trim().toLowerCase();
      if (!key) continue;
      const cur = parts.get(key) || { description: i.description, partNumber: i.partNumber || '', brand: i.brand || '', qty: Number(i.qty) || 1, cost: Number(i.cost) || 0, vendor: i.vendor || '', uses: 0, at: '' };
      cur.uses += 1;
      if (String(p.at) > cur.at) Object.assign(cur, { at: String(p.at), cost: Number(i.cost) || cur.cost, qty: Number(i.qty) || cur.qty, vendor: i.vendor || cur.vendor, brand: i.brand || cur.brand });
      parts.set(key, cur);
    }
  }
  const scope = level === 'model' && vehicle ? `${vehicle.make} ${vehicle.model}` : level === 'make' && vehicle ? vehicle.make : 'all vehicles';
  return {
    count: pool.length,
    scope,
    level,
    hours: hours.length ? { usual: round1(median(hours)), min: round1(Math.min(...hours)), max: round1(Math.max(...hours)), count: hours.length } : null,
    parts: [...parts.values()].sort((a, b) => b.uses - a.uses || b.at.localeCompare(a.at)).slice(0, 6),
    last: { ro: pool[0].order.number, orderId: pool[0].order.id, at: pool[0].at, total: null },
  };
}
