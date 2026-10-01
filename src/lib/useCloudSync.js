// Keeps the shop in sync with its Shop Cloud while a staff member is signed in on this device:
// pulls booking requests, online approvals and customer messages from the inbox, and republishes
// the booking page's open times whenever the calendar changes.
import { useEffect, useRef, useState } from 'react';
import { useShop } from '../store/hooks';
import { cloudConfig, cloudSession, fetchInbox, clearInbox, publishBooking } from './cloudShare';
import { bookingConfig } from './booking';

const POLL_MS = 60000;

export function useCloudSync() {
  const shop = useShop();
  const { state } = shop;
  const cfg = cloudConfig(state.shop);
  const signedIn = Boolean(cfg && cloudSession()?.url === cfg.url);
  const [status, setStatus] = useState({ at: null, error: '' });
  const latest = useRef(shop);
  const busy = useRef(false);

  useEffect(() => {
    latest.current = shop;
  });

  // ---------------------------------------------------------------- Inbox
  useEffect(() => {
    if (!signedIn) return undefined;
    let alive = true;
    const run = async () => {
      if (busy.current || document.visibilityState === 'hidden') return;
      busy.current = true;
      try {
        const rows = await fetchInbox(cfg);
        if (!alive) return;
        const done = applyInbox(rows, latest.current);
        await clearInbox(cfg, done);
        if (alive) setStatus({ at: new Date().toISOString(), error: '' });
      } catch (e) {
        if (alive) setStatus({ at: new Date().toISOString(), error: e.message || 'Sync failed' });
      } finally {
        busy.current = false;
      }
    };
    run();
    const t = setInterval(run, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // cfg is derived from shop settings; re-run only when the connection itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, cfg?.url, cfg?.key]);

  // ---------------------------------------------------------------- Booking page open times
  const published = state.shop.booking?.published;
  const bookingOn = state.shop.booking?.enabled;
  const fingerprint = signedIn && published && bookingOn ? JSON.stringify({ ...bookingConfig(state, { includeBusy: true, includeSite: true }), publishedAt: null }) : '';
  const lastFingerprint = useRef('');
  useEffect(() => {
    if (!fingerprint) return undefined;
    if (!lastFingerprint.current) {
      // First render after load: assume what's published is current until something changes.
      lastFingerprint.current = fingerprint;
      return undefined;
    }
    if (fingerprint === lastFingerprint.current) return undefined;
    const t = setTimeout(async () => {
      try {
        await publishBooking(cfg, bookingConfig(latest.current.state, { includeBusy: true, includeSite: true }));
        lastFingerprint.current = fingerprint;
      } catch {
        // Next change retries.
      }
    }, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  return { enabled: signedIn, ...status };
}

/** Turn inbox rows into bookings, approvals and messages. Returns the ids that were handled. */
function applyInbox(rows, { state, addBookingRequests, authorize, addMessage, selectTire }) {
  const handled = [];
  const bookings = [];
  for (const row of rows) {
    const p = row.payload || {};
    if (row.kind === 'booking') {
      if (p.name && p.start) {
        bookings.push({
          remoteId: row.id,
          source: 'online',
          createdAt: row.created_at || p.at,
          name: String(p.name).slice(0, 120),
          phone: String(p.phone || '').slice(0, 40),
          email: String(p.email || '').slice(0, 120),
          vehicle: String(p.vehicle || '').slice(0, 120),
          vin: '',
          services: Array.isArray(p.services) ? p.services.map((x) => String(x).slice(0, 120)).slice(0, 12) : [],
          start: new Date(p.start).toISOString(),
          duration: Math.min(480, Math.max(30, Number(p.duration) || 60)),
          notes: String(p.notes || '').slice(0, 1000),
          customerId: null,
        });
      }
      handled.push(row.id);
      continue;
    }
    // Approvals and messages refer to a share link; match it to the repair order.
    const order = row.ref && state.orders.find((o) => o.share?.id === row.ref);
    if (!order) {
      handled.push(row.id);
      continue;
    }
    if (row.kind === 'approval') {
      const decisions = p.decisions || {};
      const pending = new Set(order.services.filter((s) => s.status === 'pending').map((s) => s.id));
      const serviceIds = Object.keys(decisions).filter((id) => decisions[id] === 'approved' && pending.has(id));
      const declineIds = Object.keys(decisions).filter((id) => decisions[id] === 'declined' && pending.has(id));
      // Tire picks arrive as `tire:<serviceId>` → option id.
      for (const k of Object.keys(decisions)) {
        const sid = k.startsWith('tire:') ? k.slice(5) : null;
        const svc = sid && order.services.find((s) => s.id === sid);
        if (svc?.tires?.options.some((o) => o.id === decisions[k])) selectTire(order.id, sid, decisions[k]);
      }
      if (serviceIds.length || declineIds.length) {
        authorize(order.id, { serviceIds, declineIds, method: 'online', by: String(p.name || 'Customer').slice(0, 120), signature: typeof p.signature === 'string' && p.signature.startsWith('data:image/') ? p.signature : null, note: 'Approved from the online report' });
        const titles = (ids) => order.services.filter((s) => ids.includes(s.id)).map((s) => s.title);
        const parts = [serviceIds.length && `Approved: ${titles(serviceIds).join(', ')}`, declineIds.length && `Declined: ${titles(declineIds).join(', ')}`].filter(Boolean);
        if (order.customerId) addMessage({ customerId: order.customerId, orderId: order.id, dir: 'in', channel: 'portal', body: `${parts.join('. ')}. — signed ${p.name || ''}`.trim(), at: row.created_at });
      }
    } else if (row.kind === 'message' && p.text && order.customerId) {
      addMessage({ customerId: order.customerId, orderId: order.id, dir: 'in', channel: 'portal', body: String(p.text).slice(0, 2000), at: row.created_at });
    }
    handled.push(row.id);
  }
  if (bookings.length) addBookingRequests(bookings);
  return handled;
}
