import { useState } from 'react';
import { Zap, Calculator, CircleDot, ArrowLeftRight } from 'lucide-react';
import { Card, CardHeader, Field, Toggle, Dot } from '../../components/ui';
import { AWG } from '../../data/electrical';

const n = (v) => {
  const x = parseFloat(v);
  return Number.isFinite(x) ? x : null;
};
const fmt = (x, d = 2) => (x == null || !Number.isFinite(x) ? '—' : Number(x.toFixed(d)).toLocaleString('en-US', { maximumFractionDigits: d }));

export default function Tools() {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <VoltageDrop />
      <OhmsLaw />
      <TireSize />
      <Converter />
    </div>
  );
}

function VoltageDrop() {
  const [amps, setAmps] = useState('15');
  const [feet, setFeet] = useState('12');
  const [awg, setAwg] = useState('14');
  const [roundTrip, setRoundTrip] = useState(true);
  const [system, setSystem] = useState('12');
  const wire = AWG.find((a) => a.awg === awg);
  const len = (n(feet) || 0) * (roundTrip ? 2 : 1);
  const drop = (n(amps) || 0) * (wire.ohmPer1000ft / 1000) * len;
  const pctDrop = drop / Number(system);
  const smallest = (limit) => [...AWG].reverse().find((a) => (n(amps) || 0) * (a.ohmPer1000ft / 1000) * len <= limit * Number(system));
  const rec3 = smallest(0.03);
  const rec10 = smallest(0.1);
  const status = pctDrop <= 0.03 ? ['bg-ok', 'Within 3% — good for most circuits'] : pctDrop <= 0.1 ? ['bg-warn', 'Over 3% — OK only for non-critical loads'] : ['bg-bad', 'Over 10% — too much loss; go up in gauge'];

  return (
    <Card>
      <CardHeader icon={Zap} title="Voltage-drop calculator" subtitle="Size wire for a new circuit or sanity-check an existing one" />
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        <Field label="Current (A)">{(id) => <input id={id} className="input tabular" inputMode="decimal" value={amps} onChange={(e) => setAmps(e.target.value)} />}</Field>
        <Field label="Run length (ft)">{(id) => <input id={id} className="input tabular" inputMode="decimal" value={feet} onChange={(e) => setFeet(e.target.value)} />}</Field>
        <Field label="Wire gauge">
          {(id) => (
            <select id={id} className="input" value={awg} onChange={(e) => setAwg(e.target.value)}>
              {AWG.map((a) => <option key={a.awg} value={a.awg}>{a.awg} AWG</option>)}
            </select>
          )}
        </Field>
        <Field label="System">
          {(id) => (
            <select id={id} className="input" value={system} onChange={(e) => setSystem(e.target.value)}>
              <option value="12">12 V</option>
              <option value="24">24 V</option>
              <option value="48">48 V</option>
            </select>
          )}
        </Field>
        <label className="col-span-2 flex items-center gap-2 text-sm text-ink-2 sm:col-span-4">
          <Toggle checked={roundTrip} onChange={setRoundTrip} label="Include return path" /> Include return path (wired ground, not chassis)
        </label>
      </div>
      <div className="grid grid-cols-3 border-t border-line">
        <Out label="Voltage drop" value={`${fmt(drop, 3)} V`} />
        <Out label="Of system voltage" value={`${fmt(pctDrop * 100, 1)}%`} />
        <Out label="Power lost" value={`${fmt(drop * (n(amps) || 0), 1)} W`} />
      </div>
      <div className="space-y-1 border-t border-line/70 px-4 py-3 text-sm">
        <div className="flex items-center gap-2"><Dot className={status[0]} size={7} /> {status[1]}</div>
        <div className="text-ink-2">Smallest wire for ≤3% drop: <span className="font-medium text-ink">{rec3 ? `${rec3.awg} AWG` : 'larger than 2/0'}</span> · for ≤10%: <span className="font-medium text-ink">{rec10 ? `${rec10.awg} AWG` : 'larger than 2/0'}</span></div>
        <p className="text-xs text-ink-3">Diagnostic rule of thumb under load: ~0.1 V across a connection or ground, and well under 0.5 V for a full power or ground side. Resistance only — check the fuse and the wire’s temperature rating separately.</p>
      </div>
    </Card>
  );
}

