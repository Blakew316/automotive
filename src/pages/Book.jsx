// Public online-booking page. Opens on customers' phones, never loads shop data: everything it
// needs (hours, services, open times) comes from the link or the shop's published booking file.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarX, Check, ChevronLeft, MapPin, Phone, MessageSquare, Mail, CircleCheck, Clock } from 'lucide-react';
import { PoweredBy, ShopBrand } from '../brand/Logo';
import { titleName, usePageTitle } from '../brand/title';
import { EmptyState, Spinner } from '../components/ui';
import { decodeConfig, slotsForDay, bookableDays } from '../lib/booking';
import { parseShareSource, submitToInbox } from '../lib/cloudShare';
import { usePromise } from '../lib/usePromise';
import { smsHref, mailHref, time, phone as fmtPhone, telHref } from '../lib/format';
import { SERVICE_ICONS, iconKey } from '../lib/serviceIcons';

const OTHER = 'Something else / diagnose a problem';
const ME_KEY = 'autoshop-book:me';

// Customers who booked before on this phone get their details filled in.
function readMe() {
  try {
    return JSON.parse(localStorage.getItem(ME_KEY)) || null;
  } catch {
    return null;
  }
}
function saveMe(me) {
  try {
    if (me) localStorage.setItem(ME_KEY, JSON.stringify(me));
    else localStorage.removeItem(ME_KEY);
  } catch {
    // Remembering is a convenience only.
  }
}

