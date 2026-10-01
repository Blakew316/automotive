// Public live status page: where the customer's vehicle is right now. Opens from a texted link on
// the customer's phone, so it never loads shop data — only the small file the shop publishes.
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Check, Phone, MapPin, FileText, CreditCard, Clock, Link2Off, Wrench, RefreshCw } from 'lucide-react';
import { EmptyState, Spinner } from '../components/ui';
import { parseShareSource } from '../lib/cloudShare';
import { phone as fmtPhone, telHref, money, relTime } from '../lib/format';
import { TRACK_STEPS } from '../lib/tracker';

const REFRESH_MS = 45_000;
const when = (iso) => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function Track() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const source = parseShareSource(params.get('from') || '', 'track');
  const [data, setData] = useState(null);
  const [error, setError] = useState(source ? '' : 'This link is incomplete.');
  const [checked, setChecked] = useState(null);

  useEffect(() => {
    if (!source || !/^[\w-]{10,64}$/.test(id || '')) return undefined;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`${source}/${encodeURIComponent(id)}.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(res.status === 400 || res.status === 404 ? 'This status page isn’t available.' : 'Couldn’t load the latest status.');
        const json = await res.json();
        if (!alive) return;
        if (json.revoked) throw new Error('This status page has been turned off.');
        setData(json);
        setError('');
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setChecked(new Date().toISOString());
      }
    };
    load();
    const t = setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [source, id]);

  if (!data && !error)
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-canvas text-ink-3">
        <Spinner size={22} />
      </div>
    );
  if (!data)
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-canvas px-4">
        <EmptyState icon={Link2Off} title="Status unavailable" body={error} />
      </div>
    );

  const steps = data.steps || [];
  const currentIndex = Math.max(0, steps.findIndex((s) => s.status === data.status));
  const current = TRACK_STEPS.find((s) => s.status === data.status);
  const done = data.status === 'ready' || data.status === 'closed';
  const remaining = (data.services || []).filter((s) => s.approved);

  return (
    <div className="min-h-[100dvh] bg-canvas">
      <header className="bg-graphite text-white">
        <div className="mx-auto max-w-xl px-4 pb-7 pt-5">
          <div className="flex items-center gap-2 text-sm text-white/75">
            <Wrench size={15} /> {data.shop.name}
          </div>
          <p className="mt-5 text-sm text-white/70">{data.first ? `Hi ${data.first} — here’s your` : 'Your'} {data.vehicle}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{current?.label || 'In the shop'}</h1>
          <p className="mt-2 max-w-md text-[15px] text-white/80">{current?.detail}</p>
          {data.promisedAt && !done && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm">
              <Clock size={14} /> Expected {when(data.promisedAt)}
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 px-4 py-6">
        <section className="card p-5">
          <ol className="relative">
            {steps.map((s, i) => {
              const reached = i <= currentIndex;
              const now = i === currentIndex;
              return (
                <li key={s.status} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < steps.length - 1 && <span aria-hidden className={`absolute left-[13px] top-7 h-[calc(100%-20px)] w-0.5 ${i < currentIndex ? 'bg-accent' : 'bg-line'}`} />}
                  <span className={`relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${reached ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink-4'} ${now ? 'ring-4 ring-accent/15' : ''}`}>
                    {reached && !now ? <Check size={14} strokeWidth={3} /> : <span className="text-xs font-semibold">{i + 1}</span>}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <div className={`font-medium ${reached ? 'text-ink' : 'text-ink-3'}`}>{s.label}</div>
                    {s.at && reached && <div className="text-xs text-ink-3">{when(s.at)}</div>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {remaining.length > 0 && (
          <section className="card p-5">
            <h2 className="mb-2 text-sm font-semibold">Work on your vehicle</h2>
            <ul className="space-y-1.5 text-sm">
              {remaining.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${s.done ? 'bg-ok text-white' : 'border border-ink-4'}`}>{s.done && <Check size={10} strokeWidth={3} />}</span>
                  <span className={s.done ? 'text-ink-2' : 'text-ink'}>{s.title}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          {data.reportUrl && (
            <a href={data.reportUrl} className="btn-secondary btn-lg h-12">
              <FileText size={16} /> Inspection & estimate
            </a>
          )}
          {data.payLink && (
            <a href={data.payLink} target="_blank" rel="noopener noreferrer" className="btn-primary btn-lg h-12">
              <CreditCard size={16} /> Pay {money(data.balance)}
            </a>
          )}
          {data.shop.phone && (
            <a href={telHref(data.shop.phone)} className="btn-secondary btn-lg h-12">
              <Phone size={16} /> Call {fmtPhone(data.shop.phone)}
            </a>
          )}
        </div>

        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-ink-3">
          {data.shop.address && (
            <span className="flex items-center gap-1">
              <MapPin size={12} /> {data.shop.address}
            </span>
          )}
          <span className="flex items-center gap-1">
            <RefreshCw size={11} /> Updated {relTime(data.updatedAt)}
            {checked ? ' · checks for news automatically' : ''}
          </span>
          {error && <span className="text-warn">{error}</span>}
        </p>
      </main>
    </div>
  );
}
