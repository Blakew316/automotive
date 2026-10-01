// Everything the shop needs for one vehicle configuration, generated on-device from the stored
// NHTSA data: configuration facts, system diagrams, a service parts list and repair procedures.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, Cable, Package, Wrench, Info, ClipboardCopy, Check, Search, TriangleAlert } from 'lucide-react';
import { useShop } from '../store/hooks';
import { Tabs, Segmented, Card, CardHeader } from './ui';
import { SpecsCard } from './VehicleIntel';
import { buildProfile, POWERTRAIN_LABEL, DRIVE_LABEL } from '../lib/profile';
import { generatePartsList, countParts } from '../lib/partsList';
import { proceduresFor } from '../lib/procedures';
import { engineLabel } from '../lib/vindb';
import { diagramsFor } from './diagrams';
import { vehicleSpecs } from '../data/vehicleSpecs';
import { number } from '../lib/format';

const INJECTION_LABEL = {
  port: 'Port fuel injection',
  direct: 'Direct injection',
  dual: 'Port + direct injection',
  tbi: 'Throttle-body injection',
  carb: 'Carburetor',
  'common-rail': 'Common-rail diesel',
  diesel: 'Mechanical / unit-injector diesel',
};

/**
 * @param {{year:number, make:string, model:string, values:object, vehicleType?:string, extraTabs?:Array, initialTab?:string}} props
 */
export default function VehicleKnowledge({ year, make, model, values, vehicleType, extraTabs = [], initialTab = 'overview' }) {
  const [tab, setTab] = useState(initialTab);
  const [driveOverride, setDriveOverride] = useState(null);
  const profile = useMemo(() => buildProfile({ year, make, model, values, vehicleType, driveOverride }), [year, make, model, values, vehicleType, driveOverride]);
  const diagrams = useMemo(() => diagramsFor(profile), [profile]);
  const parts = useMemo(() => generatePartsList(profile), [profile]);
  const procedures = useMemo(() => proceduresFor(profile), [profile]);
  const specs = useMemo(() => matchSpecs(profile), [profile]);

  const tabs = [
    { value: 'overview', label: 'Overview', icon: LayoutGrid },
    { value: 'diagrams', label: 'Diagrams', icon: Cable, count: diagrams.length },
    { value: 'parts', label: 'Parts list', icon: Package, count: countParts(parts) },
    { value: 'repairs', label: 'Repair guides', icon: Wrench, count: procedures.length },
    ...extraTabs.map(({ value, label, icon, count }) => ({ value, label, icon, count })),
  ];
  const extra = extraTabs.find((t) => t.value === tab);

  return (
    <div>
      <ConfigStrip p={profile} onDrive={setDriveOverride} driveOverride={driveOverride} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-5 mt-6" />
      {tab === 'overview' && <Overview p={profile} specs={specs} onTab={setTab} counts={{ diagrams: diagrams.length, parts: countParts(parts), procedures: procedures.length }} />}
      {tab === 'diagrams' && <Diagrams p={profile} list={diagrams} />}
      {tab === 'parts' && <PartsList p={profile} groups={parts} specs={specs} />}
      {tab === 'repairs' && <Procedures list={procedures} />}
      {extra && extra.render()}
    </div>
  );
}

function matchSpecs(p) {
  const list = vehicleSpecs.filter((s) => s.make.toLowerCase() === p.make.toLowerCase() && p.model.toLowerCase().startsWith(s.model.toLowerCase()) && p.year >= s.years[0] && p.year <= s.years[1]);
  if (!p.displacement) return list;
  const same = list.filter((s) => {
    const d = parseFloat((s.engine.match(/(\d\.\d)\s*L/i) || [])[1]);
    return !d || Math.abs(d - p.displacement) < 0.15;
  });
  return same;
}

