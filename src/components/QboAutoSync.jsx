// Daily QuickBooks Online auto-sync. Once a day, the first owner or manager device that's open
// posts the last week of daily sales journals through yesterday (Accounting → QuickBooks & exports
// → Post automatically). Days already in QuickBooks are only touched if something changed, so
// several devices doing this, or a manual post, never makes duplicates.
import { useEffect, useRef } from 'react';
import { useShop, useSync, useAccess } from '../store/hooks';
import { autoPlan, postJournals, resultLine } from '../lib/quickbooks';

export default function QboAutoSync() {
  const shop = useShop();
  const sync = useSync();
  const { role, user } = useAccess();
  const latest = useRef(shop);
  useEffect(() => {
    latest.current = shop;
  });
  const qbo = shop.state.shop.qbo;
  const on = Boolean(sync?.staff && sync?.cfg && ['owner', 'manager'].includes(role) && qbo?.auto);
  const today = new Date().toDateString();
  const due = on && qbo?.lastAuto?.day !== today;
  const cfg = sync?.cfg;

  useEffect(() => {
    if (!due) return undefined;
    let alive = true;
    // Give the shop's data a moment to sync in first.
    const t = setTimeout(async () => {
      const { state } = latest.current;
      if (!alive || state.shop.qbo?.lastAuto?.day === today) return;
      const plan = autoPlan(state);
      const record = (patch) => latest.current.updateShop({ qbo: { ...latest.current.state.shop.qbo, lastAuto: { day: today, at: new Date().toISOString(), by: user.name, ...patch } } });
      if (plan.missing.length) {
        record({ ok: false, summary: `Choose QuickBooks accounts for ${plan.missing.join(', ')}` });
        return;
      }
      if (!plan.journals.length) {
        record({ ok: true, summary: 'Nothing new to post' });
        return;
      }
      try {
        const r = await postJournals(cfg, plan.journals, state.shop.qbo.map);
        if (!alive) return;
        const first = r.results.find((x) => x.status === 'error');
        record({ ok: !r.errors, summary: resultLine(r), error: first ? `${first.no}: ${first.error}` : undefined });
      } catch (e) {
        // Not connected or offline: say so on the Accounting screen and try again tomorrow.
        if (alive) record({ ok: false, summary: e.message || 'Couldn’t reach QuickBooks' });
      }
    }, 20_000);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [due, cfg, today, user.name]);

  return null;
}
