// Online card payments on this device, while a staff member is signed in and the shop's Stripe
// account is connected (Settings → Payments & financing):
//  - records payments and refunds on the repair order as Stripe reports them (Realtime, with
//    polling as the fallback), with a "payment received" notice;
//  - makes pay links on demand, and keeps one ready for every live status page with a balance;
//  - refunds online payments;
//  - charges cards on the shop's Stripe card readers from the RO.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShop, useSync, useUI } from '../store/hooks';
import { PayContext } from '../store/context';
import { shopPay, payEvents, clearPayEvents, subscribeTable } from '../lib/sync/api';
import { openPayLink, payPageBase, projectRef } from '../lib/payments';
import { orderTotals } from '../lib/pricing';
import { shopAt } from '../lib/locations';
import { money, vehicleName } from '../lib/format';

const balanceOf = (state, o) => Math.max(0, orderTotals(o, shopAt(state.shop, o.locationId)).balance);

export default function PayLine({ children }) {
  const shop = useShop();
  const { state } = shop;
  const sync = useSync();
  const { toast } = useUI();
  const cfg = sync?.cfg;
  const staff = Boolean(sync?.staff && cfg);
  const [status, setStatus] = useState(null);
  const [rev, setRev] = useState(0);
  const latest = useRef(shop);
  const pending = useRef(new Map());
  useEffect(() => {
    latest.current = shop;
  });

  useEffect(() => {
    if (!staff) return undefined;
    let alive = true;
    shopPay(cfg, 'status')
      .then((st) => alive && setStatus(st))
      .catch(() => alive && setStatus(null));
    return () => {
      alive = false;
    };
  }, [staff, cfg, rev]);
  const st = staff ? status : null;
  const ready = Boolean(st?.configured && st?.connected);

  // ---------------------------------------------------------------- Payments and refunds from Stripe
  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    let live = false;
    let busy = false;
    let tick = 0;
    const apply = (rows) => {
      if (!alive || !rows.length) return;
      const before = latest.current.state.orders;
      const done = latest.current.applyPayEvents(rows);
      if (done?.length) clearPayEvents(cfg, done).catch(() => {});
      for (const r of rows) {
        if (r.kind !== 'payment') continue;
        const o = before.find((x) => x.id === r.payload?.orderId);
        if (o && !o.payments.some((x) => x.stripe?.pi === r.payload.paymentIntent)) toast(`Payment received — ${money(r.payload.amount)} for RO #${o.number}`, { tone: 'success' });
      }
    };
    const poll = async () => {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        apply((await payEvents(cfg)) || []);
      } catch {
        // Offline: the next poll retries.
      } finally {
        busy = false;
      }
    };
    poll();
    const unsubscribe = subscribeTable(cfg, 'shop_pay_events', (row) => apply([row]), (on) => (live = on));
    const t = setInterval(() => {
      tick += 1;
      if (!live || tick % 4 === 0) poll();
    }, 20_000);
    const onVisible = () => document.visibilityState === 'visible' && poll();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ready, cfg, toast]);

  // ---------------------------------------------------------------- Pay links
  const ensureLink = useCallback(
    async (order) => {
      const s = latest.current.state;
      const o = s.orders.find((x) => x.id === order.id) || order;
      const balance = balanceOf(s, o);
      const have = openPayLink(o, balance);
      if (have) return have;
      if (pending.current.has(o.id)) return pending.current.get(o.id);
      const c = s.customers.find((x) => x.id === o.customerId);
      const v = s.vehicles.find((x) => x.id === o.vehicleId);
      const site = shopAt(s.shop, o.locationId);
      const job = shopPay(cfg, 'link', {
        orderId: o.id,
        roNumber: o.number,
        amount: Math.round(balance * 100) / 100,
        title: `RO #${o.number}${v ? ` — ${vehicleName(v)}` : ''}`,
        shopName: site.name,
        shopPhone: site.phone,
        email: c?.email || '',
        returnBase: payPageBase(),
        returnQuery: projectRef(cfg) ? `p=${projectRef(cfg)}` : '',
      })
        .then((r) => {
          const link = { id: r.id, url: r.url, amount: r.amount, status: 'open', test: r.mode === 'test', createdAt: new Date().toISOString() };
          latest.current.updateOrder(o.id, { payLink: link });
          return link;
        })
        .finally(() => pending.current.delete(o.id));
      pending.current.set(o.id, job);
      return job;
    },
    [cfg],
  );

  // A live status page with a balance always offers a working pay link.
  const needLinks = ready
    ? state.orders
        .filter((o) => o.track?.id && !o.track.off && o.status === 'ready' && balanceOf(state, o) >= 0.5 && !openPayLink(o, balanceOf(state, o)))
        .map((o) => o.id)
        .join(',')
    : '';
  useEffect(() => {
    if (!needLinks) return undefined;
    const t = setTimeout(async () => {
      for (const id of needLinks.split(',')) {
        const o = latest.current.state.orders.find((x) => x.id === id);
        if (o) await ensureLink(o).catch(() => {});
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [needLinks, ensureLink]);

  const refund = useCallback(
    async ({ order, payment, amount }) => {
      const r = await shopPay(cfg, 'refund', { paymentIntent: payment.stripe.pi, amount, nonce: `${payment.id}-${Date.now()}` });
      latest.current.addPayment(order.id, { method: 'Refund', amount: -r.amount, tip: 0, surcharge: 0, ref: 'Stripe refund', stripe: { pi: payment.stripe.pi, refund: true, id: r.id } });
      return r;
    },
    [cfg],
  );

  // ---------------------------------------------------------------- Card readers (Stripe Terminal)
  // The counter sends the amount to a reader, the customer taps or inserts, and the payment lands on
  // the RO as soon as the reader approves it (the webhook records it too, in case this screen closes).
  const readers = useMemo(() => (ready ? st?.terminal?.readers || [] : []), [ready, st]);
  const sessionEmail = sync?.session?.email;
  const reader = useMemo(
    () => ({
      charge: ({ order, readerId, amount, tip = 0, surcharge = 0 }) => shopPay(cfg, 'readerCharge', { readerId, orderId: order.id, roNumber: order.number, amount, tip, surcharge, shopName: latest.current.state.shop.name, by: sessionEmail || '' }),
      check: async (readerId, paymentIntent) => {
        const r = await shopPay(cfg, 'readerCheck', { readerId, paymentIntent });
        if (r.status === 'succeeded' && r.payment) latest.current.applyPayEvents([{ kind: 'payment', payload: r.payment, created_at: new Date().toISOString() }]);
        return r;
      },
      cancel: (readerId, paymentIntent) => shopPay(cfg, 'readerCancel', { readerId, paymentIntent }),
      simulate: (readerId) => shopPay(cfg, 'readerSimulate', { readerId }),
    }),
    [cfg, sessionEmail],
  );

  const value = useMemo(
    () => ({ status: st, ready, refresh: () => setRev((n) => n + 1), ensureLink: ready ? ensureLink : null, refund: ready ? refund : null, readers, reader: ready && readers.length ? reader : null }),
    [st, ready, ensureLink, refund, readers, reader],
  );
  return <PayContext.Provider value={value}>{children}</PayContext.Provider>;
}
