import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Database, Binary, Plus, Factory } from 'lucide-react';
import { PageHeader, Card, CardHeader, Segmented, Spinner, EmptyState, SearchInput } from '../../components/ui';
import { VehicleForm } from '../../components/forms';
import VehicleKnowledge from '../../components/VehicleKnowledge';
import { loadMake, modelYearRows, buildOptions, vinCodeTable, keyPositions, yearCode, FIELD_LABEL, TYPE_LABEL } from '../../lib/catalog';
import { number } from '../../lib/format';
import { usePromise } from '../../lib/usePromise';

const TYPE_ORDER = ['Passenger Car', 'MPV', 'Truck', 'Incomplete', 'Incomplete Vehicle'];
const TYPE_INITIAL = { 'Passenger Car': 'P', MPV: 'M', Truck: 'T', Incomplete: 'I', 'Incomplete Vehicle': 'I' };

export default function CatalogModel() {
  const { make: makeSlug, model: modelSlug } = useParams();
  const [params, setParams] = useSearchParams();
  const state = usePromise(() => loadMake(makeSlug), makeSlug);

  const data = state.data;
  const model = data?.models.find((m) => m.slug === modelSlug);
  const years = useMemo(() => (model ? [...model.years].sort((a, b) => b - a) : []), [model]);
  const requested = Number(params.get('year'));
  const thisYear = new Date().getFullYear();
  const year = years.includes(requested) ? requested : years.find((y) => y <= thisYear + 1) || years[0];

  if (state.status === 'loading')
    return (
      <div className="flex h-64 items-center justify-center text-ink-3">
        <Spinner size={20} />
      </div>
    );
  if (!model)
    return (
      <EmptyState
        icon={Database}
        title="Model not found"
        body={state.error?.message}
        action={<Link to={`/catalog/${makeSlug}`} className="btn-secondary">Back to make</Link>}
      />
    );

  const setYear = (y) => setParams({ year: String(y) }, { replace: true });
  const idx = years.indexOf(year);
  return <ModelYear key={`${model.slug}-${year}`} make={data} model={model} year={year} years={years} onYear={setYear} prev={years[idx + 1]} next={years[idx - 1]} requested={requested} />;
}

function Choice({ label, options, value, onChange, format = (x) => x }) {
  if (options.length < 2) return null;
  return (
    <div>
      <div className="field-label">{label}</div>
      {options.length <= 4 && options.every((o) => format(o).length < 26) ? (
        <Segmented size="sm" value={value} onChange={onChange} options={options.map((o) => ({ value: o, label: format(o) }))} />
      ) : (
        <select className="input h-8 w-auto max-w-full py-0 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o} value={o}>{format(o)}</option>
          ))}
        </select>
      )}
    </div>
  );
}

const shortDrive = (d) => d.replace(/\/.*$/, '').replace(/-Wheel Drive/i, 'WD').trim();

