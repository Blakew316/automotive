import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Pencil, ScanLine, Car, Trash2, MoreHorizontal } from 'lucide-react';
import { useShop, useUI, useTotals, useLookup } from '../store/hooks';
import { PageHeader, Card, CardHeader, EmptyState, StatusLabel, KV, Mono, CopyButton, Menu, Modal } from '../components/ui';
import { VehicleForm } from '../components/forms';
import { RecallsCard, ComplaintsCard, SafetyCard, SpecsCard, ResourcesCard } from '../components/VehicleIntel';
import { money, fullName, dateShort, number } from '../lib/format';
import { decodeOffline } from '../lib/vin';

export default function VehicleDetail() {
  const { id } = useParams();
  const { state, deleteVehicle } = useShop();
  const { toast } = useUI();
  const totals = useTotals();
  const lookup = useLookup();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const v = state.vehicles.find((x) => x.id === id);
  if (!v) return <EmptyState icon={Car} title="Vehicle not found" action={<Link to="/vehicles" className="btn-secondary">All vehicles</Link>} />;

  const owner = lookup.customer.get(v.customerId);
  const orders = state.orders.filter((o) => o.vehicleId === v.id).sort((a, b) => b.number - a.number);
  const spend = orders.filter((o) => ['ready', 'closed'].includes(o.status)).reduce((s, o) => s + totals(o).total, 0);
  const offline = v.vin ? decodeOffline(v.vin) : null;

  return (
    <>
      <PageHeader
        back="/vehicles"
        eyebrow={owner ? <Link to={`/customers/${owner.id}`} className="hover:text-accent">{fullName(owner)}</Link> : 'No owner'}
        title={`${v.year} ${v.make} ${v.model}`}
        subtitle={[v.trim, v.engine, v.color].filter(Boolean).join(' · ')}
        actions={
          <>
            {v.vin && <Link to={`/vin?vin=${v.vin}`} className="btn-secondary"><ScanLine size={15} /> Full decode</Link>}
            <Link to={`/orders/new?vehicle=${v.id}`} className="btn-primary"><Plus size={16} strokeWidth={2.2} /> Repair order</Link>
            <Menu
              trigger={({ toggle }) => <button className="btn-secondary btn-icon" onClick={toggle} aria-label="More"><MoreHorizontal size={16} /></button>}
              items={[
                { label: 'Edit vehicle', icon: Pencil, onClick: () => setEditing(true) },
                '-',
                { label: 'Delete vehicle', icon: Trash2, danger: true, onClick: () => setConfirmDelete(true) },
              ]}
            />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Service history" subtitle={`${orders.length} visits · ${money(spend)} lifetime`} />
            {orders.length === 0 ? (
              <EmptyState title="No visits yet" action={<Link to={`/orders/new?vehicle=${v.id}`} className="btn-secondary btn-sm">Start a repair order</Link>} />
            ) : (
              <ol className="relative px-4 py-3">
                {orders.map((o, i) => (
                  <li key={o.id} className="relative flex gap-4 pb-4 last:pb-0">
                    {i < orders.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-line" />}
                    <span className="relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-surface bg-ink-4 ring-1 ring-line" />
                    <Link to={`/orders/${o.id}`} className="-mx-2 -my-1 min-w-0 flex-1 rounded-[8px] px-2 py-1 hover:bg-fill/[0.05]">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-sm font-medium">
                          {dateShort(o.closedAt || o.createdAt)} · RO #{o.number}
                        </span>
                        <span className="tabular text-sm">{money(totals(o).total)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 text-xs text-ink-3">
                        {o.mileageIn && <span className="tabular">{number(o.mileageIn)} mi</span>}
                        <StatusLabel status={o.status} className="text-xs" />
                      </div>
                      <div className="mt-0.5 truncate text-sm text-ink-2">{o.services.filter((s) => s.status !== 'declined').map((s) => s.title).join(', ') || o.concern}</div>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <RecallsCard year={v.year} make={v.make} model={v.model} vin={v.vin} />
          <div className="grid gap-6 xl:grid-cols-2">
            <ComplaintsCard year={v.year} make={v.make} model={v.model} />
            <SafetyCard year={v.year} make={v.make} model={v.model} />
          </div>
        </div>

        <div className="space-y-6">
          <Card className="px-4 py-2">
            <dl className="divide-y divide-line/70">
              <KV label="VIN">
                <span className="inline-flex items-center">
                  <Mono>{v.vin || '—'}</Mono>
                  {v.vin && <CopyButton text={v.vin} className="-mr-2 h-6 w-6 px-0" />}
                </span>
              </KV>
              {offline && <KV label="Built in">{offline.country}{offline.checkDigitOk === false ? ' · check digit mismatch' : ''}</KV>}
              <KV label="Plate">{v.plate ? `${v.plate} ${v.plateState || ''}` : '—'}</KV>
              <KV label="Mileage">{number(v.mileage)} mi</KV>
              <KV label="Engine">{v.engine || '—'}</KV>
              <KV label="Color">{v.color || '—'}</KV>
              <KV label="Owner">{owner ? <Link to={`/customers/${owner.id}`} className="link">{fullName(owner)}</Link> : '—'}</KV>
            </dl>
          </Card>
          <SpecsCard year={v.year} make={v.make} model={v.model} />
          <ResourcesCard year={v.year} make={v.make} model={v.model} vin={v.vin} />
        </div>
      </div>

      {editing && <VehicleForm open initial={v} onClose={() => setEditing(false)} />}
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete vehicle?"
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button
              className="btn-primary !bg-bad"
              onClick={() => {
                deleteVehicle(v.id);
                toast('Vehicle deleted');
                navigate('/vehicles', { replace: true });
              }}
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-2">Repair orders for this vehicle are kept for your records.</p>
      </Modal>
    </>
  );
}
