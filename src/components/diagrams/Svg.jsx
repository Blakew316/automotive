// Shared building blocks for generated system diagrams.
import { WIRE, LEGENDS, CAVEAT } from './tokens';

export function Diagram({ id, title, subtitle, legend = [], caveat = CAVEAT, viewBox = '0 0 720 360', minWidth = 560, children, notes }) {
  return (
    <figure id={id} className="card overflow-hidden">
      <figcaption className="card-header">
        <div className="min-w-0">
          <h3 className="card-title">{title}</h3>
          {subtitle && <p className="text-xs text-ink-3">{subtitle}</p>}
        </div>
      </figcaption>
      <div className="overflow-x-auto px-2 py-3 sm:px-4">
        <svg viewBox={viewBox} className="mx-auto block h-auto w-full" style={{ minWidth, maxWidth: Number(viewBox.split(' ')[2]) * 1.35 }} role="img" aria-label={title}>
          <defs>
            <marker id={`arrow-${id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
            </marker>
          </defs>
          {children}
        </svg>
      </div>
      {legend.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line/70 px-4 py-2 text-xs text-ink-2">
          {legend.map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className="h-[3px] w-4 rounded-full" style={{ background: LEGENDS[k].color }} />
              {LEGENDS[k].label}
            </li>
          ))}
        </ul>
      )}
      {notes?.length > 0 && (
        <ul className="space-y-1 border-t border-line/70 px-4 py-2.5 text-sm text-ink-2">
          {notes.map((n) => (
            <li key={n} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-4" />
              {n}
            </li>
          ))}
        </ul>
      )}
      {caveat && <p className="border-t border-line/70 px-4 py-2 text-xs text-ink-3">{caveat}</p>}
    </figure>
  );
}

export function Block({ x, y, w, h, label, sub, tone = 'default', rx = 9, small }) {
  const fill = tone === 'muted' ? 'rgb(var(--fill) / 0.08)' : tone === 'accent' ? 'rgb(var(--accent) / 0.08)' : tone === 'hv' ? 'rgb(235 104 52 / 0.10)' : 'rgb(var(--surface))';
  const stroke = tone === 'accent' ? 'rgb(var(--accent) / 0.6)' : tone === 'hv' ? WIRE.hv : 'rgb(var(--ink-3))';
  const cx = x + w / 2;
  const fs = small ? 10.5 : 12;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} stroke={stroke} strokeWidth="1.3" />
      <text x={cx} y={y + h / 2 + (sub ? -3 : 0)} dy="0.35em" textAnchor="middle" className="fill-ink" style={{ fontSize: fs, fontWeight: 600 }}>
        {label}
      </text>
      {sub && (
        <text x={cx} y={y + h / 2 + 11} dy="0.35em" textAnchor="middle" className="fill-ink-3" style={{ fontSize: 10 }}>
          {sub}
        </text>
      )}
    </g>
  );
}

export const Wire = ({ d, kind = 'signal', dashed, width = 2, arrow, id }) => (
  <path
    d={d}
    fill="none"
    stroke={WIRE[kind]}
    strokeWidth={width}
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeDasharray={dashed ? '5 4' : undefined}
    markerEnd={arrow && id ? `url(#arrow-${id})` : undefined}
  />
);

export const Label = ({ x, y, children, anchor = 'start', muted = true, size = 11, weight = 400 }) => (
  <text x={x} y={y} textAnchor={anchor} className={muted ? 'fill-ink-3' : 'fill-ink'} style={{ fontSize: size, fontWeight: weight }}>
    {children}
  </text>
);

export const Node = ({ x, y, r = 3.5, kind = 'signal' }) => <circle cx={x} cy={y} r={r} fill={WIRE[kind]} />;

export const GroundSymbol = ({ x, y }) => (
  <g stroke={WIRE.ground} strokeWidth="1.6" strokeLinecap="round">
    <line x1={x} y1={y} x2={x} y2={y + 8} />
    <line x1={x - 9} y1={y + 8} x2={x + 9} y2={y + 8} />
    <line x1={x - 6} y1={y + 12} x2={x + 6} y2={y + 12} />
    <line x1={x - 3} y1={y + 16} x2={x + 3} y2={y + 16} />
  </g>
);

export const Fuse = ({ x, y, label }) => (
  <g>
    <rect x={x - 12} y={y - 6} width={24} height={12} rx={3} fill="rgb(var(--surface))" stroke="rgb(var(--ink-3))" strokeWidth="1.2" />
    <path d={`M${x - 8},${y} q4,-5 8,0 t8,0`} fill="none" stroke="rgb(var(--ink-2))" strokeWidth="1.2" />
    {label && <Label x={x} y={y - 10} anchor="middle" size={10}>{label}</Label>}
  </g>
);
