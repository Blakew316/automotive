// Saving the shop on this device. Every record is stored under its own key in IndexedDB
// (r:<collection>/<id>), with each list's order (o:<collection>) and the shop settings and other
// single values (m:<key>) alongside — so an edit writes a few kilobytes, not the whole shop.
//
// IndexedDB writes are asynchronous and can be cut off when a tab closes, so changes not yet
// confirmed are also written synchronously to a small localStorage journal when the page is
// hidden; the journal is replayed on the next load.
import { readAll, writeMany } from './db';

const JOURNAL = 'autoshop-pro:journal';
const isList = (v) => Array.isArray(v) && v.every((x) => x && typeof x === 'object' && x.id != null);

/** IndexedDB entries ({key: value | undefined to delete}) that turn `prev` into `next`. */
export function entriesBetween(prev, next) {
  const out = {};
  for (const k of new Set([...Object.keys(prev || {}), ...Object.keys(next || {})])) {
    const a = prev?.[k];
    const b = next?.[k];
    if (a === b) continue;
    if (isList(b)) {
      const before = new Map(isList(a) ? a.map((x) => [String(x.id), x]) : []);
      const ids = [];
      for (const x of b) {
        const id = String(x.id);
        ids.push(id);
        if (before.get(id) !== x) out[`r:${k}/${id}`] = x;
        before.delete(id);
      }
      for (const id of before.keys()) out[`r:${k}/${id}`] = undefined;
      const prevIds = isList(a) ? a.map((x) => String(x.id)) : null;
      if (!prevIds || prevIds.length !== ids.length || prevIds.some((id, i) => id !== ids[i])) out[`o:${k}`] = ids;
      if (a !== undefined && !isList(a)) out[`m:${k}`] = undefined;
    } else {
      if (isList(a)) {
        for (const x of a) out[`r:${k}/${x.id}`] = undefined;
        out[`o:${k}`] = undefined;
      }
      out[`m:${k}`] = b;
    }
  }
  return out;
}

function readJournal() {
  try {
    return JSON.parse(localStorage.getItem(JOURNAL)) || null;
  } catch {
    return null;
  }
}

/** Drop journal entries that IndexedDB now holds (so an old copy never overrides a newer save). */
function pruneJournal(keys) {
  const j = readJournal();
  if (!j) return;
  for (const k of keys) {
    delete j.set?.[k];
    if (j.del) j.del = j.del.filter((x) => x !== k);
  }
  try {
    if (!Object.keys(j.set || {}).length && !(j.del || []).length) localStorage.removeItem(JOURNAL);
    else localStorage.setItem(JOURNAL, JSON.stringify(j));
  } catch {
    // Left as is; replaying it is harmless.
  }
}

/** The saved shop, or null if this device has none. */
export async function loadSaved() {
  const all = await readAll();
  const journal = readJournal();
  if (journal) {
    // Changes saved as a tab closed: fold them into IndexedDB now.
    const fix = { ...(journal.set || {}) };
    for (const k of journal.del || []) fix[k] = undefined;
    for (const [k, v] of Object.entries(fix)) {
      if (v === undefined) delete all[k];
      else all[k] = v;
    }
    await writeMany(fix).then(
      () => localStorage.removeItem(JOURNAL),
      () => {},
    );
  }
  const keys = Object.keys(all);
  if (!keys.some((k) => k.startsWith('o:') || k.startsWith('m:'))) return { state: null, sync: all.sync || null, journal };
  const state = {};
  const records = new Map();
  for (const k of keys) {
    if (k.startsWith('m:')) state[k.slice(2)] = all[k];
    else if (k.startsWith('r:')) records.set(k.slice(2), all[k]);
  }
  for (const k of keys) {
    if (!k.startsWith('o:')) continue;
    const c = k.slice(2);
    state[c] = (all[k] || []).map((id) => records.get(`${c}/${id}`)).filter(Boolean);
  }
  return { state, sync: all.sync || null, journal };
}

/** Writes saves in the background; call `flush` on every change and `journal` when the page hides. */
export function createSaver(initial) {
  let saved = initial; // what IndexedDB holds (null = nothing yet)
  const queue = {}; // entries not yet confirmed written
  let writing = null;

  const take = (next) => {
    Object.assign(queue, entriesBetween(saved, next));
    saved = next;
  };

  async function write() {
    if (writing) return writing;
    const batch = { ...queue };
    if (!Object.keys(batch).length) return;
    writing = writeMany(batch)
      .then(() => {
        for (const [k, v] of Object.entries(batch)) if (queue[k] === v) delete queue[k];
        pruneJournal(Object.keys(batch).filter((k) => !(k in queue)));
      })
      .finally(() => {
        writing = null;
      });
    await writing;
    if (Object.keys(queue).length) await write();
  }

  return {
    flush(next) {
      take(next);
      return write().catch(() => {});
    },
    /** Synchronous safety copy of unsaved changes for a closing tab (plus any extra keys, e.g. sync state). */
    journal(next, extra = {}) {
      take(next);
      Object.assign(queue, extra);
      const set = {};
      const del = [];
      for (const [k, v] of Object.entries(queue)) {
        if (v === undefined) del.push(k);
        else set[k] = v;
      }
      if (!del.length && !Object.keys(set).length) return;
      try {
        const prior = readJournal();
        localStorage.setItem(JOURNAL, JSON.stringify({ set: { ...(prior?.set || {}), ...set }, del: [...new Set([...(prior?.del || []), ...del])] }));
      } catch {
        // Too big for the journal: the IndexedDB write below usually still completes.
      }
      write().catch(() => {});
    },
  };
}
