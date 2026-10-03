// Customer-facing vehicle report (inspection, recommendations, work done, photos & video). Pure
// presentation over a report snapshot (lib/report.js), so the same view serves the in-shop
// "customer view" and public share links. `Media` renders one photo/video from wherever it lives.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Phone, MessageSquare, Check, X, ChevronLeft, ChevronRight, Play, CircleCheck, CircleAlert, TriangleAlert, Wrench, Images, Clock, CreditCard, Disc3 } from 'lucide-react';
import { money, date, dateTime, phone as fmtPhone, telHref, smsHref, number } from '../lib/format';
import { approvalText, totalWithChoice } from '../lib/report';
import { formatDuration } from '../lib/media';
import { TiresBrakes } from './Gauges';
import { PoweredBy } from '../brand/Logo';
import { titleName, usePageTitle } from '../brand/title';

const RATING = {
  good: { label: 'Good', tone: 'text-ok', dot: 'bg-ok', icon: CircleCheck },
  soon: { label: 'Needs attention soon', tone: 'text-warn', dot: 'bg-warn', icon: TriangleAlert },
  now: { label: 'Needs attention now', tone: 'text-bad', dot: 'bg-bad', icon: CircleAlert },
};
const STATUS_COPY = {
  estimate: 'Your estimate is ready for review.',
  approved: 'Work is approved and scheduled.',
  in_progress: 'We’re working on your vehicle.',
  waiting_parts: 'We’re waiting on parts to arrive.',
  ready: 'Your vehicle is ready for pickup.',
  closed: 'This visit is complete. Thank you!',
};
const SVC_STATUS = { pending: 'Awaiting your approval', approved: 'Approved', declined: 'Declined' };

