// Auto Diagnosis: pick the vehicle, say what it's doing (and any codes), and get the known answers
// first — recalls that may cover it, what owners of the same make/model/year report to NHTSA, what
// fixed it at this shop before, and what the codes mean — with general first checks and an optional
// AI test plan built from that same data.
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Stethoscope, ShieldAlert, MessageSquareWarning, History, ScanLine, ListChecks, Sparkles, StickyNote, CircleAlert, RotateCw, Wrench, ArrowUpRight, Car,
} from 'lucide-react';
import { useShop, useUI, useLookup } from '../store/hooks';
import { PageHeader, Card, CardHeader, SearchInput, Spinner, EmptyState, Dot, ExternalLink } from '../components/ui';
import { ScanButton } from '../components/Scanner';
import AiAssistant from '../components/AiAssistant';
import { keyboard } from '../lib/keyboard';
import { useIsPhone } from '../lib/viewport';
import { getRecalls, getComplaints, nhtsaVinRecallUrl, nhtsaVehicleUrl } from '../lib/nhtsa';
import { decodeOffline, cleanVin } from '../lib/vin';
import { decodeVinLocal } from '../lib/vindb';
import { loadIndex, searchIndex } from '../lib/catalog';
import { OPEN_STATUSES, STATUS } from '../lib/workflow';
import { fullName, vehicleName, number, date, dateShort } from '../lib/format';
import {
  SYMPTOMS, parseCodes, searchTerms, rankComplaints, rankRecalls, commonPhrases, shopFixes, codeInfo, symptomChecks, quickAnswer, diagnosisContext, excerpt, sentenceCase, componentLabel,
} from '../lib/diagnose';

const SEVERITY = { high: { dot: 'bg-bad', label: 'Stop driving / fix soon' }, moderate: { dot: 'bg-warn', label: 'Fix soon' }, low: { dot: 'bg-ok', label: 'Low urgency' } };
const KIND = {
  recall: { icon: ShieldAlert, tone: 'text-bad bg-bad/[0.08]' },
  shop: { icon: History, tone: 'text-hue-teal bg-hue-teal/[0.1]' },
  code: { icon: ScanLine, tone: 'text-accent bg-accent/[0.09]' },
  owners: { icon: MessageSquareWarning, tone: 'text-hue-lilac bg-hue-lilac/[0.1]' },
};
const label = (v) => [v.year, v.make, v.model].filter(Boolean).join(' ');

