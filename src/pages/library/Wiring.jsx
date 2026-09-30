import { useState } from 'react';
import { Cable, Zap, ToggleRight, Plug, Palette, Ruler, FileText, ArrowUpRight } from 'lucide-react';
import { Card, CardHeader, Segmented } from '../../components/ui';
import { OBD_PINS, OBD_TESTS, RELAY_TERMINALS, RELAY_TESTS, BLADE_FUSES, MAXI_FUSES, JCASE_FUSES, WIRE_COLORS, AWG, TRAILER_4FLAT, TRAILER_7WAY } from '../../data/electrical';
import { freeDocuments, oemPortals } from '../../data/serviceInfo';

export default function Wiring() {
  const wiringDocs = freeDocuments.filter((d) => ['Wiring', 'Service manual', 'Body builder'].includes(d.category));
  const factory = oemPortals.filter((p) => p.offers.some((o) => /wiring|electrical|ETM/i.test(o)));
  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-6">
          <div className="min-w-[240px] flex-1">
            <h2 className="text-lg font-semibold">Vehicle-specific wiring diagrams</h2>
            <p className="mt-1 text-sm text-ink-2">
              Factory schematics, connector end-views and component locations come from each manufacturer’s service portal, sold to independent shops by subscription (many offer 1–3 day access). {factory.length} portals list wiring or electrical troubleshooting manuals in their subscription; every OEM portal is in the OEM service info tab.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {factory.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="chip hover:border-accent/50 hover:text-ink">
                {p.makes.slice(0, 2).join(' / ')} <ArrowUpRight size={11} />
              </a>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader icon={FileText} title="Free official wiring & technical documents" subtitle="Published by the manufacturer — no subscription needed" />
        <ul className="grid divide-y divide-line/70 md:grid-cols-2 md:divide-y-0">
          {wiringDocs.map((d) => (
            <li key={d.id} className="md:border-b md:border-line/70 md:odd:border-r">
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="group flex h-full items-start gap-3 px-4 py-3 hover:bg-fill/[0.04]">
                <FileText size={16} strokeWidth={1.7} className="mt-0.5 shrink-0 text-ink-3" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-sm font-medium">
                    {d.title} <ArrowUpRight size={12} className="shrink-0 text-ink-4 group-hover:text-accent" />
                  </span>
                  <span className="block text-xs text-ink-3">
                    {d.publisher} · {d.category} · {d.format}
                  </span>
                  <span className="mt-0.5 block text-xs leading-4 text-ink-2">{d.description}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Card>

      <ObdCard />
      <div className="grid gap-6 xl:grid-cols-2">
        <RelayCard />
        <FuseCard />
      </div>
      <WireColorCard />
      <div className="grid gap-6 xl:grid-cols-2">
        <TrailerCard />
        <AwgCard />
      </div>
    </div>
  );
}

function ObdCard() {
  const [sel, setSel] = useState(6);
  const pin = OBD_PINS.find((p) => p.pin === sel);
  const W = 420;
  const cell = 38;
  const gap = 8;
  const rowW = 8 * cell + 7 * gap;
  const x0 = (W - rowW) / 2;
  const pos = (n) => {
    const row = n <= 8 ? 0 : 1;
    const i = row ? n - 9 : n - 1;
    return { x: x0 + i * (cell + gap) + (row ? 0 : 0), y: row ? 104 : 46 };
  };
  return (
    <Card>
      <CardHeader icon={Plug} title="OBD-II diagnostic connector (SAE J1962)" subtitle="Vehicle-side DLC, viewed from the front. Select a pin." />
      <div className="grid gap-6 p-4 lg:grid-cols-[440px_minmax(0,1fr)]">
        <div>
          <svg viewBox={`0 0 ${W} 180`} className="h-auto w-full" role="group" aria-label="OBD-II connector pinout">
            <path d={`M${x0 - 26},22 H${W - x0 + 26} L${W - x0 + 6},158 H${x0 - 6} Z`} fill="rgb(var(--fill) / 0.08)" stroke="rgb(var(--ink-3))" strokeWidth="1.5" strokeLinejoin="round" />
            <rect x={W / 2 - 22} y={14} width={44} height={10} rx={3} fill="rgb(var(--surface))" stroke="rgb(var(--ink-3))" strokeWidth="1.5" />
            {OBD_PINS.map((p) => {
              const { x, y } = pos(p.pin);
              const on = p.pin === sel;
              const fill = p.power ? 'rgb(var(--ink-2))' : p.std ? 'var(--series-1)' : 'rgb(var(--surface))';
              return (
                <g key={p.pin} onClick={() => setSel(p.pin)} onKeyDown={(e) => e.key === 'Enter' && setSel(p.pin)} tabIndex={0} role="button" aria-label={`Pin ${p.pin}: ${p.fn}`} className="cursor-pointer outline-none">
                  {on && <rect x={x - 4} y={y - 4} width={cell + 8} height={cell + 8} rx={11} fill="none" stroke="rgb(var(--ink))" strokeWidth="2" />}
                  <rect x={x} y={y} width={cell} height={cell} rx={8} fill={fill} stroke={p.std || p.power ? 'none' : 'rgb(var(--ink-4))'} strokeWidth="1" />
                  <text x={x + cell / 2} y={y + cell / 2} dy="0.35em" textAnchor="middle" style={{ fontSize: 14, fontWeight: 600 }} fill={p.std || p.power ? '#fff' : 'rgb(var(--ink-3))'}>
                    {p.pin}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-ink-2">
            <Legend swatch="var(--series-1)" label="Standard signal" />
            <Legend swatch="rgb(var(--ink-2))" label="Power / ground" />
            <Legend swatch="rgb(var(--surface))" ring label="OEM discretionary" />
          </div>
        </div>
        <div className="min-w-0">
          <div className="rounded-[10px] border border-line p-3">
            <div className="text-xs text-ink-3">Pin {pin.pin}</div>
            <div className="text-lg font-semibold">{pin.fn}</div>
            {pin.note && <p className="text-sm text-ink-2">{pin.note}</p>}
          </div>
          <table className="table mt-3">
            <thead>
              <tr>
                <th className="!px-2">Test</th>
                <th className="!px-2">Expected</th>
              </tr>
            </thead>
            <tbody>
              {OBD_TESTS.map((t) => (
                <tr key={t.test}>
                  <td className="!px-2 align-top font-medium">{t.test}</td>
                  <td className="!px-2 align-top">
                    {t.expect}
                    <div className="text-xs text-ink-3">{t.fault}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

const Legend = ({ swatch, label, ring }) => (
  <span className="flex items-center gap-1.5">
    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: swatch, boxShadow: ring ? 'inset 0 0 0 1px rgb(var(--ink-4))' : undefined }} />
    {label}
  </span>
);

function RelayCard() {
  const stroke = 'rgb(var(--ink-2))';
  return (
    <Card>
      <CardHeader icon={ToggleRight} title="Automotive relay (ISO / DIN 72552)" subtitle="5-pin changeover relay — de-energized state shown" />
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <svg viewBox="0 0 260 190" className="h-auto w-full" aria-label="Relay schematic">
          <rect x="10" y="10" width="240" height="170" rx="12" fill="none" stroke="rgb(var(--line))" strokeWidth="1.5" strokeDasharray="0" />
          {/* coil */}
          <line x1="60" y1="30" x2="60" y2="62" stroke={stroke} strokeWidth="2" />
          <path d="M60,62 q14,6 0,12 q14,6 0,12 q14,6 0,12 q14,6 0,12" fill="none" stroke={stroke} strokeWidth="2" />
          <line x1="60" y1="110" x2="60" y2="160" stroke={stroke} strokeWidth="2" />
          <text x="60" y="24" textAnchor="middle" className="fill-ink" style={{ fontSize: 13, fontWeight: 600 }}>86</text>
          <text x="60" y="175" textAnchor="middle" className="fill-ink" style={{ fontSize: 13, fontWeight: 600 }}>85</text>
          <text x="84" y="92" className="fill-ink-3" style={{ fontSize: 11 }}>coil</text>
          <line x1="80" y1="86" x2="150" y2="86" stroke="rgb(var(--ink-4))" strokeWidth="1.2" strokeDasharray="3 3" />
          {/* switch */}
          <line x1="190" y1="160" x2="190" y2="128" stroke={stroke} strokeWidth="2" />
          <circle cx="190" cy="128" r="3.5" fill={stroke} />
          <line x1="190" y1="128" x2="160" y2="72" stroke="rgb(var(--accent))" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="160" cy="68" r="3.5" fill="none" stroke={stroke} strokeWidth="2" />
          <line x1="160" y1="64" x2="160" y2="30" stroke={stroke} strokeWidth="2" />
          <circle cx="220" cy="68" r="3.5" fill="none" stroke={stroke} strokeWidth="2" />
          <line x1="220" y1="64" x2="220" y2="30" stroke={stroke} strokeWidth="2" />
          <text x="160" y="24" textAnchor="middle" className="fill-ink" style={{ fontSize: 13, fontWeight: 600 }}>87a</text>
          <text x="220" y="24" textAnchor="middle" className="fill-ink" style={{ fontSize: 13, fontWeight: 600 }}>87</text>
          <text x="190" y="175" textAnchor="middle" className="fill-ink" style={{ fontSize: 13, fontWeight: 600 }}>30</text>
          <text x="146" y="72" textAnchor="end" className="fill-ink-3" style={{ fontSize: 10 }}>NC</text>
          <text x="230" y="72" className="fill-ink-3" style={{ fontSize: 10 }}>NO</text>
        </svg>
        <dl className="space-y-2 text-sm">
          {RELAY_TERMINALS.map((r) => (
            <div key={r.t} className="flex gap-3">
              <dt className="w-9 shrink-0 font-mono font-semibold">{r.t}</dt>
              <dd>
                <div className="font-medium">{r.fn}</div>
                <div className="text-xs text-ink-3">{r.detail}</div>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <ol className="list-decimal space-y-1 border-t border-line/70 px-4 py-3 pl-8 text-sm text-ink-2">
        {RELAY_TESTS.map((t) => <li key={t}>{t}</li>)}
      </ol>
    </Card>
  );
}

function FuseIcon({ hex, label }) {
  const light = ['#eeeee8', '#f4f4f0', '#f2c230', '#f2a0c0', '#d4b48c'].includes(hex);
  return (
    <svg viewBox="0 0 40 52" className="h-11 w-auto" aria-hidden>
      <rect x="6" y="2" width="28" height="30" rx="5" fill={hex} stroke={light ? 'rgb(var(--ink-4))' : 'none'} strokeWidth="1" />
      <rect x="10" y="30" width="6" height="18" rx="1" fill="#b8b8bd" />
      <rect x="24" y="30" width="6" height="18" rx="1" fill="#b8b8bd" />
      <text x="20" y="17" dy="0.35em" textAnchor="middle" style={{ fontSize: 11, fontWeight: 700 }} fill={light ? '#1d1d1f' : '#fff'}>{label}</text>
    </svg>
  );
}

function FuseCard() {
  const [kind, setKind] = useState('blade');
  const list = { blade: BLADE_FUSES, maxi: MAXI_FUSES, jcase: JCASE_FUSES }[kind];
  return (
    <Card>
      <CardHeader icon={Zap} title="Fuse color codes" subtitle="ISO 8820-3" actions={<Segmented size="sm" value={kind} onChange={setKind} options={[{ value: 'blade', label: 'Blade' }, { value: 'maxi', label: 'MAXI' }, { value: 'jcase', label: 'J-case' }]} />} />
      <ul className="grid grid-cols-3 gap-x-2 gap-y-3 p-4 sm:grid-cols-4 lg:grid-cols-5">
        {list.map((f) => (
          <li key={f.a} className="flex items-center gap-2">
            <FuseIcon hex={f.hex} label={f.a} />
            <div className="min-w-0 text-xs">
              <div className="font-semibold text-ink">{f.a} A</div>
              <div className="leading-tight text-ink-3">
                {f.color}
                {f.varies && '*'}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="border-t border-line/70 px-4 py-2.5 text-xs text-ink-3">
        {kind === 'blade' && 'Standard, mini and low-profile mini blade fuses share this code.'}
        {kind === 'maxi' && '* Colors at 70/100/120 A vary by brand.'}
        {kind === 'jcase' && 'J-case cartridge colors differ from blade fuses. * Varies — always read the stamped rating.'}
      </p>
    </Card>
  );
}

const Swatch = ({ hex }) => <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: hex, boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.15)' }} />;

function WireColorCard() {
  return (
    <Card>
      <CardHeader icon={Palette} title="Wire color abbreviations" subtitle="How colors are printed in OEM wiring diagrams. Two colors = base / stripe (GN/WH = green with white stripe)." />
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Color</th>
              <th>GM · Ford · Stellantis</th>
              <th>Honda · Acura</th>
              <th>Toyota · Lexus</th>
              <th>German (DIN: VW, Audi, BMW, Mercedes)</th>
            </tr>
          </thead>
          <tbody>
            {WIRE_COLORS.map((w) => (
              <tr key={w.color}>
                <td>
                  <span className="flex items-center gap-2 font-medium">
                    <Swatch hex={w.hex} /> {w.color}
                  </span>
                </td>
                <td className="font-mono text-[12.5px]">{w.us}</td>
                <td className="font-mono text-[12.5px]">{w.honda}</td>
                <td className="font-mono text-[12.5px]">{w.toyota}</td>
                <td className="font-mono text-[12.5px]">{w.din}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TrailerCard() {
  const [scheme, setScheme] = useState('rv');
  return (
    <Card>
      <CardHeader icon={Cable} title="Trailer connectors" subtitle="Pin functions are fixed — wire colors vary. Verify with a test light." />
      <div className="px-4 pt-3">
        <div className="section-label mb-2">4-pin flat</div>
        <div className="flex overflow-hidden rounded-[9px] border border-line">
          {TRAILER_4FLAT.map((w) => (
            <div key={w.color} className="flex-1 border-r border-line/70 px-2 py-2 text-center last:border-0">
              <Swatch hex={w.hex} />
              <div className="mt-1 text-xs font-medium">{w.color}</div>
              <div className="text-2xs leading-3 text-ink-3">{w.fn}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 pb-2 pt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="section-label">7-way RV blade</div>
          <Segmented size="sm" value={scheme} onChange={setScheme} options={[{ value: 'rv', label: 'RV industry' }, { value: 'sae', label: 'SAE J2863' }]} />
        </div>
        <table className="table">
          <tbody>
            {TRAILER_7WAY.map((p) => {
              const [name, hex] = p[scheme];
              return (
                <tr key={p.pin}>
                  <td className="!pl-0 font-mono text-[12.5px] text-ink-3">{p.pin}</td>
                  <td>{p.fn}</td>
                  <td className="!pr-0">
                    <span className="flex items-center justify-end gap-2">
                      {name} <Swatch hex={hex} />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line/70 px-4 py-2.5 text-xs text-ink-3">
        6-pin round: ground, tail, left and right sit on outer pins; the remaining pins carry electric brakes and +12 V auxiliary, but the center pin’s job differs by trailer — confirm with a meter before connecting a brake controller.
      </p>
    </Card>
  );
}

function AwgCard() {
  return (
    <Card>
      <CardHeader icon={Ruler} title="Wire gauge reference" subtitle="Copper at 20 °C (ASTM B258) — use with the voltage-drop calculator in Shop tools" />
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>AWG</th>
              <th className="text-right">Metric (mm²)</th>
              <th className="text-right">Ω / 1000 ft</th>
              <th className="text-right">mΩ / m</th>
            </tr>
          </thead>
          <tbody>
            {AWG.map((a) => (
              <tr key={a.awg}>
                <td className="font-medium">{a.awg}</td>
                <td className="tabular text-right">{a.mm2}</td>
                <td className="tabular text-right">{a.ohmPer1000ft}</td>
                <td className="tabular text-right text-ink-2">{((a.ohmPer1000ft / 304.8) * 1000).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
