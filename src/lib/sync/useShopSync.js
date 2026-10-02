// Shared shop data for the store: decides when this device syncs with the cloud, runs the sync
// engine and file sync, and offers the "first device uploads, other devices join" flows.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SyncEngine, downloadAll } from './engine';
import { syncApi, shopAdmin, mfaOk } from './api';
import { startMediaSync } from './mediaSync';
import { stateFromRows, recordsOf, keyOf, lookup } from './records';
import { same } from './merge';
import { cloudConfig, cloudSession, isStaffSession } from '../cloudShare';
import { writeKey } from '../db';

const DEVICE_KEY = 'autoshop-pro:device';

function guessDeviceName() {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const kind = /iPad|Macintosh.*Mobile|Tablet/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Android phone' : 'Android tablet') : /CrOS/.test(ua) ? 'Chromebook' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows PC' : 'Computer';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return browser ? `${kind} · ${browser}` : kind;
}

function readDevice() {
  try {
    const d = JSON.parse(localStorage.getItem(DEVICE_KEY));
    if (d?.id) return d;
  } catch {
    // New device.
  }
  const d = { id: crypto.randomUUID?.() || String(Math.random()).slice(2), name: guessDeviceName() };
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(d));
  } catch {
    // Name is regenerated next time.
  }
  return d;
}

const EMPTY = { cursor: 0, versions: {}, pending: {}, bases: {}, lastSync: null };

