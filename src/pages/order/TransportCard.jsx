// How the customer is getting around while the car is here — waiting, drop-off, shuttle ride,
// loaner (checked out and back in with odometer, fuel and a signed agreement) or a rental — plus
// the details of a self check-in.
import { useState } from 'react';
import { Car, KeyRound, ArrowRightLeft, Fuel, MapPin, CircleAlert } from 'lucide-react';
import { useShop, useUI } from '../../store/hooks';
import { Card, CardHeader, Modal, Field } from '../../components/ui';
import SignaturePad from '../../components/SignaturePad';
import { TRANSPORT, FUEL, availableLoaners } from '../../lib/operations';
import { dateTime, number, time } from '../../lib/format';

const toLocal = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromLocal = (v) => (v ? new Date(v).toISOString() : null);

export default function TransportCard({ order, customer }) {
  const { state, updateOrder } = useShop();
  const [out, setOut] = useState(false);
  const [back, setBack] = useState(false);
  const mode = order.transport || '';
  const loaner = order.loaner;
  const ci = order.checkin;
  const set = (patch) => updateOrder(order.id, patch);
  const leg = (k, patch) => set({ shuttle: { ...(order.shuttle || {}), [k]: { ...(order.shuttle?.[k] || {}), ...patch } } });

  return (
    <Card>
      <CardHeader title="Transportation" icon={Car} subtitle={ci ? `Self check-in · ${dateTime(ci.at)}` : undefined} />
      <div className="space-y-3 px-4 pb-4 text-sm">
        {ci && (
          <div className="flex items-start gap-2 rounded-[8px] bg-fill/[0.06] px-3 py-2 text-xs text-ink-2">
            <KeyRound size={14} className="mt-0.5 shrink-0 text-ink-3" />
            <span>
              Keys {ci.dropoff === 'dropbox' ? 'in the drop box' : 'at the counter'}
              {ci.keyTag ? ` · tag ${ci.keyTag}` : ''} · prefers {ci.contact === 'call' ? 'a call' : ci.contact === 'email' ? 'email' : 'texts'}
              {ci.loaner ? ' · asked for a loaner' : ''} · signed by {ci.by}
            </span>
          </div>
        )}
        <select className="input" value={mode} onChange={(e) => set({ transport: e.target.value || null })} aria-label="Transportation">
          <option value="">Not set</option>
          {Object.entries(TRANSPORT).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {mode === 'loaner' &&
          (loaner?.outAt && !loaner.inAt ? (
            <div className="rounded-[8px] border border-line px-3 py-2.5">
              <div className="font-medium">{loaner.name}</div>
              <div className="text-xs text-ink-3">
                Out {dateTime(loaner.outAt)} · {number(loaner.outMiles)} mi · {loaner.outFuel} tank
              </div>
              <button className="btn-secondary btn-sm mt-2" onClick={() => setBack(true)}>
                <ArrowRightLeft size={13} /> Check loaner back in
              </button>
            </div>
          ) : loaner?.inAt ? (
            <div className="rounded-[8px] border border-line px-3 py-2.5 text-xs text-ink-2">
              <div className="text-sm font-medium text-ink">{loaner.name} — returned</div>
              {number(loaner.inMiles - loaner.outMiles)} mi driven · fuel {loaner.outFuel} → {loaner.inFuel}
              {FUEL.indexOf(loaner.inFuel) < FUEL.indexOf(loaner.outFuel) && <span className="text-warn"> · came back lower</span>}
            </div>
          ) : (
            <button className="btn-primary btn-sm w-full" onClick={() => setOut(true)} disabled={!(state.shop.frontDesk?.loaners || []).length}>
              <KeyRound size={13} /> Check out a loaner
            </button>
          ))}
        {mode === 'loaner' && !(state.shop.frontDesk?.loaners || []).length && <p className="text-xs text-ink-3">Add your loaner cars in Settings → Front desk.</p>}

        {mode === 'shuttle' && (
          <div className="space-y-2">
            {[
              ['dropoff', 'Ride from the shop'],
              ['pickup', 'Pick up back to the shop'],
            ].map(([k, label]) => (
              <div key={k} className="rounded-[8px] border border-line px-3 py-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-ink-2">{label}</span>
                  <label className="flex items-center gap-1.5 text-xs text-ink-3">
                    <input type="checkbox" checked={Boolean(order.shuttle?.[k]?.done)} onChange={(e) => leg(k, { done: e.target.checked })} className="h-3.5 w-3.5" /> Done
                  </label>
                </div>
                <input type="datetime-local" className="input h-8 text-sm" value={toLocal(order.shuttle?.[k]?.at)} onChange={(e) => leg(k, { at: fromLocal(e.target.value) })} aria-label={`${label} time`} />
                <div className="relative mt-1.5">
                  <MapPin size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4" />
                  <input className="input h-8 pl-7 text-sm" placeholder={k === 'dropoff' ? 'Where to (home, work…)' : 'Pick up from'} defaultValue={order.shuttle?.[k]?.address || (customer?.address ? `${customer.address}, ${customer.city || ''}`.trim() : '')} onBlur={(e) => e.target.value !== (order.shuttle?.[k]?.address || '') && leg(k, { address: e.target.value.trim() })} aria-label={`${label} address`} />
                </div>
              </div>
            ))}
          </div>
        )}

        {mode === 'rental' && (
          <input className="input" placeholder="Rental company & reservation #" defaultValue={order.rental?.note || ''} onBlur={(e) => set({ rental: { note: e.target.value.trim() } })} aria-label="Rental details" />
        )}
        {mode === 'waiting' && <p className="text-xs text-ink-3">Shown first on the waiting-room screen{order.promisedAt ? ` · promised ${time(order.promisedAt)}` : ''}.</p>}
      </div>
      {out && <LoanerOut order={order} customer={customer} onClose={() => setOut(false)} />}
      {back && <LoanerIn order={order} onClose={() => setBack(false)} />}
    </Card>
  );
}

function LoanerOut({ order, customer, onClose }) {
  const { state, updateOrder } = useShop();
  const { toast } = useUI();
  const free = availableLoaners(state);
  const [id, setId] = useState(free[0]?.id || '');
  const l = free.find((x) => x.id === id);
  const [miles, setMiles] = useState(() => String(l?.mileage || ''));
  const [fuel, setFuel] = useState(l?.fuel || 'F');
  const [notes, setNotes] = useState('');
  const [signature, setSignature] = useState(null);
  const terms = state.shop.frontDesk?.loanerTerms;
  const save = () => {
    const at = new Date().toISOString();
    updateOrder(order.id, { loaner: { id: l.id, name: l.name, outAt: at, outMiles: Number(String(miles).replace(/\D/g, '')) || 0, outFuel: fuel, notes: notes.trim(), signature, by: [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') } });
    toast(`${l.name} checked out`, { tone: 'success' });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Check out a loaner"
      subtitle={`RO #${order.number}`}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!l || !signature} onClick={save}>Hand over keys</button>
        </>
      }
    >
      {free.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-ink-2"><CircleAlert size={15} className="text-warn" /> Every loaner is out right now.</p>
      ) : (
        <div className="space-y-3">
          <Field label="Loaner">
            {(fid) => (
              <select id={fid} className="input" value={id} onChange={(e) => { setId(e.target.value); const n = free.find((x) => x.id === e.target.value); setMiles(String(n?.mileage || '')); setFuel(n?.fuel || 'F'); }}>
                {free.map((x) => (
                  <option key={x.id} value={x.id}>{x.name}{x.plate ? ` · ${x.plate}` : ''}</option>
                ))}
              </select>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Odometer out">{(fid) => <input id={fid} inputMode="numeric" className="input tabular" value={miles} onChange={(e) => setMiles(e.target.value)} />}</Field>
            <Field label="Fuel out">
              {(fid) => (
                <select id={fid} className="input" value={fuel} onChange={(e) => setFuel(e.target.value)}>
                  {FUEL.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <Field label="Existing damage / notes">{(fid) => <input id={fid} className="input" placeholder="e.g. small scratch rear bumper" value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
          {terms && <p className="rounded-[8px] bg-fill/[0.06] px-3 py-2 text-xs text-ink-2">{terms}</p>}
          <SignaturePad onChange={setSignature} label="Customer signs here" height={120} />
        </div>
      )}
    </Modal>
  );
}

function LoanerIn({ order, onClose }) {
  const { state, updateOrder, updateShop } = useShop();
  const { toast } = useUI();
  const l = order.loaner;
  const [miles, setMiles] = useState(String(l.outMiles || ''));
  const [fuel, setFuel] = useState(l.outFuel || 'F');
  const n = Number(String(miles).replace(/\D/g, '')) || 0;
  const save = () => {
    const at = new Date().toISOString();
    updateOrder(order.id, { loaner: { ...l, inAt: at, inMiles: n, inFuel: fuel } });
    // Remember where the loaner's odometer and tank are for the next customer.
    const fd = state.shop.frontDesk;
    updateShop({ frontDesk: { ...fd, loaners: fd.loaners.map((x) => (x.id === l.id ? { ...x, mileage: n, fuel } : x)) } });
    toast(`${l.name} is back — ${number(n - l.outMiles)} mi`, { tone: 'success' });
    onClose();
  };
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={`Check in ${l.name}`}
      subtitle={`Out ${dateTime(l.outAt)} at ${number(l.outMiles)} mi, ${l.outFuel} tank`}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={n < l.outMiles} onClick={save}>Check in</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Odometer in">{(fid) => <input id={fid} inputMode="numeric" className="input tabular" value={miles} onChange={(e) => setMiles(e.target.value)} autoFocus />}</Field>
        <Field label="Fuel in">
          {(fid) => (
            <select id={fid} className="input" value={fuel} onChange={(e) => setFuel(e.target.value)}>
              {FUEL.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-2">
        <Fuel size={14} className="text-ink-3" /> {n >= l.outMiles ? `${number(n - l.outMiles)} mi driven` : 'Odometer in can’t be below odometer out'}
        {FUEL.indexOf(fuel) < FUEL.indexOf(l.outFuel) && <span className="text-warn"> · fuel is lower than it went out</span>}
      </p>
    </Modal>
  );
}
