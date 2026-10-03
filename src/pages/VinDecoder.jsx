import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ScanLine, ClipboardPaste, Camera, CircleCheck, CircleAlert, Plus, Car, X, Info, Database, ChevronRight } from 'lucide-react';
import { useShop } from '../store/hooks';
import { PageHeader, Card, CardHeader, Spinner, Modal, Mono, CopyButton, EmptyState } from '../components/ui';
import { VehicleForm } from '../components/forms';
import Scanner from '../components/Scanner';
import { RecallsCard, ComplaintsCard, SafetyCard, ResourcesCard } from '../components/VehicleIntel';
import VehicleKnowledge from '../components/VehicleKnowledge';
import { decodeOffline, cleanVin, autocorrectVin, extractVin, VIN_SECTIONS } from '../lib/vin';
import { decodeVinLocal } from '../lib/vindb';
import { catalogPath, enrichValues } from '../lib/catalog';
import { fullName, vehicleName } from '../lib/format';
import { storageKey } from '../lib/edition';

const RECENT_KEY = storageKey('recent-vins');
const readRecent = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
};

export default function VinDecoder() {
  const { state } = useShop();
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get('vin') || '');
  const [result, setResult] = useState(null);
  const [live, setLive] = useState({ status: 'idle' });
  const [recent, setRecent] = useState(readRecent);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef(null);
  const vin = cleanVin(input);
  const check = decodeOffline(vin);

  const decode = useCallback(async (raw) => {
    const off = decodeOffline(raw);
    setResult(off);
    if (!off.valid) {
      setLive({ status: 'idle' });
      return;
    }
    setParams({ vin: off.vin }, { replace: true });
    setLive({ status: 'loading' });
    try {
      const data = await decodeVinLocal(off.vin);
      if (data.complete) data.values = await enrichValues(data.values, data.make);
      setLive({ status: 'done', data });
      const entry = { vin: off.vin, label: [data.year, data.make, data.model, data.trim].filter(Boolean).join(' '), at: Date.now() };
      setRecent((prev) => {
        const next = [entry, ...prev.filter((r) => r.vin !== off.vin)].slice(0, 8);
        try {
          localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        } catch {
          // Recent list is a convenience only.
        }
        return next;
      });
    } catch (error) {
      setLive({ status: 'error', error });
    }
  }, [setParams]);

  const initial = useRef(params.get('vin'));
  useEffect(() => {
    // Decode a VIN passed in the URL exactly once (e.g. links from vehicles and repair orders).
    if (!initial.current) return;
    const v = initial.current;
    initial.current = null;
    decode(v);
  }, [decode]);

  const d = live.data;
  const vehicle = d && d.make && d.model && d.year ? { year: d.year, make: d.make, model: d.model } : null;
  const onFile = result?.valid && state.vehicles.find((x) => x.vin === result.vin);
  // Balance the two spec columns (3 VIN-derived rows lead the left column).
  const split = Math.max(0, Math.ceil(((d?.specs?.length || 0) + 3) / 2) - 3);

  const submit = (e) => {
    e?.preventDefault();
    decode(vin);
  };

  return (
    <>
      <PageHeader title="VIN Decoder" subtitle="Decodes on this device from the NHTSA vPIC database stored with the app — any vehicle sold in the U.S. since 1981 — with diagrams, parts and repair guides for the exact configuration." />

      <Card className="p-5 sm:p-6">
        <form onSubmit={submit}>
          <label htmlFor="vin-input" className="field-label">Vehicle identification number</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="vin-input"
              ref={inputRef}
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              onPaste={(e) => {
                const found = extractVin(e.clipboardData.getData('text'));
                if (found) {
                  e.preventDefault();
                  setInput(found);
                  decode(found);
                }
              }}
              maxLength={24}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              enterKeyHint="search"
              placeholder="1HGCV1F30LA000000"
              className="input h-12 flex-1 font-mono text-xl uppercase tracking-[0.18em] placeholder:tracking-[0.18em]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary btn-lg"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    const found = extractVin(text) || cleanVin(text);
                    setInput(found);
                    decode(found);
                  } catch {
                    inputRef.current?.focus();
                  }
                }}
              >
                <ClipboardPaste size={16} /> Paste
              </button>
              <button type="button" className="btn-secondary btn-lg" onClick={() => setScanning(true)}>
                <Camera size={16} /> Scan
              </button>
              <button type="submit" className="btn-primary btn-lg min-w-[120px]" disabled={vin.length !== 17 || live.status === 'loading'}>
                {live.status === 'loading' ? <Spinner size={16} /> : <ScanLine size={17} />} Decode
              </button>
            </div>
          </div>
        </form>

        <VinBreakdown vin={vin} />

        <div className="mt-3 min-h-[20px] text-sm">
          {vin.length > 0 && vin.length < 17 && <span className="text-ink-3">{17 - vin.length} more character{17 - vin.length === 1 ? '' : 's'}</span>}
          {vin.length === 17 && check.errors.map((e) => (
            <span key={e} className="flex items-center gap-1.5 text-bad">
              <CircleAlert size={14} /> {e}
              {/[IOQ]/.test(vin) && (
                <button className="ml-1 text-accent hover:underline" onClick={() => setInput(autocorrectVin(vin))}>Fix it</button>
              )}
            </span>
          ))}
          {vin.length === 17 && check.valid && (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-2">
              <span className="flex items-center gap-1.5">
                {check.checkDigitOk ? <CircleCheck size={14} className="text-ok" /> : <CircleAlert size={14} className="text-warn" />}
                {check.checkDigitOk ? 'Check digit valid' : `Check digit ${vin[8]} ≠ ${check.expected}`}
              </span>
              <span>· {check.make || 'Unknown manufacturer'} · {check.country} · {check.year} model year</span>
            </span>
          )}
        </div>

        {(recent.length > 0 || state.vehicles.length > 0) && !result && (
          <div className="mt-4 border-t border-line pt-4">
            <div className="section-label mb-2">{recent.length ? 'Recent' : 'Vehicles in your shop'}</div>
            <div className="flex flex-wrap gap-1.5">
              {(recent.length ? recent : state.vehicles.slice(0, 6).map((v) => ({ vin: v.vin, label: vehicleName(v) }))).map((r) => (
                <button
                  key={r.vin}
                  onClick={() => {
                    setInput(r.vin);
                    decode(r.vin);
                  }}
                  className="chip hover:border-accent/50 hover:text-ink"
                >
                  {r.label || r.vin}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {result && result.valid && (
        <div className="mt-6 space-y-6">
          {onFile && (
            <Link to={`/vehicles/${onFile.id}`} className="card flex items-center gap-3 px-4 py-3 text-sm hover:bg-fill/[0.03]">
              <Car size={18} className="text-ink-3" />
              <span className="flex-1">
                On file: <span className="font-medium">{vehicleName(onFile, { trim: true })}</span>
                {onFile.customerId && <span className="text-ink-3"> · {fullName(state.customers.find((c) => c.id === onFile.customerId))}</span>}
              </span>
              <span className="text-accent">Open vehicle</span>
            </Link>
          )}

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4 px-5 pb-4 pt-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm text-ink-3">
                  <Mono>{result.vin}</Mono>
                  <CopyButton text={result.vin} className="h-6 w-6 px-0" />
                </div>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">
                  {d ? [d.year, d.make, d.model].filter(Boolean).join(' ') || 'Unknown vehicle' : [result.year, result.make].filter(Boolean).join(' ') || 'Decoding…'}
                </h2>
                <p className="text-md text-ink-2">{d ? [d.trim, d.body].filter(Boolean).join(' · ') : live.status === 'loading' ? 'Decoding…' : 'Partial decode'}</p>
              </div>
              <div className="flex gap-2">
                {!onFile && (
                  <button className="btn-secondary" onClick={() => setSaving(true)}>
                    <Plus size={15} /> Save vehicle
                  </button>
                )}
                {onFile && <Link to={`/orders/new?vehicle=${onFile.id}`} className="btn-primary"><Plus size={15} /> Repair order</Link>}
              </div>
            </div>

            {live.status === 'error' && (
              <div className="mx-5 mb-4 flex items-start gap-2 rounded-[9px] border border-line bg-raised px-3 py-2.5 text-sm text-ink-2">
                <Info size={16} className="mt-0.5 shrink-0 text-ink-3" />
                <span>
                  {live.error.message}. Showing what the VIN itself encodes. <button className="text-accent hover:underline" onClick={() => decode(result.vin)}>Try again</button>
                </span>
              </div>
            )}
            {d && !d.complete && d.errorText && (
              <div className="mx-5 mb-4 flex items-start gap-2 rounded-[9px] border border-line bg-raised px-3 py-2.5 text-sm text-ink-2">
                <Info size={16} className="mt-0.5 shrink-0 text-ink-3" />
                <span>{d.errorText.replace(/^\d+ - /, '')}</span>
              </div>
            )}

            <div className="grid border-t border-line md:grid-cols-2">
              <dl className="divide-y divide-line/70 px-5 py-2 md:border-r md:border-line">
                <Spec k="Manufacturer (WMI)" v={`${result.make || '—'} · ${result.wmi}`} />
                <Spec k="Assembly country" v={result.country} />
                <Spec k="Model year (pos. 10)" v={result.year} />
                {(d?.specs || []).slice(0, split).map(([k, v]) => <Spec key={k} k={k} v={v} />)}
              </dl>
              <dl className="divide-y divide-line/70 px-5 py-2">
                {(d?.specs || []).slice(split).map(([k, v]) => <Spec key={k} k={k} v={v} />)}
                {live.status === 'loading' && (
                  <div className="flex items-center gap-2 py-3 text-sm text-ink-3">
                    <Spinner size={14} /> Loading specifications…
                  </div>
                )}
              </dl>
            </div>
            {d?.safety?.length > 0 && (
              <div className="border-t border-line px-5 py-4">
                <div className="section-label mb-2">Safety & driver-assist equipment</div>
                <dl className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                  {d.safety.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 border-b border-line/50 py-1.5 text-sm">
                      <dt className="text-ink-3">{k}</dt>
                      <dd className="text-right text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </Card>

          {vehicle && (
            <section>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Diagrams, parts & repair guides</h2>
                  <p className="text-sm text-ink-3">Generated for this VIN’s configuration from data stored on this site.</p>
                </div>
                <Link to={catalogPath(vehicle)} className="btn-plain btn-sm text-accent">
                  <Database size={14} /> Open in Vehicle Database <ChevronRight size={14} />
                </Link>
              </div>
              <VehicleKnowledge year={vehicle.year} make={vehicle.make} model={vehicle.model} values={d.values} vehicleType={d.vehicleType} />
            </section>
          )}
          {!vehicle && result.make && live.status !== 'loading' && <ResourcesCard year={result.year} make={result.make} vin={result.vin} />}
          {vehicle && (
            <>
              <RecallsCard {...vehicle} vin={result.vin} />
              <div className="grid gap-6 lg:grid-cols-2">
                <ComplaintsCard {...vehicle} />
                <SafetyCard {...vehicle} />
              </div>
              <ResourcesCard {...vehicle} vin={result.vin} />
            </>
          )}
        </div>
      )}

      {!result && (
        <Card className="mt-6">
          <CardHeader title="Reading a VIN" subtitle="49 CFR Part 565 — the same structure every manufacturer uses" />
          <dl className="grid gap-x-8 px-5 py-3 sm:grid-cols-2">
            {VIN_SECTIONS.map((s) => (
              <div key={s.key} className="flex gap-3 border-b border-line/50 py-2 text-sm">
                <dt className="w-24 shrink-0 font-medium">
                  {s.label} <span className="font-normal text-ink-3">{s.range[1] - s.range[0] === 1 ? s.range[1] : `${s.range[0] + 1}–${s.range[1]}`}</span>
                </dt>
                <dd className="text-ink-2">{s.desc}</dd>
              </div>
            ))}
          </dl>
          <p className="px-5 pb-4 text-xs text-ink-3">VINs never use the letters I, O or Q. Position 9 is a check digit computed from the other 16 characters, so most typos are caught before you order a part.</p>
        </Card>
      )}

      {saving && (
        <VehicleForm
          open
          onClose={() => setSaving(false)}
          initial={{ vin: result.vin, year: d?.year || result.year || '', make: d?.make || result.make || '', model: d?.model || '', trim: d?.trim || '', engine: d?.engine || '' }}
        />
      )}
      {scanning && (
        <Scanner
          mode="vin"
          onClose={() => setScanning(false)}
          onResult={(code) => {
            setInput(code);
            decode(code);
          }}
        />
      )}
      {result && !result.valid && <EmptyState className="mt-6" icon={CircleAlert} title="That doesn’t look like a valid VIN" body={result.errors.join(' ')} />}
    </>
  );
}

function Spec({ k, v }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-ink-3">{k}</dt>
      <dd className="text-right text-ink">{v ?? '—'}</dd>
    </div>
  );
}

function VinBreakdown({ vin }) {
  const chars = vin.padEnd(17, ' ').slice(0, 17).split('');
  return (
    <div className="mt-4 overflow-x-auto">
      <div className="flex min-w-[560px] gap-3">
        {VIN_SECTIONS.map((s) => (
          <div key={s.key} style={{ flex: s.range[1] - s.range[0] }} className="min-w-0" title={s.desc}>
            <div className="flex gap-[3px]">
              {chars.slice(s.range[0], s.range[1]).map((ch, i) => {
                const bad = /[IOQ]/.test(ch);
                return (
                  <span key={i} className={`flex h-9 flex-1 items-center justify-center rounded-[6px] font-mono text-md font-medium ${ch.trim() ? (bad ? 'bg-bad/10 text-bad' : 'bg-fill/[0.09] text-ink') : 'bg-fill/[0.05] text-ink-4'}`}>
                    {ch.trim() || '·'}
                  </span>
                );
              })}
            </div>
            <div className="mt-1.5 truncate border-t border-line pt-1 text-2xs font-medium uppercase tracking-wide text-ink-3">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

