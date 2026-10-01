// The business phone line on this device, while a staff member is signed in and the shop's Twilio
// number is connected (Settings → Messaging → Business texting & calls):
//  - files incoming texts, delivery receipts, server-sent texts and finished calls into customers'
//    conversations as they happen (Realtime, with polling as the fallback);
//  - pops up who's calling while the phone rings;
//  - keeps the phone server's profile current (hours, receptionist settings, the caller directory);
//  - keeps automatic appointment texts queued on the server in step with the calendar.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { PhoneIncoming, X, User, Wrench, CalendarClock } from 'lucide-react';
import { useShop, useSync } from '../store/hooks';
import { PhoneContext } from '../store/context';
import { Avatar } from './ui';
import { shopPhone, phoneEvents, clearPhoneEvents, subscribePhoneEvents, uploadPrivateJson, scheduleTexts, cancelTexts, scheduledTexts } from '../lib/sync/api';
import { lineSettings, phoneProfile, appointmentTexts, customerByPhone, callMeta, last10 } from '../lib/phone';
import { fullName, vehicleName, phone as fmtPhone, time } from '../lib/format';
import { STATUS } from '../lib/workflow';

const RING_WINDOW = 120_000;

export default function PhoneLine({ children }) {
  const shop = useShop();
  const { state } = shop;
  const sync = useSync();
  const cfg = sync?.cfg;
  const staff = Boolean(sync?.staff && cfg);
  const line = lineSettings(state.shop);
  const [status, setStatus] = useState(null);
  const [rev, setRev] = useState(0);
  const [ringing, setRinging] = useState([]);
  const [dismissed, setDismissed] = useState([]);
  const latest = useRef(shop);
  useEffect(() => {
    latest.current = shop;
  });

  // ---------------------------------------------------------------- Is the line connected?
  useEffect(() => {
    if (!staff) return undefined;
    let alive = true;
    shopPhone(cfg, 'status')
      .then((st) => alive && setStatus(st))
      .catch(() => alive && setStatus(null));
    return () => {
      alive = false;
    };
  }, [staff, cfg, rev]);
  const st = staff ? status : null;
  const connected = Boolean(st?.connected);

  // ---------------------------------------------------------------- Events: texts, receipts, calls
  useEffect(() => {
    if (!connected) return undefined;
    let alive = true;
    let live = false;
    let busy = false;
    let tick = 0;
    const calls = new Map();
    const process = (rows) => {
      if (!alive) return;
      for (const r of rows) if (r.kind === 'call') calls.set(r.sid, r);
      const now = Date.now();
      setRinging([...calls.values()].filter((r) => !r.final && r.payload?.status === 'ringing' && r.payload?.direction !== 'out' && now - new Date(r.created_at).getTime() < RING_WINDOW));
      const finals = rows.filter((r) => r.final);
      if (!finals.length) return;
      const done = latest.current.applyPhoneEvents(finals);
      if (done?.length) clearPhoneEvents(cfg, done).catch(() => {});
      // Someone replied STOP or START: refresh the opt-out list the composer checks.
      if (finals.some((r) => r.kind === 'sms_in' && r.payload?.optOut)) setRev((n) => n + 1);
    };
    const poll = async () => {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        process((await phoneEvents(cfg)) || []);
      } catch {
        // Offline: the next poll retries.
      } finally {
        busy = false;
      }
    };
    poll();
    const unsubscribe = subscribePhoneEvents(cfg, (row) => process([row]), (on) => (live = on));
    // Every 15 s without a live connection; once a minute with one (and to expire old pop-ups).
    const t = setInterval(() => {
      tick += 1;
      if (!live || tick % 4 === 0) poll();
      else process([]);
    }, 15_000);
    const onVisible = () => document.visibilityState === 'visible' && poll();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [connected, cfg]);

  // ---------------------------------------------------------------- Phone server profile
  const profileFp = connected ? JSON.stringify(phoneProfile(state)) : '';
  const lastProfile = useRef('');
  useEffect(() => {
    if (!profileFp || profileFp === lastProfile.current) return undefined;
    const t = setTimeout(async () => {
      try {
        await uploadPrivateJson(cfg, 'phone/profile.json', JSON.parse(profileFp));
        lastProfile.current = profileFp;
      } catch {
        // Next change retries.
      }
    }, lastProfile.current ? 2500 : 300);
    return () => clearTimeout(t);
  }, [profileFp, cfg]);

  // ---------------------------------------------------------------- Automatic appointment texts
  const textsFp = connected ? JSON.stringify(appointmentTexts(state).map((x) => [x.key, x.to_phone, x.body, x.immediate ? 'now' : x.send_at])) : '';
  const lastTexts = useRef('');
  useEffect(() => {
    if (!textsFp || textsFp === lastTexts.current) return undefined;
    const t = setTimeout(async () => {
      try {
        const want = appointmentTexts(latest.current.state).map(({ key, to_phone, body, send_at, meta }) => ({ key, to_phone, body, send_at, meta }));
        if (want.length) await scheduleTexts(cfg, want);
        const keys = new Set(want.map((x) => x.key));
        const stale = ((await scheduledTexts(cfg)) || []).filter((r) => r.status === 'pending' && !keys.has(r.key)).map((r) => r.key);
        if (stale.length) await cancelTexts(cfg, stale);
        lastTexts.current = textsFp;
      } catch {
        // Next change retries.
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [textsFp, cfg]);

  // ---------------------------------------------------------------- Sending & calling
  const optOuts = useMemo(() => new Set((st?.optOuts || []).map(last10)), [st]);
  const send = useCallback(
    async ({ customer, body, orderId = null, meta }) => {
      try {
        const r = await shopPhone(cfg, 'send', { to: customer.phone, body });
        latest.current.addMessage({ id: `msg_tw_${r.sid}`, customerId: customer.id, orderId, dir: 'out', channel: 'sms', body, meta: { ...(meta || {}), sid: r.sid, via: 'line', status: 'sent' } });
        return r;
      } catch (e) {
        if (e.status === 409) latest.current.saveCustomer({ id: customer.id, textOptIn: false });
        throw e;
      }
    },
    [cfg],
  );
  const call = useCallback(
    async ({ customer, ring, orderId = null }) => {
      const r = await shopPhone(cfg, 'call', { to: customer.phone, ring, name: fullName(customer) });
      const meta = callMeta({ direction: 'out', status: 'outgoing', to: customer.phone });
      latest.current.addMessage({ id: `msg_call_${r.sid}`, customerId: customer.id, orderId, dir: 'out', channel: 'call', body: `Called ${fmtPhone(customer.phone)} from the business line`, meta: { sid: r.sid, call: meta } });
      return r;
    },
    [cfg],
  );

  const value = useMemo(
    () => ({
      status: st,
      connected,
      // Texts go out from the business number (otherwise the device's Messages app opens).
      ready: connected && line.enabled !== false,
      optedOut: (p) => optOuts.has(last10(p)),
      refresh: () => setRev((r) => r + 1),
      send,
      call,
      ringPhones: line.forward,
    }),
    [st, connected, line.enabled, line.forward, optOuts, send, call],
  );

  const pops = ringing.filter((r) => !dismissed.includes(r.sid));
  return (
    <PhoneContext.Provider value={value}>
      {children}
      {pops.length > 0 &&
        createPortal(
          <div className="no-print fixed right-3 top-3 z-[70] flex w-[min(360px,calc(100vw-24px))] flex-col gap-2" aria-live="assertive">
            {pops.map((r) => (
              <CallPop key={r.sid} row={r} onClose={() => setDismissed((d) => [...d, r.sid])} />
            ))}
          </div>,
          document.body,
        )}
    </PhoneContext.Provider>
  );
}

/** Who's calling — with their vehicle and repair order — while the phone rings. */
function CallPop({ row, onClose }) {
  const { state } = useShop();
  const p = row.payload || {};
  const c = customerByPhone(state, p.from);
  const order = c && state.orders.filter((o) => o.customerId === c.id && o.status !== 'closed').sort((a, b) => b.number - a.number)[0];
  const v = order ? state.vehicles.find((x) => x.id === order.vehicleId) : c && state.vehicles.find((x) => x.customerId === c.id);
  const appt = c && state.appointments.filter((a) => a.customerId === c.id && a.start > new Date().toISOString() && !['cancelled', 'no_show'].includes(a.status)).sort((a, b) => a.start.localeCompare(b.start))[0];
  const name = c ? fullName(c) : p.callerName || 'New caller';
  return (
    <div role="alertdialog" aria-label={`Incoming call from ${name}`} className="animate-slide-in overflow-hidden rounded-[14px] border border-line bg-surface shadow-sheet">
      <div className="flex items-center gap-2 border-b border-line/70 bg-accent/[0.06] px-3.5 py-2 text-xs font-medium text-accent">
        <PhoneIncoming size={14} className="animate-pulse" /> Incoming call · business line
        <button onClick={onClose} className="btn-ghost btn-icon ml-auto h-6 w-6 text-ink-3" aria-label="Dismiss">
          <X size={14} />
        </button>
      </div>
      <div className="flex gap-3 px-3.5 py-3">
        <Avatar person={c || undefined} name={c ? undefined : name} size={38} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{name}</div>
          <div className="text-xs text-ink-3">{fmtPhone(p.from || '') || 'Unknown number'}{c ? '' : ' · not in your customers yet'}</div>
          {v && <div className="mt-1 truncate text-sm">{vehicleName(v)}</div>}
          {order && (
            <div className="truncate text-xs text-ink-2">
              RO #{order.number} · {STATUS[order.status]?.label}
              {order.promisedAt ? ` · promised ${new Date(order.promisedAt).toDateString() === new Date().toDateString() ? time(order.promisedAt) : new Date(order.promisedAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}
            </div>
          )}
          {!order && appt && (
            <div className="flex items-center gap-1 truncate text-xs text-ink-2">
              <CalendarClock size={12} /> Booked {new Date(appt.start).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-1.5 border-t border-line/70 px-3 py-2">
        {c && (
          <Link to={`/customers/${c.id}`} onClick={onClose} className="btn-secondary btn-sm">
            <User size={13} /> Customer
          </Link>
        )}
        {order && (
          <Link to={`/orders/${order.id}`} onClick={onClose} className="btn-primary btn-sm">
            <Wrench size={13} /> RO #{order.number}
          </Link>
        )}
        {!c && <span className="px-1 py-1 text-xs text-ink-3">They’ll be added to Messages after the call.</span>}
      </div>
    </div>
  );
}
