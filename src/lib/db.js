// Shop data on this device, in IndexedDB (no 5 MB limit like localStorage). Each top-level part of
// the shop (orders, customers, shop settings …) is stored under its own key, so a save only writes
// the parts that changed.
const DB_NAME = 'autoshop-data';
const STORE = 'kv';

let dbPromise = null;
function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Could not open shop storage'));
      req.onblocked = () => reject(new Error('Shop storage is busy in another tab'));
    }).catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

function run(mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const out = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(out && 'result' in out ? out.result : out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error || new Error('Storage quota exceeded'));
      }),
  );
}

/** All stored keys and values as an object. */
export function readAll() {
  return run('readonly', (s) => {
    const out = {};
    const req = s.openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return;
      out[c.key] = c.value;
      c.continue();
    };
    return { get result() { return out; } };
  });
}

/** Write several keys in one transaction; `undefined` values delete the key. */
export function writeMany(entries) {
  return run('readwrite', (s) => {
    for (const [k, v] of Object.entries(entries)) {
      if (v === undefined) s.delete(k);
      else s.put(v, k);
    }
  });
}

export const readKey = (key) => run('readonly', (s) => s.get(key));
export const writeKey = (key, value) => writeMany({ [key]: value });

/** Remove everything (used when a device leaves the shop or loads a different shop). */
export const clearAll = () => run('readwrite', (s) => s.clear());
