// Receivables aging as one stacked bar with a labelled legend (amounts in text, so color is never
// the only cue).
import { money } from '../lib/format';

const FILL = { current: 'bg-ok/70', d30: 'bg-warn/60', d60: 'bg-warn', d90: 'bg-bad/70', d90p: 'bg-bad' };

export default function AgingBar({ buckets, className = '' }) {
  const total = buckets.reduce((s, b) => s + b.amount, 0);
  return (
    <div className={className}>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-fill/[0.08]" role="img" aria-label={buckets.map((b) => `${b.label} ${money(b.amount)}`).join(', ')}>
        {total > 0 &&
          buckets
            .filter((b) => b.amount > 0)
            .map((b) => <span key={b.key} className={`${FILL[b.key]} h-full first:rounded-l-full last:rounded-r-full`} style={{ width: `${(b.amount / total) * 100}%` }} title={`${b.label}: ${money(b.amount)}`} />)}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
        {buckets.map((b) => (
          <div key={b.key}>
            <dt className="flex items-center gap-1.5 text-xs text-ink-3">
              <span className={`h-2 w-2 rounded-full ${FILL[b.key]}`} />
              {b.label}
            </dt>
            <dd className={`tabular text-sm font-semibold ${b.amount > 0 ? 'text-ink' : 'text-ink-4'}`}>
              {money(b.amount)}
              {b.count > 0 && <span className="ml-1 text-xs font-normal text-ink-3">· {b.count}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