function Fact({ label, value, typical, children }) {
  return (
    <div className="min-w-0 py-2.5">
      <dt className="flex items-center gap-1.5 text-xs text-ink-3">
        {label}
        {typical && <span className="rounded-[4px] bg-fill/[0.1] px-1 text-2xs font-medium text-ink-3" title="Inferred from the configuration — not stated in the NHTSA record">typical</span>}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-ink" title={typeof value === 'string' ? value : undefined}>{value || '—'}</dd>
      {children}
    </div>
  );
}

function ConfigStrip({ p, onDrive, driveOverride }) {
  const sizeInferred = p.ice && p.cylinders && p.sizeSource !== 'vin';
  const engine = !p.ice
    ? p.values.evdu
      ? `Electric · ${p.values.evdu}`
      : 'Electric'
    : sizeInferred
      ? [p.displacement ? `${p.displacement.toFixed(1)}L` : null, p.turbo ? 'Turbo' : null, `${p.layout || ''}${p.cylinders}`, p.fuelKind === 'diesel' ? 'Diesel' : null].filter(Boolean).join(' ')
      : engineLabel(p.values, p.make) || (p.cylinders ? `${p.cylinders}-cyl` : null);
  const facts = [
    { label: 'Powertrain', value: POWERTRAIN_LABEL[p.powertrain] },
    { label: 'Engine', value: [engine, p.engineCode].filter(Boolean).join(' · '), typical: sizeInferred },
    p.ice && { label: 'Fuel system', value: INJECTION_LABEL[p.injection] || p.injection, typical: !p.injectionKnown },
    p.ice && { label: 'Firing order', value: p.firingOrder || 'See OEM data' },
    { label: 'Drive', value: DRIVE_LABEL[p.drive], typical: !p.driveKnown && !driveOverride, drive: true },
    { label: 'Transmission', value: p.transmission },
    { label: 'Body', value: p.bodyText },
    p.electrified && p.battery.kwh ? { label: 'Battery', value: `${p.battery.kwh} kWh${p.battery.type ? ` · ${p.battery.type}` : ''}` } : null,
    p.hp ? { label: 'Output', value: `${number(p.hp)} hp` } : null,
    p.gvwr && { label: 'GVWR', value: p.gvwr.replace(/\s*\(.*\)$/, '') },
  ].filter(Boolean);
  return (
    <Card className="px-5 py-1.5">
      <dl className="grid grid-cols-2 gap-x-6 sm:grid-cols-3 lg:grid-cols-5">
        {facts.map((f) => (
          <Fact key={f.label} label={f.label} value={f.value} typical={f.typical}>
            {f.drive && !p.driveKnown && (
              <Segmented
                size="sm"
                className="mt-1"
                value={driveOverride || p.drive}
                onChange={onDrive}
                options={[
                  { value: 'fwd', label: 'FWD' },
                  { value: 'rwd', label: 'RWD' },
                ]}
              />
            )}
          </Fact>
        ))}
      </dl>
    </Card>
  );
}

