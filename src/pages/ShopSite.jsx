// Public shop website: a one-page site for the shop (services, reviews, hours, location) with
// online booking built in. Like the booking page, it never loads shop data — its content comes
// from the link or the shop's published file.
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarCheck, Phone, MapPin, Clock, Star, Check, Quote, Wrench, Navigation, HandCoins, Globe } from 'lucide-react';
import { EmptyState, Spinner } from '../components/ui';
import { decodeConfig } from '../lib/booking';
import { parseShareSource } from '../lib/cloudShare';
import { usePromise } from '../lib/usePromise';
import { SERVICE_ICONS, iconKey } from '../lib/serviceIcons';
import { phone as fmtPhone, telHref } from '../lib/format';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function loadConfig(c, from) {
  if (c) return decodeConfig(c);
  const source = parseShareSource(from || '', 'site');
  if (!source) throw new Error('This link is incomplete.');
  const res = await fetch(`${source}/booking.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error('This shop’s page isn’t available right now.');
  return res.json();
}

const hm12 = (s) => {
  const [h, m] = s.split(':').map(Number);
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
};

export default function ShopSite() {
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
        <EmptyState icon={Globe} title="Page unavailable" body={loaded.error.message} />
      </div>
    );
  return <Site config={loaded.data} bookHref={`/book?${c ? `c=${encodeURIComponent(c)}` : `from=${encodeURIComponent(from)}`}`} />;
}

function Site({ config, bookHref }) {
  const shop = config.shop;
  const site = config.site || {};
  const canBook = config.enabled !== false;
  const address = [shop.address, [shop.city, shop.state].filter(Boolean).join(', '), shop.zip].filter(Boolean).join(' ');
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shop.name} ${address}`)}`;
  const today = new Date().getDay();
  const openNow = useMemo(() => {
    const h = config.hours?.[today];
    if (!h) return false;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const [o, cl] = h.map((x) => x.split(':').map(Number)).map(([a, b]) => a * 60 + (b || 0));
    return mins >= o && mins < cl;
  }, [config.hours, today]);
  const years = site.since ? new Date().getFullYear() - Number(site.since) : null;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* Top bar */}
      <header className="glass sticky top-0 z-20 border-b border-line/70 bg-surface/85">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-accent text-on-accent">
            <Wrench size={16} />
          </span>
          <span className="truncate font-semibold">{shop.name}</span>
          <div className="ml-auto flex items-center gap-2">
            {shop.phone && (
              <a href={telHref(shop.phone)} className="btn-ghost hidden sm:inline-flex">
                <Phone size={15} /> {fmtPhone(shop.phone)}
              </a>
            )}
            {canBook && (
              <Link to={bookHref} className="btn-primary">
                <CalendarCheck size={15} /> Book online
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-graphite text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          {site.since && (
            <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80 ring-1 ring-white/15">
              <span className="h-1.5 w-1.5 rounded-full bg-white/70" /> In business since {site.since}
            </span>
          )}
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Auto repair in {shop.city || 'your area'}
            {shop.state ? `, ${shop.state}` : ''} you can trust.
          </h1>
          {site.tagline && <p className="mt-4 max-w-2xl text-lg text-white/75">{site.tagline}</p>}
          {site.rating && (
            <div className="mt-5 flex items-center gap-2 text-sm text-white/85">
              <span className="flex text-white">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} size={17} fill={i < Math.round(site.rating) ? 'currentColor' : 'none'} />
                ))}
              </span>
              <b>{site.rating.toFixed(1)}</b>
              {site.reviews ? <span className="text-white/60">from {site.reviews}+ reviews</span> : null}
            </div>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            {canBook && (
              <Link to={bookHref} className="btn btn-lg h-12 bg-white px-6 text-md text-[rgb(16_33_62)] hover:bg-white/90">
                <CalendarCheck size={18} /> Book an appointment
              </Link>
            )}
            {shop.phone && (
              <a href={telHref(shop.phone)} className="btn btn-lg h-12 bg-white/10 px-6 text-md text-white ring-1 ring-white/20 hover:bg-white/15">
                <Phone size={18} /> Call {fmtPhone(shop.phone)}
              </a>
            )}
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70">
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${openNow ? 'bg-ok' : 'bg-white/40'}`} /> {openNow ? 'Open now' : 'Closed now'}
            </span>
            {address && (
              <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-white">
                <MapPin size={14} /> {address}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Highlights */}
      {site.highlights?.length > 0 && (
        <section className="border-b border-line/70 bg-surface">
          <div className="mx-auto grid max-w-6xl gap-x-6 gap-y-3 px-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
            {site.highlights.map((h) => (
              <div key={h} className="flex items-center gap-2.5 text-sm font-medium">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Check size={14} strokeWidth={2.6} />
                </span>
                {h}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Services */}
      {site.services?.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="eyebrow mb-2">Services</div>
          <h2 className="text-3xl font-bold tracking-tight">Everything your vehicle needs</h2>
          <p className="mt-2 max-w-2xl text-ink-2">From oil changes to engine work, all makes and models. You’ll get photos of what we find and approve every repair before we start.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {site.services.map((s) => {
              const key = iconKey(s.title);
              const Icon = SERVICE_ICONS[key === 'other' || key === 'maintenance' ? iconKey(s.items[0] || s.title) : key];
              return (
                <div key={s.title} className="card group relative flex flex-col p-5 transition-shadow hover:shadow-pop">
                  <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-[11px] bg-accent/[0.09] text-accent">
                    <Icon size={22} strokeWidth={1.8} />
                  </span>
                  <h3 className="font-semibold">{s.title}</h3>
                  <ul className="mt-2 flex-1 space-y-1 text-sm text-ink-2">
                    {s.items.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                  {canBook && (
                    <Link to={bookHref} className="mt-4 text-sm font-semibold text-accent hover:underline">
                      Book this →
                    </Link>
                  )}
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] rounded-b-lg bg-accent opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* About + reviews */}
      <section className="bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div>
            <div className="eyebrow mb-2">About us</div>
            <h2 className="text-3xl font-bold tracking-tight">{years && years > 1 ? `${years} years of honest repair` : 'Honest repair, explained'}</h2>
            {site.about && <p className="mt-3 text-ink-2">{site.about}</p>}
            {site.warranty && (
              <div className="mt-5 flex items-start gap-3 rounded-[12px] border border-line p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-ok/10 text-ok">
                  <Check size={18} />
                </span>
                <div>
                  <div className="font-semibold">Our warranty</div>
                  <div className="text-sm text-ink-2">{site.warranty}</div>
                </div>
              </div>
            )}
            {site.financing && (
              <div className="mt-3 flex items-start gap-3 rounded-[12px] border border-line p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-accent/10 text-accent">
                  <HandCoins size={18} />
                </span>
                <div>
                  <div className="font-semibold">Financing available</div>
                  <div className="text-sm text-ink-2">
                    Pay over time on repairs{site.financing.min ? ` over $${site.financing.min}` : ''}
                    {site.financing.provider ? ` through ${site.financing.provider}` : ''}.{' '}
                    {site.financing.url && (
                      <a href={site.financing.url} target="_blank" rel="noopener noreferrer" className="link">
                        Apply
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          {site.testimonials?.length > 0 && (
            <div>
              <div className="eyebrow mb-2">What customers say</div>
              <div className="grid gap-4 sm:grid-cols-2">
                {site.testimonials.map((t, i) => (
                  <figure key={i} className={`rounded-[12px] border border-line bg-canvas p-5 ${i === 0 ? 'sm:col-span-2' : ''}`}>
                    <Quote size={20} className="text-accent/60" />
                    <blockquote className="mt-2 text-md text-ink">{t.text}</blockquote>
                    <figcaption className="mt-3 flex items-center gap-2 text-sm text-ink-3">
                      <span className="flex text-accent">
                        {[0, 1, 2, 3, 4].map((k) => (
                          <Star key={k} size={13} fill="currentColor" />
                        ))}
                      </span>
                      {t.name}
                    </figcaption>
                  </figure>
                ))}
              </div>
              {site.reviewUrl && (
                <a href={site.reviewUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-4">
                  <Star size={14} /> Read or leave a review
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Hours & location */}
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-2">
        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2 font-semibold">
            <Clock size={18} className="text-accent" /> Hours
          </div>
          <dl className="divide-y divide-line/70 text-sm">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const h = config.hours?.[d];
              return (
                <div key={d} className={`flex justify-between py-2 ${d === today ? 'font-semibold' : ''}`}>
                  <dt>{DAYS[d]}</dt>
                  <dd className={h ? '' : 'text-ink-3'}>{h ? `${hm12(h[0])} – ${hm12(h[1])}` : 'Closed'}</dd>
                </div>
              );
            })}
          </dl>
        </div>
        <div className="card flex flex-col p-6">
          <div className="mb-4 flex items-center gap-2 font-semibold">
            <MapPin size={18} className="text-accent" /> Visit us
          </div>
          <div className="text-md">{shop.name}</div>
          <div className="text-ink-2">{address}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              <Navigation size={14} /> Directions
            </a>
            {shop.phone && (
              <a href={telHref(shop.phone)} className="btn-secondary">
                <Phone size={14} /> {fmtPhone(shop.phone)}
              </a>
            )}
          </div>
          {canBook && (
            <div className="mt-auto pt-6">
              <Link to={bookHref} className="btn-primary w-full">
                <CalendarCheck size={15} /> Book online — takes about 2 minutes
              </Link>
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-line/70 py-8 text-center text-xs text-ink-3">
        © {new Date().getFullYear()} {shop.name}
        {address ? ` · ${address}` : ''}
      </footer>
    </div>
  );
}