function OhmsLaw() {
  const [v, setV] = useState('12.6');
  const [i, setI] = useState('');
  const [r, setR] = useState('4');
  const V = n(v);
  const I = n(i);
  const R = n(r);
  let out = {};
  if (V != null && R != null && I == null) out = { I: V / R, P: (V * V) / R };
  else if (V != null && I != null && R == null) out = { R: V / I, P: V * I };
  else if (I != null && R != null && V == null) out = { V: I * R, P: I * I * R };
  else if (V != null && I != null && R != null) out = { P: V * I };
  return (
    <Card>
      <CardHeader icon={Calculator} title="Ohm’s law" subtitle="Enter any two — leave the unknown blank" />
      <div className="grid grid-cols-3 gap-3 p-4">
        <Field label="Voltage (V)">{(id) => <input id={id} className="input tabular" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} placeholder={out.V != null ? fmt(out.V, 3) : ''} />}</Field>
        <Field label="Current (A)">{(id) => <input id={id} className="input tabular" inputMode="decimal" value={i} onChange={(e) => setI(e.target.value)} placeholder={out.I != null ? fmt(out.I, 3) : ''} />}</Field>
        <Field label="Resistance (Ω)">{(id) => <input id={id} className="input tabular" inputMode="decimal" value={r} onChange={(e) => setR(e.target.value)} placeholder={out.R != null ? fmt(out.R, 3) : ''} />}</Field>
      </div>
      <div className="grid grid-cols-2 border-t border-line sm:grid-cols-4">
        <Out label="Voltage" value={out.V != null ? `${fmt(out.V, 3)} V` : V != null ? `${fmt(V, 3)} V` : '—'} />
        <Out label="Current" value={out.I != null ? `${fmt(out.I, 3)} A` : I != null ? `${fmt(I, 3)} A` : '—'} />
        <Out label="Resistance" value={out.R != null ? `${fmt(out.R, 3)} Ω` : R != null ? `${fmt(R, 3)} Ω` : '—'} />
        <Out label="Power" value={out.P != null ? `${fmt(out.P, 1)} W` : '—'} />
      </div>
      <p className="border-t border-line/70 px-4 py-2.5 text-xs text-ink-3">Example: a 2 Ω injector on 13.5 V draws ≈6.75 A — a sign of a low-impedance (peak-and-hold) design.</p>
    </Card>
  );
}

const parseTire = (s) => {
  const m = /^\s*(?:P|LT)?\s*(\d{3})\s*\/\s*(\d{2})\s*Z?R?\s*-?\s*(\d{2}(?:\.\d)?)\s*$/i.exec(s || '');
  if (!m) return null;
  const width = Number(m[1]);
  const aspect = Number(m[2]);
  const rim = Number(m[3]);
  const sidewall = (width * aspect) / 100 / 25.4;
  const dia = rim + 2 * sidewall;
  return { width: width / 25.4, sidewall, dia, circ: dia * Math.PI, revs: 63360 / (dia * Math.PI) };
};

function TireSize() {
  const [a, setA] = useState('265/70R17');
  const [b, setB] = useState('275/65R18');
  const A = parseTire(a);
  const B = parseTire(b);
  const diff = A && B ? (B.dia - A.dia) / A.dia : null;
  const rows = [
    ['Overall diameter', (t) => `${fmt(t.dia, 2)} in`],
    ['Section width', (t) => `${fmt(t.width, 2)} in`],
    ['Sidewall height', (t) => `${fmt(t.sidewall, 2)} in`],
    ['Circumference', (t) => `${fmt(t.circ, 1)} in`],
    ['Revolutions / mile', (t) => fmt(t.revs, 0)],
  ];
  return (
    <Card>
      <CardHeader icon={CircleDot} title="Tire size comparison" subtitle="Metric sizes, e.g. 225/45R17 or LT275/65R18" />
      <div className="grid grid-cols-2 gap-3 p-4">
        <Field label="Original">{(id) => <input id={id} className="input font-mono uppercase" value={a} onChange={(e) => setA(e.target.value)} />}</Field>
        <Field label="New">{(id) => <input id={id} className="input font-mono uppercase" value={b} onChange={(e) => setB(e.target.value)} />}</Field>
      </div>
      <table className="table border-t border-line">
        <thead>
          <tr>
            <th />
            <th className="text-right">Original</th>
            <th className="text-right">New</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, f]) => (
            <tr key={k}>
              <td className="text-ink-2">{k}</td>
              <td className="tabular text-right">{A ? f(A) : '—'}</td>
              <td className="tabular text-right">{B ? f(B) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-line/70 px-4 py-3 text-sm">
        {diff == null ? (
          <span className="text-ink-3">Enter two valid sizes.</span>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Dot className={Math.abs(diff) <= 0.03 ? 'bg-ok' : 'bg-warn'} size={7} />
              Diameter {diff >= 0 ? '+' : ''}{fmt(diff * 100, 1)}% · at an indicated 60 mph you’re actually doing <span className="font-medium">{fmt(60 * (1 + diff), 1)} mph</span>
            </div>
            <p className="mt-1 text-xs text-ink-3">Keep within ±3% to avoid speedometer, ABS and transmission shift-point complaints; larger changes need a PCM/TCM tire-size recalibration.</p>
          </>
        )}
      </div>
    </Card>
  );
}