function Overview({ p, specs, onTab, counts }) {
  const typical = [
    ['Diagnostics', p.era.canRequired ? 'OBD-II over CAN (required 2008+)' : p.era.canLikely ? 'OBD-II, CAN likely' : p.era.obd2 ? 'OBD-II, pre-CAN protocol' : 'Pre-OBD-II (manufacturer-specific)'],
    p.ice && ['Ignition', p.fuelKind === 'diesel' ? 'Compression ignition · glow plugs' : { likely: 'Coil-on-plug', mixed: 'Coil-on-plug or coil packs', unlikely: 'Distributor or coil packs' }[p.era.coilOnPlug]],
    p.ice && p.fuelKind !== 'diesel' && ['Throttle', { likely: 'Electronic throttle control', mixed: 'Cable or electronic throttle', unlikely: 'Cable throttle with IAC' }[p.era.electronicThrottle]],
    ['Steering', { likely: 'Electric power steering', mixed: 'Hydraulic or electric power steering', unlikely: 'Hydraulic power steering' }[p.era.electricPowerSteering]],
    ['Tire pressure monitoring', p.era.tpms ? 'Required (2008+)' : 'Optional / not equipped'],
    ['Charging system', p.ice && !p.electrified ? (p.era.smartCharging ? 'PCM-controlled alternator likely' : 'Internally regulated alternator') : 'DC-DC converter charges the 12 V battery'],
    ['Driver assistance', { likely: 'Camera / radar ADAS common — calibrate after windshield, bumper or alignment work', possible: 'ADAS available on some trims', unlikely: 'Pre-ADAS era' }[p.era.adas]],
    p.era.backupCamera && ['Rear camera', 'Required (May 2018+)'],
    p.era.startStop === 'possible' && ['Start-stop', 'Possible — AGM/EFB battery & battery sensor if equipped'],
    p.era.electronicParkingBrake === 'possible' && ['Parking brake', 'Electronic parking brake possible — scan-tool service mode'],
    p.fuelKind === 'diesel' && ['Aftertreatment', [p.era.dpf && 'DPF', p.era.scr && 'SCR / DEF', 'EGR'].filter(Boolean).join(' · ')],
    p.flex && ['Fuel', 'Flex-fuel (E85 capable)'],
  ].filter(Boolean);

  const known = Object.entries({
    Trim: p.trim,
    Doors: p.values.doors,
    'Engine notes': p.values.engInfo,
    'Engine manufacturer': p.values.engMfr,
    Brakes: p.values.brake,
    'Charger': p.values.charger,
  }).filter(([, v]) => v);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['diagrams', Cable, 'System diagrams', `${counts.diagrams} diagrams for this configuration`],
            ['parts', Package, 'Service parts list', `${counts.parts} parts across ${p.electrified ? 'all' : 'major'} systems`],
            ['repairs', Wrench, 'Repair guides', `${counts.procedures} procedures with tools & steps`],
          ].map(([t, icon, title, sub]) => {
            const Icon = icon;
            return (
            <button key={t} onClick={() => onTab(t)} className="card flex items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-fill/[0.03]">
              <Icon size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-ink-3" />
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-xs text-ink-3">{sub}</span>
              </span>
            </button>
            );
          })}
        </div>
        <Card>
          <CardHeader title="Systems & equipment" subtitle="Conventions for this model year and configuration — verify on the vehicle" />
          <dl className="divide-y divide-line/70 px-4">
            {typical.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5 py-2.5 text-sm sm:flex-row sm:gap-4">
                <dt className="shrink-0 text-ink-3 sm:w-44">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        {known.length > 0 && (
          <Card>
            <CardHeader title="From the VIN data" subtitle="Stated in the NHTSA record for this configuration" />
            <dl className="divide-y divide-line/70 px-4">
              {known.map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5 py-2.5 text-sm sm:flex-row sm:gap-4">
                  <dt className="shrink-0 text-ink-3 sm:w-44">{k}</dt>
                  <dd className="text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}
      </div>
      <div className="space-y-6">
        <SpecsCard year={p.year} make={p.make} model={p.model} specs={specs} />
        <div className="flex gap-2.5 rounded-[10px] border border-line px-4 py-3 text-xs leading-5 text-ink-3">
          <Info size={15} className="mt-0.5 shrink-0" />
          <p>
            Configuration facts come from the NHTSA vPIC database stored with this app. Anything marked <span className="font-medium text-ink-2">typical</span> is inferred from the
            model year and layout. Diagrams are representative of this configuration — torque values, capacities, connector pin-outs and wire colors must come from factory
            service information.
          </p>
        </div>
      </div>
    </div>
  );
}

function Diagrams({ p, list }) {
  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-1.5" aria-label="Diagrams">
        {list.map((d) => (
          <a key={d.id} href={`#${d.id}`} onClick={(e) => (e.preventDefault(), document.getElementById(d.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))} className="chip hover:border-accent/50 hover:text-ink">
            {d.label}
          </a>
        ))}
      </nav>
      {list.map((d) => (
        <div key={d.id} className="scroll-mt-20">
          <d.Component profile={p} />
        </div>
      ))}
    </div>
  );
}

const lc = (s) => String(s || '').toLowerCase();

// Inventory items from one carmaker's parts brand are never suggested for another make.
const OEM_BRANDS = [
  [/motorcraft|^ford$/i, /ford|lincoln|mercury/i],
  [/acdelco|^gm$/i, /chevrolet|gmc|buick|cadillac|pontiac|oldsmobile|saturn|hummer/i],
  [/mopar/i, /chrysler|dodge|jeep|ram|plymouth|fiat|alfa/i],
  [/^honda$/i, /honda|acura/i],
  [/^toyota$|^lexus$/i, /toyota|lexus|scion/i],
  [/^nissan$/i, /nissan|infiniti/i],
  [/^hyundai$|^kia$/i, /hyundai|kia|genesis/i],
  [/^subaru$/i, /subaru/i],
  [/^mazda$/i, /mazda/i],
  [/^vw$|volkswagen|^audi$/i, /volkswagen|audi|porsche/i],
  [/^bmw$|^mini$/i, /bmw|mini/i],
  [/mercedes/i, /mercedes|smart/i],
];
const brandFits = (brand, make) => {
  const hit = OEM_BRANDS.find(([b]) => b.test(String(brand || '').trim()));
  return !hit || hit[1].test(make);
};

function PartsList({ p, groups, specs }) {
  const { state } = useShop();
  const [copied, setCopied] = useState(false);
  const [q, setQ] = useState('');
  const inventory = state.inventory || [];
  const verified = useMemo(() => {
    const s = specs[0];
    if (!s) return {};
    return {
      'Oil filter': s.oilFilter,
      'Engine air filter': s.engineAirFilter,
      'Cabin air filter': s.cabinAirFilter,
      'Spark plugs': s.sparkPlugs?.part,
      'Engine oil': s.oil ? [s.oil.viscosity, s.oil.spec, s.oil.capacityQt && `${s.oil.capacityQt} qt w/ filter`].filter(Boolean).join(' · ') : null,
    };
  }, [specs]);
  const matchStock = (it) => {
    if (!it.kw) return [];
    return inventory.filter((x) => brandFits(x.brand, p.make) && it.kw.some((k) => lc(`${x.description} ${x.category}`).includes(k))).slice(0, 3);
  };
  const filtered = q.trim()
    ? groups.map((g) => ({ ...g, items: g.items.filter((i) => lc(`${i.name} ${i.note || ''} ${g.system}`).includes(lc(q.trim()))) })).filter((g) => g.items.length)
    : groups;
  const title = [p.year, p.make, p.model].filter(Boolean).join(' ');
  const copy = async () => {
    const text = [
      `${title}${p.trim ? ` ${p.trim}` : ''} — service parts list`,
      ...groups.flatMap((g) => [``, g.system.toUpperCase(), ...g.items.map((i) => `  ${i.qty != null ? `${i.qty} × ` : ''}${i.name}${verified[i.name] ? ` (${verified[i.name]})` : ''}${i.condition ? ` — ${i.condition}` : ''}`)]),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable (permissions) — nothing else to do.
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter parts" className="input h-8 border-transparent bg-fill/[0.1] pl-8 shadow-none focus:bg-surface" />
        </div>
        <button className="btn-secondary btn-sm" onClick={copy}>
          {copied ? <Check size={14} className="text-ok" /> : <ClipboardCopy size={14} />} {copied ? 'Copied' : 'Copy list'}
        </button>
      </div>
      <div className="flex gap-2.5 rounded-[10px] border border-line px-4 py-3 text-xs leading-5 text-ink-3">
        <TriangleAlert size={15} className="mt-0.5 shrink-0" />
        <p>
          Built from this vehicle’s engine, fuel, drivetrain, body and model year. Quantities follow from the configuration; items marked <span className="font-medium text-ink-2">typical</span> depend on the
          exact build. Part numbers are only shown where they have been verified; chips show similar items in your inventory — always confirm fitment by VIN before ordering.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {filtered.map((g) => (
          <Card key={g.system} className="self-start">
            <CardHeader title={g.system} subtitle={`${g.items.length} item${g.items.length === 1 ? '' : 's'}`} />
            <ul className="divide-y divide-line/70">
              {g.items.map((it) => {
                const stock = matchStock(it);
                return (
                  <li key={it.name} className="flex gap-3 px-4 py-2.5">
                    <span className="w-10 shrink-0 pt-px text-right text-sm tabular-nums text-ink-3">{it.qty != null ? `${it.qty}×` : '—'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium text-ink">
                        {it.name}
                        {it.typical && <span className="rounded-[4px] bg-fill/[0.1] px-1 text-2xs font-medium text-ink-3">typical</span>}
                      </div>
                      {verified[it.name] && <div className="mt-0.5 text-xs text-ink-2"><span className="font-medium text-ok">Verified</span> · <span className="font-mono">{verified[it.name]}</span></div>}
                      {it.condition && <div className="mt-0.5 text-xs text-ink-2">{it.condition}</div>}
                      {it.note && <div className="mt-0.5 text-xs text-ink-3">{it.note}</div>}
                      {stock.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {stock.map((s) => (
                            <Link key={s.id} to={`/parts?q=${encodeURIComponent(s.partNumber)}`} className="chip text-2xs hover:border-accent/50 hover:text-ink" title="In your inventory — confirm fitment">
                              <span className={`h-1.5 w-1.5 rounded-full ${s.qty > 0 ? 'bg-ok' : 'bg-ink-4'}`} />
                              {s.brand} {s.partNumber} · {s.qty} on hand
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-sm text-ink-3">No parts match “{q}”.</p>}
      </div>
    </div>
  );
}

function Procedures({ list }) {
  const [open, setOpen] = useState(() => new Set(list.filter((x) => x.first).map((x) => x.id)));
  const toggle = (id) =>
    setOpen((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const systems = [...new Set(list.map((x) => x.system))];
  return (
    <div className="space-y-6">
      <div className="flex gap-2.5 rounded-[10px] border border-line px-4 py-3 text-xs leading-5 text-ink-3">
        <Info size={15} className="mt-0.5 shrink-0" />
        <p>Standard workshop procedures tailored to this configuration. Look up the listed specifications in factory service information before starting.</p>
      </div>
      {systems.map((sys) => (
        <section key={sys}>
          <h3 className="section-label mb-2">{sys}</h3>
          <Card className="divide-y divide-line/70">
            {list
              .filter((x) => x.system === sys)
              .map((x) => (
                <div key={x.id}>
                  <button onClick={() => toggle(x.id)} aria-expanded={open.has(x.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-fill/[0.03]">
                    <Wrench size={15} strokeWidth={1.8} className="shrink-0 text-ink-3" />
                    <span className="flex-1 text-sm font-medium">{x.title}</span>
                    <span className="text-xs text-ink-3">{x.steps.length} steps</span>
                  </button>
                  {open.has(x.id) && (
                    <div className="grid gap-5 px-4 pb-4 pl-11 md:grid-cols-[minmax(0,1fr)_260px]">
                      <ol className="list-decimal space-y-1.5 pl-4 text-sm leading-6 text-ink-2 marker:text-ink-4">
                        {x.steps.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ol>
                      <div className="space-y-4 text-sm">
                        {x.tools?.length > 0 && (
                          <div>
                            <div className="section-label mb-1">Tools</div>
                            <ul className="space-y-0.5 text-ink-2">{x.tools.map((t) => <li key={t}>{t}</li>)}</ul>
                          </div>
                        )}
                        {x.specs?.length > 0 && (
                          <div>
                            <div className="section-label mb-1">Look up in OEM data</div>
                            <ul className="space-y-0.5 text-ink-2">{x.specs.map((t) => <li key={t}>{t}</li>)}</ul>
                          </div>
                        )}
                        {x.cautions?.length > 0 && (
                          <div>
                            <div className="section-label mb-1 text-bad">Cautions</div>
                            <ul className="space-y-0.5 text-ink-2">{x.cautions.map((t) => <li key={t}>{t}</li>)}</ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </Card>
        </section>
      ))}
    </div>
  );
}
