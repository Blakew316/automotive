import { useMemo, useRef, useState } from 'react';

/** Round a max up to a clean axis ceiling and return ~4 ticks. */
function niceTicks(max, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return ticks;
}

/**
 * Single-series column chart: thin columns (≤24px) with 4px rounded caps from one baseline,
 * hairline gridlines, and a per-column hover/focus tooltip.
 */
export function ColumnChart({ data, height = 200, format = (v) => v, tickFormat = format, label = 'Chart', highlight }) {
  const wrap = useRef(null);
  const [hover, setHover] = useState(null);
  const W = 640;
  const pad = { top: 12, right: 8, bottom: 26, left: 48 };
  const innerW = W - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const ticks = useMemo(() => niceTicks(Math.max(0, ...data.map((d) => d.value))), [data]);
  const top = ticks[ticks.length - 1] || 1;
  const band = innerW / Math.max(1, data.length);
  const barW = Math.min(24, band * 0.62);
  const labelEvery = Math.ceil(data.length / 10);
  const y = (v) => pad.top + innerH - (v / top) * innerH;

  return (
    <div ref={wrap} className="relative" role="img" aria-label={label}>
      <svg viewBox={`0 0 ${W} ${height}`} className="block h-auto w-full overflow-visible">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="rgb(var(--line))" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-ink-3" style={{ fontSize: 11 }}>
              {tickFormat(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.left + band * i + band / 2;
          const h = Math.max(0, (d.value / top) * innerH);
          const x0 = cx - barW / 2;
          const yTop = pad.top + innerH - h;
          const r = Math.min(4, h, barW / 2);
          const path = h > 0 ? `M${x0},${pad.top + innerH} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x0 + barW - r} Q${x0 + barW},${yTop} ${x0 + barW},${yTop + r} V${pad.top + innerH} Z` : '';
          const isHi = highlight ? highlight(d, i) : false;
          const faded = hover != null && hover !== i;
          return (
            <g key={d.key ?? i}>
              {path && <path d={path} fill="var(--series-1)" opacity={faded ? 0.45 : isHi || hover === i ? 1 : 0.85} className="transition-opacity" />}
              <rect
                x={pad.left + band * i}
                y={pad.top}
                width={band}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.label}: ${format(d.value)}`}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                style={{ outline: 'none' }}
              />
              {i % labelEvery === 0 && (
                <text x={cx} y={height - 8} textAnchor="middle" className="fill-ink-3" style={{ fontSize: 11 }}>
                  {d.short ?? d.label}
                </text>
              )}
            </g>
          );
        })}
        <line x1={pad.left} x2={W - pad.right} y1={pad.top + innerH} y2={pad.top + innerH} stroke="rgb(var(--ink-4))" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      {hover != null && data[hover] && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-[8px] bg-surface px-2.5 py-1.5 text-center shadow-pop"
          style={{ left: `${((pad.left + band * hover + band / 2) / W) * 100}%`, top: `${(y(data[hover].value) / height) * 100}%`, marginTop: -8 }}
        >
          <div className="tabular whitespace-nowrap text-sm font-semibold text-ink">{format(data[hover].value)}</div>
          <div className="whitespace-nowrap text-2xs text-ink-3">{data[hover].label}</div>
          {data[hover].sub && <div className="whitespace-nowrap text-2xs text-ink-3">{data[hover].sub}</div>}
        </div>
      )}
    </div>
  );
}

const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];

/** 100% stacked bar with 2px surface gaps and a legend that carries the values. */
export function MixBar({ segments, format = (v) => v }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div>
      <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full">
        {segments.map((s, i) =>
          s.value > 0 ? <div key={s.label} title={`${s.label}: ${format(s.value)}`} style={{ width: `${(s.value / total) * 100}%`, background: SERIES[i] }} /> : null,
        )}
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {segments.map((s, i) => (
          <li key={s.label} className="flex items-start gap-2">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-[2px]" style={{ background: SERIES[i] }} />
            <div className="min-w-0">
              <div className="text-sm text-ink-2">{s.label}</div>
              <div className="tabular text-md font-semibold text-ink">
                {format(s.value)} <span className="text-xs font-normal text-ink-3">{Math.round((s.value / total) * 100)}%</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bars for ranked lists (tech productivity, top services). Value labels sit at the bar tip. */
export function RankBars({ rows, format = (v) => v }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-ink">{r.label}</span>
            <span className="tabular shrink-0 text-ink-2">{format(r.value)}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-fill/[0.12]">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: 'var(--series-1)' }} />
          </div>
          {r.sub && <div className="mt-1 text-xs text-ink-3">{r.sub}</div>}
        </li>
      ))}
    </ul>
  );
}