/** The words that matched, highlighted in a complaint excerpt. */
function Highlight({ text, terms }) {
  if (!terms?.length) return text;
  const re = new RegExp(`((?:^|[^a-z0-9])(?:${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})[a-z0-9-]*)`, 'gi');
  return text.split(re).map((part, i) =>
    i % 2 ? (
      <mark key={i} className="rounded-[3px] bg-hue-amber/[0.2] px-px text-ink">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

/** NHTSA recalls (this model year) and owner complaints (one year either side) for the vehicle. */
function useNhtsa(v) {
  const [data, setData] = useState({ status: 'idle' });
  const [nonce, setNonce] = useState(0);
  const key = v?.year && v?.make && v?.model ? `${v.year}|${v.make}|${v.model}` : '';
  useEffect(() => {
    if (!key) return undefined;
    const k = key;
    const [y, make, model] = key.split('|');
    const year = Number(y);
    const years = [year - 1, year, year + 1].filter((x) => x >= 1990 && x <= new Date().getFullYear() + 1);
    const ctrl = new AbortController();
    let alive = true;
    Promise.resolve()
      .then(() => alive && setData({ key: k, status: 'loading' }))
      .then(() =>
        Promise.allSettled([getRecalls({ year, make, model }, { signal: ctrl.signal }), ...years.map((yr) => getComplaints({ year: yr, make, model }, { signal: ctrl.signal }).then((list) => list.map((c) => ({ ...c, year: yr }))))]),
      )
      .then((res) => {
        if (!alive || !res) return;
        const [recalls, ...lists] = res;
        const got = lists.filter((r) => r.status === 'fulfilled');
        if (recalls.status === 'rejected' && !got.length) throw recalls.reason || new Error('NHTSA did not respond');
        const complaints = got.flatMap((r) => r.value);
        const seen = new Set();
        setData({
          key: k,
          status: 'done',
          recalls: recalls.status === 'fulfilled' ? recalls.value : [],
          complaints: complaints.filter((c) => (seen.has(c.id) ? false : seen.add(c.id))),
          years: `${years[0]}–${years[years.length - 1]}`,
          partial: recalls.status === 'rejected' || got.length < lists.length,
        });
      })
      .catch((error) => alive && setData({ key: k, status: 'error', error }));
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [key, nonce]);
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  // Results always belong to the vehicle on screen; a new vehicle starts out loading.
  return useMemo(() => (data.key === key ? { ...data, retry } : { status: key ? 'loading' : 'idle', retry }), [data, key, retry]);
}

/** Choose the vehicle: one in the shop, a customer's, a VIN (typed or scanned), or year make model. */
function VehiclePicker({ onPick }) {
  const { state } = useShop();
  const lookup = useLookup();
  const [q, setQ] = useState('');
  const [index, setIndex] = useState(null);
  const [vinState, setVinState] = useState(null);
  const [pickYear, setPickYear] = useState(null);
  useEffect(() => {
    loadIndex().then(setIndex, () => {});
  }, []);
  const inShop = useMemo(
    () =>
      state.orders
        .filter((o) => OPEN_STATUSES.includes(o.status) && o.vehicleId)
        .sort((a, b) => b.number - a.number)
        .slice(0, 8)
        .map((o) => ({ order: o, vehicle: lookup.vehicle.get(o.vehicleId) }))
        .filter((x) => x.vehicle),
    [state.orders, lookup],
  );
  const query = q.trim().toLowerCase();
  const vin = cleanVin(q);
  const shopHits = useMemo(() => {
    if (query.length < 2) return [];
    return state.vehicles
      .filter((v) => `${label(v)} ${v.plate || ''} ${v.vin || ''} ${v.unit || ''} ${fullName(lookup.customer.get(v.customerId))}`.toLowerCase().includes(query))
      .slice(0, 6);
  }, [state.vehicles, query, lookup]);
  const ordersHit = /^#?\d{3,}$/.test(query) ? state.orders.find((o) => String(o.number) === query.replace('#', '')) : null;
  const catalogHits = useMemo(() => (index && query.length >= 3 ? searchIndex(index, q, 6).filter((r) => r.types.some((t) => t !== 'I')) : []), [index, q, query]);

  const fromVin = async (raw) => {
    const off = decodeOffline(raw);
    if (!off.valid) return setVinState({ error: off.errors[0] });
    setVinState({ busy: true });
    try {
      const d = await decodeVinLocal(off.vin);
      if (!d.make || !d.model || !d.year) return setVinState({ error: d.errorText || 'Couldn’t read the model from this VIN — enter year, make and model instead.' });
      setVinState(null);
      onPick({ vehicle: { year: d.year, make: d.make, model: d.model, engine: d.engine, vin: off.vin } });
    } catch (e) {
      setVinState({ error: e.message });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="RO #, plate, VIN, customer, or year make model" className="flex-1" />
        <ScanButton mode="vin" className="btn-secondary btn-icon" onResult={(v) => fromVin(v)} title="Scan the VIN barcode" />
      </div>
      {vinState?.busy && (
        <p className="flex items-center gap-2 text-sm text-ink-3">
          <Spinner size={13} /> Reading the VIN…
        </p>
      )}
      {vinState?.error && <p className="text-sm text-bad">{vinState.error}</p>}
      {!query && inShop.length > 0 && (
        <div>
          <div className="section-label mb-1.5">In the shop</div>
          <div className="flex flex-wrap gap-1.5">
            {inShop.map(({ order, vehicle }) => (
              <button key={order.id} className="chip h-8 hover:border-accent/50" onClick={() => onPick({ vehicle, order })}>
                <Dot className={STATUS[order.status]?.dot} size={6} />
                {label(vehicle)} <span className="text-ink-4">#{order.number}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {query && (
        <ul className="divide-y divide-line/70 overflow-hidden rounded-[10px] border border-line">
          {vin.length === 17 && (
            <li>
              <button className="press flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-fill/[0.05]" onClick={() => fromVin(vin)}>
                <ScanLine size={15} className="text-accent" /> Decode VIN <span className="font-mono text-ink-2">{vin}</span>
              </button>
            </li>
          )}
          {ordersHit && lookup.vehicle.get(ordersHit.vehicleId) && (
            <li>
              <button className="press flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-fill/[0.05]" onClick={() => onPick({ vehicle: lookup.vehicle.get(ordersHit.vehicleId), order: ordersHit })}>
                <Wrench size={15} className="text-ink-3" /> RO #{ordersHit.number} · {label(lookup.vehicle.get(ordersHit.vehicleId))}
              </button>
            </li>
          )}
          {shopHits.map((v) => (
            <li key={v.id}>
              <button className="press flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-fill/[0.05]" onClick={() => onPick({ vehicle: v })}>
                <Car size={15} className="text-ink-3" />
                <span className="min-w-0 flex-1 truncate">
                  {label(v)} <span className="text-ink-3">· {fullName(lookup.customer.get(v.customerId))}{v.plate ? ` · ${v.plate}` : ''}</span>
                </span>
              </button>
            </li>
          ))}
          {catalogHits.map((r) => (
            <li key={`${r.makeSlug}/${r.modelSlug}`} className="flex flex-wrap items-center gap-2.5 px-3 py-2 text-sm">
              <Stethoscope size={15} className="text-ink-3" />
              <span className="min-w-0 flex-1 truncate">
                {r.make} {r.model} <span className="text-ink-3">· {r.yf}–{r.yt}</span>
              </span>
              {r.year ? (
                <button className="btn-secondary btn-sm" onClick={() => onPick({ vehicle: { year: r.year, make: r.make, model: r.model } })}>
                  {r.year}
                </button>
              ) : (
                <select
                  className="input h-8 w-auto py-0 text-sm"
                  aria-label={`Year for ${r.make} ${r.model}`}
                  value={pickYear?.key === r.modelSlug ? pickYear.year : ''}
                  onChange={(e) => {
                    setPickYear({ key: r.modelSlug, year: e.target.value });
                    if (e.target.value) onPick({ vehicle: { year: Number(e.target.value), make: r.make, model: r.model } });
                  }}
                >
                  <option value="">Year…</option>
                  {Array.from({ length: Math.min(r.yt, new Date().getFullYear() + 1) - r.yf + 1 }, (_, i) => Math.min(r.yt, new Date().getFullYear() + 1) - i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              )}
            </li>
          ))}
          {!shopHits.length && !catalogHits.length && vin.length !== 17 && !ordersHit && <li className="px-3 py-3 text-sm text-ink-3">No match — try “2018 Ford F-150”, a plate, a VIN or an RO number.</li>}
        </ul>
      )}
    </div>
  );
}

export default function Diagnose() {
  const { state, addNote } = useShop();
  const { toast } = useUI();
  const lookup = useLookup();
  const [params, setParams] = useSearchParams();
  const [concern, setConcern] = useState('');
  const [chosen, setChosen] = useState([]);
  const [codesText, setCodesText] = useState('');
  const [more, setMore] = useState(false);
  const [assist, setAssist] = useState(false);
  const phone = useIsPhone();

  // The vehicle (and repair order) come from the link: ?order=…, ?vehicle=…, or ?year=&make=&model=.
  const orderId = params.get('order');
  const order = useMemo(() => (orderId ? state.orders.find((o) => o.id === orderId) : null), [orderId, state.orders]);
  const shopVehicle = order ? lookup.vehicle.get(order.vehicleId) : params.get('vehicle') ? lookup.vehicle.get(params.get('vehicle')) : null;
  const vehicle = useMemo(
    () => shopVehicle || (params.get('year') && params.get('make') && params.get('model') ? { year: Number(params.get('year')), make: params.get('make'), model: params.get('model'), engine: params.get('engine') || '', vin: params.get('vin') || '' } : null),
    [shopVehicle, params],
  );

  // Opening from a repair order brings its concern and any codes already written on it (once per RO).
  const [seeded, setSeeded] = useState(null);
  if (order && seeded !== order.id) {
    setSeeded(order.id);
    setConcern((c) => c || order.concern || '');
    const written = [order.concern, ...(order.notes || []).map((n) => n.text), ...order.services.flatMap((s) => [s.title, s.cause, s.note])].join(' ');
    const found = parseCodes(written);
    if (found.length) setCodesText((c) => c || found.join(' '));
  }

  const pick = ({ vehicle: v, order: o }) => {
    if (o) setParams({ order: o.id });
    else if (v.id) setParams({ vehicle: v.id });
    else setParams({ year: String(v.year), make: v.make, model: v.model, ...(v.engine ? { engine: v.engine } : {}), ...(v.vin ? { vin: v.vin } : {}) });
  };
  const clear = () => {
    setParams({});
    setConcern('');
    setCodesText('');
    setChosen([]);
  };

  // Typing stays instant; the ranking catches up a beat later.
  const typed = useDeferredValue(concern);
  const typedCodes = useDeferredValue(codesText);
  const codes = useMemo(() => parseCodes(`${typedCodes} ${typed}`), [typedCodes, typed]);
  const { ids, terms, parts } = useMemo(() => searchTerms({ text: typed, symptoms: chosen, codes }), [typed, chosen, codes]);
  const nhtsa = useNhtsa(vehicle);
  const vLabel = vehicle ? label(vehicle) : '';
  const recalls = useMemo(() => (vehicle && nhtsa.status === 'done' ? rankRecalls(nhtsa.recalls, { ids, terms }) : []), [vehicle, nhtsa, ids, terms]);
  const owners = useMemo(() => {
    if (!vehicle || nhtsa.status !== 'done') return null;
    const r = rankComplaints(nhtsa.complaints, { ids, terms });
    return { ...r, phrases: commonPhrases(r.matched, { exclude: [vehicle.make, vehicle.model, 'model', 'year'] }) };
  }, [vehicle, nhtsa, ids, terms]);
  const shop = useMemo(() => (vehicle ? shopFixes(state, { vehicle, terms, codes, parts, excludeOrderId: order?.id }) : null), [state, vehicle, terms, codes, parts, order?.id]);
  const codeList = useMemo(() => codeInfo(codes), [codes]);
  const asked = Boolean(concern.trim() || codes.length || chosen.length);
  const answer = vehicle ? quickAnswer({ codes: codeList, recalls, complaints: owners, fixes: shop?.fixes || [], vehicleLabel: vLabel, concern: asked }) : [];
  const mileage = order?.mileageIn || shopVehicle?.mileage || null;
  const context = () =>
    diagnosisContext({ vehicleLabel: `${vLabel}${vehicle.engine ? `, ${vehicle.engine}` : ''}`, mileage, concern: [concern.trim(), chosen.map((id) => SYMPTOMS.find((s) => s.id === id)?.label).filter(Boolean).join(', ')].filter(Boolean).join(' — '), codes: codeList, recalls, complaints: owners, fixes: shop?.fixes || [], years: nhtsa.years });

  const addToRo = () => {
    const lines = [`Auto diagnosis — ${vLabel}${codes.length ? ` · ${codes.join(', ')}` : ''}`, ...answer.map((a) => `• ${a.title}: ${a.detail}`)];
    if (!answer.length) lines.push('• No known pattern found in recalls, NHTSA owner reports or this shop’s history.');
    addNote(order.id, lines.join('\n'), true);
    toast('Added to the repair order’s notes', { tone: 'success' });
  };

  return (
    <>
      <PageHeader
        title="Auto Diagnosis"
        subtitle="Known problems for the vehicle — recalls, what owners report to NHTSA, and what fixed it here — ranked against the concern."
        actions={
          vehicle && (
            <>
              <button className="btn-secondary" onClick={() => setAssist(true)}>
                <Sparkles size={15} /> AI test plan
              </button>
              {order && (
                <button className="btn-primary" onClick={addToRo}>
                  <StickyNote size={15} /> Add to RO #{order.number}
                </button>
              )}
            </>
          )
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* What we're diagnosing */}
        <Card className="lg:sticky lg:top-6">
          <div className="space-y-4 p-4">
            <div>
              <div className="field-label">Vehicle</div>
              {vehicle ? (
                <div className="flex items-start gap-3 rounded-[10px] border border-line bg-raised px-3 py-2.5">
                  <Car size={18} className="mt-0.5 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold" data-testid="dx-vehicle">{vLabel}</div>
                    <div className="truncate text-xs text-ink-3">
                      {[vehicle.engine, mileage && `${number(mileage)} mi`, order && `RO #${order.number}`, shopVehicle?.customerId && fullName(lookup.customer.get(shopVehicle.customerId))].filter(Boolean).join(' · ') || 'Year, make and model'}
                    </div>
                  </div>
                  <button className="btn-plain btn-sm -mr-1" onClick={clear}>Change</button>
                </div>
              ) : (
                <VehiclePicker onPick={pick} />
              )}
            </div>
            <label className="block">
              <span className="field-label">What’s it doing?</span>
              <textarea
                rows={3}
                value={concern}
                onChange={(e) => setConcern(e.target.value)}
                placeholder="e.g. rough idle when cold, stumbles on acceleration, check engine light"
                className="input min-h-[76px] resize-none [field-sizing:content]"
                aria-label="Concern"
              />
            </label>
            {/* On a phone the concerns are one swipeable row, so the answers stay close. */}
            <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" role="group" aria-label="Common concerns">
              {SYMPTOMS.map((s) => {
                const on = ids.includes(s.id);
                return (
                  <button
                    key={s.id}
                    aria-pressed={on}
                    onClick={() => setChosen((c) => (c.includes(s.id) ? c.filter((x) => x !== s.id) : [...c, s.id]))}
                    className={`chip h-7 shrink-0 ${on ? 'border-accent/60 bg-accent/[0.09] text-ink' : 'hover:border-ink-4'}`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            <label className="block">
              <span className="field-label">Trouble codes</span>
              <input {...keyboard.code} value={codesText} onChange={(e) => setCodesText(e.target.value)} placeholder="P0302 P0305" className="input font-mono uppercase" aria-label="Trouble codes" enterKeyHint="done" />
            </label>
            {codes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {codes.map((c) => (
                  <span key={c} className="chip h-7 font-mono">{c}</span>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* What's known */}
        <div className="min-w-0 space-y-5">
          {!vehicle ? (
            <Card>
              <EmptyState icon={Stethoscope} title="Pick the vehicle to start" body="Choose one in the shop, search a customer’s vehicle or plate, scan or type a VIN, or enter year make model. Recalls and known problems show up right away; add the concern and codes to narrow them down." />
            </Card>
          ) : (
            <>
              <Card className="foil-top">
                <CardHeader icon={Stethoscope} tone="navy" title={asked ? 'Quick answer' : `Known problems: ${vLabel}`} subtitle={asked ? 'The strongest leads, best first — verify before replacing parts' : 'Add what it’s doing and any codes to narrow these down'} />
                <ul className="divide-y divide-line/70" data-testid="dx-answer">
                  {answer.map((a, i) => {
                    const K = KIND[a.kind];
                    return (
                      <li key={i} className="flex gap-3 px-4 py-3">
                        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${K.tone}`}>
                          <K.icon size={16} />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink">{a.title}</div>
                          <p className="mt-0.5 text-sm text-ink-2">{a.detail}</p>
                          {a.orderId && (
                            <Link to={`/orders/${a.orderId}`} className="mt-1 inline-flex items-center gap-0.5 text-sm text-accent hover:underline">
                              Open that RO <ArrowUpRight size={13} />
                            </Link>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  {nhtsa.status === 'loading' && (
                    <li className="flex items-center gap-2 px-4 py-3 text-sm text-ink-3">
                      <Spinner size={14} /> Checking NHTSA recalls and owner reports for {vLabel}…
                    </li>
                  )}
                  {nhtsa.status === 'error' && (
                    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-ink-2">
                      <span className="flex items-center gap-2">
                        <CircleAlert size={15} className="text-warn" /> Couldn’t reach NHTSA ({nhtsa.error?.message}). Codes and this shop’s history still work offline.
                      </span>
                      <button className="btn-secondary btn-sm" onClick={nhtsa.retry}><RotateCw size={13} /> Retry</button>
                    </li>
                  )}
                  {nhtsa.status === 'done' && !answer.length && (
                    <li className="px-4 py-3 text-sm text-ink-2">{asked ? 'No recall, owner-report pattern or past fix here matches this yet — work through the checks below, and try other words for the symptom.' : 'No recalls or owner-report patterns on file for this vehicle.'}</li>
                  )}
                </ul>
              </Card>

              {codeList.length > 0 && (
                <Card>
                  <CardHeader icon={ScanLine} tone="navy" title="Trouble codes" subtitle="Generic SAE meanings; causes ordered most likely first" />
                  <ul className="divide-y divide-line/70">
                    {codeList.map((c) => (
                      <li key={c.code} className="px-4 py-3">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-mono font-semibold">{c.code}</span>
                          <span className="text-ink">{c.description || 'Manufacturer-specific code — look it up in the OEM service information'}</span>
                          {c.severity && (
                            <span className="inline-flex items-center gap-1 text-xs text-ink-3">
                              <Dot className={SEVERITY[c.severity]?.dot} size={6} /> {SEVERITY[c.severity]?.label}
                            </span>
                          )}
                        </div>
                        {c.causes?.length > 0 && (
                          <div className="mt-2 grid gap-3 sm:grid-cols-2">
                            <div>
                              <div className="section-label mb-1">Likely causes</div>
                              <ol className="list-decimal space-y-0.5 pl-5 text-sm text-ink-2">
                                {c.causes.map((x) => <li key={x}>{x}</li>)}
                              </ol>
                            </div>
                            {/* On a phone the checks fold away so the other answers stay close. */}
                            <details open={!phone} className="group/checks">
                              <summary className="section-label mb-1 cursor-pointer list-none sm:pointer-events-none">
                                Check{' '}
                                <span className="normal-case tracking-normal text-accent sm:hidden">
                                  · <span className="group-open/checks:hidden">show</span>
                                  <span className="hidden group-open/checks:inline">hide</span>
                                </span>
                              </summary>
                              <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink-2">
                                {c.checks?.map((x) => <li key={x}>{x}</li>)}
                              </ul>
                            </details>
                          </div>
                        )}
                        {c.known && !c.causes && <Link to={`/library?tab=dtc&code=${c.code}`} className="mt-1 inline-block text-sm text-accent hover:underline">Open in the code library</Link>}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {shop && (shop.fixes.length > 0 || shop.common.length > 0) && (
                <Card>
                  <CardHeader icon={History} tone="teal" title={shop.fixes.length ? 'Fixed here before' : `Common repairs on ${vehicle.make} ${vehicle.model} here`} subtitle={shop.fixes.length ? 'This shop’s repair orders with a matching concern, codes or cause' : `${shop.orders} repair order${shop.orders === 1 ? '' : 's'} on this model`} />
                  <ul className="divide-y divide-line/70">
                    {(shop.fixes.length ? shop.fixes : shop.common).map((f) => (
                      <li key={f.title} className="px-4 py-3 text-sm">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="font-semibold text-ink">{f.title}</span>
                          <span className="text-xs text-ink-3">
                            {f.n}×{f.sameModel != null ? ` · ${f.sameModel} on this model` : ''}
                            {f.hours ? ` · about ${f.hours} h` : ''}
                          </span>
                        </div>
                        {(f.cause || f.correction) && (
                          <p className="mt-0.5 text-ink-2">
                            {f.cause && <>Cause: {f.cause}. </>}
                            {f.correction && <>Correction: {f.correction}.</>}
                          </p>
                        )}
                        {f.last && (
                          <Link to={`/orders/${f.last.id}`} className="mt-0.5 inline-flex items-center gap-0.5 text-xs text-accent hover:underline">
                            Last on RO #{f.last.number}{f.lastVehicle ? ` · ${vehicleName(f.lastVehicle)}` : ''} · {dateShort(f.last.closedAt || f.last.createdAt)}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {nhtsa.status === 'done' && (
                <Card>
                  <CardHeader
                    icon={ShieldAlert}
                    tone="rose"
                    title={`Recalls · ${vehicle.year}`}
                    subtitle={recalls.length ? `${recalls.length} for this model year${recalls.some((r) => r.related) ? ` · ${recalls.filter((r) => r.related).length} may relate` : ''}` : 'None on file with NHTSA for this model year'}
                    actions={vehicle.vin ? <ExternalLink href={nhtsaVinRecallUrl(vehicle.vin)} className="text-sm">Open recalls for this VIN</ExternalLink> : null}
                  />
                  {recalls.length > 0 && (
                    <ul className="divide-y divide-line/70">
                      {recalls.slice(0, more ? 30 : 4).map((r) => (
                        <li key={r.campaign} className="px-4 py-3 text-sm">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-mono text-xs text-ink-3">{r.campaign}</span>
                            <span className="font-semibold text-ink">{componentLabel(r.component)}</span>
                            {r.related && <span className="pill bg-bad/[0.1] text-bad">May relate</span>}
                            {r.date && <span className="text-xs text-ink-3">{date(r.date)}</span>}
                          </div>
                          <p className="mt-0.5 line-clamp-3 text-ink-2"><Highlight text={sentenceCase(r.summary)} terms={r.hits} /></p>
                          {r.remedy && <p className="mt-0.5 line-clamp-2 text-xs text-ink-3">Remedy: {sentenceCase(r.remedy)}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}

              {owners && (
                <Card>
                  <CardHeader
                    icon={MessageSquareWarning}
                    tone="lilac"
                    title="What owners report"
                    subtitle={`${number(owners.total)} complaints to NHTSA for ${nhtsa.years} ${vehicle.make} ${vehicle.model}${asked ? ` · ${number(owners.matched.length)} match this concern` : ''}`}
                    actions={<ExternalLink href={nhtsaVehicleUrl(vehicle)} className="text-sm">NHTSA</ExternalLink>}
                  />
                  {owners.matched.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-ink-3">{owners.total ? 'None of the owner reports describe this concern.' : 'No owner complaints filed for these model years.'}</p>
                  ) : (
                    <>
                      <div className="grid gap-4 px-4 py-3 sm:grid-cols-2">
                        <div>
                          <div className="section-label mb-2">Systems</div>
                          <ul className="space-y-1.5">
                            {owners.components.map((c) => (
                              <li key={c.name}>
                                <div className="mb-0.5 flex justify-between text-sm">
                                  <span className="truncate text-ink">{componentLabel(c.name)}</span>
                                  <span className="tabular text-ink-3">{c.n}</span>
                                </div>
                                <div className="h-1 rounded-full bg-fill/[0.12]">
                                  <div className="h-full rounded-full" style={{ width: `${(c.n / owners.components[0].n) * 100}%`, background: 'var(--series-1)' }} />
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-3">
                          {owners.phrases.length > 0 && (
                            <div>
                              <div className="section-label mb-1.5">What they describe</div>
                              <div className="flex flex-wrap gap-1.5" data-testid="dx-phrases">
                                {owners.phrases.map((p) => (
                                  <span key={p.phrase} className="chip h-7">
                                    {p.phrase} <span className="tabular text-ink-4">{p.n}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {owners.mileage && (
                            <div>
                              <div className="section-label mb-1">Failure mileage</div>
                              <p className="text-sm text-ink-2">
                                Typically around <b className="text-ink">{number(owners.mileage.median)} mi</b> ({number(owners.mileage.low)}–{number(owners.mileage.high)}, {owners.mileage.n} reports)
                              </p>
                            </div>
                          )}
                          {(owners.crashes > 0 || owners.fires > 0) && (
                            <p className="flex items-center gap-1.5 text-sm text-bad">
                              <CircleAlert size={14} /> {[owners.crashes && `${owners.crashes} involved a crash`, owners.fires && `${owners.fires} a fire`].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <ul className="divide-y divide-line/70 border-t border-line/70">
                        {owners.matched.slice(0, more ? 20 : 4).map((c) => (
                          <li key={c.id} className="px-4 py-2.5 text-sm">
                            <div className="mb-0.5 text-xs text-ink-3">
                              {c.year} · {c.date ? dateShort(c.date) : ''} · {c.components.slice(0, 2).map(componentLabel).join(', ')}
                              {c.crash && ' · crash'}
                              {c.fire && ' · fire'}
                            </div>
                            <p className="text-ink-2">
                              <Highlight text={excerpt(c.summary, c.hits || [])} terms={c.hits} />
                            </p>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {(owners.matched.length > 4 || recalls.length > 4) && (
                    <div className="border-t border-line/70 px-4 py-2">
                      <button className="btn-plain btn-sm" onClick={() => setMore((m) => !m)}>{more ? 'Show fewer' : 'Show more reports and recalls'}</button>
                    </div>
                  )}
                </Card>
              )}

              {ids.length > 0 && (
                <Card>
                  <CardHeader icon={ListChecks} tone="azure" title="First checks" subtitle="General for any vehicle — confirm with the OEM procedure" />
                  <div className="grid gap-4 px-4 py-3 sm:grid-cols-2">
                    {symptomChecks(ids).map((s) => (
                      <div key={s.id}>
                        <div className="mb-1 text-sm font-semibold text-ink">{s.label}</div>
                        <ol className="list-decimal space-y-0.5 pl-5 text-sm text-ink-2">
                          {s.checks.map((x) => <li key={x}>{x}</li>)}
                        </ol>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <p className="px-1 text-xs text-ink-3">
                Recalls and owner complaints come from NHTSA (owner reports are unverified). Fixes come from this shop’s repair orders. Code guidance is generic SAE J2012 — always confirm with the manufacturer’s service information and bulletins.
              </p>
            </>
          )}
        </div>
      </div>

      {assist && vehicle && (
        <AiAssistant
          title={`Test plan · ${vLabel}`}
          subtitle="Built from the recalls, owner reports, shop history and codes above"
          tasks={['diagnose', 'ask']}
          buildContext={() => context()}
          onSaveNote={
            order
              ? (text) => {
                  addNote(order.id, `AI test plan — ${vLabel}\n${text}`, true);
                  toast('Saved to the repair order’s notes', { tone: 'success' });
                }
              : undefined
          }
          onClose={() => setAssist(false)}
        />
      )}
    </>
  );
}
