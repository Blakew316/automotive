// Keeps customers' live status pages current: whenever a tracked repair order changes in a way the
// page shows, the signed-in device republishes it (and records what it published, so other devices
// sharing the shop's data don't publish it again).
import { useEffect, useRef } from 'react';
import { useShop, useSync } from '../store/hooks';
import { trackFingerprint, trackPayload, publishTrack } from './tracker';

const KEEP_AFTER_CLOSE = 3 * 86_400_000;

export function useTracking() {
  const { state, updateOrder } = useShop();
  const sync = useSync();
  const latest = useRef(state);
  const busy = useRef(new Set());
  const cfg = sync?.cfg;
  const staff = Boolean(sync?.staff);

  useEffect(() => {
    latest.current = state;
  });

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
    }, 1500);
    return () => clearTimeout(t);
  }, [state.orders, state.customers, state.vehicles, staff, cfg, updateOrder]);
}