export default function ReportView({ report, Media, onDecision, decisions = {}, footer }) {
  const [open, setOpen] = useState(null);
  const { shop, vehicle, ro, totals } = report;
  usePageTitle(`${vehicle ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') : 'Vehicle report'} — ${titleName(shop.name)}`);
  const media = report.media || [];
  const byService = (id) => media.filter((m) => m.serviceId === id);
  const byInspection = (key) => media.filter((m) => m.inspectionKey === key && !m.serviceId);
  const general = media.filter((m) => !m.serviceId && !m.inspectionKey);
  const flagged = report.inspection.items.filter((i) => i.rating === 'soon' || i.rating === 'now').sort((a, b) => (a.rating === 'now' ? -1 : 0) - (b.rating === 'now' ? -1 : 0));
  const good = report.inspection.items.filter((i) => i.rating === 'good');
  const pending = report.services.filter((s) => s.status === 'pending');
  const others = report.services.filter((s) => s.status !== 'pending');
  const vName = vehicle ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') : 'Your vehicle';
  const openMedia = (m) => setOpen(m.id);

  return (
    <div className="mx-auto max-w-[760px] px-4 pb-16 pt-6 sm:pt-10">
      <header className="mb-6">
        <div className="text-sm font-semibold text-ink">{shop.name}</div>
        <div className="text-xs text-ink-3">
          {[shop.address, [shop.city, shop.state].filter(Boolean).join(', '), shop.zip].filter(Boolean).join(' ')} ·{' '}
          <a href={telHref(shop.phone)} className="hover:text-accent">
            {fmtPhone(shop.phone)}
          </a>
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-ink">{vName}</h1>
        <p className="mt-1 text-md text-ink-2">
          {report.customer.firstName ? `Prepared for ${report.customer.firstName} · ` : ''}RO #{ro.number} · {date(ro.createdAt)}
          {vehicle?.mileage ? ` · ${number(vehicle.mileage)} mi` : ''}
        </p>
      </header>

      <section className="card mb-5 flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5">
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <Clock size={18} className="shrink-0 text-ink-3" />
          <span className="min-w-0">
            <span className="block text-md font-semibold text-ink">{ro.statusLabel}</span>
            <span className="block text-sm text-ink-2">
              {STATUS_COPY[ro.status] || ''}
              {ro.promisedAt && !['ready', 'closed'].includes(ro.status) ? ` Promised ${dateTime(ro.promisedAt)}.` : ''}
            </span>
          </span>
        </span>
        <span className="flex gap-2">
          <a href={telHref(shop.phone)} className="btn-secondary">
            <Phone size={15} /> Call
          </a>
          <a href={smsHref(shop.phone, approvalText(report))} className="btn-secondary">
            <MessageSquare size={15} /> Text
          </a>
        </span>
      </section>

      {ro.concern && (
        <Block title="Your concern">
          <p className="px-4 py-3 text-md text-ink-2">{ro.concern}</p>
        </Block>
      )}

      {pending.length > 0 && (
        <Block title="Needs your approval" subtitle={onDecision ? 'Choose for each item, then sign to send your decision' : 'Reply by text or call us to approve'} accent>
          <ul className="divide-y divide-line/70">
            {pending.map((s) => (
              <ServiceRow key={s.id} s={s} showPrices={report.showPrices} media={byService(s.id)} Media={Media} onOpen={openMedia} decisions={decisions} onDecision={onDecision}>
                {onDecision ? (
                  <div className="mt-3 flex gap-2" role="radiogroup" aria-label={`Decision for ${s.title}`}>
                    <button
                      role="radio"
                      aria-checked={decisions[s.id] === 'approved'}
                      className={`flex-1 sm:flex-none ${decisions[s.id] === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => onDecision(s.id, decisions[s.id] === 'approved' ? null : 'approved')}
                    >
                      <Check size={15} /> {decisions[s.id] === 'approved' ? 'Approved' : 'Approve'}
                    </button>
                    <button
                      role="radio"
                      aria-checked={decisions[s.id] === 'declined'}
                      className={`flex-1 sm:flex-none ${decisions[s.id] === 'declined' ? 'btn-primary !bg-ink-2' : 'btn-secondary'}`}
                      onClick={() => onDecision(s.id, decisions[s.id] === 'declined' ? null : 'declined')}
                    >
                      <X size={15} /> {decisions[s.id] === 'declined' ? 'Declined' : 'Not now'}
                    </button>
                  </div>
                ) : null}
              </ServiceRow>
            ))}
          </ul>
          {footer}
          {!onDecision && (
            <div className="border-t border-line/70 px-4 py-3">
              <a href={smsHref(shop.phone, approvalText(report))} className="btn-primary w-full sm:w-auto">
                <MessageSquare size={15} /> Text {fmtPhone(shop.phone)} to approve
              </a>
            </div>
          )}
        </Block>
      )}

      {report.inspection.items.length > 0 && (
        <Block title="Vehicle inspection" subtitle={`${report.inspection.items.length} point${report.inspection.items.length === 1 ? '' : 's'} checked`}>
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-line/70 px-4 py-3 text-sm">
            {['now', 'soon', 'good'].map((r) => (
              <span key={r} className="flex items-center gap-1.5 text-ink-2">
                <span className={`h-2 w-2 rounded-full ${RATING[r].dot}`} />
                <span className="font-semibold text-ink">{report.inspection.counts[r]}</span> {RATING[r].label.toLowerCase()}
              </span>
            ))}
          </div>
          <TiresBrakes items={report.inspection.items} className="border-b border-line/70 px-4 py-4" />
          <ul className="divide-y divide-line/70">
            {flagged.map((i) => {
              const R = RATING[i.rating];
              return (
                <li key={i.key} className="px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <R.icon size={17} className={`mt-0.5 shrink-0 ${R.tone}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-md font-medium text-ink">{i.label.replace(/\s*\(.*\)$/, '')}</div>
                      <div className={`text-xs font-medium ${R.tone}`}>
                        {R.label}
                        {i.measure != null && <span className="text-ink-2"> · measured {i.measure}{i.unit === 'mm' ? ' mm' : i.unit}</span>}
                      </div>
                      {i.note && <p className="mt-1 text-sm text-ink-2">{i.note}</p>}
                    </div>
                  </div>
                  {byInspection(i.key).length > 0 && (
                    <div className="mt-2.5 pl-7">
                      <MediaGrid Media={Media} onOpen={openMedia} items={byInspection(i.key)} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {good.length > 0 && (
            <details className="border-t border-line/70 px-4 py-3">
              <summary className="cursor-pointer select-none text-sm font-medium text-ink-2">
                {good.length} item{good.length === 1 ? '' : 's'} checked and in good condition
              </summary>
              <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm text-ink-2 sm:grid-cols-2">
                {good.map((i) => (
                  <li key={i.key} className="flex items-center gap-2">
                    <CircleCheck size={14} className="shrink-0 text-ok" />
                    <span className="truncate">{i.label.replace(/\s*\(.*\)$/, '')}</span>
                    {i.note && <span className="truncate text-ink-3">· {i.note}</span>}
                  </li>
                ))}
              </ul>
              {good.some((i) => byInspection(i.key).length) && (
                <div className="mt-3">
                  <MediaGrid Media={Media} onOpen={openMedia} items={good.flatMap((i) => byInspection(i.key))} />
                </div>
              )}
            </details>
          )}
        </Block>
      )}

      {others.length > 0 && (
        <Block title={['ready', 'closed'].includes(ro.status) ? 'Work performed' : 'Services'}>
          <ul className="divide-y divide-line/70">
            {others.map((s) => (
              <ServiceRow key={s.id} s={s} showPrices={report.showPrices} media={byService(s.id)} Media={Media} onOpen={openMedia} />
            ))}
          </ul>
        </Block>
      )}

      {general.length > 0 && (
        <Block title="Photos & video" subtitle={`${general.length} from your visit`}>
          <div className="p-3">
            <MediaGrid Media={Media} onOpen={openMedia} items={general} size="lg" />
          </div>
        </Block>
      )}

      {totals && (
        <Block title="Summary">
          <dl className="space-y-1.5 px-4 py-3 text-sm">
            <Row k="Subtotal" v={money(totals.subtotal)} />
            {totals.discount > 0 && <Row k="Discount" v={`−${money(totals.discount)}`} />}
            {totals.tax > 0 && <Row k="Tax" v={money(totals.tax)} />}
            <Row k="Total" v={money(totals.total)} strong />
            {totals.paid > 0 && <Row k="Paid" v={money(totals.paid)} />}
            {totals.paid > 0 && <Row k="Balance due" v={money(totals.balance)} strong />}
          </dl>
          {pending.length > 0 && <p className="border-t border-line/70 px-4 py-2 text-xs text-ink-3">Totals include items awaiting your approval; declined items are removed.</p>}
          {report.payLink && (
            <div className="border-t border-line/70 px-4 py-3">
              <a href={report.payLink} target="_blank" rel="noopener noreferrer" className="btn-primary w-full sm:w-auto">
                <CreditCard size={15} /> Pay {money(totals.balance)} now
              </a>
            </div>
          )}
          {report.financing && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 px-4 py-3 text-sm">
              <span>
                <span className="font-medium text-ink">Financing available</span>
                <span className="block text-xs text-ink-3">
                  As low as {money(report.financing.monthly)}/mo for {report.financing.months} months ({report.financing.apr}% APR example, subject to approval)
                  {report.financing.provider ? ` · ${report.financing.provider}` : ''}
                </span>
              </span>
              {report.financing.url && (
                <a href={report.financing.url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                  Apply
                </a>
              )}
            </div>
          )}
        </Block>
      )}

      {report.notes.length > 0 && (
        <Block title="Notes from the shop">
          <ul className="divide-y divide-line/70">
            {report.notes.map((n) => (
              <li key={n.at + n.text} className="px-4 py-3">
                <div className="text-xs text-ink-3">{dateTime(n.at)}</div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{n.text}</p>
              </li>
            ))}
          </ul>
        </Block>
      )}

      <footer className="mt-8 border-t border-line pt-4 text-xs leading-5 text-ink-3">
        {shop.warranty && <p>Warranty: {shop.warranty}</p>}
        {vehicle?.vin && <p>VIN {vehicle.vin}</p>}
        <p>
          {shop.name} ·{' '}
          <a href={telHref(shop.phone)} className="hover:text-accent">
            {fmtPhone(shop.phone)}
          </a>
          {shop.email ? ` · ${shop.email}` : ''} · Report updated {dateTime(report.generatedAt)}
        </p>
        <PoweredBy name={shop.name} className="mt-4" />
      </footer>

      {open && <Lightbox items={media} id={open} onNavigate={setOpen} onClose={() => setOpen(null)} Media={Media} />}
    </div>
  );
}

function MediaGrid(props) {
  const { items, size = 'sm', onOpen } = props;
  const Media = props.Media;
  if (!items.length) return null;
  return (
    <div className={`grid gap-2 ${size === 'lg' ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-3 sm:grid-cols-4'}`}>
      {items.map((m) => (
        <button key={m.id} onClick={() => onOpen(m)} className="group relative aspect-[4/3] overflow-hidden rounded-[10px] bg-fill/[0.08]" aria-label={m.caption || (m.kind === 'video' ? 'Play video' : 'View photo')}>
          <Media media={m} variant="thumb" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          {m.kind === 'video' && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
                <Play size={15} fill="currentColor" className="ml-0.5" />
              </span>
            </span>
          )}
          {(m.caption || m.duration != null) && (
            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-5 text-left text-2xs font-medium text-white">
              <span className="line-clamp-2">{m.caption || formatDuration(m.duration)}</span>
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function Block({ title, subtitle, accent, children }) {
  return (
    <section className={`card mb-5 overflow-hidden ${accent ? 'ring-1 ring-accent/40' : ''}`}>
      <div className="card-header">
        <div className="min-w-0">
          <h2 className="card-title">{title}</h2>
          {subtitle && <p className="text-xs text-ink-3">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Row({ k, v, strong }) {
  return (
    <div className={`flex justify-between ${strong ? 'text-md font-semibold text-ink' : 'text-ink-2'}`}>
      <dt>{k}</dt>
      <dd className="tabular">{v}</dd>
    </div>
  );
}

const TIER_LABEL = { good: 'Good', better: 'Better', best: 'Best' };

/** Side-by-side tire options; tappable when the customer is choosing. */
function TireChoice({ s, showPrices, decisions = {}, onDecision }) {
  const q = s.tires;
  const chosen = decisions[`tire:${s.id}`] || q.selectedId;
  const canPick = onDecision && s.status === 'pending';
  return (
    <div className="mt-3 pl-[26px]">
      <div className="mb-2 flex items-center gap-1.5 text-xs text-ink-3">
        <Disc3 size={13} /> {q.qty} tires{q.size ? ` · ${q.size}` : ''}
        {canPick && ' — tap the option you’d like'}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {q.options.map((o) => {
          const on = o.id === chosen;
          const Tag = canPick ? 'button' : 'div';
          return (
            <Tag
              key={o.id}
              {...(canPick ? { type: 'button', onClick: () => onDecision(`tire:${s.id}`, o.id), 'aria-pressed': on } : {})}
              className={`relative rounded-[10px] border p-3 text-left transition-colors ${on ? 'border-accent bg-accent/[0.05] ring-1 ring-accent/30' : 'border-line bg-surface'} ${canPick ? 'hover:border-accent/50' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-2xs font-semibold uppercase tracking-wide text-ink-3">{TIER_LABEL[o.tier] || o.tier}</span>
                {on && (
                  <span className="flex items-center gap-1 text-2xs font-semibold text-accent">
                    <Check size={12} /> Selected
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-ink-3">{o.brand}</div>
              <div className="font-semibold text-ink">{o.model || o.brand}</div>
              <div className="mt-0.5 text-xs text-ink-3">{[q.size, o.spec].filter(Boolean).join(' ')}{o.warranty ? ` · ${o.warranty} mi warranty` : ''}</div>
              {showPrices && o.each != null && (
                <div className="mt-2">
                  <span className="tabular text-lg font-semibold text-ink">{money(o.each)}</span> <span className="text-xs text-ink-3">each · {money(o.set)} set</span>
                </div>
              )}
            </Tag>
          );
        })}
      </div>
    </div>
  );
}

function ServiceRow(props) {
  const { s, showPrices, media, onOpen, children, decisions, onDecision } = props;
  const Media = props.Media;
  const declined = s.status === 'declined';
  const total = totalWithChoice(s, decisions);
  return (
    <li className={`px-4 py-3.5 ${declined ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <Wrench size={16} className="mt-0.5 shrink-0 text-ink-3" />
          <div className="min-w-0">
            <div className={`text-md font-medium text-ink ${declined ? 'line-through' : ''}`}>{s.title}</div>
            <div className="text-xs text-ink-3">
              {s.done && !declined ? 'Completed' : SVC_STATUS[s.status]}
            </div>
          </div>
        </div>
        {showPrices && total != null && (s.noCharge ? <div className="shrink-0 text-md font-semibold text-ink">No charge</div> : <div className="tabular shrink-0 text-md font-semibold text-ink">{money(total)}</div>)}
      </div>
      {(s.cause || s.correction) && (
        <dl className="mt-2 space-y-1 pl-[26px] text-sm">
          {s.cause && (
            <div>
              <dt className="inline font-medium text-ink">What we found: </dt>
              <dd className="inline text-ink-2">{s.cause}</dd>
            </div>
          )}
          {s.correction && (
            <div>
              <dt className="inline font-medium text-ink">What we did: </dt>
              <dd className="inline text-ink-2">{s.correction}</dd>
            </div>
          )}
        </dl>
      )}
      {s.lines.length > 0 && (
        <ul className="mt-2 space-y-0.5 pl-[26px] text-sm text-ink-2">
          {s.lines.map((l, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">
                {l.qty && l.qty !== 1 ? `${l.qty} × ` : ''}
                {l.description}
              </span>
              {showPrices && l.total != null && <span className="tabular shrink-0 text-ink-3">{money(l.total)}</span>}
            </li>
          ))}
        </ul>
      )}
      {s.tires && <TireChoice s={s} showPrices={showPrices} decisions={decisions} onDecision={onDecision} />}
      {media.length > 0 && (
        <div className="mt-3 pl-[26px]">
          <MediaGrid Media={Media} onOpen={onOpen} items={media} />
        </div>
      )}
      {children && <div className="pl-[26px]">{children}</div>}
    </li>
  );
}

function Lightbox(props) {
  const { items, id, onNavigate, onClose } = props;
  const Media = props.Media;
  const idx = items.findIndex((m) => m.id === id);
  const m = items[idx];
  const prev = items[idx - 1];
  const next = items[idx + 1];
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && prev) onNavigate(prev.id);
      if (e.key === 'ArrowRight' && next) onNavigate(next.id);
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [prev, next, onClose, onNavigate]);
  if (!m) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95 text-white" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <div className="flex items-center justify-between px-4 py-3 text-sm text-white/70">
        <span>
          {idx + 1} of {items.length}
        </span>
        <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
          <X size={18} />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        <Media key={m.id} media={m} variant="full" className="max-h-full max-w-full rounded-[6px] object-contain" />
        {prev && (
          <button onClick={() => onNavigate(prev.id)} aria-label="Previous" className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
            <ChevronLeft size={20} />
          </button>
        )}
        {next && (
          <button onClick={() => onNavigate(next.id)} aria-label="Next" className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
            <ChevronRight size={20} />
          </button>
        )}
      </div>
      <p className="min-h-[52px] px-5 py-3 text-center text-sm text-white/85">{m.caption}</p>
    </div>,
    document.body,
  );
}

export function MediaFallback({ media, className }) {
  return (
    <span className={`flex items-center justify-center text-ink-3 ${className}`}>
      <Images size={22} />
      <span className="sr-only">{media.caption}</span>
    </span>
  );
}
