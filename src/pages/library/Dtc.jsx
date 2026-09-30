import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleAlert, Stethoscope, ListChecks } from 'lucide-react';
import { Card, CardHeader, SearchInput, Dot, EmptyState, Mono } from '../../components/ui';
import { dtcCodes, dtcDetails, dtcSystems } from '../../data/dtcCodes';

const SEVERITY = {
  low: { label: 'Low — monitor', dot: 'bg-ok' },
  moderate: { label: 'Moderate — repair soon', dot: 'bg-warn' },
  high: { label: 'High — risk of damage', dot: 'bg-bad' },
};

const SUBSYSTEM = {
  0: 'Fuel & air metering, auxiliary emissions',
  1: 'Fuel & air metering',
  2: 'Fuel & air metering — injector circuit',
  3: 'Ignition system or misfire',
  4: 'Auxiliary emission controls',
  5: 'Vehicle speed, idle control & auxiliary inputs',
  6: 'Computer & output circuits',
  7: 'Transmission',
  8: 'Transmission',
  9: 'Transmission',
  A: 'Hybrid propulsion',
};

export default function Dtc() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('code') || '');
  const [system, setSystem] = useState('all');
  const entries = useMemo(() => Object.entries(dtcCodes), []);
  const systems = useMemo(() => [...new Set(entries.map(([, v]) => v.s))], [entries]);
  const selected = (params.get('code') || '').toUpperCase();

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    return entries.filter(([k, v]) => (system === 'all' || v.s === system) && (!query || k.toLowerCase().startsWith(query) || v.d.toLowerCase().includes(query)));
  }, [entries, q, system]);

  const pick = (code) => setParams({ tab: 'dtc', code });
  const exact = dtcCodes[q.trim().toUpperCase()] ? q.trim().toUpperCase() : null;
  const active = selected && dtcCodes[selected] ? selected : exact || results[0]?.[0];
  const code = active && dtcCodes[active];
  const detail = active && dtcDetails[active];
  const letter = active?.[0];
  const generic = active && ['0', '2'].includes(active[1]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Code or keyword — P0420, misfire, EVAP…" className="min-w-[220px] flex-1" autoFocus />
          <select className="input w-auto" value={system} onChange={(e) => setSystem(e.target.value)} aria-label="System">
            <option value="all">All systems</option>
            {systems.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <Card className="max-h-[70vh] overflow-y-auto">
          {results.length === 0 ? (
            <EmptyState icon={CircleAlert} title="No generic code matches" body="Manufacturer-specific codes (P1xxx, B1xxx, U3xxx…) are defined in OEM service information." />
          ) : (
            <ul className="divide-y divide-line/70">
              {results.slice(0, 200).map(([k, v]) => (
                <li key={k}>
                  <button onClick={() => pick(k)} className={`flex w-full items-start gap-3 px-4 py-2 text-left transition-colors ${k === active ? 'bg-accent/[0.07]' : 'hover:bg-fill/[0.04]'}`}>
                    <Mono className="w-14 shrink-0 pt-px font-semibold text-ink">{k}</Mono>
                    <span className="min-w-0 flex-1 text-sm text-ink-2">{v.d}</span>
                    {dtcDetails[k] && <Dot className={SEVERITY[dtcDetails[k].severity]?.dot} size={6} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <p className="mt-2 text-xs text-ink-3">
          {results.length > 200 ? `Showing 200 of ${results.length}. Refine your search.` : `${results.length} code${results.length === 1 ? '' : 's'}`} · {entries.length} generic SAE J2012 definitions · dot = detailed diagnostic guide
        </p>
      </div>

      <div className="min-w-0">
        {code ? (
          <div className="space-y-4 lg:sticky lg:top-4">
            <Card className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="font-mono text-3xl font-bold tracking-tight text-ink">{active}</span>
                  <h2 className="mt-1 text-lg font-semibold leading-6">{code.d}</h2>
                </div>
                {detail && (
                  <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm text-ink-2">
                    <Dot className={SEVERITY[detail.severity]?.dot} size={7} /> {SEVERITY[detail.severity]?.label}
                  </span>
                )}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-line pt-3 text-sm sm:grid-cols-4">
                <div><dt className="text-xs text-ink-3">Domain</dt><dd>{dtcSystems[letter]}</dd></div>
                <div><dt className="text-xs text-ink-3">Type</dt><dd>{generic ? 'Generic (SAE)' : 'Mfr / mixed'}</dd></div>
                <div><dt className="text-xs text-ink-3">System</dt><dd>{code.s}</dd></div>
                {letter === 'P' && <div><dt className="text-xs text-ink-3">Subsystem</dt><dd className="leading-5">{SUBSYSTEM[active[2]] || '—'}</dd></div>}
              </dl>
            </Card>
            {detail ? (
              <>
                <Card>
                  <CardHeader icon={Stethoscope} title="Common causes" subtitle="Most likely first" />
                  <ol className="list-decimal space-y-1.5 px-4 py-3 pl-9 text-sm">
                    {detail.causes.map((c) => <li key={c}>{c}</li>)}
                  </ol>
                </Card>
                <Card>
                  <CardHeader icon={ListChecks} title="Diagnostic checks" />
                  <ol className="list-decimal space-y-1.5 px-4 py-3 pl-9 text-sm">
                    {detail.checks.map((c) => <li key={c}>{c}</li>)}
                  </ol>
                </Card>
              </>
            ) : (
              <Card className="p-4 text-sm text-ink-2">
                No detailed guide for this code yet. Check freeze-frame data, related codes and OEM TSBs — a pattern failure is often documented in the manufacturer’s service information.
              </Card>
            )}
          </div>
        ) : (
          <EmptyState icon={CircleAlert} title="Select a code" />
        )}
      </div>

      <Card className="lg:col-span-2">
        <CardHeader title="Reading a trouble code" subtitle="SAE J2012 structure" />
        <div className="grid gap-4 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><div className="font-mono text-lg font-bold">P<span className="text-ink-4">0420</span></div><p className="text-ink-2">P powertrain · B body · C chassis · U network</p></div>
          <div><div className="font-mono text-lg font-bold"><span className="text-ink-4">P</span>0<span className="text-ink-4">420</span></div><p className="text-ink-2">0 / 2 generic (same on every vehicle) · 1 manufacturer-specific · 3 mixed</p></div>
          <div><div className="font-mono text-lg font-bold"><span className="text-ink-4">P0</span>4<span className="text-ink-4">20</span></div><p className="text-ink-2">Subsystem — e.g. 3 ignition/misfire, 4 emissions, 7 transmission</p></div>
          <div><div className="font-mono text-lg font-bold"><span className="text-ink-4">P04</span>20</div><p className="text-ink-2">Specific fault within that subsystem</p></div>
        </div>
      </Card>
    </div>
  );
}
