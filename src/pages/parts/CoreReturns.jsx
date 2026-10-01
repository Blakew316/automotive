// Core returns: parts bought with a core charge (batteries, alternators, starters, calipers…). The
// old part goes back to the vendor for a credit — this keeps track of what's owed back.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { useShop } from '../../store/hooks';
import { Card, EmptyState, Segmented, Stat } from '../../components/ui';
import { coreList, CORE_STATUS } from '../../lib/operations';
import { money, dateShort } from '../../lib/format';

export default function CoreReturns() {
  const { state, updateItem } = useShop();
  const [filter, setFilter] = useState('owed');
  const all = useMemo(() => coreList(state), [state]);
  const rows = all.filter((c) => filter === 'all' || c.status === filter);
  const sum = (st) => all.filter((c) => c.status === st).reduce((s, c) => s + c.amount, 0);
  const setStatus = (c, status) => updateItem(c.order.id, c.service.id, c.item.id, { core: { ...c.item.core, status, ...(status === 'returned' ? { returnedAt: new Date().toISOString() } : status === 'credited' ? { creditedAt: new Date().toISOString() } : {}) } });

  return (
    <>
      <Card className="mb-4 grid grid-cols-3 divide-x divide-line p-1">
        <Stat label="To return" value={money(sum('owed'))} sub={`${all.filter((c) => c.status === 'owed').length} cores`} />
        <Stat label="Returned, awaiting credit" value={money(sum('returned'))} sub={`${all.filter((c) => c.status === 'returned').length} cores`} />
        <Stat label="Credited" value={money(sum('credited'))} />
      </Card>
      <Card>
        <div className="flex items-center gap-2 border-b border-line/70 px-4 py-2.5">
          <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: 'owed', label: 'To return' }, { value: 'returned', label: 'Awaiting credit' }, { value: 'credited', label: 'Credited' }, { value: 'all', label: 'All' }]} />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Package} title={filter === 'owed' ? 'No cores to return' : 'Nothing here'} body="Enter the core charge on a part line of a repair order (next to its status) to track it here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Part</th>
                  <th>RO</th>
                  <th className="hidden sm:table-cell">Vendor</th>
                  <th className="text-right">Core</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={`${c.order.id}-${c.item.id}`}>
                    <td>
                      <div className="font-medium">{c.item.description || 'Part'}</div>
                      <div className="font-mono text-xs text-ink-3">{c.item.partNumber || '—'}{Number(c.item.qty) > 1 ? ` · ×${c.item.qty}` : ''}</div>
                    </td>
                    <td>
                      <Link to={`/orders/${c.order.id}`} className="tabular hover:underline">#{c.order.number}</Link>
                      <div className="text-xs text-ink-3">{dateShort(c.since)}</div>
                    </td>
                    <td className="hidden text-ink-2 sm:table-cell">{c.vendor || '—'}</td>
                    <td className="tabular text-right font-medium">{money(c.amount)}</td>
                    <td>
                      <select className="input h-8 w-auto py-0 text-sm" value={c.status} onChange={(e) => setStatus(c, e.target.value)} aria-label={`Core status for ${c.item.description}`}>
                        {Object.entries(CORE_STATUS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      {c.item.core.returnedAt && c.status !== 'owed' && <div className="mt-0.5 text-xs text-ink-3">Returned {dateShort(c.item.core.returnedAt)}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
