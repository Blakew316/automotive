// Repair orders as iPhone list rows: vehicle and total, then who (or the work), RO number, status and date.
import { Link } from 'react-router-dom';
import { useLookup, useTotals } from '../store/hooks';
import { StatusLabel, Disclosure } from './ui';
import { money, fullName, vehicleName, dateShort } from '../lib/format';

export default function OrderRows({ orders, detail = 'customer', siteName }) {
  const lookup = useLookup();
  const totals = useTotals();
  return (
    <ul className="divide-y divide-line/70">
      {orders.map((o) => {
        const t = totals(o);
        const v = lookup.vehicle.get(o.vehicleId);
        const c = lookup.customer.get(o.customerId);
        const due = o.status !== 'estimate' && o.status !== 'closed' && t.balance > 0.004;
        const second =
          detail === 'work'
            ? o.services.filter((s) => s.status !== 'declined').map((s) => s.title).join(', ') || o.concern
            : [v && fullName(c), v?.plate].filter(Boolean).join(' · ');
        return (
          <li key={o.id}>
            <Link to={`/orders/${o.id}`} className="press flex items-center gap-3 py-3 pl-4 pr-3.5">
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-base font-semibold text-ink">{v ? vehicleName(v) : fullName(c)}</span>
                  <span className="tabular shrink-0 text-base font-medium text-ink">{money(t.total)}</span>
                </span>
                <span className="mt-0.5 flex items-baseline justify-between gap-3 text-sm text-ink-2">
                  <span className="truncate">{second || '—'}</span>
                  <span className="tabular shrink-0 text-ink-3">#{o.number}</span>
                </span>
                <span className="mt-1 flex items-center justify-between gap-3">
                  <StatusLabel status={o.status} className="text-xs" />
                  <span className="truncate text-xs text-ink-3">
                    {due && <span className="font-medium text-ink-2">{money(t.balance)} due · </span>}
                    {siteName && `${siteName(o)} · `}
                    {dateShort(o.closedAt || o.updatedAt || o.createdAt)}
                  </span>
                </span>
              </span>
              <Disclosure />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