async function loadConfig(c, from) {
  if (c) return decodeConfig(c);
  const source = parseShareSource(from || '', 'site');
  if (!source) throw new Error('This booking link is incomplete.');
  const res = await fetch(`${source}/booking.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error('This shop’s booking page isn’t available right now.');
  return res.json();
}

export default function Book() {
  const [params] = useSearchParams();
  const c = params.get('c');
  const from = params.get('from');
  const loaded = usePromise(() => loadConfig(c, from), `${c}|${from}`);

  if (loaded.status === 'loading')
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-ink-3">
        <Spinner size={22} />
      </div>
    );
  if (loaded.status === 'error')
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <EmptyState icon={CalendarX} title="Booking unavailable" body={loaded.error.message} />
      </div>
    );
  return <Booking config={loaded.data} />;
}

function Booking({ config }) {
  const shop = config.shop;
  const [step, setStep] = useState(0);
  const [services, setServices] = useState([]);
  const [day, setDay] = useState(null);
  const [slot, setSlot] = useState(null);
  const [me, setMe] = useState(readMe);
  const [f, setF] = useState(() => ({ name: '', phone: '', email: '', vehicle: '', ...(readMe() || {}), notes: '' }));
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const now = useMemo(() => new Date(), []);
  usePageTitle(`Book a visit — ${titleName(shop.name)}`);

  const minutes = Math.max(30, services.reduce((s, t) => s + (config.services.find((x) => x.title === t)?.minutes || 60), 0));
  const days = useMemo(() => bookableDays(config, now).map((d) => ({ d, slots: slotsForDay(config, d, minutes, now) })), [config, minutes, now]);
  const activeDay = day ? days.find((x) => x.d.getTime() === day) : days.find((x) => x.slots.length);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const contactOk = f.name.trim() && (f.phone.replace(/\D/g, '').length >= 10 || /\S+@\S+\.\S+/.test(f.email));

  const summary = () =>
    [
      `Appointment request — ${shop.name}`,
      `${slot.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${time(slot.toISOString())}`,
      `Service: ${services.join(', ') || 'General service'}`,
      `Name: ${f.name.trim()}`,
      f.phone && `Phone: ${f.phone}`,
      f.email && `Email: ${f.email}`,
      f.vehicle && `Vehicle: ${f.vehicle}`,
      f.notes && `Notes: ${f.notes}`,
    ]
      .filter(Boolean)
      .join('\n');

  const submit = async () => {
    setSending(true);
    setError('');
    try {
      await submitToInbox(config.inbox, 'booking', null, { name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(), vehicle: f.vehicle.trim(), services, start: slot.toISOString(), duration: minutes, notes: f.notes.trim(), at: new Date().toISOString() });
      remember();
      setDone(true);
    } catch (e) {
      setError(`${e.message}. You can send the request by text or email instead.`);
    } finally {
      setSending(false);
    }
  };

  const address = [shop.address, [shop.city, shop.state].filter(Boolean).join(', '), shop.zip].filter(Boolean).join(' ');
  const remember = () => saveMe({ name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(), vehicle: f.vehicle.trim() });

  return (
    <div className="min-h-screen bg-canvas">
      <header className="customer-header">
        <div className="mx-auto max-w-xl px-4 pb-6 pt-6">
          <div className="flex flex-col gap-3">
            <ShopBrand name={shop.name} className="h-11" />
            <div className="min-w-0">
              <div className="flex flex-wrap gap-x-3 text-xs text-ink-3">
                {address && (
                  <span>
                    <MapPin size={11} className="mr-0.5 inline" />
                    {address}
                  </span>
                )}
                {shop.phone && (
                  <a href={telHref(shop.phone)} className="hover:text-ink">
                    <Phone size={11} className="mr-0.5 inline" />
                    {fmtPhone(shop.phone)}
                  </a>
                )}
              </div>
            </div>
          </div>
          {!done && (
            <div className="mt-6">
              <h1 className="text-2xl font-bold tracking-tight">Schedule your visit</h1>
              <p className="text-sm text-ink-3">Takes about 2 minutes — we’ll confirm by text.</p>
            </div>
          )}
          {me && !done && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent/[0.08] px-3 py-1 text-xs text-ink-2 ring-1 ring-accent/15">
              Welcome back, {me.name.split(' ')[0]}
              <button
                className="text-accent underline hover:text-ink"
                onClick={() => {
                  saveMe(null);
                  setMe(null);
                  setF({ name: '', phone: '', email: '', vehicle: '', notes: f.notes });
                }}
              >
                Not you?
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-16 pt-6">
        {done ? (
          <div className="card px-6 py-10 text-center">
            <CircleCheck size={40} className="mx-auto mb-3 text-ok" />
            <h2 className="text-xl font-semibold">Request sent</h2>
            <p className="mt-1 text-sm text-ink-2">
              {slot.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {time(slot.toISOString())}
            </p>
            <p className="mt-3 text-sm text-ink-3">{config.note || `${shop.name} will confirm shortly.`}</p>
          </div>
        ) : (
          <>
            <Steps step={step} />
            {step === 0 && (
              <section>
                <h2 className="mb-1 text-xl font-semibold">What do you need?</h2>
                <p className="mb-4 text-sm text-ink-3">Choose one or more.</p>
                <div className="space-y-2">
                  {[...config.services.map((s) => s.title), OTHER].map((t) => {
                    const on = services.includes(t);
                    const mins = config.services.find((s) => s.title === t)?.minutes;
                    return (
                      <button
                        key={t}
                        onClick={() => setServices(on ? services.filter((x) => x !== t) : [...services, t])}
                        className={`flex w-full items-center gap-3 rounded-[12px] border px-4 py-3 text-left transition-colors ${on ? 'border-accent bg-accent/[0.06]' : 'border-line bg-surface hover:bg-fill/[0.04]'}`}
                      >
                        <ServiceIcon title={t} on={on} />
                        <span className="flex-1 text-[15px]">{t}</span>
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${on ? 'border-accent bg-accent text-on-accent' : 'border-ink-4'}`}>{on && <Check size={12} strokeWidth={3} />}</span>
                        {mins && <span className="text-xs text-ink-3">~{mins >= 60 ? `${Math.round((mins / 60) * 10) / 10} hr` : `${mins} min`}</span>}
                      </button>
                    );
                  })}
                </div>
                <button className="btn-primary mt-6 h-11 w-full text-[15px]" disabled={!services.length} onClick={() => setStep(1)}>
                  Choose a time
                </button>
              </section>
            )}

            {step === 1 && (
              <section>
                <BackButton onClick={() => setStep(0)} />
                <h2 className="mb-4 text-xl font-semibold">Pick a time</h2>
                <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
                  {days.map(({ d, slots }) => {
                    const on = activeDay?.d.getTime() === d.getTime();
                    return (
                      <button
                        key={d.toISOString()}
                        disabled={!slots.length}
                        onClick={() => {
                          setDay(d.getTime());
                          setSlot(null);
                        }}
                        className={`flex w-[62px] shrink-0 flex-col items-center rounded-[12px] border py-2 transition-colors disabled:opacity-35 ${on ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface hover:bg-fill/[0.04]'}`}
                      >
                        <span className={`text-2xs uppercase ${on ? 'text-on-accent/80' : 'text-ink-3'}`}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                        <span className="text-lg font-semibold leading-6">{d.getDate()}</span>
                        <span className={`text-2xs ${on ? 'text-on-accent/80' : 'text-ink-3'}`}>{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                      </button>
                    );
                  })}
                </div>
                {activeDay ? (
                  <>
                    <div className="mb-2 text-sm text-ink-2">{activeDay.d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {activeDay.slots.map((s) => {
                        const on = slot?.getTime() === s.getTime();
                        return (
                          <button key={s.toISOString()} onClick={() => setSlot(s)} className={`h-10 rounded-[10px] border text-sm font-medium transition-colors ${on ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface hover:bg-fill/[0.04]'}`}>
                            {time(s.toISOString())}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="rounded-[10px] bg-fill/[0.06] px-3 py-3 text-sm text-ink-2">No open times in the next {config.days} days. Please call {fmtPhone(shop.phone)}.</p>
                )}
                {!config.busy && <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-3"><Clock size={12} /> Times shown are business hours — the shop will confirm availability.</p>}
                <button className="btn-primary mt-6 h-11 w-full text-[15px]" disabled={!slot} onClick={() => setStep(2)}>
                  Continue
                </button>
              </section>
            )}

            {step === 2 && (
              <section>
                <BackButton onClick={() => setStep(1)} />
                <h2 className="mb-1 text-xl font-semibold">Your details</h2>
                <p className="mb-4 text-sm text-ink-3">
                  {services.join(', ')} · {slot.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {time(slot.toISOString())}
                </p>
                <div className="space-y-3">
                  <input className="input h-11 text-[15px]" placeholder="Full name" autoComplete="name" autoCapitalize="words" value={f.name} onChange={set('name')} aria-label="Full name" />
                  <input className="input h-11 text-[15px]" placeholder="Mobile phone" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} aria-label="Mobile phone" />
                  <input className="input h-11 text-[15px]" placeholder="Email (optional)" type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" value={f.email} onChange={set('email')} aria-label="Email" />
                  <input className="input h-11 text-[15px]" placeholder="Vehicle — e.g. 2018 Honda Accord" autoCapitalize="words" value={f.vehicle} onChange={set('vehicle')} aria-label="Vehicle" />
                  <textarea className="input resize-none text-[15px]" rows={3} placeholder="Anything we should know? (noises, warning lights, waiting vs. drop-off)" value={f.notes} onChange={set('notes')} aria-label="Notes" />
                </div>
                {error && <p className="mt-3 text-sm text-bad">{error}</p>}
                {config.inbox && !error ? (
                  <button className="btn-primary mt-6 h-11 w-full text-[15px]" disabled={!contactOk || sending} onClick={submit}>
                    {sending ? <Spinner size={16} /> : <Check size={16} />} Request appointment
                  </button>
                ) : (
                  <div className="mt-6 grid gap-2">
                    {shop.phone && (
                      <a href={contactOk ? smsHref(shop.phone, summary()) : undefined} onClick={() => contactOk && (remember(), setDone(true))} aria-disabled={!contactOk} className={`btn-primary h-11 text-[15px] ${contactOk ? '' : 'pointer-events-none opacity-50'}`}>
                        <MessageSquare size={16} /> Send request by text
                      </a>
                    )}
                    {shop.email && (
                      <a href={contactOk ? mailHref(shop.email, `Appointment request — ${f.name.trim()}`, summary()) : undefined} onClick={() => contactOk && (remember(), setDone(true))} aria-disabled={!contactOk} className={`btn-secondary h-11 text-[15px] ${contactOk ? '' : 'pointer-events-none opacity-50'}`}>
                        <Mail size={16} /> Send by email
                      </a>
                    )}
                  </div>
                )}
                <p className="mt-3 text-center text-xs text-ink-3">{config.note}</p>
              </section>
            )}
          </>
        )}
        <PoweredBy name={shop.name} className="mt-10" />
      </main>
    </div>
  );
}

function ServiceIcon({ title, on }) {
  const Icon = SERVICE_ICONS[title === OTHER ? 'inspect' : iconKey(title)];
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition-colors ${on ? 'bg-accent text-on-accent' : 'bg-accent/10 text-accent'}`}>
      <Icon size={18} strokeWidth={1.9} />
    </span>
  );
}

function Steps({ step }) {
  return (
    <div className="mb-6 flex gap-1.5" aria-label={`Step ${step + 1} of 3`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-fill/[0.15]'}`} />
      ))}
    </div>
  );
}

function BackButton({ onClick }) {
  return (
    <button onClick={onClick} className="btn-plain -ml-2 mb-2 h-7 px-1.5 text-sm">
      <ChevronLeft size={17} /> Back
    </button>
  );
}
