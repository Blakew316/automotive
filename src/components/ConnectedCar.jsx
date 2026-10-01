// Vehicle page → Connected car: text the owner a link to connect their car (Smartcar), then see its
// odometer, oil life, tire pressures, fuel and battery here. Reading the car also updates the
// vehicle's mileage and feeds the oil-change reminders in Marketing.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, RefreshCw, Unplug, Send, Gauge, Droplet, Fuel, BatteryCharging, AlertTriangle, Copy } from 'lucide-react';
import { useShop, useSync, useAccess, useUI } from '../store/hooks';
import { Card, CardHeader, Spinner } from './ui';
import ComposeModal from './Compose';
import { shopCars } from '../lib/sync/api';
import { connectMessage, vehiclePatch, tireList, readingAlerts, LOW_TIRE_PSI, LOW_OIL_PCT } from '../lib/connectedCars';
import { number, relTime, vehicleName } from '../lib/format';

const STALE_MS = 12 * 3600_000;

export default function ConnectedCar({ vehicle: v, owner }) {
  const { state, saveVehicle } = useShop();
  const sync = useSync();
  const { role } = useAccess();
  const { toast } = useUI();
  const cfg = sync?.cfg;
  const staff = Boolean(sync?.staff && cfg);
  const manager = ['owner', 'manager'].includes(role);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState('');
  const [problem, setProblem] = useState('');
  const [compose, setCompose] = useState(null);
  const [link, setLink] = useState('');
  const latest = useRef(v);
  latest.current = v;

  const car = status?.cars?.[0] || null;
  const snap = v.connected;

  const apply = (c) => saveVehicle(vehiclePatch(latest.current, c));

  useEffect(() => {
    if (!staff) return undefined;
    let alive = true;
    shopCars(cfg, 'status', { vehicleIds: [v.id] })
      .then((st) => {
        if (!alive) return;
        setStatus(st);
        const c = st.cars?.[0];
        // Keep the vehicle record in step with the server: connected by the customer from the
        // link, or disconnected from another device.
        if (c && (!latest.current.connected || c.readAt !== latest.current.connected.readAt)) apply(c);
        if (!c && latest.current.connected) saveVehicle({ id: latest.current.id, connected: null });
      })
      .catch(() => alive && setStatus({ error: true }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, cfg, v.id]);

  const read = async (quiet = false) => {
    setBusy('read');
    setProblem('');
    try {
      const c = await shopCars(cfg, 'read', { vehicleId: v.id });
      apply(c);
      setStatus((s) => ({ ...s, cars: [c] }));
      if (!quiet) toast('Readings updated', { tone: 'success' });
    } catch (e) {
      setProblem(e.message || 'Couldn’t reach the car');
    } finally {
      setBusy('');
    }
  };

  // Opened a while after the last reading: read again (once).
  const autoRead = useRef(false);
  useEffect(() => {
    if (!car || autoRead.current) return;
    autoRead.current = true;
    if (!car.readAt || Date.now() - new Date(car.readAt).getTime() > STALE_MS) read(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [car]);

  const sendLink = async () => {
    setBusy('link');
    try {
      const r = await shopCars(cfg, 'link', { vehicleId: v.id, vin: v.vin || '', vehicle: vehicleName(v), shop: state.shop.name, mode: state.shop.cars?.mode === 'simulated' ? 'simulated' : 'live' });
      const body = connectMessage(state.shop, owner, v, r.url);
      if (owner && (owner.phone || owner.email)) setCompose({ body });
      else setLink(r.url);
    } catch (e) {
      toast(e.message || 'Couldn’t make a link', { tone: 'error' });
    } finally {
      setBusy('');
    }
  };

  const unlink = async () => {
    if (!window.confirm('Disconnect this car? The shop will stop seeing its readings.')) return;
    setBusy('unlink');
    try {
      await shopCars(cfg, 'unlink', { vehicleId: v.id });
      saveVehicle({ id: v.id, connected: null });
      setStatus((s) => ({ ...s, cars: [] }));
      toast('Car disconnected', { tone: 'success' });
    } catch (e) {
      toast(e.message || 'Couldn’t disconnect', { tone: 'error' });
    } finally {
      setBusy('');
    }
  };

  // Not signed in to Shop Cloud: show the last reading this device has, if any.
  if (!staff) return snap?.reading ? <Readings v={v} reading={snap.reading} readAt={snap.readAt} /> : null;
  if (!status || status.error) return null;
  if (!status.configured)
    return manager ? (
      <Card data-testid="connected-car">
        <CardHeader title="Connected car" icon={Radio} subtitle="Mileage, oil life and tire pressure from the car itself" />
        <p className="px-4 pb-4 text-sm text-ink-2">
          With the owner’s OK, read this car’s odometer, oil life and tire pressures from its maker’s connected services. <Link to="/settings?tab=general#connected-cars" className="link">Set up connected cars</Link>
        </p>
      </Card>
    ) : null;

  const reading = car?.reading || null;
  return (
    <Card data-testid="connected-car">
      <CardHeader
        title="Connected car"
        icon={Radio}
        subtitle={car ? (car.readAt ? `Read ${relTime(car.readAt)}` : 'Connected — not read yet') : 'Not connected'}
        actions={
          car ? (
            <>
              <button className="btn-ghost btn-icon btn-sm" onClick={() => read()} disabled={busy === 'read'} aria-label="Read the car now" title="Read now">
                {busy === 'read' ? <Spinner size={13} /> : <RefreshCw size={14} />}
              </button>
              {manager && (
                <button className="btn-ghost btn-icon btn-sm" onClick={unlink} disabled={busy === 'unlink'} aria-label="Disconnect car" title="Disconnect">
                  <Unplug size={14} />
                </button>
              )}
            </>
          ) : null
        }
      />
      <div className="px-4 pb-4 text-sm">
        {car ? (
          <>
            {problem && (
              <div className="mb-3 rounded-[10px] bg-bad/[0.07] px-3 py-2 text-bad">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <span>{problem}</span>
                </div>
                {/expired|disconnected/i.test(problem) && (
                  <button className="btn-secondary btn-sm mt-2" onClick={sendLink} disabled={busy === 'link'}>
                    <Send size={13} /> Send a new connect link
                  </button>
                )}
              </div>
            )}
            {reading ? <ReadingGrid v={v} reading={reading} /> : <p className="text-ink-3">{busy === 'read' ? 'Reading the car…' : 'No readings yet.'}</p>}
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-ink-2">
              Text {owner?.firstName || 'the owner'} a link to connect this car. They sign in to their car maker’s app account and approve read-only access — then you’ll see its real mileage, oil life and tire pressures here, and oil-change reminders use them.
            </p>
            <button className="btn-secondary btn-sm" onClick={sendLink} disabled={busy === 'link'}>
              {busy === 'link' ? <Spinner size={13} /> : <Send size={13} />} Send connect link
            </button>
            {link && (
              <div className="flex items-center gap-1 rounded-[8px] bg-fill/[0.08] px-2 py-1">
                <code className="min-w-0 flex-1 truncate font-mono text-xs">{link}</code>
                <button className="btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(link).then(() => toast('Link copied'), () => {})} aria-label="Copy link">
                  <Copy size={13} />
                </button>
              </div>
            )}
            {state.shop.cars?.mode === 'simulated' && <p className="text-xs text-warn">Simulated mode: the link connects one of Smartcar’s test cars, not the customer’s.</p>}
            <p className="text-xs text-ink-3">Works with most 2015-and-newer cars whose owner has the maker’s connected-services app; the link is good for 7 days.</p>
          </div>
        )}
      </div>
      {compose && owner && <ComposeModal customer={owner} initialBody={compose.body} channel={owner.phone ? 'sms' : 'email'} subject={`Connect your ${vehicleName(v)}`} onClose={() => setCompose(null)} onSent={() => toast('Connect link sent', { tone: 'success' })} />}
    </Card>
  );
}

function Readings({ v, reading, readAt }) {
  return (
    <Card data-testid="connected-car">
      <CardHeader title="Connected car" icon={Radio} subtitle={readAt ? `Read ${relTime(readAt)}` : 'Connected'} />
      <div className="px-4 pb-4 text-sm">
        <ReadingGrid v={v} reading={reading} />
      </div>
    </Card>
  );
}

function ReadingGrid({ v, reading }) {
  const tires = tireList(reading.tires);
  const alerts = readingAlerts(reading);
  const power = reading.fuel?.percent != null ? { icon: Fuel, label: 'Fuel', ...reading.fuel } : reading.battery?.percent != null ? { icon: BatteryCharging, label: 'Battery', ...reading.battery } : null;
  return (
    <div className="space-y-3" data-testid="car-readings">
      {alerts.length > 0 && (
        <ul className="space-y-1 rounded-[10px] border border-warn/40 bg-warn/[0.07] px-3 py-2">
          {alerts.map((a) => (
            <li key={a} className="flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" />
              {a}
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Tile icon={Gauge} label="Odometer" value={reading.odometer != null ? `${number(reading.odometer)} mi` : '—'} sub={reading.odometer != null && Number(v.mileage) > reading.odometer ? 'Lower than the last RO' : null} />
        <Tile icon={Droplet} label="Oil life" value={reading.oilLife != null ? `${reading.oilLife}%` : '—'} bar={reading.oilLife} low={reading.oilLife != null && reading.oilLife <= LOW_OIL_PCT} />
        {power && <Tile icon={power.icon} label={power.label} value={`${power.percent}%`} sub={power.range != null ? `${number(power.range)} mi range` : null} bar={power.percent} />}
      </div>
      {tires.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-ink-3">Tire pressure (psi)</div>
          <div className="grid grid-cols-2 gap-1.5">
            {tires.map(([k, val]) => (
              <div key={k} className={`flex items-center justify-between rounded-[8px] px-2.5 py-1.5 ${val < LOW_TIRE_PSI ? 'bg-warn/[0.1] text-warn' : 'bg-fill/[0.06]'}`}>
                <span className="text-xs">{k}</span>
                <span className="tabular font-semibold">{Math.round(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-ink-3">Read-only. A reading the car maker doesn’t share for this model shows as —.</p>
    </div>
  );
}

function Tile({ icon, label, value, sub, bar, low }) {
  const Icon = icon;
  return (
    <div className="rounded-[10px] bg-fill/[0.06] px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-ink-3">
        <Icon size={13} /> {label}
      </div>
      <div className={`tabular text-base font-semibold ${low ? 'text-warn' : ''}`}>{value}</div>
      {typeof bar === 'number' && (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fill/[0.12]">
          <div className={`h-full rounded-full ${low ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${Math.max(2, Math.min(100, bar))}%` }} />
        </div>
      )}
      {sub && <div className="text-2xs text-ink-3">{sub}</div>}
    </div>
  );
}
