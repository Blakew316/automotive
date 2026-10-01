import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Pencil, ScanLine, Car, Trash2, MoreHorizontal, Database, ChevronRight, History } from 'lucide-react';
import RecordHistory from '../components/RecordHistory';
import { useShop, useUI, useTotals, useLookup, useSync } from '../store/hooks';
import { PageHeader, Card, CardHeader, EmptyState, StatusLabel, KV, Mono, CopyButton, Menu, Modal, Spinner } from '../components/ui';
import { VehicleForm } from '../components/forms';
import { RecallsCard, ComplaintsCard, SafetyCard, ResourcesCard } from '../components/VehicleIntel';
import { decodeVinLocal } from '../lib/vindb';
import { usePromise } from '../lib/usePromise';
import { loadMake, modelYearRows, buildOptions, slugify, catalogPath, enrichValues } from '../lib/catalog';
import { money, fullName, dateShort, number } from '../lib/format';
import { decodeOffline } from '../lib/vin';

const VehicleKnowledge = lazy(() => import('../components/VehicleKnowledge'));

export default function VehicleDetail() {
  const { id } = useParams();
  const { state, deleteVehicle } = useShop();
  const { toast } = useUI();
  const totals = useTotals();
  const lookup = useLookup();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [history, setHistory] = useState(false);
  const sync = useSync();
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
                sync?.enabled && { label: 'Change history', icon: History, onClick: () => setHistory(true) },
                '-',
                { label: 'Delete vehicle', icon: Trash2, danger: true, onClick: () => setConfirmDelete(true) },
              ]}
            />
          </>
        }
      />

      {history && <RecordHistory collection="vehicles" id={v.id} title={`${v.year} ${v.make} ${v.model}`} onClose={() => setHistory(false)} />}
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
          <ResourcesCard year={v.year} make={v.make} model={v.model} vin={v.vin} />
        </div>
      </div>

      <TechnicalSection vehicle={v} />

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

/** Configuration for a shop vehicle: decoded from its VIN, or matched in the catalog by year/make/model/engine. */
async function configFor(v) {
  if (v.vin && v.vin.length === 17) {
    try {
      const d = await decodeVinLocal(v.vin);
      if (d.complete) return { values: await enrichValues(d.values, d.make), vehicleType: d.vehicleType, source: 'vin', year: d.year || v.year, make: d.make || v.make, model: d.model || v.model };
    } catch {
      // Fall through to the catalog match.
    }
  }
  const make = await loadMake(slugify(v.make)).catch(() => null);
  const want = slugify(v.model);
  const model = make?.models.find((m) => m.slug === want) || make?.models.find((m) => want.startsWith(m.slug) || m.slug.startsWith(want));
  if (!model) return null;
  const options = buildOptions(modelYearRows(model, Number(v.year), make.shared), make.make, make.sizes);
  const disp = parseFloat((String(v.engine || '').match(/(\d\.\d)\s*L?/i) || [])[1]);
  const engine = options.engines.find((e) => disp && Math.abs(parseFloat(e.values.dispL) - disp) < 0.15) || (options.enginesShared ? null : options.engines[0]);
  const values = { ...(engine?.values || {}) };
  if (options.bodies[0]) values.body = options.bodies[0];
  if (options.drives.length === 1) values.drive = options.drives[0];
  return { values, source: 'catalog', year: Number(v.year), make: make.make, model: model.name, vehicleType: model.types[0] };
}

function TechnicalSection({ vehicle: v }) {
  const state = usePromise(() => configFor(v), [v.vin, v.year, v.make, v.model, v.engine].join('|'));
  const cfg = state.data || null;
  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Diagrams, parts & repair guides</h2>
          <p className="text-sm text-ink-3">
            {cfg ? (cfg.source === 'vin' ? 'Built from this vehicle’s VIN.' : `Matched by year, make and model${v.engine ? ' and engine' : ''} — add the VIN for an exact configuration.`) : 'Generated from data stored on this site.'}
          </p>
        </div>
        <Link to={catalogPath(cfg || v)} className="btn-plain btn-sm text-accent">
          <Database size={14} /> Open in Vehicle Database <ChevronRight size={14} />
        </Link>
      </div>
      {state.status === 'loading' ? (
        <div className="flex h-32 items-center justify-center text-ink-3">
          <Spinner size={18} />
        </div>
      ) : cfg ? (
        <Suspense fallback={<div className="flex h-32 items-center justify-center text-ink-3"><Spinner size={18} /></div>}>
          <VehicleKnowledge year={cfg.year} make={cfg.make} model={cfg.model} values={cfg.values} vehicleType={cfg.vehicleType} />
        </Suspense>
      ) : (
        <EmptyState icon={Database} title="Not found in the vehicle database" body="Check the make and model spelling, or add the VIN to decode the exact configuration." />
      )}
    </section>
  );
}
