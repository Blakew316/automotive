// Email from the shop's own address on this device, while a staff member is signed in and the
// shop's Resend account is set up (Settings → Messaging → Email):
//  - sends customer emails (with PDF estimates, invoices and receipts) and logs them to the
//    conversation;
//  - marks each email delivered, opened, bounced or marked as spam as Resend reports it (Realtime,
//    polling as a fallback), and flags a customer whose address bounced;
//  - keeps today's numbers current for the owner's daily summary email.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShop, useSync, useAccess } from '../store/hooks';
import { EmailContext } from '../store/context';
import { shopEmail, emailEvents, clearEmailEvents, subscribeTable, digestSnapshot } from '../lib/sync/api';
import { EMAIL_RANK } from '../lib/email';

export default function EmailLine({ children }) {
  const shop = useShop();
  const sync = useSync();
  const { role } = useAccess();
  const cfg = sync?.cfg;
  const staff = Boolean(sync?.staff && cfg);
  const [status, setStatus] = useState(null);
  const [rev, setRev] = useState(0);
  const latest = useRef(shop);
  useEffect(() => {
    latest.current = shop;
  });

  useEffect(() => {
    if (!staff) return undefined;
    let alive = true;
    shopEmail(cfg, 'status')
      .then((st) => alive && setStatus(st))
      .catch(() => alive && setStatus(null));
    return () => {
      alive = false;
    };
  }, [staff, cfg, rev]);
  const st = staff ? status : null;
  // Ready once keys are in and Resend says the domain is verified.
  const ready = Boolean(st?.configured && st?.domain?.status === 'verified');

  // ---------------------------------------------------------------- Delivery events
  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    let live = false;
    let busy = false;
    let tick = 0;
    const apply = (rows) => {
      if (!alive || !rows.length) return;
      const { state: cur, updateMessage, saveCustomer } = latest.current;
      for (const r of rows) {
        const m = cur.messages.find((x) => x.meta?.emailId === r.email_id);
        if (!m) continue;
        // A later event never hides a worse one (an "opened" after a bounce stays a bounce).
        updateMessage(m.id, (x) =>
          (EMAIL_RANK[r.kind] ?? 0) >= (EMAIL_RANK[x.meta?.status || 'sent'] ?? 0)
            ? { meta: { ...x.meta, status: r.kind, statusAt: r.payload?.at || r.created_at, ...(r.payload?.bounce ? { bounce: r.payload.bounce.message || r.payload.bounce.type } : {}) } }
            : {},
        );
        if (r.kind === 'bounced' || r.kind === 'complained') saveCustomer({ id: m.customerId, emailProblem: r.kind === 'bounced' ? 'bounced' : 'spam' });
      }
      // Events for emails sent from another device are applied there too; either way they're done.
      clearEmailEvents(cfg, rows.map((r) => r.id)).catch(() => {});
    };
    const poll = async () => {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        apply((await emailEvents(cfg)) || []);
      } catch {
        // Offline: the next poll retries.
      } finally {
        busy = false;
      }
    };
    poll();
    const unsubscribe = subscribeTable(cfg, 'shop_email_events', (row) => apply([row]), (on) => (live = on));
    const t = setInterval(() => {
      tick += 1;
      if (!live || tick % 4 === 0) poll();
    }, 30_000);
    const onVisible = () => document.visibilityState === 'visible' && poll();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ready, cfg]);

  // ---------------------------------------------------------------- Daily summary numbers
  // Owner and manager devices keep today's figures on the server (at most every 10 minutes, and
  // only when they change) so the summary email has them even if nobody's at a computer at send time.
  const sent = useRef('');
  const digestOn = Boolean(st?.digest?.enabled);
  const canDigest = ['owner', 'manager'].includes(role);
  useEffect(() => {
    if (!staff || !digestOn || !canDigest) return undefined;
    let last = 0;
    const push = async () => {
      // The summary's number-crunching loads only on owner and manager devices that need it.
      const mod = await import('../lib/digest').catch(() => null);
      if (!mod) return;
      const { day, data } = mod.digestData(latest.current.state);
      const fp = JSON.stringify([day, data.today, data.inShop, data.estimates, data.receivables, data.tomorrow, data.attention]);
      if (fp === sent.current || Date.now() - last < 10 * 60_000) return;
      last = Date.now();
      digestSnapshot(cfg, day, data)
        .then(() => (sent.current = fp))
        .catch(() => (last = 0));
    };
    const first = setTimeout(push, 8_000);
    const t = setInterval(push, 5 * 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [staff, digestOn, canDigest, cfg]);

  // ---------------------------------------------------------------- Sending
  const send = useCallback(
    async ({ customer, subject, text, orderId = null, attachments = [], kind = 'message', meta }) => {
      const s = latest.current.state.shop;
      const r = await shopEmail(cfg, 'send', {
        to: customer.email,
        subject,
        text,
        attachments: attachments.map((a) => ({ filename: a.filename, content: a.content })),
        kind,
        shop: { name: s.name, phone: s.phone, email: s.email, address: [s.address, [s.city, s.state].filter(Boolean).join(', '), s.zip].filter(Boolean).join(' ') },
      });
      latest.current.addMessage({
        customerId: customer.id,
        orderId,
        dir: 'out',
        channel: 'email',
        body: text,
        meta: { ...(meta || {}), via: 'email', emailId: r.id, status: 'sent', subject, ...(attachments.length ? { attachments: attachments.map((a) => a.filename) } : {}) },
      });
      // A good send clears an old "bounced" flag on the customer.
      if (customer.emailProblem) latest.current.saveCustomer({ id: customer.id, emailProblem: null });
      return r;
    },
    [cfg],
  );

  const value = useMemo(() => ({ status: st, ready, refresh: () => setRev((r) => r + 1), send: ready ? send : null }), [st, ready, send]);
  return <EmailContext.Provider value={value}>{children}</EmailContext.Provider>;
}
