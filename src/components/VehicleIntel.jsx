import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, MessageSquareWarning, Star, BookOpen, Package, Cable, RotateCw, CircleCheck, Droplets, Globe, ExternalLink as ExtIcon } from 'lucide-react';
import { Card, CardHeader, Spinner, ExternalLink, Dot } from './ui';
import { getRecalls, getComplaints, getSafetyRatings, nhtsaVinRecallUrl } from '../lib/nhtsa';
import { SUPPLIERS, B2B_PLATFORMS, oemPartsFor } from '../lib/suppliers';
import { oemPortals, freeDocuments } from '../data/serviceInfo';
import { vehicleSpecs } from '../data/vehicleSpecs';
import { date, number } from '../lib/format';

/** Generic async loader keyed on its dependencies. Nothing is fetched until `enabled` is true. */
function useAsync(fn, deps, enabled = true) {
  const [state, setState] = useState({ status: enabled ? 'loading' : 'idle' });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle' });
      return undefined;
    }
    let alive = true;
    const ctrl = new AbortController();
    Promise.resolve()
      .then(() => alive && setState({ status: 'loading' }))
      .then(() => fn({ signal: ctrl.signal }))
      .then((data) => alive && setState({ status: 'done', data }))
      .catch((error) => alive && setState({ status: 'error', error }));
    return () => {
      alive = false;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled]);
  return { ...state, retry: () => setNonce((n) => n + 1) };
}

// Recalls, complaints and crash ratings change daily and are not stored with the app, so they are
// fetched from NHTSA only when the user asks (or has opted in to always check).
const ONLINE_KEY = 'autoshop-pro:online-lookups';
const readOnline = () => {
  try {
    return localStorage.getItem(ONLINE_KEY) === '1';
  } catch {
    return false;
  }
};
function useOnline() {
  const [on, setOn] = useState(readOnline);
  const enable = (always) => {
    if (always) {
      try {
        localStorage.setItem(ONLINE_KEY, '1');
      } catch {
        // Preference only.
      }
    }
    setOn(true);
  };
  return [on, enable];
}

function OnlinePrompt({ what, onEnable }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm text-ink-2">
      <span className="flex items-center gap-2">
        <Globe size={15} className="shrink-0 text-ink-3" /> Live {what} from NHTSA (needs an internet connection).
      </span>
      <span className="flex gap-1.5">
        <button className="btn-secondary btn-sm" onClick={() => onEnable(false)}>Check now</button>
        <button className="btn-plain btn-sm text-ink-3" onClick={() => onEnable(true)}>Always check</button>
      </span>
    </div>
  );
}

function LoadState({ state, children, empty, what = 'data', onEnable }) {
  if (state.status === 'idle') return <OnlinePrompt what={what} onEnable={onEnable} />;
  if (state.status === 'loading')
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-sm text-ink-3">
        <Spinner size={14} /> Checking NHTSA…
      </div>
    );
  if (state.status === 'error')
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-4 text-sm text-ink-2">
        <span>{state.error?.message || 'Could not load'}</span>
        <button className="btn-secondary btn-sm" onClick={state.retry}>
          <RotateCw size={13} /> Retry
        </button>
      </div>
    );
  if (empty) return empty;
  return children;
}

const component = (c = '') => c.split(':').map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 2).join(' › ');

