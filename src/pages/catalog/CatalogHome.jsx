import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Database, ScanLine, ChevronRight, CarFront, Truck, Bus, Package } from 'lucide-react';
import { PageHeader, Card, CardHeader, SearchInput, Segmented, Spinner, EmptyState } from '../../components/ui';
import { searchIndex, TYPE_LABEL } from '../../lib/catalog';
import { useCatalogIndex } from '../../lib/usePromise';
import { number } from '../../lib/format';

const POPULAR = [
  'chevrolet', 'ford', 'toyota', 'honda', 'nissan', 'ram', 'gmc', 'jeep', 'hyundai', 'kia', 'subaru', 'volkswagen',
  'bmw', 'mercedes-benz', 'dodge', 'mazda', 'lexus', 'audi', 'tesla', 'buick', 'cadillac', 'chrysler', 'acura', 'infiniti',
  'lincoln', 'volvo', 'mitsubishi', 'porsche', 'land-rover', 'mini', 'genesis', 'rivian',
];

const TYPES = [
  { value: 'all', label: 'All' },
  { value: 'P', label: 'Cars' },
  { value: 'M', label: 'SUVs & vans' },
  { value: 'T', label: 'Trucks' },
  { value: 'I', label: 'Chassis' },
];

export default function CatalogHome() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [type, setType] = useState(params.get('type') || 'all');
  const [cursor, setCursor] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const state = useCatalogIndex();
  const index = state.data;

  useEffect(() => {
    const next = {};
    if (q) next.q = q;
    if (type !== 'all') next.type = type;
    setParams(next, { replace: true });
  }, [q, type, setParams]);

  const stats = useMemo(() => {
    if (!index) return null;
    let models = 0;
    for (const m of index.makes) models += m.models.length;
    return { makes: index.makes.length, models };
  }, [index]);

  const results = useMemo(() => {
    if (!index || !q.trim()) return [];
    return searchIndex(index, q, 60).filter((r) => type === 'all' || r.types.includes(type));
  }, [index, q, type]);

  const makes = useMemo(() => {
    if (!index) return [];
    return index.makes
      .map((m) => ({ ...m, count: type === 'all' ? m.models.length : m.models.filter((x) => x[4].includes(type)).length }))
      .filter((m) => m.count > 0);
  }, [index, type]);
  const popular = useMemo(() => POPULAR.map((s) => makes.find((m) => m.slug === s)).filter(Boolean), [makes]);
  const groups = useMemo(() => {
    const g = new Map();
    for (const m of makes) {
      const ch = /[a-z]/i.test(m.name[0]) ? m.name[0].toUpperCase() : '#';
      if (!g.has(ch)) g.set(ch, []);
      g.get(ch).push(m);
    }
    return [...g.entries()].sort((a, b) => (a[0] === '#' ? 1 : b[0] === '#' ? -1 : a[0].localeCompare(b[0])));
  }, [makes]);

  const go = (r) => navigate(`/catalog/${r.makeSlug}/${r.modelSlug}${r.year ? `?year=${r.year}` : ''}`);

  return (
    <>
      <PageHeader
        title="Vehicle Database"
        subtitle={
          stats
            ? `${number(stats.makes)} makes · ${number(stats.models)} models · 1981–${index.maxYear} — VIN data, diagrams, parts lists and repair guides stored on this site`
            : 'Every make and model in the NHTSA vPIC database, stored on this site'
        }
        actions={<Link to="/vin" className="btn-secondary"><ScanLine size={15} /> Decode a VIN</Link>}
      />

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            inputRef={inputRef}
            autoFocus
            value={q}
            onChange={(v) => {
              setQ(v);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') (e.preventDefault(), setCursor((c) => Math.min(c + 1, results.length - 1)));
              if (e.key === 'ArrowUp') (e.preventDefault(), setCursor((c) => Math.max(c - 1, 0)));
              if (e.key === 'Enter' && results[cursor]) go(results[cursor]);
            }}
            placeholder="Search year, make and model — e.g. 2014 Silverado, Camry, F-450"
            className="flex-1 [&_input]:h-10 [&_input]:text-md"
          />
          <Segmented options={TYPES} value={type} onChange={setType} className="self-start sm:self-auto" />
        </div>
        {q.trim() && index && (
          <div className="mt-3 border-t border-line pt-2">
            {results.length === 0 ? (
              <p className="px-1 py-3 text-sm text-ink-3">No models match “{q}”.</p>
            ) : (
              <ul className="max-h-[420px] divide-y divide-line/60 overflow-y-auto">
                {results.map((r, i) => (
                  <li key={`${r.makeSlug}/${r.modelSlug}`}>
                    <Link
                      to={`/catalog/${r.makeSlug}/${r.modelSlug}${r.year ? `?year=${r.year}` : ''}`}
                      onMouseEnter={() => setCursor(i)}
                      className={`flex items-center gap-3 rounded-[8px] px-2 py-2 text-sm ${i === cursor ? 'bg-fill/[0.07]' : ''}`}
                    >
                      <TypeIcon types={r.types} />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium text-ink">{r.year ? `${r.year} ` : ''}{r.make} {r.model}</span>
                      </span>
                      <span className="hidden text-xs text-ink-3 sm:inline">{r.types.map((t) => TYPE_LABEL[t]).join(' · ')}</span>
                      <span className="tabular w-24 text-right text-xs text-ink-3">{r.yf === r.yt ? r.yf : `${r.yf}–${r.yt}`}</span>
                      <ChevronRight size={15} className="text-ink-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      {state.status === 'loading' && (
        <div className="flex h-48 items-center justify-center text-ink-3">
          <Spinner size={20} />
        </div>
      )}
      {state.status === 'error' && <EmptyState className="mt-6" icon={Database} title="Vehicle data could not be loaded" body={state.error.message} />}

      {index && !q.trim() && (
        <>
          <section className="mt-8">
            <h2 className="section-label mb-3">Popular makes</h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {popular.map((m) => (
                <Link key={m.slug} to={`/catalog/${m.slug}`} className="card group flex flex-col px-3.5 py-3 transition-colors hover:bg-fill/[0.03]">
                  <span className="flex items-center justify-between text-md font-semibold tracking-tight">
                    {m.name}
                    <ChevronRight size={15} className="text-ink-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="text-xs text-ink-3">
                    {m.count} model{m.count === 1 ? '' : 's'} · {m.years[0]}–{m.years[1]}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <Card className="mt-8">
            <CardHeader
              icon={Database}
              title="All makes"
              subtitle={`${number(makes.length)} makes${type !== 'all' ? ` with ${TYPES.find((t) => t.value === type).label.toLowerCase()}` : ''} — passenger cars, SUVs, vans, trucks and incomplete chassis`}
            />
            <nav className="flex flex-wrap gap-x-1 border-b border-line/70 px-3 py-2 text-sm" aria-label="Jump to letter">
              {groups.map(([ch]) => (
                <a
                  key={ch}
                  href={`#make-${ch}`}
                  onClick={(e) => (e.preventDefault(), document.getElementById(`make-${ch}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))}
                  className="rounded-[6px] px-1.5 py-0.5 font-medium text-ink-2 hover:bg-fill/[0.08] hover:text-ink"
                >
                  {ch}
                </a>
              ))}
            </nav>
            <div className="divide-y divide-line/70">
              {groups.map(([ch, list]) => (
                <section key={ch} id={`make-${ch}`} className="scroll-mt-20 px-4 py-3">
                  <h3 className="mb-1.5 text-sm font-semibold text-ink-3">{ch}</h3>
                  <ul className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {list.map((m) => (
                      <li key={m.slug}>
                        <Link to={`/catalog/${m.slug}`} className="-mx-1.5 flex items-baseline justify-between gap-2 rounded-[6px] px-1.5 py-1 text-sm hover:bg-fill/[0.06]">
                          <span className="truncate text-ink">{m.name}</span>
                          <span className="tabular shrink-0 text-xs text-ink-4">{m.count}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </Card>
          <p className="mt-4 text-xs text-ink-3">
            Source: NHTSA Product Information Catalog and Vehicle Listing (vPIC), public domain — manufacturer-submitted VIN data for vehicles sold in the United States.
            Some makes listed are low-volume builders, body companies and chassis upfitters that file VIN data with NHTSA.
          </p>
        </>
      )}
    </>
  );
}

export function TypeIcon({ types = [] }) {
  const Icon = types.includes('P') ? CarFront : types.includes('M') ? CarFront : types.includes('T') ? Truck : types.includes('I') ? Package : Bus;
  return <Icon size={16} strokeWidth={1.8} className="shrink-0 text-ink-3" />;
}
