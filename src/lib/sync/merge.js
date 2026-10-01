// Merging two edits of the same record. `base` is the version both edits started from (undefined
// when it isn't known), `mine` the edit on this device and `theirs` the copy in the cloud. A field
// changed on only one side keeps that change; when both sides changed the same field, this device's
// edit wins. Lists of items with ids (services, line items, payments, notes …) merge item by item,
// so two people adding lines to the same repair order both keep their lines.

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
// A list of records with ids (an empty list counts, so a first line added on each side merges).
const isIdList = (v) => Array.isArray(v) && v.every((x) => isObj(x) && (typeof x.id === 'string' || typeof x.id === 'number'));

/** Structural equality for JSON-like values. */
export function same(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!same(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  const ka = Object.keys(a).filter((k) => a[k] !== undefined);
  const kb = Object.keys(b).filter((k) => b[k] !== undefined);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!same(a[k], b[k])) return false;
  return true;
}

function mergeValue(base, mine, theirs, known) {
  if (same(mine, theirs)) return mine;
  if (known) {
    if (same(mine, base)) return theirs;
    if (same(theirs, base)) return mine;
  }
  if (isObj(mine) && isObj(theirs)) return mergeObject(isObj(base) ? base : undefined, mine, theirs, known && isObj(base));
  if (isIdList(mine) && isIdList(theirs)) return mergeList(isIdList(base) ? base : undefined, mine, theirs, known && isIdList(base));
  return mine;
}

function mergeObject(base, mine, theirs, known) {
  const out = {};
  const keys = new Set([...Object.keys(theirs), ...Object.keys(mine)]);
  for (const k of keys) {
    const inMine = mine[k] !== undefined;
    const inTheirs = theirs[k] !== undefined;
    const inBase = known && base[k] !== undefined;
    if (!inMine) {
      // Removed here and untouched there → stays removed. Otherwise keep their value.
      if (inBase && same(base[k], theirs[k])) continue;
      out[k] = theirs[k];
      continue;
    }
    if (!inTheirs) {
      if (inBase && same(base[k], mine[k])) continue;
      out[k] = mine[k];
      continue;
    }
    out[k] = mergeValue(inBase ? base[k] : undefined, mine[k], theirs[k], known);
  }
  return out;
}

function mergeList(base, mine, theirs, known) {
  const b = new Map((base || []).filter(isObj).map((x) => [x.id, x]));
  const m = new Map(mine.map((x) => [x.id, x]));
  const t = new Map(theirs.map((x) => [x.id, x]));
  // This device's order first; items only they have go right after the item before them in their list.
  const order = mine.map((x) => x.id);
  let last = -1;
  for (const x of theirs) {
    const at = order.indexOf(x.id);
    if (at >= 0) last = at;
    else order.splice(++last, 0, x.id);
  }
  const out = [];
  for (const id of order) {
    const mi = m.get(id);
    const ti = t.get(id);
    const bi = b.get(id);
    if (mi && ti) out.push(mergeValue(bi, mi, ti, known && Boolean(bi)));
    else if (mi) {
      // They removed it: drop it unless it was changed here.
      if (known && bi && same(bi, mi)) continue;
      out.push(mi);
    } else if (ti) {
      if (known && bi && same(bi, ti)) continue;
      out.push(ti);
    }
  }
  return out;
}

/** Merge a record edited on this device (`mine`) with the cloud copy (`theirs`). */
export function merge3(base, mine, theirs) {
  if (mine == null) return theirs;
  if (theirs == null) return mine;
  return mergeValue(base, mine, theirs, base !== undefined && base !== null);
}

/** Counters only ever move up: take the larger value of each. */
export function mergeCounters(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(Number(out[k]) || 0, Number(v) || 0);
  return out;
}
