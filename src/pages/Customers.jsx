import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserPlus, Users } from 'lucide-react';
import { useShop, useTotals } from '../store/hooks';
import { PageHeader, Card, SearchInput, Avatar, EmptyState, Segmented } from '../components/ui';
import { CustomerForm } from '../components/forms';
import { money0, fullName, phone, dateShort } from '../lib/format';

export default function Customers() {
  const { state } = useShop();
  const totals = useTotals();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent');

  const rows = useMemo(() => {
    const stats = new Map();
    state.orders.forEach((o) => {
      const s = stats.get(o.customerId) || { spend: 0, visits: 0, last: null };
      if (o.status === 'closed' || o.status === 'ready') {
        s.spend += totals(o).total;
        s.visits += 1;
      }
      const d = o.closedAt || o.createdAt;
      if (!s.last || d > s.last) s.last = d;
      stats.set(o.customerId, s);
    });
    const query = q.toLowerCase();
    return state.customers
      .filter((c) => !query || `${fullName(c)} ${c.company} ${c.phone} ${c.email} ${(c.tags || []).join(' ')}`.toLowerCase().includes(query))
      .map((c) => ({ c, vehicles: state.vehicles.filter((v) => v.customerId === c.id), ...(stats.get(c.id) || { spend: 0, visits: 0, last: null }) }))
      .sort((a, b) => (sort === 'name' ? fullName(a.c).localeCompare(fullName(b.c)) : sort === 'value' ? b.spend - a.spend : String(b.last || '').localeCompare(String(a.last || ''))));
  }, [state.customers, state.vehicles, state.orders, q, sort, totals]);

  const creating = params.get('new') === '1';

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={`${state.customers.length} customers · ${state.vehicles.length} vehicles`}
        actions={
          <button className="btn-primary" onClick={() => setParams({ new: '1' })}>
            <UserPlus size={15} /> New customer
          </button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Name, phone, email, company, tag" className="w-full sm:w-80" />
        <Segmented size="sm" value={sort} onChange={setSort} options={[{ value: 'recent', label: 'Recent' }, { value: 'value', label: 'Top spend' }, { value: 'name', label: 'A–Z' }]} />
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={Users} title="No customers found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="hidden md:table-cell">Contact</th>
                  <th>Vehicles</th>
                  <th className="hidden text-right sm:table-cell">Visits</th>
                  <th className="text-right">Lifetime</th>
                  <th className="hidden text-right lg:table-cell">Last visit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ c, vehicles, spend, visits, last }) => (
                  <tr key={c.id} className="row-link" onClick={() => navigate(`/customers/${c.id}`)}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar person={c} size={30} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 font-medium">
                            {fullName(c)}
                            {(c.tags || []).map((t) => (
                              <span key={t} className="rounded-[4px] border border-line px-1 text-2xs font-medium text-ink-3">{t}</span>
                            ))}
                          </div>
                          {c.company && <div className="text-xs text-ink-3">{c.company}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell">
                      <div className="whitespace-nowrap">{phone(c.phone)}</div>
                      <div className="max-w-[220px] truncate text-xs text-ink-3">{c.email}</div>
                    </td>
                    <td className="max-w-[240px] truncate text-ink-2">{vehicles.map((v) => `${v.year} ${v.model}`).join(', ') || '—'}</td>
                    <td className="tabular hidden text-right sm:table-cell">{visits}</td>
                    <td className="tabular text-right font-medium">{money0(spend)}</td>
                    <td className="hidden whitespace-nowrap text-right text-ink-2 lg:table-cell">{last ? dateShort(last) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {creating && <CustomerForm open onClose={() => setParams({})} onSaved={(id) => navigate(`/customers/${id}`)} />}
    </>
  );
}
