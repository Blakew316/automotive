// Keeps customers' public pages current: live status pages for repair orders and fleet portals for
// business accounts. Whenever something a page shows changes, the signed-in device republishes it
// (and records what it published, so other devices sharing the shop's data don't publish it again).
import { useEffect, useRef, useState } from 'react';
import { useShop, useSync } from '../store/hooks';
import { trackFingerprint, trackPayload, publishTrack } from './tracker';
import { portalFingerprint, portalPayload, publishPortal } from './fleetPortal';

const KEEP_AFTER_CLOSE = 3 * 86_400_000;

export function useTracking() {
  const { state, updateOrder, saveAccount } = useShop();
  const sync = useSync();
  const latest = useRef(state);
  const busy = useRef(new Set());
  const cfg = sync?.cfg;
  const staff = Boolean(sync?.staff);
  // Hourly check so day-based countdowns (PM due dates, days past due) roll over without an edit.
  const [hour, setHour] = useState(0);

  useEffect(() => {
    latest.current = state;
  });
  useEffect(() => {
    const t = setInterval(() => setHour((h) => h + 1), 3_600_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!staff || !cfg) return undefined;
    const t = setTimeout(async () => {
      const s = latest.current;
      const now = Date.now();
      for (const o of s.orders) {
        const tr = o.track;
        if (!tr?.id || tr.off || busy.current.has(o.id)) continue;
        if (o.status === 'closed' && o.closedAt && now - new Date(o.closedAt).getTime() > KEEP_AFTER_CLOSE) continue;
        const fp = trackFingerprint(s, o);
        if (fp === tr.fp) continue;
        busy.current.add(o.id);
        try {
          await publishTrack(cfg, tr.id, trackPayload(s, o));
          updateOrder(o.id, (cur) => ({ track: { ...cur.track, fp, publishedAt: new Date().toISOString() } }));
        } catch {
          // Offline: the next change retries.
        } finally {
          busy.current.delete(o.id);
        }
      }
      for (const c of s.customers) {
        const portal = c.account?.portal;
        if (!portal?.id || portal.off || busy.current.has(c.id)) continue;
        const at = new Date();
        const fp = portalFingerprint(s, c, cfg, at);
        if (fp === portal.fp) continue;
        busy.current.add(c.id);
        try {
          await publishPortal(cfg, portal.id, portalPayload(s, c, cfg, at));
          saveAccount(c.id, { portal: { ...portal, fp, publishedAt: at.toISOString() } });
        } catch {
          // Offline: the next change retries.
        } finally {
          busy.current.delete(c.id);
        }
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [state.orders, state.customers, state.vehicles, staff, cfg, updateOrder, saveAccount, hour]);
}