export function RecallsCard({ year, make, model, vin }) {
  const [online, enable] = useOnline();
  const state = useAsync((o) => getRecalls({ year, make, model }, o), [year, make, model], online);
  const [open, setOpen] = useState(null);
  const recalls = state.data || [];
  return (
    <Card>
      <CardHeader
        icon={ShieldAlert}
        title="Safety recalls"
        subtitle={state.status === 'done' ? `${recalls.length} campaign${recalls.length === 1 ? '' : 's'} for ${year} ${make} ${model} · NHTSA` : 'NHTSA'}
        actions={vin && <ExternalLink href={nhtsaVinRecallUrl(vin)} className="text-sm">Check this VIN</ExternalLink>}
      />
      <LoadState
        state={state}
        what="recall campaigns"
        onEnable={enable}
        empty={
          state.status === 'done' && recalls.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-5 text-sm text-ink-2">
              <CircleCheck size={16} className="text-ok" /> No recall campaigns on file for this model year.
            </div>
          ) : null
        }
      >
        <ul className="divide-y divide-line/70">
          {recalls.map((r) => (
            <li key={r.campaign}>
              <button onClick={() => setOpen(open === r.campaign ? null : r.campaign)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-fill/[0.04]">
                <Dot className={r.parkIt || r.parkOutside ? 'bg-bad' : 'bg-warn'} size={7} />
                <span className="-mt-1 min-w-0 flex-1">
                  <span className="block text-sm font-medium capitalize text-ink">{component(r.component) || 'Recall'}</span>
                  <span className="block text-xs text-ink-3">
                    {r.campaign} · {r.date ? date(r.date) : ''}
                    {r.parkIt && ' · Do not drive'}
                    {r.parkOutside && ' · Park outside'}
                    {r.ota && ' · Over-the-air remedy'}
                  </span>
                </span>
              </button>
              {open === r.campaign && (
                <div className="space-y-2 bg-raised px-4 pb-4 pl-9 pt-1 text-sm leading-5 text-ink-2">
                  <p>{r.summary}</p>
                  {r.consequence && <p><span className="font-medium text-ink">Risk: </span>{r.consequence}</p>}
                  {r.remedy && <p><span className="font-medium text-ink">Remedy: </span>{r.remedy}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </LoadState>
      {vin && state.status === 'done' && (
        <p className="border-t border-line/70 px-4 py-2 text-xs text-ink-3">
          Model-year campaigns shown. Whether this specific VIN is still unrepaired comes from the manufacturer — use “Check this VIN”.
        </p>
      )}
    </Card>
  );
}

export function ComplaintsCard({ year, make, model }) {
  const [online, enable] = useOnline();
  const state = useAsync((o) => getComplaints({ year, make, model }, o), [year, make, model], online);
  const list = state.data || [];
  const byComponent = Object.entries(
    list.reduce((acc, c) => {
      c.components.forEach((k) => (acc[k] = (acc[k] || 0) + 1));
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const max = byComponent[0]?.[1] || 1;
  return (
    <Card>
      <CardHeader icon={MessageSquareWarning} title="Owner complaints" subtitle={state.status === 'done' ? `${number(list.length)} reports filed with NHTSA` : 'NHTSA'} />
      <LoadState state={state} what="owner complaints" onEnable={enable} empty={state.status === 'done' && !list.length ? <p className="px-4 py-5 text-sm text-ink-3">No complaints filed.</p> : null}>
        <div className="px-4 py-3">
          <div className="section-label mb-2">Most-reported systems</div>
          <ul className="space-y-2">
            {byComponent.map(([k, n]) => (
              <li key={k}>
                <div className="mb-0.5 flex justify-between text-sm">
                  <span className="truncate capitalize text-ink">{k.toLowerCase()}</span>
                  <span className="tabular text-ink-3">{n}</span>
                </div>
                <div className="h-1 rounded-full bg-fill/[0.12]">
                  <div className="h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: 'var(--series-1)' }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
        {list.slice(0, 3).map((c) => (
          <div key={c.id} className="border-t border-line/70 px-4 py-2.5 text-sm">
            <div className="mb-0.5 text-xs text-ink-3">
              {c.date ? date(c.date) : ''} · {c.components.slice(0, 2).join(', ').toLowerCase()}
              {c.crash && ' · crash'}
              {c.fire && ' · fire'}
            </div>
            <p className="line-clamp-3 text-ink-2">{c.summary}</p>
          </div>
        ))}
      </LoadState>
    </Card>
  );
}

const stars = (r) => {
  const n = Number(r);
  return Number.isFinite(n) && n > 0 ? '★'.repeat(n) + '☆'.repeat(5 - n) : 'Not rated';
};

export function SafetyCard({ year, make, model }) {
  const [online, enable] = useOnline();
  const state = useAsync((o) => getSafetyRatings({ year, make, model }, o), [year, make, model], online);
  const variants = state.data || [];
  return (
    <Card>
      <CardHeader icon={Star} title="NCAP crash ratings" subtitle="NHTSA 5-Star Safety Ratings" />
      <LoadState state={state} what="crash ratings" onEnable={enable} empty={state.status === 'done' && !variants.length ? <p className="px-4 py-5 text-sm text-ink-3">Not tested by NHTSA for this model year.</p> : null}>
        <ul className="divide-y divide-line/70">
          {variants.map((v) => (
            <li key={v.id} className="px-4 py-3">
              <div className="mb-1.5 text-sm font-medium">{v.description}</div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                {[
                  ['Overall', v.overall],
                  ['Frontal', v.front],
                  ['Side', v.side],
                  ['Rollover', v.rollover],
                ].map(([k, r]) => (
                  <div key={k} className="flex justify-between">
                    <dt className="text-ink-3">{k}</dt>
                    <dd className="tracking-[0.1em] text-ink" aria-label={`${r} stars`}>{stars(r)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </LoadState>
    </Card>
  );
}

function findSpecs({ year, make, model }) {
  const y = Number(year);
  return vehicleSpecs.filter((s) => s.make.toLowerCase() === String(make).toLowerCase() && String(model).toLowerCase().startsWith(s.model.toLowerCase()) && y >= s.years[0] && y <= s.years[1]);
}

export function SpecsCard({ year, make, model, specs: given }) {
  const specs = given || findSpecs({ year, make, model });
  const manuals = freeDocuments.filter((d) => d.category === 'Owner manuals' && d.makes.includes(make));
  return (
    <Card>
      <CardHeader icon={Droplets} title="Maintenance specs" subtitle={specs.length ? 'Verified against OEM & retailer sources' : 'Fluids, capacities & filters'} />
      {specs.length ? (
        specs.map((s) => (
          <div key={s.id} className="border-b border-line/70 px-4 py-3 last:border-0">
            <div className="mb-1 text-sm font-medium">{s.engine} <span className="font-normal text-ink-3">· {s.years[0]}–{s.years[1]}</span></div>
            <dl className="divide-y divide-line/50 text-sm">
              {s.oil && <SpecRow k="Engine oil" v={[s.oil.viscosity, s.oil.spec, s.oil.capacityQt && `${s.oil.capacityQt} qt w/ filter`].filter(Boolean).join(' · ')} />}
              {s.oilFilter && <SpecRow k="Oil filter" v={s.oilFilter} mono />}
              {s.engineAirFilter && <SpecRow k="Engine air filter" v={s.engineAirFilter} mono />}
              {s.cabinAirFilter && <SpecRow k="Cabin filter" v={s.cabinAirFilter} mono />}
              {s.sparkPlugs && <SpecRow k="Spark plugs" v={[s.sparkPlugs.part, s.sparkPlugs.gap].filter(Boolean).join(' · ')} mono />}
              {s.coolant && <SpecRow k="Coolant" v={s.coolant} />}
              {s.transmissionFluid && <SpecRow k="Transmission" v={s.transmissionFluid} />}
              {s.brakeFluid && <SpecRow k="Brake fluid" v={s.brakeFluid} />}
            </dl>
            <details className="mt-1.5 text-xs text-ink-3">
              <summary className="cursor-pointer select-none hover:text-ink-2">Sources ({s.sources.length})</summary>
              <ul className="mt-1 space-y-0.5">
                {s.sources.map((u) => (
                  <li key={u} className="truncate">
                    <a href={u} target="_blank" rel="noopener noreferrer" className="hover:text-accent hover:underline">{new URL(u).hostname}</a>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        ))
      ) : (
        <p className="px-4 py-3 text-sm text-ink-2">
          No verified spec sheet for this vehicle yet. The owner’s manual lists oil, fluids, capacities and fuse charts{manuals.length ? ':' : '.'}
        </p>
      )}
      {manuals.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line/70 px-4 py-2.5 text-sm">
          {manuals.map((m) => (
            <ExternalLink key={m.id} href={m.url}>{m.title}</ExternalLink>
          ))}
        </div>
      )}
      <p className="border-t border-line/70 px-4 py-2 text-xs text-ink-3">Always confirm fitment by VIN before ordering.</p>
    </Card>
  );
}

function SpecRow({ k, v, mono }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-ink-3">{k}</dt>
      <dd className={`text-right text-ink ${mono ? 'font-mono text-[12.5px]' : ''}`}>{v}</dd>
    </div>
  );
}

export function ResourcesCard({ year, make, model, vin }) {
  const portal = oemPortals.find((p) => p.makes.includes(make));
  const docs = freeDocuments.filter((d) => d.makes.includes(make) && d.category !== 'Owner manuals');
  const oemParts = oemPartsFor(make);
  const v = { year, make, model };
  return (
    <Card>
      <CardHeader icon={BookOpen} title="Service information & parts" subtitle={`${make} resources for technicians`} />
      <div className="divide-y divide-line/70">
        {portal && (
          <a href={portal.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3 px-4 py-3 hover:bg-fill/[0.04]">
            <BookOpen size={16} strokeWidth={1.8} className="mt-0.5 shrink-0 text-ink-3" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-sm font-medium text-ink">
                {portal.name} <ExtIcon size={12} className="text-ink-4 group-hover:text-accent" />
              </span>
              <span className="block text-xs text-ink-3">Factory {portal.offers.slice(0, 3).join(', ').toLowerCase()} · {portal.access}</span>
            </span>
          </a>
        )}
        {docs.map((d) => (
          <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3 px-4 py-3 hover:bg-fill/[0.04]">
            <Cable size={16} strokeWidth={1.8} className="mt-0.5 shrink-0 text-ink-3" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-sm font-medium text-ink">
                {d.title} <ExtIcon size={12} className="text-ink-4 group-hover:text-accent" />
              </span>
              <span className="block text-xs text-ink-3">{d.category} · free · {d.description}</span>
            </span>
          </a>
        ))}
        <div className="px-4 py-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Package size={16} strokeWidth={1.8} className="text-ink-3" /> Parts catalogs for this vehicle
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUPPLIERS.filter((s) => s.vehicle).map((s) => (
              <a key={s.id} href={s.vehicle(v)} target="_blank" rel="noopener noreferrer" className="chip hover:border-accent/50 hover:text-ink">
                {s.name} <ExtIcon size={11} />
              </a>
            ))}
            {oemParts && (
              <a href={oemParts.url} target="_blank" rel="noopener noreferrer" className="chip hover:border-accent/50 hover:text-ink">
                {oemParts.name} <ExtIcon size={11} />
              </a>
            )}
            {B2B_PLATFORMS.slice(0, 1).map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="chip hover:border-accent/50 hover:text-ink">
                {p.name} <ExtIcon size={11} />
              </a>
            ))}
            <Link to={`/parts?tab=catalog&q=${encodeURIComponent([year, make, model].filter(Boolean).join(' '))}${vin ? `&vin=${vin}` : ''}`} className="chip hover:border-accent/50 hover:text-ink">
              Search all suppliers
            </Link>
          </div>
        </div>
        <Link to="/library?tab=wiring" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-fill/[0.04]">
          <Cable size={16} strokeWidth={1.8} className="shrink-0 text-ink-3" />
          <span className="flex-1">
            <span className="font-medium">Universal wiring references</span>
            <span className="block text-xs text-ink-3">OBD-II pinout, relays, fuses, trailer connectors, voltage-drop calculator</span>
          </span>
        </Link>
      </div>
    </Card>
  );
}
