// Public self check-in: customers check their vehicle in on the lobby tablet, or after hours at the
// key drop on their own phone. Like the booking page it never loads shop data — only the small
// file the shop publishes — and the check-in arrives in the shop's inbox as a new repair order.
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleCheck, KeyRound, Wrench, Phone, ClipboardX, Car, MessageSquare } from 'lucide-react';
import { ShopBrand } from '../brand/Logo';
import { EmptyState, Spinner, Field } from '../components/ui';
import SignaturePad from '../components/SignaturePad';
import { ScanButton } from '../components/Scanner';
import { parseShareSource, submitToInbox } from '../lib/cloudShare';
import { usePromise } from '../lib/usePromise';
import { telHref, phone as fmtPhone, money } from '../lib/format';

const QUICK = ['Oil change', 'Check engine light', 'Brakes', 'Noise', 'A/C or heat', 'Tires', 'Battery / won’t start', 'Inspection'];

async function loadConfig(from) {
  const source = parseShareSource(from || '', 'site');
  if (!source) throw new Error('This check-in link is incomplete.');
  const res = await fetch(`${source}/checkin.json?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error('Self check-in isn’t available right now — please see the front counter.');
  return res.json();
}

const isOpen = (hours, now = new Date()) => {
  const h = hours?.[now.getDay()];
  if (!h) return false;
  const [o, c] = h.map((s) => s.split(':').map(Number)).map(([a, b]) => a * 60 + (b || 0));
  const m = now.getHours() * 60 + now.getMinutes();
  return m >= o && m < c;
};

export default function CheckIn() {
  const [params] = useSearchParams();
  const from = params.get('from');
  const loaded = usePromise(() => loadConfig(from), from || '');
  if (loaded.status === 'loading')
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-canvas text-ink-3">
        <Spinner size={22} />
      </div>
    );
  if (loaded.status === 'error' || !loaded.data?.enabled || !loaded.data?.inbox)
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-canvas px-4">
        <EmptyState icon={ClipboardX} title="Self check-in unavailable" body={loaded.error?.message || 'Please see the front counter.'} />
      </div>
    );
  return <Form config={loaded.data} kiosk={params.get('kiosk') === '1'} locationId={params.get('loc') || null} />;
}

const BLANK = { name: '', phone: '', email: '', vehicle: '', vin: '', plate: '', mileage: '', concern: '', dropoff: 'counter', keyTag: '', transport: 'dropoff', needBy: '', contact: 'text' };

function Form({ config, kiosk, locationId }) {
  const shop = config.shop;
  const afterHours = !isOpen(shop.hours);
  const [f, setF] = useState(() => ({ ...BLANK, dropoff: afterHours ? 'dropbox' : 'counter' }));
  const [signature, setSignature] = useState(null);
  const [agree, setAgree] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const [padKey, setPadKey] = useState(0);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const pick = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const phoneOk = f.phone.replace(/\D/g, '').length >= 10;
  const ready = f.name.trim() && (phoneOk || /\S+@\S+\.\S+/.test(f.email)) && (f.vehicle.trim() || f.plate.trim() || f.vin) && f.concern.trim() && signature && agree;

  const reset = useCallback(() => {
    setF({ ...BLANK, dropoff: !isOpen(shop.hours) ? 'dropbox' : 'counter' });
    setSignature(null);
    setAgree(false);
    setDone(null);
    setPadKey((k) => k + 1);
    window.scrollTo(0, 0);
  }, [shop.hours]);

  // On the lobby tablet, go back to a blank form a little while after each check-in.
  useEffect(() => {
    if (!done || !kiosk) return undefined;
    const t = setTimeout(reset, 45_000);
    return () => clearTimeout(t);
  }, [done, kiosk, reset]);

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setSending(true);
    setError('');
    try {
      const payload = {
        name: f.name.trim(),
        phone: f.phone.trim(),
        email: f.email.trim(),
        vehicle: f.vehicle.trim(),
        plate: f.plate.trim(),
        vin: f.vin,
        mileage: f.mileage.replace(/\D/g, ''),
        concern: f.concern.trim(),
        dropoff: f.dropoff,
        keyTag: f.keyTag.trim(),
        transport: f.transport === 'loaner' ? 'loaner' : f.transport,
        loaner: f.transport === 'loaner',
        needBy: f.needBy ? new Date(f.needBy).toISOString() : null,
        contact: f.contact,
        diagLimit: config.diagLimit || 0,
        locationId,
        signature,
        at: new Date().toISOString(),
      };
      await submitToInbox(config.inbox, 'checkin', null, payload);
      setDone(payload);
    } catch (err) {
      setError(`${err.message}. Please see the front counter${shop.phone ? ` or call ${fmtPhone(shop.phone)}` : ''}.`);
    } finally {
      setSending(false);
    }
  };

  if (done)
    return (
      <Shell shop={shop}>
        <div className="card px-6 py-10 text-center">
          <CircleCheck size={44} className="mx-auto text-ok" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">You’re checked in</h1>
          <p className="mx-auto mt-2 max-w-sm text-ink-2">
            Thanks, {done.name.split(' ')[0]}. We’ll {done.contact === 'call' ? 'call' : done.contact === 'email' ? 'email' : 'text'} you as soon as we’ve looked at your {done.vehicle || 'vehicle'}.
          </p>
          {done.dropoff === 'dropbox' && (
            <p className="mx-auto mt-4 flex max-w-sm items-start gap-2 rounded-[10px] bg-fill/[0.06] px-4 py-3 text-left text-sm text-ink-2">
              <KeyRound size={16} className="mt-0.5 shrink-0 text-ink-3" />
              {config.afterHours}
            </p>
          )}
          {kiosk && (
            <button className="btn-secondary btn-lg mt-6" onClick={reset}>
              Check in another vehicle
            </button>
          )}
        </div>
      </Shell>
    );

  return (
    <Shell shop={shop}>
      <form className="space-y-4" onSubmit={submit}>
        {afterHours && (
          <p className="flex items-start gap-2 rounded-[10px] border border-line bg-surface px-4 py-3 text-sm text-ink-2">
            <KeyRound size={16} className="mt-0.5 shrink-0 text-ink-3" />
            We’re closed right now. {config.afterHours}
          </p>
        )}
        <Section title="About you">
          <Field label="Your name">{(id) => <input id={id} className="input h-11 text-base" autoComplete="name" autoCapitalize="words" value={f.name} onChange={set('name')} />}</Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mobile phone">{(id) => <input id={id} type="tel" inputMode="tel" className="input h-11 text-base" autoComplete="tel" value={f.phone} onChange={set('phone')} />}</Field>
            <Field label="Email (optional)">{(id) => <input id={id} type="email" className="input h-11 text-base" autoComplete="email" value={f.email} onChange={set('email')} />}</Field>
          </div>
        </Section>

        <Section title="Your vehicle" icon={Car}>
          <Field label="Year, make & model">{(id) => <input id={id} className="input h-11 text-base" placeholder="e.g. 2019 Toyota Camry" value={f.vehicle} onChange={set('vehicle')} />}</Field>
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
            <ScanButton mode="vin" className="btn-secondary btn-sm" onResult={(vin) => setF((x) => ({ ...x, vin }))} hint="Point your camera at the VIN barcode inside the driver’s door jamb.">
              Scan VIN (optional)
            </ScanButton>
            {f.vin && <span className="font-mono text-xs">VIN {f.vin}</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="License plate">{(id) => <input id={id} autoCapitalize="characters" autoCorrect="off" spellCheck={false} className="input h-11 text-base uppercase" value={f.plate} onChange={set('plate')} />}</Field>
            <Field label="Mileage (optional)">{(id) => <input id={id} inputMode="numeric" className="input h-11 text-base" value={f.mileage} onChange={set('mileage')} />}</Field>
          </div>
        </Section>

        <Section title="What can we help with?" icon={Wrench}>
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => pick('concern', f.concern.includes(q) ? f.concern : [f.concern.trim(), q].filter(Boolean).join(f.concern.trim() ? ', ' : ''))}
                className={`chip h-8 ${f.concern.includes(q) ? 'border-accent bg-accent/[0.08] text-ink' : 'hover:bg-fill/[0.05]'}`}
              >
                {q}
              </button>
            ))}
          </div>
          <Field label="Tell us what’s going on">
            {(id) => <textarea id={id} rows={3} className="input text-base" placeholder="When does it happen? Any noises, lights or smells?" value={f.concern} onChange={set('concern')} />}
          </Field>
        </Section>

        <Section title="Drop-off" icon={KeyRound}>
          <Choice label="Where are your keys?" value={f.dropoff} onChange={(v) => pick('dropoff', v)} options={[{ value: 'counter', label: 'At the front counter' }, { value: 'dropbox', label: 'In the key drop box' }]} />
          {config.askKeyTag && <Field label="Key tag number (if you used one)">{(id) => <input id={id} className="input h-11 w-40 text-base" value={f.keyTag} onChange={set('keyTag')} />}</Field>}
          <Choice
            label="While we work"
            value={f.transport}
            onChange={(v) => pick('transport', v)}
            options={[{ value: 'waiting', label: 'I’ll wait' }, { value: 'dropoff', label: 'Leaving it' }, { value: 'shuttle', label: 'I need a ride' }, ...(config.loaners ? [{ value: 'loaner', label: 'Loaner, if available' }] : [])]}
          />
          <Field label="Need it back by (optional)">{(id) => <input id={id} type="datetime-local" className="input h-11 text-base sm:w-64" value={f.needBy} onChange={set('needBy')} />}</Field>
          <Choice label="Best way to reach you" value={f.contact} onChange={(v) => pick('contact', v)} options={[{ value: 'text', label: 'Text' }, { value: 'call', label: 'Call' }, { value: 'email', label: 'Email' }]} />
        </Section>

        <Section title="Authorization">
          <p className="text-sm text-ink-2">
            {config.terms}
            {config.diagLimit > 0 && <span className="font-medium text-ink"> Up to {money(config.diagLimit)} to inspect and diagnose.</span>}
          </p>
          <SignaturePad key={padKey} onChange={setSignature} label="Sign with your finger" height={140} />
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[rgb(var(--accent))]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>I’m the owner or authorized to drop off this vehicle, and I agree to the above.</span>
          </label>
        </Section>

        {error && <p className="text-sm text-bad">{error}</p>}
        <button type="submit" className="btn-primary btn-lg h-14 w-full text-base" disabled={!ready || sending}>
          {sending ? <Spinner size={16} /> : <CircleCheck size={18} />} Check in
        </button>
        {!ready && <p className="text-center text-xs text-ink-3">Your name, a phone or email, the vehicle, what’s going on and your signature are needed.</p>}
      </form>
    </Shell>
  );
}

function Shell({ shop, children }) {
  return (
    <div className="min-h-[100dvh] bg-canvas">
      <header className="customer-header">
        <div className="mx-auto max-w-2xl px-4 pb-6 pt-6">
          <ShopBrand name={shop.name} />
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Check in your vehicle</h1>
          <p className="mt-1 text-[15px] text-ink-3">Takes about a minute. We’ll keep you posted by text.</p>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        {children}
        <p className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-ink-3">
          {shop.address && <span>{shop.address}</span>}
          {shop.phone && (
            <a href={telHref(shop.phone)} className="inline-flex items-center gap-1 hover:text-ink">
              <Phone size={11} /> {fmtPhone(shop.phone)}
            </a>
          )}
          <span className="inline-flex items-center gap-1">
            <MessageSquare size={11} /> Questions? Ask at the counter
          </span>
        </p>
      </main>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <section className="card space-y-3 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        {Icon && <Icon size={16} className="text-ink-3" />} {title}
      </h2>
      {children}
    </section>
  );
}

function Choice({ label, value, onChange, options }) {
  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`h-10 rounded-[8px] border px-3.5 text-sm font-medium transition-colors ${value === o.value ? 'border-accent bg-accent/[0.08] text-ink ring-[3px] ring-accent/10' : 'border-line bg-surface text-ink-2 hover:bg-fill/[0.04]'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
