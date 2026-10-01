// How the shop's state maps onto synced records. Every top-level list (orders, customers …) is a
// collection of records keyed by id; the shop settings and counters are single records in `meta`.

export const META = 'meta';
export const SINGLETONS = ['shop', 'counters'];
const SKIP = new Set(['version', 'seededAt']);
// Lists the app keeps newest-first (new records go at the top).
const NEWEST_FIRST = new Set(['activity', 'bookingRequests', 'campaigns', 'customers', 'expenses', 'inventory', 'purchaseOrders', 'vehicles']);

export const keyOf = (collection, id) => `${collection}/${id}`;
export const splitKey = (key) => {
  const i = key.indexOf('/');
  return [key.slice(0, i), key.slice(i + 1)];
};

/** Names of the list collections in a state. */
export function collectionsOf(state) {
  return Object.keys(state || {}).filter((k) => !SKIP.has(k) && Array.isArray(state[k]));
}

/** The current value of one record, or null if it doesn't exist. */
export function lookup(state, collection, id) {
  if (collection === META) return SINGLETONS.includes(id) ? (state?.[id] ?? null) : null;
  const list = state?.[collection];
  if (!Array.isArray(list)) return null;
  return list.find((x) => x?.id === id) ?? null;
}

/** Every record in a state as [collection, id, data]. */
export function* recordsOf(state) {
  for (const k of SINGLETONS) if (state?.[k] != null) yield [META, k, state[k]];
  for (const c of collectionsOf(state)) for (const x of state[c]) if (x && x.id != null) yield [c, String(x.id), x];
}

/**
 * Records that differ between two states, as [collection, id, now, before]. The store shares
 * unchanged objects between versions, so a changed record is simply one whose object is new.
 */
export function diffStates(prev, next) {
  const out = [];
  for (const k of SINGLETONS) if (prev?.[k] !== next?.[k]) out.push([META, k, next?.[k] ?? null, prev?.[k] ?? null]);
  const names = new Set([...collectionsOf(prev), ...collectionsOf(next)]);
  for (const c of names) {
    const a = prev?.[c] || [];
    const b = next?.[c] || [];
    if (a === b) continue;
    const before = new Map();
    for (const x of a) if (x && x.id != null) before.set(String(x.id), x);
    for (const x of b) {
      if (!x || x.id == null) continue;
      const id = String(x.id);
      const was = before.get(id);
      if (was !== x) out.push([c, id, x, was ?? null]);
      before.delete(id);
    }
    for (const [id, was] of before) out.push([c, id, null, was]);
  }
  return out;
}

/**
 * Write records into a state draft (Immer) — `data: null` removes the record. New list records go
 * where the app would have put them (top of newest-first lists, end of the others).
 */
export function applyToDraft(draft, changes) {
  const index = new Map();
  const indexOf = (c) => {
    if (!index.has(c)) {
      const m = new Map();
      (draft[c] || []).forEach((x, i) => x && x.id != null && m.set(String(x.id), i));
      index.set(c, m);
    }
    return index.get(c);
  };
  const removed = new Map();
  for (const [c, id, data] of changes) {
    if (c === META) {
      if (SINGLETONS.includes(id) && data) draft[id] = data;
      continue;
    }
    if (!Array.isArray(draft[c])) draft[c] = [];
    const at = indexOf(c).get(id);
    if (data == null) {
      if (at !== undefined) {
        if (!removed.has(c)) removed.set(c, new Set());
        removed.get(c).add(id);
      }
      continue;
    }
    if (at !== undefined) draft[c][at] = data;
    else if (NEWEST_FIRST.has(c)) {
      draft[c].unshift(data);
      index.delete(c);
    } else {
      draft[c].push(data);
      indexOf(c).set(id, draft[c].length - 1);
    }
  }
  for (const [c, ids] of removed) draft[c] = draft[c].filter((x) => !(x && ids.has(String(x.id))));
}

const time = (x) => x.createdAt || x.at || x.start || x.date || '';
/** Put a downloaded collection in the order the app expects. */
export function sortCollection(c, list) {
  const num = (x) => Number(x.number) || 0;
  // Repair orders are appended (oldest first); purchase orders are added at the top.
  if (c === 'orders') return list.sort((a, b) => num(a) - num(b));
  if (c === 'purchaseOrders') return list.sort((a, b) => num(b) - num(a));
  if (NEWEST_FIRST.has(c)) return list.sort((a, b) => String(time(b)).localeCompare(String(time(a))));
  if (['appointments', 'timeEntries', 'messages'].includes(c)) return list.sort((a, b) => String(time(a)).localeCompare(String(time(b))));
  return list;
}

/** Build a whole state from downloaded rows (oldest change first). */
export function stateFromRows(rows, skeleton) {
  const state = { ...skeleton };
  for (const k of collectionsOf(skeleton)) state[k] = [];
  const lists = {};
  for (const r of rows) {
    if (r.deleted || !r.data) continue;
    if (r.collection === META) {
      if (SINGLETONS.includes(r.id)) state[r.id] = r.data;
      continue;
    }
    (lists[r.collection] ||= new Map()).set(r.id, r.data);
  }
  for (const [c, m] of Object.entries(lists)) state[c] = sortCollection(c, [...m.values()]);
  return state;
}
