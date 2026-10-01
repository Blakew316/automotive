// Keeps this device's copy of the shop in step with the cloud.
//
//  - Local edits are noted as pending and pushed in batches. Each push says which version of the
//    record the edit was based on; if someone else changed it first, the server sends their copy
//    back and the two edits are merged (see merge.js) and pushed again.
//  - Remote changes arrive live (realtime) and by polling, and are applied unless this device has
//    newer unpushed edits to the same record, in which case they are merged.
//  - A manifest of every record's version is checked now and then so nothing is ever missed.
//  - Pending edits survive reloads and going offline.
import { merge3, mergeCounters, same } from './merge';
import { META, keyOf, splitKey, lookup, recordsOf } from './records';

const PUSH_DELAY = 700;
const BATCH = 200;
const PULL_OVERLAP = 200;
const POLL_LIVE = 60_000;
const POLL_FALLBACK = 15_000;
const RECONCILE_EVERY = 10 * 60_000;

export class SyncEngine {
  constructor(opts) {
    this.o = opts;
    const m = opts.meta || {};
    // bases: for each record with unsent edits, the copy it had before the first of them — the
    // common ancestor for merging if someone else changed it meanwhile (kept across reloads).
    this.meta = { cursor: m.cursor || 0, versions: { ...(m.versions || {}) }, pending: { ...(m.pending || {}) }, bases: { ...(m.bases || {}) }, lastSync: m.lastSync || null };
    this.base = new Map();
    this.status = { phase: 'idle', pending: Object.keys(this.meta.pending).length, lastSync: this.meta.lastSync, live: false, error: '' };
    this.timers = {};
    this.stopped = false;
    this.pushing = null;
    this.pulling = null;
  }

  // ---------------------------------------------------------------- lifecycle
  start() {
    this.stopped = false;
    this.started = true;
    this.unsub = this.o.api.subscribe?.(
      (rows) => this.ingest(rows),
      (live) => this.setStatus({ live }),
    );
    this.syncAll();
    this.schedulePoll();
    this.timers.reconcile = setInterval(() => this.reconcile().catch(() => {}), RECONCILE_EVERY);
    this.onOnline = () => this.syncAll();
    this.onVisible = () => document.visibilityState === 'visible' && this.syncAll();
    window.addEventListener('online', this.onOnline);
    document.addEventListener('visibilitychange', this.onVisible);
  }

  stop() {
    this.stopped = true;
    this.started = false;
    Object.values(this.timers).forEach((t) => {
      clearTimeout(t);
      clearInterval(t);
    });
    this.timers = {};
    this.unsub?.();
    window.removeEventListener('online', this.onOnline);
    document.removeEventListener('visibilitychange', this.onVisible);
  }

  schedulePoll() {
    clearTimeout(this.timers.poll);
    if (this.stopped) return;
    this.timers.poll = setTimeout(async () => {
      // Retry anything that couldn't be sent earlier (offline, signed out), then fetch.
      if (Object.keys(this.meta.pending).length) await this.push().catch(() => {});
      await this.pull().catch(() => {});
      this.schedulePoll();
    }, this.status.live ? POLL_LIVE : POLL_FALLBACK);
  }

  async syncAll() {
    try {
      await this.push();
      await this.reconcile();
    } catch {
      // Status already shows the problem; the next poll retries.
    }
  }

  setStatus(patch) {
    this.status = { ...this.status, ...patch, pending: Object.keys(this.meta.pending).length };
    this.o.onStatus?.(this.status);
  }

  save() {
    clearTimeout(this.timers.save);
    this.timers.save = setTimeout(() => this.o.saveMeta?.({ ...this.meta }), 300);
  }