const CONVERSIONS = [
  { id: 'torque', label: 'Torque', a: 'N·m', b: 'lb·ft', f: (x) => x * 0.737562, r: (x) => x / 0.737562 },
  { id: 'torque-in', label: 'Torque (small)', a: 'N·m', b: 'lb·in', f: (x) => x * 8.85075, r: (x) => x / 8.85075 },
  { id: 'pressure', label: 'Pressure', a: 'psi', b: 'kPa', f: (x) => x * 6.89476, r: (x) => x / 6.89476 },
  { id: 'bar', label: 'Pressure', a: 'bar', b: 'psi', f: (x) => x * 14.5038, r: (x) => x / 14.5038 },
  { id: 'volume', label: 'Volume', a: 'liters', b: 'US quarts', f: (x) => x * 1.05669, r: (x) => x / 1.05669 },
  { id: 'temp', label: 'Temperature', a: '°C', b: '°F', f: (x) => (x * 9) / 5 + 32, r: (x) => ((x - 32) * 5) / 9 },
  { id: 'length', label: 'Length', a: 'mm', b: 'inches', f: (x) => x / 25.4, r: (x) => x * 25.4 },
  { id: 'distance', label: 'Distance', a: 'km', b: 'miles', f: (x) => x * 0.621371, r: (x) => x / 0.621371 },
];

function Converter() {
  const [vals, setVals] = useState({ torque: { a: '100' } });
  return (
    <Card>
      <CardHeader icon={ArrowLeftRight} title="Unit converter" subtitle="Type in either column" />
      <ul className="divide-y divide-line/70">
        {CONVERSIONS.map((c) => {
          const s = vals[c.id] || {};
          const aVal = s.a ?? (s.b != null && n(s.b) != null ? fmt(c.r(n(s.b)), 3) : '');
          const bVal = s.b ?? (s.a != null && n(s.a) != null ? fmt(c.f(n(s.a)), 3) : '');
          return (
            <li key={c.id} className="grid grid-cols-2 items-center gap-2 px-4 py-2 sm:grid-cols-[110px_1fr_1fr] sm:gap-3">
              <span className="col-span-2 text-sm text-ink-2 sm:hidden">{c.label}</span>
              <span className="hidden text-sm text-ink-2 sm:block">{c.label}</span>
              <label className="relative">
                <input className="input tabular pr-14" inputMode="decimal" value={aVal} onChange={(e) => setVals((v) => ({ ...v, [c.id]: { a: e.target.value } }))} aria-label={c.a} />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-3">{c.a}</span>
              </label>
              <label className="relative">
                <input className="input tabular pr-16" inputMode="decimal" value={bVal} onChange={(e) => setVals((v) => ({ ...v, [c.id]: { b: e.target.value } }))} aria-label={c.b} />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-3">{c.b}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Out({ label, value }) {
  return (
    <div className="min-w-0 border-r border-line/70 px-3 py-3 last:border-0 sm:px-4">
      <div className="truncate text-xs text-ink-3">{label}</div>
      <div className="tabular mt-0.5 truncate text-md font-semibold sm:text-lg">{value}</div>
    </div>
  );
}
