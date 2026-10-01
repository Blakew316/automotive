// Keeps the shop in sync with its Shop Cloud while a staff member is signed in on this device:
// pulls booking requests, online approvals and customer messages (from report links, the booking
// page and the shop's website) from the inbox, and republishes
// the booking page's open times whenever the calendar changes.
import { useEffect, useRef, useState } from 'react';
import { useShop } from '../store/hooks';
import { cloudConfig, cloudSession, fetchInbox, clearInbox, publishBooking, publishPublicJson, isStaffSession } from './cloudShare';
import { bookingConfig } from './booking';
import { checkinConfig } from './operations';

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
  const staff = signedIn && isStaffSession(cloudSession());

  // First staff sign-in with booking on: publish the booking page and website so their links work.
  useEffect(() => {
    if (!staff || !bookingOn || published) return;
    let alive = true;
    publishBooking(cfg, bookingConfig(latest.current.state, { includeBusy: true }))
      .then(() => {
        if (alive) latest.current.updateShop({ booking: { ...latest.current.state.shop.booking, published: new Date().toISOString() } });
      })
      .catch(() => {
        // Settings → Online booking → Publish retries with the error shown.
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, bookingOn, published, cfg?.url]);
  const fingerprint = signedIn && published && bookingOn ? JSON.stringify({ ...bookingConfig(state, { includeBusy: true }), publishedAt: null }) : '';
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
        await publishBooking(cfg, bookingConfig(latest.current.state, { includeBusy: true }));
        lastFingerprint.current = fingerprint;
      } catch {
        // Next change retries.
      }
    }, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  // ---------------------------------------------------------------- Self check-in page
  // Publishes site/checkin.json whenever what the page shows changes; the fingerprint is saved with
  // the shop's settings so other signed-in devices don't publish it again.
  const checkinFp = staff ? JSON.stringify(checkinConfig(state)) : '';
  const savedFp = state.shop.frontDesk?.checkin?.fp;
  useEffect(() => {
    if (!checkinFp || checkinFp === savedFp) return undefined;
    const t = setTimeout(async () => {
      try {
        await publishPublicJson(cfg, 'site/checkin.json', checkinConfig(latest.current.state), 60);
        const fd = latest.current.state.shop.frontDesk;
        latest.current.updateShop({ frontDesk: { ...fd, checkin: { ...fd.checkin, fp: checkinFp, published: new Date().toISOString() } } });
      } catch {
        // Next change (or sign-in) retries.
      }
    }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkinFp, savedFp]);

  return { enabled: signedIn, ...status };
}

/** Turn inbox rows into bookings, approvals and messages. Returns the ids that were handled. */
function applyInbox(rows, { state, addBookingRequests, authorize, addMessage, addWebsiteMessage, addCheckin, selectTire }) {
  const handled = [];
  const bookings = [];
  for (const row of rows) {
    const p = row.payload || {};
    if (row.kind === 'booking') {
      if (p.name && p.start) {
        bookings.push({
          remoteId: row.id,
          source: p.source === 'website' || p.source === 'phone' ? p.source : 'online',
          window: (p.source === 'website' || p.source === 'phone') && ['Morning', 'Midday', 'Afternoon', 'Flexible'].includes(p.window) ? p.window : null,
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
    // Self check-in and key drop.
    if (row.kind === 'checkin') {
      if ((p.name || p.phone) && (p.vehicle || p.plate || p.vin)) addCheckin(row);
      handled.push(row.id);
      continue;
    }
    // Contact and fleet forms on the shop's website.
    if (row.kind === 'message' && !row.ref && p.source === 'website') {
      const text = String(p.text || '').trim().slice(0, 2000);
      if (p.name && text && (p.phone || p.email)) {
        addWebsiteMessage({
          remoteId: row.id,
          name: String(p.name).slice(0, 120),
          phone: String(p.phone || '').slice(0, 40),
          email: String(p.email || '').slice(0, 120),
          company: String(p.company || '').slice(0, 120),
          body: p.form === 'fleet' ? `Fleet inquiry\n${text}` : text,
          at: row.created_at,
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