  fail(e) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const auth = e?.status === 401 || e?.status === 403 || /sign in|JWT|not staff|staff only/i.test(e?.message || '');
    this.setStatus({ phase: offline ? 'offline' : auth ? 'signed-out' : 'error', error: e?.message || 'Sync failed' });
  }

  // ---------------------------------------------------------------- local changes
  /** Called by the store for every local change: [[collection, id, now, before], …]. */
  noteLocal(changes) {
    if (!changes.length) return;
    for (const [c, id, , before] of changes) {
      const key = keyOf(c, id);
      if (!this.meta.pending[key] && this.meta.versions[key] != null && !(key in this.meta.bases)) this.meta.bases[key] = before ?? null;
      this.meta.pending[key] = true;
    }
    this.setStatus({});
    this.save();
    // Signed out or not started: the edits wait (and survive reloads) until sync resumes.
    if (!this.started) return;
    clearTimeout(this.timers.push);
    this.timers.push = setTimeout(() => this.push().catch(() => {}), PUSH_DELAY);
  }

  /** Mark every record on this device as needing upload (first device to switch on sync). */
  markAllPending() {
    for (const [c, id] of recordsOf(this.o.getState())) this.meta.pending[keyOf(c, id)] = true;
    this.save();
    this.setStatus({});
  }

  push() {
    if (this.pushing) {
      this.pushAgain = true;
      return this.pushing;
    }
    this.pushing = (async () => {
      try {
        do {
          this.pushAgain = false;
          await this.pushPending();
        } while (this.pushAgain && !this.stopped);
      } finally {
        this.pushing = null;
      }
    })();
    return this.pushing;
  }

  async pushPending() {
    let rounds = 0;
    while (!this.stopped) {
      const keys = Object.keys(this.meta.pending);
      if (!keys.length) break;
      if (++rounds > 1000) break;
      this.setStatus({ phase: 'syncing' });
      const state = this.o.getState();
      const batch = [];
      for (const key of keys.slice(0, BATCH)) {
        const [c, id] = splitKey(key);
        const data = lookup(state, c, id);
        const base = this.meta.versions[key] ?? null;
        // Created and removed before it ever reached the cloud: nothing to send.
        if (data == null && base == null) {
          delete this.meta.pending[key];
          continue;
        }
        batch.push({ key, c, id, data, base });
      }
      if (!batch.length) continue;
      let res;
      try {
        res = await this.o.api.push(
          batch.map((b) => ({ collection: b.c, id: b.id, data: b.data ?? undefined, deleted: b.data == null, base: b.base })),
          this.o.getActor?.() || null,
          this.o.device || null,
        );
      } catch (e) {
        this.fail(e);
        throw e;
      }
      const byKey = new Map(batch.map((b) => [b.key, b]));
      const now = this.o.getState();
      for (const a of res.applied || []) {
        const key = keyOf(a.collection, a.id);
        const sent = byKey.get(key);
        this.meta.versions[key] = a.version;
        this.base.set(key, sent?.data ?? null);
        // Edited again while the push was in flight → stays pending.
        if (lookup(now, a.collection, a.id) === (sent?.data ?? null)) {
          delete this.meta.pending[key];
          delete this.meta.bases[key];
        } else this.meta.bases[key] = sent?.data ?? null;
      }
      for (const row of res.conflicts || []) this.resolve(row);
      this.meta.lastSync = new Date().toISOString();
      this.save();
    }
    this.setStatus({ phase: 'idle', error: '', lastSync: this.meta.lastSync });
  }

  // ---------------------------------------------------------------- remote changes
  /** Merge the cloud copy of a record with this device's pending edit. */
  resolve(row) {
    const key = keyOf(row.collection, row.id);
    const local = lookup(this.o.getState(), row.collection, row.id);
    const remote = row.deleted ? null : row.data;
    const base = key in this.meta.bases ? this.meta.bases[key] : this.base.has(key) ? this.base.get(key) : undefined;
    this.meta.versions[key] = row.version;
    this.base.set(key, remote);
    const settle = () => {
      delete this.meta.pending[key];
      delete this.meta.bases[key];
    };
    if (remote == null) {
      // Removed there. Removed here too → done; edited here → keep the edit (pushed again).
      if (local == null) settle();
      else this.meta.bases[key] = null;
      return;
    }
    if (local == null) {
      // Removed here but changed there: keep their copy rather than lose their work.
      this.o.apply([[row.collection, row.id, remote]]);
      settle();
      return;
    }
    const merged = row.collection === META && row.id === 'counters' ? mergeCounters(local, remote) : merge3(base, local, remote);
    if (same(merged, remote)) {
      this.o.apply([[row.collection, row.id, remote]]);
      settle();
    } else {
      if (!same(merged, local)) this.o.apply([[row.collection, row.id, merged]]);
      // The cloud copy is now the common ancestor for the merged edit.
      this.meta.bases[key] = remote;
      this.meta.pending[key] = true;
    }
  }

  /** Apply rows from the cloud (pull, realtime, manifest repair). */
  ingest(rows) {
    if (!rows?.length) return;
    const apply = [];
    let changed = false;
    for (const row of rows) {
      const key = keyOf(row.collection, row.id);
      if ((this.meta.versions[key] ?? 0) >= row.version) continue;
      changed = true;
      if (this.meta.pending[key]) {
        this.resolve(row);
        continue;
      }
      const data = row.deleted ? null : row.data;
      if (row.collection === META && row.id === 'counters' && data) {
        const local = lookup(this.o.getState(), META, 'counters');
        const merged = mergeCounters(local || {}, data);
        apply.push([META, 'counters', merged]);
        if (!same(merged, data)) this.meta.pending[key] = true;
      } else apply.push([row.collection, row.id, data]);
      this.meta.versions[key] = row.version;
      this.base.set(key, data);
    }
    if (apply.length) this.o.apply(apply);
    if (changed) {
      this.o.afterRemote?.();
      this.meta.lastSync = new Date().toISOString();
      this.save();
      this.setStatus({ lastSync: this.meta.lastSync });
      if (Object.keys(this.meta.pending).length) this.push().catch(() => {});
    }
  }

  pull() {
    if (this.pulling) return this.pulling;
    this.pulling = (async () => {
      try {
        let since = Math.max(0, (this.meta.cursor || 0) - PULL_OVERLAP);
        for (let i = 0; i < 1000 && !this.stopped; i++) {
          const res = await this.o.api.pull(since, 1000);
          this.ingest(res.rows || []);
          if ((res.last_seq || 0) > (this.meta.cursor || 0)) this.meta.cursor = res.last_seq;
          if (!res.rows?.length || res.rows.length < 1000) break;
          since = res.last_seq;
        }
        this.meta.lastSync = new Date().toISOString();
        this.save();
        this.setStatus({ phase: this.status.phase === 'syncing' ? 'syncing' : 'idle', error: '', lastSync: this.meta.lastSync });
      } catch (e) {
        this.fail(e);
        throw e;
      } finally {
        this.pulling = null;
      }
    })();
    return this.pulling;
  }

  /** Compare every record's version with the cloud and fetch whatever is behind. */
  async reconcile() {
    let m;
    try {
      m = await this.o.api.manifest();
    } catch (e) {
      this.fail(e);
      throw e;
    }
    const behind = [];
    const remote = new Set();
    for (const [c, id, v] of m.records || []) {
      const key = keyOf(c, id);
      remote.add(key);
      if ((this.meta.versions[key] ?? 0) < v) behind.push([c, id]);
    }
    // Records here the cloud has never seen (created offline before a reload) go up.
    for (const [c, id] of recordsOf(this.o.getState())) {
      const key = keyOf(c, id);
      if (!remote.has(key) && this.meta.versions[key] == null) this.meta.pending[key] = true;
    }
    for (let i = 0; i < behind.length; i += 300) this.ingest(await this.o.api.get(behind.slice(i, i + 300)));
    if ((m.head || 0) > (this.meta.cursor || 0)) this.meta.cursor = m.head;
    this.meta.lastSync = new Date().toISOString();
    this.save();
    this.setStatus({ phase: 'idle', error: '', lastSync: this.meta.lastSync });
    if (Object.keys(this.meta.pending).length) await this.push();
  }
}

/** Download the whole shop: every live row, oldest first. */
export async function downloadAll(api, onProgress = () => {}) {
  const rows = [];
  let since = 0;
  let head = 0;
  for (let i = 0; i < 10000; i++) {
    const res = await api.pull(since, 1000);
    rows.push(...(res.rows || []));
    head = Math.max(head, res.head || 0, res.last_seq || 0);
    onProgress(rows.length);
    if (!res.rows?.length || res.rows.length < 1000) break;
    since = res.last_seq;
  }
  const versions = {};
  for (const r of rows) versions[keyOf(r.collection, r.id)] = r.version;
  return { rows, versions, cursor: head };
}
