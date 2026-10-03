import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Car, ScanLine, Tractor } from 'lucide-react';
import { useShop, useLookup } from '../store/hooks';
import { PageHeader, Card, SearchInput, EmptyState, Mono, Disclosure } from '../components/ui';
import { useIsPhone } from '../lib/viewport';
import { VehicleForm } from '../components/forms';
import { fullName, number, dateShort, vehicleName, vehicleTrim } from '../lib/format';
import { SMALL_ENGINE, TERMS } from '../lib/edition';
import { equipmentTypeLabel } from '../data/smallEngine';

const VehicleIcon = SMALL_ENGINE ? Tractor : Car;

export default function Vehicles() {
  const { state } = useShop();
  const lookup = useLookup();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [make, setMake] = useState('all');
  const phone = useIsPhone();

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
      .filter((v) => !query || `${v.year} ${v.make} ${v.model} ${v.trim}${SMALL_ENGINE ? ` ${equipmentTypeLabel(v.type)} ${v.engine || ''}` : ''} ${v.vin} ${v.plate} ${fullName(lookup.customer.get(v.customerId))}`.toLowerCase().includes(query))
      .sort((a, b) => String(lastService.get(b.id) || '').localeCompare(String(lastService.get(a.id) || '')));
  }, [state.vehicles, q, make, lookup, lastService]);

  return (
    <>
      <PageHeader
        title={TERMS.vehicles}
        subtitle={SMALL_ENGINE ? `${number(state.vehicles.length)} units · ${makes.length} brands` : `${state.vehicles.length} vehicles · ${makes.length} makes`}
        actions={
          <>
            {!SMALL_ENGINE && <Link to="/vin" className="btn-secondary"><ScanLine size={15} /> Decode VIN</Link>}
            <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} strokeWidth={2.2} /> {`Add ${TERMS.vehicleLower}`}</button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={setQ} placeholder={SMALL_ENGINE ? 'Brand, model #, serial #, type, tag, owner' : 'Year, make, model, VIN, plate, owner'} className="w-full sm:w-80" />
        <select className="input w-auto" value={make} onChange={(e) => setMake(e.target.value)} aria-label={TERMS.make}>
          <option value="all">{SMALL_ENGINE ? 'All brands' : 'All makes'}</option>
          {makes.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={VehicleIcon} title={`No ${TERMS.vehicles.toLowerCase()} found`} />
        ) : phone ? (
          <ul className="divide-y divide-line/70">
            {rows.map((v) => (
              <li key={v.id}>
                <Link to={`/vehicles/${v.id}`} className="press flex items-center gap-3 py-3 pl-4 pr-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-base font-semibold text-ink">{SMALL_ENGINE ? vehicleName(v) : <>{v.year} {v.make} {v.model}</>}</span>
                      {v.plate && <span className="shrink-0 font-mono text-xs text-ink-2">{v.plate}</span>}
                    </div>
                    <div className="flex items-baseline justify-between gap-3 text-sm text-ink-3">
                      <span className="truncate">{[fullName(lookup.customer.get(v.customerId)), vehicleTrim(v)].filter(Boolean).join(' · ')}</span>
                      {v.mileage ? <span className="tabular shrink-0 text-xs">{number(v.mileage)} {TERMS.mi}</span> : null}
                    </div>
                  </div>
                  <Disclosure />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{TERMS.vehicle}</th>
                  <th className="hidden md:table-cell">{TERMS.vin}</th>
                  <th>Owner</th>
                  <th className="hidden sm:table-cell">{TERMS.plate}</th>
                  <th className="text-right">{TERMS.mileage}</th>
                  <th className="hidden text-right lg:table-cell">Last service</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id} className="row-link" onClick={() => navigate(`/vehicles/${v.id}`)}>
                    <td>
                      <div className="font-medium">{SMALL_ENGINE ? vehicleName(v) : <>{v.year} {v.make} {v.model}</>}</div>
                      <div className="text-xs text-ink-3">{[vehicleTrim(v), v.engine].filter(Boolean).join(' · ')}</div>
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
