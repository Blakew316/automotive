import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight, Database } from 'lucide-react';
import { PageHeader, Card, SearchInput, Segmented, Spinner, EmptyState } from '../../components/ui';
import { TYPE_LABEL } from '../../lib/catalog';
import { TypeIcon } from './CatalogHome';
import { useCatalogIndex } from '../../lib/usePromise';

export default function CatalogMake() {
  const { make: slug } = useParams();
  const [params, setParams] = useSearchParams();
  const state = useCatalogIndex();
  const [q, setQ] = useState('');
  const year = Number(params.get('year')) || null;
  const [type, setType] = useState('all');
  const make = state.data?.makes.find((m) => m.slug === slug);

  const years = useMemo(() => {
    if (!make) return [];
    const out = [];
    for (let y = make.years[1]; y >= make.years[0]; y -= 1) out.push(y);
    return out;
  }, [make]);
  const typeOptions = useMemo(() => {
    if (!make) return [];
    const present = new Set(make.models.flatMap((m) => m[4]));
    const opts = [{ value: 'all', label: 'All' }];
    for (const t of ['P', 'M', 'T', 'I']) if (present.has(t)) opts.push({ value: t, label: TYPE_LABEL[t], count: make.models.filter((m) => m[4].includes(t)).length });
    return opts;
  }, [make]);
  const models = useMemo(() => {
    if (!make) return [];
    const query = q.trim().toLowerCase();
    return make.models
      .filter(([name, , yf, yt, types]) => (!year || (year >= yf && year <= yt)) && (type === 'all' || types.includes(type)) && (!query || name.toLowerCase().includes(query)))
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }));
  }, [make, q, year, type]);

  if (state.status === 'loading')
    return (
      <div className="flex h-64 items-center justify-center text-ink-3">
        <Spinner size={20} />
      </div>
    );
  if (!make) return <EmptyState icon={Database} title="Make not found" body={state.error?.message} action={<Link to="/catalog" className="btn-secondary">All makes</Link>} />;

  return (
    <>
      <PageHeader
        back="/catalog"
        title={make.name}
        subtitle={`${make.models.length} model${make.models.length === 1 ? '' : 's'} · ${make.years[0]}–${make.years[1]} · ${make.types.join(', ')}`}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={setQ} placeholder={`Search ${make.name} models`} className="w-full sm:w-72" />
        <select
          className="input w-auto"
          aria-label="Model year"
          value={year || ''}
          onChange={(e) => setParams(e.target.value ? { year: e.target.value } : {}, { replace: true })}
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {typeOptions.length > 2 && <Segmented options={typeOptions} value={type} onChange={setType} size="sm" />}
      </div>
      <Card>
        {models.length === 0 ? (
          <EmptyState icon={Database} title="No models match" body={year ? `Nothing on file for ${year}.` : null} />
        ) : (
          <ul className="divide-y divide-line/70">
            {models.map(([name, mslug, yf, yt, types]) => (
              <li key={mslug}>
                <Link to={`/catalog/${make.slug}/${mslug}${year ? `?year=${year}` : ''}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-fill/[0.03]">
                  <TypeIcon types={types} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                  <span className="hidden text-xs text-ink-3 sm:inline">{types.map((t) => TYPE_LABEL[t]).join(' · ')}</span>
                  <span className="tabular w-24 text-right text-sm text-ink-2">{yf === yt ? yf : `${yf}–${yt}`}</span>
                  <ChevronRight size={15} className="text-ink-4" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="mt-3 text-xs text-ink-3">Year ranges are the model years covered by the manufacturer’s VIN data filed with NHTSA.</p>
    </>
  );
}
