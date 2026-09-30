import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Car, ScanLine } from 'lucide-react';
import { useShop, useLookup } from '../store/hooks';
import { PageHeader, Card, SearchInput, EmptyState, Mono } from '../components/ui';
import { VehicleForm } from '../components/forms';
import { fullName, number, dateShort } from '../lib/format';

export default function Vehicles() {
  const { state } = useShop();
  const lookup = useLookup();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [make, setMake] = useState('all');

  const makes = useMemo(() => [...new Set(state.vehicles.map((v) => v.make))].sort(), [state.vehicles]);
  const lastService = useMemo(() => {
    const m = new Map();
    state.orders.forEach((o) => {
      const d = o.closedAt || o.createdAt;
      if (!m.get(o.vehicleId) || d > m.get(o.vehicleId)) m.set(o.vehicleId, d);
    });
    return m;
  }, [state.orders]);

  const rows = useMemo(() => {
    const query = q.toLowerCase();
    return state.vehicles
      .filter((v) => make === 'all' || v.make === make)
      .filter((v) => !query || `${v.year} ${v.make} ${v.model} ${v.trim} ${v.vin} ${v.plate} ${fullName(lookup.customer.get(v.customerId))}`.toLowerCase().includes(query))
      .sort((a, b) => String(lastService.get(b.id) || '').localeCompare(String(lastService.get(a.id) || '')));
  }, [state.vehicles, q, make, lookup, lastService]);

  return (
    <>
      <PageHeader
        title="Vehicles"
        subtitle={`${state.vehicles.length} vehicles · ${makes.length} makes`}
        actions={
          <>
            <Link to="/vin" className="btn-secondary"><ScanLine size={15} /> Decode VIN</Link>
            <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} strokeWidth={2.2} /> Add vehicle</button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Year, make, model, VIN, plate, owner" className="w-full sm:w-80" />
        <select className="input w-auto" value={make} onChange={(e) => setMake(e.target.value)} aria-label="Make">
          <option value="all">All makes</option>
          {makes.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={Car} title="No vehicles found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th className="hidden md:table-cell">VIN</th>
                  <th>Owner</th>
                  <th className="hidden sm:table-cell">Plate</th>
                  <th className="text-right">Mileage</th>
                  <th className="hidden text-right lg:table-cell">Last service</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id} className="row-link" onClick={() => navigate(`/vehicles/${v.id}`)}>
                    <td>
                      <div className="font-medium">{v.year} {v.make} {v.model}</div>
                      <div className="text-xs text-ink-3">{[v.trim, v.engine].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="hidden md:table-cell"><Mono className="text-ink-2">{v.vin}</Mono></td>
                    <td className="whitespace-nowrap">{fullName(lookup.customer.get(v.customerId))}</td>
                    <td className="hidden whitespace-nowrap sm:table-cell">{v.plate ? `${v.plate} ${v.plateState || ''}` : '—'}</td>
                    <td className="tabular text-right">{number(v.mileage)}</td>
                    <td className="hidden whitespace-nowrap text-right text-ink-2 lg:table-cell">{lastService.get(v.id) ? dateShort(lastService.get(v.id)) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {adding && <VehicleForm open onClose={() => setAdding(false)} onSaved={(id) => navigate(`/vehicles/${id}`)} />}
    </>
  );
}