function ModelYear({ make, model, year, years, onYear, prev, next, requested }) {
  const rows = useMemo(() => modelYearRows(model, year, make.shared), [model, year, make.shared]);
  const options = useMemo(() => buildOptions(rows, make.make, make.sizes), [rows, make]);
  const [engineId, setEngineId] = useState(options.enginesShared ? null : options.engines[0]?.id || null);
  const [body, setBody] = useState(options.bodies[0] || null);
  const [drive, setDrive] = useState(options.drives[0] || null);
  const [trans, setTrans] = useState(options.trans[0] || null);
  const [saving, setSaving] = useState(false);
  const engine = options.engines.find((e) => e.id === engineId) || (options.enginesShared ? null : options.engines[0]);

  const values = useMemo(() => {
    const v = { ...(engine?.values || {}) };
    if (body) v.body = body;
    if (drive) v.drive = drive;
    if (trans) v.trans = trans;
    if (options.brakes.length === 1) v.brake = options.brakes[0];
    if (options.doors.length === 1) v.doors = options.doors[0];
    if (options.gvwr.length === 1) v.gvwr = options.gvwr[0];
    if (options.trims.length === 1) v.trim = options.trims[0];
    if (options.series.length === 1) v.series = options.series[0];
    return v;
  }, [engine, body, drive, trans, options]);

  const vehicleType = Object.keys(TYPE_INITIAL).find((t) => model.types.includes(t));
  const codes = useMemo(() => vinCodeTable(rows), [rows]);

  return (
    <>
      <PageHeader
        back={`/catalog/${make.slug}`}
        backText={make.make}
        title={`${year} ${make.make} ${model.name}`}
        subtitle={[
          [...model.types].sort((a, b) => TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b)).map((t) => TYPE_LABEL[TYPE_INITIAL[t]] || t).join(' · '),
          options.enginesShared ? `${options.engines.length} engines in ${make.make}’s shared table` : `${options.engines.length || 'no'} engine configuration${options.engines.length === 1 ? '' : 's'} on file`,
          requested && requested !== year ? `${requested} not on file — showing ${year}` : null]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <div className="flex items-center rounded-[8px] border border-line bg-surface">
              <button className="btn-plain h-8 w-8 rounded-r-none px-0" disabled={!prev} onClick={() => onYear(prev)} aria-label="Previous model year">
                <ChevronLeft size={16} />
              </button>
              <select className="h-8 border-x border-line bg-transparent px-2 text-sm font-medium outline-none" value={year} onChange={(e) => onYear(Number(e.target.value))} aria-label="Model year">
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button className="btn-plain h-8 w-8 rounded-l-none px-0" disabled={!next} onClick={() => onYear(next)} aria-label="Next model year">
                <ChevronRight size={16} />
              </button>
            </div>
            <button className="btn-secondary" onClick={() => setSaving(true)}>
              <Plus size={15} /> Add to shop
            </button>
          </>
        }
      />

      <Card className="mb-6">
        <CardHeader title="Configuration" subtitle="Choose the engine and build — diagrams, parts and repair guides update to match" />
        <div className="space-y-4 px-4 py-4">
          {options.engines.length > 0 ? (
            <div>
              <div className="field-label">Engine</div>
              {options.enginesShared && (
                <p className="mb-2 text-sm text-ink-2">
                  {make.make} files one engine table for all of its {model.types.includes('Passenger Car') ? 'vehicles' : 'trucks and MPVs'} under these VIN prefixes in {year}, so it lists engines
                  other {make.make} models use too. Pick the one whose code matches the vehicle’s VIN.
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {options.engines.map((e) => {
                  const active = e.id === engine?.id;
                  return (
                    <button
                      key={e.id}
                      onClick={() => setEngineId(e.id)}
                      aria-pressed={active}
                      title={[e.code, e.detail].filter(Boolean).join(' — ') || undefined}
                      className={`rounded-[9px] border px-3 py-2 text-left transition-colors ${active ? 'border-accent bg-accent/[0.06]' : 'border-line hover:bg-fill/[0.04]'}`}
                    >
                      <span className="block text-sm font-semibold text-ink">{e.label}</span>
                      <span className="block truncate text-xs text-ink-3">
                        {[
                          e.vinDigit ? `VIN 8th: ${e.vinDigit}` : null,
                          e.code,
                          e.hp.length ? `${e.hp.length > 1 ? `${e.hp[0]}–${e.hp[e.hp.length - 1]}` : e.hp[0]} hp` : null,
                          e.vinDigit ? null : `${e.keys.length} VIN pattern${e.keys.length === 1 ? '' : 's'}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-2">The manufacturer did not file engine details in its VIN data for this model year — diagrams and parts use body and era conventions.</p>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Choice label="Drive" options={options.drives} value={drive} onChange={setDrive} format={shortDrive} />
            <Choice label="Body" options={options.bodies} value={body} onChange={setBody} />
            <Choice label="Transmission" options={options.trans} value={trans} onChange={setTrans} />
          </div>
          {(options.trims.length > 0 || options.series.length > 0) && (
            <div>
              <div className="field-label">{options.trims.length ? 'Trims' : 'Series'} on file</div>
              <div className="flex flex-wrap gap-1.5">
                {(options.trims.length ? options.trims : options.series).slice(0, 40).map((t) => (
                  <span key={t} className="chip">{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      <VehicleKnowledge
        year={year}
        make={make.make}
        model={model.name}
        values={values}
        vehicleType={vehicleType}
        extraTabs={[
          {
            value: 'vin',
            label: 'VIN codes',
            icon: Binary,
            count: codes.length,
            render: () => <VinCodes codes={codes} year={year} options={options} engine={engine} makeName={make.make} />,
          },
        ]}
      />

      {saving && (
        <VehicleForm
          open
          onClose={() => setSaving(false)}
          initial={{ year, make: make.make, model: model.name, trim: values.trim || '', engine: engine ? [engine.label, engine.code].filter(Boolean).join(' ') : '' }}
        />
      )}
    </>
  );
}

const SHOW = ['model', 'series', 'trim', 'body', 'doors', 'drive', 'eng', 'dispL', 'cyl', 'engCfg', 'fuel', 'fuel2', 'turbo', 'hp', 'trans', 'elec', 'batt', 'kwh', 'evdu', 'brake', 'gvwr', 'engInfo', 'engMfr', 'charger'];

function VinCodes({ codes, year, options, engine, makeName }) {
  const [q, setQ] = useState('');
  const [onlyEngine, setOnlyEngine] = useState(false);
  const [limit, setLimit] = useState(60);
  const engineKeys = useMemo(() => new Set((engine?.keys || []).map((k) => k.key)), [engine]);
  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return codes.filter((c) => (!onlyEngine || engineKeys.has(c.key)) && (!query || Object.values(c.values).join(' ').toLowerCase().includes(query) || c.key.toLowerCase().includes(query)));
  }, [codes, q, onlyEngine, engineKeys]);
  const yc = yearCode(year);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader icon={Binary} title="VIN pattern codes" subtitle={`How the manufacturer encodes ${year} attributes in the VIN · position 10 = “${yc}”`} />
        <div className="flex flex-wrap items-center gap-3 border-b border-line/70 px-4 py-2.5">
          <SearchInput value={q} onChange={setQ} placeholder="Filter by engine, trim, body…" className="w-full sm:w-72" />
          {engine && (
            <label className="flex items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" checked={onlyEngine} onChange={(e) => setOnlyEngine(e.target.checked)} className="accent-[rgb(var(--accent))]" />
              Only the selected engine
            </label>
          )}
          <span className="ml-auto text-xs text-ink-3">{number(list.length)} pattern{list.length === 1 ? '' : 's'}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table min-w-[760px]">
            <thead>
              <tr>
                <th className="w-[290px]">VIN positions 1 – 17</th>
                <th>Sets</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, limit).map((c, i) => (
                <tr key={`${c.key}-${i}`} className={engineKeys.has(c.key) ? 'bg-accent/[0.035]' : ''}>
                  <td className="align-top">
                    <PatternCells pattern={c.key} wmi={c.wmi} yc={yc} />
                  </td>
                  <td className="align-top">
                    <div className="flex flex-wrap gap-1">
                      {c.shared && (
                        <span className="rounded-[6px] border border-line px-1.5 py-0.5 text-xs text-ink-3" title={c.schema}>
                          {makeName}-wide
                        </span>
                      )}
                      {SHOW.filter((f) => c.values[f]).map((f) => (
                        <span key={f} className="inline-flex max-w-full items-baseline gap-1 rounded-[6px] bg-fill/[0.08] px-1.5 py-0.5 text-xs">
                          <span className="text-ink-3">{FIELD_LABEL[f]}</span>
                          <span className="truncate text-ink">{c.values[f]}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length > limit && (
          <div className="border-t border-line/70 px-4 py-2.5 text-center">
            <button className="btn-plain btn-sm" onClick={() => setLimit((n) => n + 200)}>Show more ({number(list.length - limit)} remaining)</button>
          </div>
        )}
        <p className="border-t border-line/70 px-4 py-2 text-xs text-ink-3">
          Dots are positions the pattern doesn’t constrain; brackets list allowed characters. Position 9 is the check digit. A VIN matches every pattern whose positions agree — the most specific pattern wins.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={Binary} title="Manufacturer codes (WMI)" subtitle="VIN positions 1–3" />
          <div className="flex flex-wrap gap-1.5 px-4 py-3">
            {options.wmi.map((w) => (
              <span key={w} className="chip font-mono">{w}</span>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader icon={Factory} title="Assembly plants" subtitle={options.plantsShared ? `VIN position 11 · ${makeName}’s plant table for these VIN prefixes` : 'VIN position 11 (plant code) where filed'} />
          {options.plants.length ? (
            <ul className="divide-y divide-line/70">
              {options.plants.map((p, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className="w-6 text-center font-mono font-semibold">{p.code || '·'}</span>
                  <span className="flex-1 capitalize">{[p.city, p.state, p.country?.replace(/\s*\(.*\)$/, '')].filter(Boolean).map((s) => s.toLowerCase()).join(', ')}</span>
                  {p.company && <span className="truncate text-xs text-ink-3">{p.company}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-ink-3">No plant codes filed for this model year.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function PatternCells({ pattern, wmi, yc }) {
  const slots = keyPositions(pattern);
  const w = (wmi?.[0] || '···').padEnd(3, '·');
  const cells = slots.map((s, i) => {
    if (i < 3) return { ch: w[i], kind: 'wmi' };
    if (i === 8) return { ch: '✓', kind: 'check' };
    if (i === 9) return { ch: yc, kind: 'year' };
    if (s == null) return { ch: '·', kind: 'free' };
    return { ch: s, kind: 'set' };
  });
  return (
    <span className="inline-flex items-center gap-[2px] font-mono text-xs" title={`${wmi?.join(', ') || ''} ${pattern}`}>
      {cells.map((c, i) => (
        <span
          key={i}
          className={`flex h-6 min-w-[15px] items-center justify-center rounded-[4px] px-[2px] ${
            c.kind === 'set' ? 'bg-accent/[0.12] font-semibold text-ink' : c.kind === 'wmi' || c.kind === 'year' ? 'bg-fill/[0.1] text-ink-2' : 'text-ink-4'
          } ${i === 3 || i === 9 ? 'ml-1' : ''}`}
        >
          {c.ch.length > 3 ? `[${c.ch.slice(1, -1).length > 5 ? '…' : c.ch.slice(1, -1)}]` : c.ch}
        </span>
      ))}
      {wmi?.length > 1 && <span className="ml-1 text-2xs text-ink-3">+{wmi.length - 1}</span>}
    </span>
  );
}