export function useShopSync({ stateRef, cloud, commit, update, applyRemote, syncRef, syncMetaRef, bootSync, migrate, actor }) {
  const [conf, setConf] = useState(() => ({ enabled: Boolean(bootSync?.enabled), url: bootSync?.url || null, joinedAt: bootSync?.joinedAt || null }));
  const confRef = useRef(conf);
  const metaRef = useRef(bootSync ? { cursor: bootSync.cursor || 0, versions: bootSync.versions || {}, pending: bootSync.pending || {}, bases: bootSync.bases || {}, lastSync: bootSync.lastSync || null } : { ...EMPTY });
  const [status, setStatus] = useState({ phase: 'idle', pending: Object.keys(metaRef.current.pending).length, lastSync: metaRef.current.lastSync, live: false, error: '' });
  const [session, setSession] = useState(cloudSession);
  const [device, setDevice] = useState(readDevice);
  const [cloudHasData, setCloudHasData] = useState(null);
  const [cloudError, setCloudError] = useState('');
  const [checkTick, setCheckTick] = useState(0);
  const actorRef = useRef(actor);
  const deviceRef = useRef(device);
  const mediaRef = useRef(null);

  useEffect(() => {
    actorRef.current = actor;
    deviceRef.current = device;
    // Lets the store save sync state synchronously when the tab closes.
    if (syncMetaRef) syncMetaRef.current = () => ({ ...confRef.current, ...(syncRef.current ? syncRef.current.meta : metaRef.current) });
  });

  useEffect(() => {
    const on = () => setSession(cloudSession());
    window.addEventListener('autoshop:session', on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener('autoshop:session', on);
      window.removeEventListener('storage', on);
    };
  }, []);

  const cfg = useMemo(() => cloudConfig({ cloud }), [cloud]);
  const signedIn = Boolean(cfg && session && session.url === cfg.url);
  // The owner can require two-step sign-in for a role: someone in it who's signed in without it
  // (set before the rule changed) is asked to set it up rather than silently losing the shop's data.
  const [twoStepNeeded, setTwoStepNeeded] = useState(false);
  const sessionToken = session?.access;
  useEffect(() => {
    if (!signedIn || !isStaffSession(session)) return undefined;
    let alive = true;
    mfaOk(cfg)
      .then((ok) => alive && setTwoStepNeeded(ok === false))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // Checked again whenever the session's token changes (sign-in, hourly refresh).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, sessionToken, cfg]);
  const staff = signedIn && isStaffSession(session) && !twoStepNeeded;
  const active = Boolean(conf.enabled && cfg && conf.url === cfg.url);

  const persist = useCallback((meta = metaRef.current) => {
    metaRef.current = meta;
    writeKey('sync', { ...confRef.current, ...meta }).catch(() => {});
  }, []);

  const setConfig = useCallback(
    (next) => {
      confRef.current = next;
      setConf(next);
      persist();
    },
    [persist],
  );

  /** Two devices that created a repair order (or PO) offline can pick the same number; renumber the later one. */
  const fixNumberClashes = useCallback(() => {
    const s = stateRef.current;
    for (const [col, counter] of [
      ['orders', 'order'],
      ['purchaseOrders', 'po'],
    ]) {
      const groups = new Map();
      for (const x of s[col] || []) {
        const n = Number(x.number);
        if (!n) continue;
        if (!groups.has(n)) groups.set(n, []);
        groups.get(n).push(x);
      }
      const clashes = [...groups.values()].filter((g) => g.length > 1);
      if (!clashes.length) continue;
      update((d) => {
        let max = Math.max(Number(d.counters?.[counter]) || 0, ...d[col].map((x) => Number(x.number) || 0));
        for (const g of clashes) {
          // Same rule on every device, so they all agree: the earliest keeps its number.
          const ordered = [...g].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || String(a.id).localeCompare(String(b.id)));
          for (const x of ordered.slice(1)) {
            const rec = d[col].find((y) => y.id === x.id);
            if (rec) rec.number = ++max;
          }
        }
        d.counters = { ...(d.counters || {}), [counter]: max };
      });
    }
  }, [stateRef, update]);

  // The engine exists while sync is on; it only talks to the cloud while a staff member is signed in.
  useEffect(() => {
    if (!active) {
      syncRef.current = null;
      return undefined;
    }
    const engine = new SyncEngine({
      api: syncApi(cfg),
      meta: metaRef.current,
      getState: () => stateRef.current,
      apply: applyRemote,
      saveMeta: (m) => persist(m),
      onStatus: setStatus,
      getActor: () => actorRef.current,
      device: deviceRef.current.name,
      afterRemote: fixNumberClashes,
    });
    syncRef.current = engine;
    if (staff) {
      engine.start();
      mediaRef.current = startMediaSync({ cfg, getState: () => stateRef.current, update });
      // Once a day, trim change history older than six months.
      try {
        const last = Number(localStorage.getItem('autoshop-pro:pruned') || 0);
        if (Date.now() - last > 86_400_000) {
          localStorage.setItem('autoshop-pro:pruned', String(Date.now()));
          shopAdmin(cfg, 'prune').catch(() => {});
        }
      } catch {
        // Skipped this time.
      }
    } else {
      engine.setStatus({ phase: signedIn ? 'not-staff' : 'signed-out' });
    }
    return () => {
      engine.stop();
      mediaRef.current?.stop();
      mediaRef.current = null;
      persist({ ...engine.meta });
      if (syncRef.current === engine) syncRef.current = null;
    };
    // cfg is derived from the url/key below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, staff, signedIn, cfg?.url, cfg?.key]);

  // Signed in on a device that isn't syncing yet: does the cloud already hold this shop?
  useEffect(() => {
    if (!staff || active) return undefined;
    let alive = true;
    syncApi(cfg)
      .count()
      .then((n) => {
        if (!alive) return;
        setCloudHasData(n > 0);
        setCloudError('');
      })
      .catch((e) => {
        if (!alive) return;
        setCloudHasData(null);
        setCloudError(e.message || 'Couldn’t reach the cloud');
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, active, cfg?.url, checkTick]);

  /** First device: this device's data becomes the shop's shared data. */
  const upload = useCallback(async () => {
    const n = await syncApi(cfg).count();
    if (n > 0) throw new Error('The cloud already has this shop’s data — load it on this device instead.');
    const pending = {};
    for (const [c, id] of recordsOf(stateRef.current)) pending[keyOf(c, id)] = true;
    metaRef.current = { ...EMPTY, pending };
    setConfig({ enabled: true, url: cfg.url, joinedAt: new Date().toISOString() });
  }, [cfg, stateRef, setConfig]);

  /** Other devices: replace this device's data with the shop's shared data. */
  const join = useCallback(
    async (onProgress = () => {}) => {
      const { rows, versions, cursor } = await downloadAll(syncApi(cfg), onProgress);
      const live = rows.filter((r) => !r.deleted);
      if (!live.length) throw new Error('The cloud doesn’t have any shop data yet.');
      const skeleton = { version: 2, seededAt: new Date().toISOString(), shop: {}, counters: {} };
      for (const c of new Set(rows.map((r) => r.collection))) if (c !== 'meta') skeleton[c] = [];
      for (const c of Object.keys(stateRef.current)) if (Array.isArray(stateRef.current[c])) skeleton[c] = [];
      const raw = stateFromRows(rows, skeleton);
      const next = migrate(structuredClone(raw));
      // Defaults filled in by this version of the app go back up.
      const pending = {};
      for (const [c, id, data] of recordsOf(next)) if (!same(data, lookup(raw, c, id))) pending[keyOf(c, id)] = true;
      metaRef.current = { cursor, versions, pending, bases: {}, lastSync: new Date().toISOString() };
      commit(next, { remote: true });
      setConfig({ enabled: true, url: cfg.url, joinedAt: new Date().toISOString() });
      setCloudHasData(true);
    },
    [cfg, stateRef, migrate, commit, setConfig],
  );

  /** Stop syncing on this device (its copy stays). */
  const leave = useCallback(() => {
    metaRef.current = { ...EMPTY };
    setConfig({ enabled: false, url: null, joinedAt: null });
    setStatus({ phase: 'idle', pending: 0, lastSync: null, live: false, error: '' });
  }, [setConfig]);

  const syncNow = useCallback(() => syncRef.current?.syncAll(), [syncRef]);

  const renameDevice = useCallback((name) => {
    const d = { ...deviceRef.current, name: name.trim() || guessDeviceName() };
    try {
      localStorage.setItem(DEVICE_KEY, JSON.stringify(d));
    } catch {
      // Kept for this session.
    }
    setDevice(d);
  }, []);

  return useMemo(
    () => ({
      cfg,
      enabled: active,
      joinedAt: conf.joinedAt,
      signedIn,
      staff,
      twoStepNeeded: signedIn && twoStepNeeded,
      session,
      status,
      device,
      cloudHasData,
      cloudError,
      recheck: () => setCloudHasData(null) || setCloudError('') || setCheckTick((n) => n + 1),
      upload,
      join,
      leave,
      syncNow,
      renameDevice,
      kickMedia: () => mediaRef.current?.kick(),
    }),
    [cfg, active, conf.joinedAt, signedIn, staff, twoStepNeeded, session, status, device, cloudHasData, cloudError, upload, join, leave, syncNow, renameDevice],
  );
}
