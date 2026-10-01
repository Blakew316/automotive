// Tire tread and brake pad gauges, and a top-down "tires & brakes at a glance" diagram. Used in the
// inspection and in the customer's report, so the numbers read at a glance.
import { ratingForMeasurement } from '../lib/inspection';

const SPEC = {
  '32nds': { max: 10, zones: [[0, 3, 'bad'], [3, 6, 'warn'], [6, 10, 'ok']], fmt: (v) => `${v}/32″`, scale: 'New tires ≈ 10/32″ · replace at 2/32″' },
  mm: { max: 12, zones: [[0, 3, 'bad'], [3, 5, 'warn'], [5, 12, 'ok']], fmt: (v) => `${v} mm`, scale: 'New pads ≈ 10–12 mm · replace at 3 mm' },
};
const ZONE = { bad: 'bg-bad/20', warn: 'bg-warn/25', ok: 'bg-ok/20' };
const MARK = { now: 'bg-bad', soon: 'bg-warn', good: 'bg-ok' };
const TEXT = { now: 'text-bad', soon: 'text-warn', good: 'text-ok' };
const FILL = { now: 'rgb(var(--bad))', soon: 'rgb(var(--warn))', good: 'rgb(var(--ok))' };

/** A horizontal gauge for one measurement (`kind` is '32nds' or 'mm'). */
export function MeasureGauge({ kind, value, className = '', showScale = false }) {
  const spec = SPEC[kind];
  const v = Number(value);
  if (!spec || !Number.isFinite(v)) return null;
  const rating = ratingForMeasurement(kind, v);
  const pct = Math.max(2, Math.min(98, (Math.min(v, spec.max) / spec.max) * 100));
  return (
    <div className={className}>
      <div className="relative h-2 rounded-full bg-fill/[0.1]" role="img" aria-label={`${spec.fmt(v)} — ${rating === 'good' ? 'good' : rating === 'soon' ? 'wearing' : 'replace now'}`}>
        {spec.zones.map(([a, b, z]) => (
          <span key={z} className={`absolute inset-y-0 ${ZONE[z]} ${a === 0 ? 'rounded-l-full' : ''} ${b === spec.max ? 'rounded-r-full' : ''}`} style={{ left: `${(a / spec.max) * 100}%`, width: `${((b - a) / spec.max) * 100}%` }} />
        ))}
        <span className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface shadow ${MARK[rating]}`} style={{ left: `${pct}%` }} />
      </div>
      {showScale && <div className="mt-1 text-[11px] text-ink-3">{spec.scale}</div>}
    </div>
  );
}

const POS = { LF: 'Left front', RF: 'Right front', LR: 'Left rear', RR: 'Right rear' };

/** Tread and pad measurements from inspection items ({label, measure}). */
function tiresAndBrakes(items) {
  const tires = {};
  const pads = [];
  for (const i of items) {
    if (i.measure == null || i.measure === '') continue;
    const m = /^(LF|RF|LR|RR)\b.*\(32nds\)/i.exec(i.label);
    if (m) tires[m[1].toUpperCase()] = Number(i.measure);
    else if (/\(mm\)/i.test(i.label)) pads.push({ label: i.label.replace(/\s*\(.*\)$/, ''), value: Number(i.measure) });
  }
  return { tires, pads, any: Object.keys(tires).length > 0 || pads.length > 0 };
}

function Tire({ x, y, value }) {
  const r = Number.isFinite(value) ? ratingForMeasurement('32nds', value) : null;
  return <rect x={x} y={y} width="14" height="34" rx="5" fill={r ? FILL[r] : 'rgb(var(--fill) / 0.25)'} />;
}

/** Top-down car with each tire's tread depth, plus the brake pads. */
export function TiresBrakes({ items, className = '' }) {
  const { tires, pads, any } = tiresAndBrakes(items);
  if (!any) return null;
  const label = (k) => (
    <div className={k[1] === 'F' ? '' : 'mt-auto'}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{POS[k]}</div>
      {Number.isFinite(tires[k]) ? (
        <div className={`tabular text-lg font-semibold ${TEXT[ratingForMeasurement('32nds', tires[k])]}`}>{tires[k]}/32″</div>
      ) : (
        <div className="text-sm text-ink-4">—</div>
      )}
    </div>
  );
  return (
    <div className={`grid gap-5 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] ${className}`}>
      {Object.keys(tires).length > 0 && (
        <div>
          <div className="mb-2 text-sm font-semibold">Tire tread</div>
          <div className="flex items-stretch gap-3">
            <div className="flex flex-1 flex-col justify-between py-3 text-right">
              {label('LF')}
              {label('LR')}
            </div>
            <svg viewBox="0 0 100 190" className="h-[176px] w-[92px] shrink-0" aria-hidden>
              <rect x="20" y="8" width="60" height="174" rx="26" fill="rgb(var(--surface))" stroke="rgb(var(--line))" strokeWidth="2" />
              <path d="M30 52 Q50 42 70 52 L66 70 Q50 64 34 70 Z" fill="rgb(var(--fill) / 0.14)" />
              <path d="M32 140 Q50 146 68 140 L66 126 Q50 130 34 126 Z" fill="rgb(var(--fill) / 0.14)" />
              <Tire x={6} y={30} value={tires.LF} />
              <Tire x={80} y={30} value={tires.RF} />
              <Tire x={6} y={128} value={tires.LR} />
              <Tire x={80} y={128} value={tires.RR} />
            </svg>
            <div className="flex flex-1 flex-col justify-between py-3">
              {label('RF')}
              {label('RR')}
            </div>
          </div>
          <p className="mt-1 text-center text-[11px] text-ink-3">{SPEC['32nds'].scale}</p>
        </div>
      )}
      {pads.length > 0 && (
        <div>
          <div className="mb-2 text-sm font-semibold">Brake pads</div>
          <ul className="space-y-3">
            {pads.map((p) => (
              <li key={p.label}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-ink-2">{p.label}</span>
                  <span className={`tabular font-semibold ${TEXT[ratingForMeasurement('mm', p.value)]}`}>{p.value} mm</span>
                </div>
                <MeasureGauge kind="mm" value={p.value} />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-ink-3">{SPEC.mm.scale}</p>
        </div>
      )}
    </div>
  );
}
