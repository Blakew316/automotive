import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, ClipboardList } from 'lucide-react';
import { useLookup, useTotals, useScopedShop, useSite } from '../store/hooks';
import { siteFor } from '../lib/locations';
import { PageHeader, Card, SearchInput, Segmented, StatusLabel, EmptyState } from '../components/ui';
import { money, fullName, vehicleName, dateShort } from '../lib/format';
import { OPEN_STATUSES, WIP_STATUSES } from '../lib/workflow';

const FILTERS = [
  { value: 'open', label: 'Open', test: (o) => OPEN_STATUSES.includes(o.status) },
  { value: 'estimate', label: 'Estimates', test: (o) => o.status === 'estimate' },
  { value: 'wip', label: 'In progress', test: (o) => WIP_STATUSES.includes(o.status) },
  { value: 'ready', label: 'Invoiced', test: (o) => o.status === 'ready' },
  { value: 'closed', label: 'Closed', test: (o) => o.status === 'closed' },
  { value: 'all', label: 'All', test: () => true },
];

export default function Orders() {
  const { state } = useScopedShop();
  const site = useSite();
  const showSite = site.multi && site.current === 'all';
  const lookup = useLookup();
  const totals = useTotals();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(60);
  const filter = FILTERS.find((f) => f.value === params.get('status')) ? params.get('status') : 'open';

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.value, state.orders.filter(f.test).length])), [state.orders]);

  const rows = useMemo(() => {
    const f = FILTERS.find((x) => x.value === filter);
    const query = q.toLowerCase().replace(/^#/, '');
    return state.orders
      .filter(f.test)
      .filter((o) => {
        if (!query) return true;
        const c = lookup.customer.get(o.customerId);
        const v = lookup.vehicle.get(o.vehicleId);
        return `${o.number} ${fullName(c)} ${vehicleName(v)} ${v?.plate || ''} ${v?.vin || ''} ${o.concern} ${o.services.map((s) => s.title).join(' ')}`.toLowerCase().includes(query);
      })
      .sort((a, b) => b.number - a.number);
  }, [state.orders, filter, q, lookup]);

  const sum = rows.reduce((s, o) => s + totals(o).total, 0);

  return (
    <>
      <PageHeader
        title="Repair Orders"
        subtitle="Estimates, work orders and invoices — one record from quote to paid."
        actions={
          <Link to="/orders/new" className="btn-primary">
            <Plus size={16} strokeWidth={2.2} /> New repair order
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          options={FILTERS.map((f) => ({ value: f.value, label: f.label, count: counts[f.value] }))}
          value={filter}
          onChange={(v) => setParams(v === 'open' ? {} : { status: v })}
          className="max-w-full overflow-x-auto"
        />
        <SearchInput value={q} onChange={setQ} placeholder="RO #, customer, vehicle, VIN, service" className="w-full sm:w-80" />
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No repair orders" body={q ? 'Try a different search.' : 'Create one to get started.'} action={<Link to="/orders/new" className="btn-secondary btn-sm">New repair order</Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>RO</th>
                  <th>Customer</th>
                  <th>Vehicle</th>
                  <th className="hidden lg:table-cell">Work</th>
                  <th>Status</th>
                  {showSite && <th className="hidden md:table-cell">Location</th>}
                  <th className="hidden md:table-cell">Updated</th>
                  <th className="text-right">Total</th>
                  <th className="hidden text-right sm:table-cell">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((o) => {
                  const t = totals(o);
                  const v = lookup.vehicle.get(o.vehicleId);
                  return (
                    <tr key={o.id} className="row-link" onClick={() => navigate(`/orders/${o.id}`)}>
                      <td className="tabular font-medium">#{o.number}</td>
                      <td className="whitespace-nowrap">{fullName(lookup.customer.get(o.customerId))}</td>
                      <td>
                        <div className="max-w-[200px] truncate">{vehicleName(v)}</div>
                        {v?.plate && <div className="text-xs text-ink-3">{v.plate}</div>}
                      </td>
                      <td className="hidden max-w-[260px] truncate text-ink-2 lg:table-cell">{o.services.filter((s) => s.status !== 'declined').map((s) => s.title).join(', ') || o.concern || '—'}</td>
                      <td><StatusLabel status={o.status} /></td>
                      {showSite && <td className="hidden whitespace-nowrap text-ink-2 md:table-cell">{siteFor(state.shop, o.locationId).name}</td>}
                      <td className="hidden whitespace-nowrap text-ink-2 md:table-cell">{dateShort(o.closedAt || o.updatedAt)}</td>
                      <td className="tabular text-right font-medium">{money(t.total)}</td>
                      <td className={`tabular hidden text-right sm:table-cell ${t.balance > 0.004 && o.status !== 'estimate' ? 'text-ink' : 'text-ink-4'}`}>
                        {o.status === 'estimate' ? '—' : money(Math.max(0, t.balance))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 0 && (
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-ink-3">
            <span>
              {Math.min(limit, rows.length)} of {rows.length} · {money(sum)} total
            </span>
            {rows.length > limit && (
              <button className="btn-plain btn-sm" onClick={() => setLimit((l) => l + 60)}>
                Show more
              </button>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
