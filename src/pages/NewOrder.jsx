import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Car, Plus, CircleCheck, Check } from 'lucide-react';
import { useShop, useUI, useSite } from '../store/hooks';
import { PageHeader, Card, CardHeader, Field, Avatar } from '../components/ui';
import { CustomerPicker, CustomerForm, VehicleForm } from '../components/forms';
import { fullName, vehicleName, money } from '../lib/format';
import { serviceTotal, priceFromMatrix } from '../lib/pricing';

export default function NewOrder() {
  const { state, createOrder } = useShop();
  const { toast } = useUI();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const appt = state.appointments.find((a) => a.id === params.get('appointment'));
  const presetVehicle = state.vehicles.find((v) => v.id === (params.get('vehicle') || appt?.vehicleId));

  const [customerId, setCustomerId] = useState(params.get('customer') || appt?.customerId || presetVehicle?.customerId || '');
  const [vehicleId, setVehicleId] = useState(presetVehicle?.id || '');
  const [concern, setConcern] = useState(params.get('concern') || (appt?.title && appt.title !== 'Service appointment' ? appt.title : ''));
  // Jobs can arrive preselected, e.g. the PM a fleet unit is due for.
  const [jobs, setJobs] = useState(() => (params.get('jobs') || '').split(',').filter((j) => state.cannedJobs.some((x) => x.id === j)));
  const [newCustomer, setNewCustomer] = useState(false);
  const [newVehicle, setNewVehicle] = useState(false);
  const site = useSite();
  const [locationId, setLocationId] = useState(site.current === 'all' ? 'main' : site.current);

  const customer = state.customers.find((c) => c.id === customerId);
  const vehicles = state.vehicles.filter((v) => v.customerId === customerId);
  const categories = useMemo(() => [...new Set(state.cannedJobs.map((j) => j.category))], [state.cannedJobs]);

  const create = (status) => {
    const o = createOrder({ customerId, vehicleId: vehicleId || null, concern, jobIds: jobs, appointmentId: appt?.id, status, ...(site.multi ? { locationId: locationId === 'main' ? null : locationId } : {}) });
    toast(`Repair order #${o.number} created`, { tone: 'success' });
    navigate(`/orders/${o.id}`, { replace: true });
  };

  const priceOf = (job) =>
    serviceTotal({
      items: job.items.map((i) => (i.type === 'labor' ? { ...i, rate: state.shop.laborRate } : i.type === 'part' ? { ...i, price: i.price ?? priceFromMatrix(i.cost, state.shop.matrix) } : i)),
    });

  return (
    <>
      <PageHeader back="/orders" title="New repair order" subtitle={appt ? `Checking in ${fullName(customer)} for “${appt.title}”` : 'Pick the customer and vehicle, capture the concern, add services.'} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="1 · Customer" subtitle={customer ? fullName(customer) : 'Search or create'} />
            <div className="p-4">
              {customer ? (
                <div className="flex items-center gap-3">
                  <Avatar person={customer} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{fullName(customer)}</div>
                    <div className="text-sm text-ink-3">{[customer.phone, customer.email].filter(Boolean).join(' · ')}</div>
                  </div>
                  <button
                    className="btn-plain btn-sm"
                    onClick={() => {
                      setCustomerId('');
                      setVehicleId('');
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <CustomerPicker
                  value={customerId}
                  onChange={(id) => {
                    setCustomerId(id);
                    const vs = state.vehicles.filter((v) => v.customerId === id);
                    setVehicleId(vs.length === 1 ? vs[0].id : '');
                  }}
                  onCreate={() => setNewCustomer(true)}
                />
              )}
            </div>
          </Card>

          <Card className={customer ? '' : 'pointer-events-none opacity-50'}>
            <CardHeader
              title="2 · Vehicle"
              subtitle={vehicleId ? vehicleName(state.vehicles.find((v) => v.id === vehicleId)) : 'Select or add by VIN'}
              actions={
                customer && (
                  <button className="btn-plain btn-sm" onClick={() => setNewVehicle(true)}>
                    <Plus size={14} /> Add vehicle
                  </button>
                )
              }
            />
            <div className="grid gap-2 p-4 sm:grid-cols-2">
              {vehicles.map((v) => {
                const active = v.id === vehicleId;
                return (
                  <button
                    key={v.id}
                    onClick={() => setVehicleId(v.id)}
                    className={`flex items-center gap-3 rounded-[10px] border px-3 py-2.5 text-left transition-colors ${active ? 'border-accent ring-[3px] ring-accent/15' : 'border-line hover:bg-fill/[0.04]'}`}
                  >
                    <Car size={18} strokeWidth={1.6} className="shrink-0 text-ink-3" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{v.unit ? <span className="mr-1.5 text-ink-2">Unit {v.unit}</span> : null}{vehicleName(v, { trim: true })}</span>
                      <span className="block truncate font-mono text-[11.5px] text-ink-3">{v.plate ? `${v.plate} · ` : ''}{v.vin}</span>
                    </span>
                    {active && <CircleCheck size={17} className="shrink-0 text-accent" />}
                  </button>
                );
              })}
              {customer && vehicles.length === 0 && <p className="text-sm text-ink-3">No vehicles on file. Add one by VIN.</p>}
            </div>
          </Card>

          <Card className={customer ? '' : 'pointer-events-none opacity-50'}>
            <CardHeader title="3 · Concern & services" subtitle="Canned jobs are priced from your menu and parts matrix" />
            <div className="space-y-5 p-4">
              <Field label="Customer concern">
                {(id) => <textarea id={id} rows={3} className="input" placeholder="In the customer’s words — e.g. “Squeal from the front when braking, started last week.”" value={concern} onChange={(e) => setConcern(e.target.value)} />}
              </Field>
              {categories.map((cat) => (
                <div key={cat}>
                  <div className="section-label mb-2">{cat}</div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {state.cannedJobs
                      .filter((j) => j.category === cat)
                      .map((j) => {
                        const on = jobs.includes(j.id);
                        return (
                          <button
                            key={j.id}
                            onClick={() => setJobs((list) => (on ? list.filter((x) => x !== j.id) : [...list, j.id]))}
                            className={`flex items-center gap-2.5 rounded-[9px] border px-3 py-2 text-left text-sm transition-colors ${on ? 'border-accent/60 bg-accent/[0.05]' : 'border-line hover:bg-fill/[0.04]'}`}
                          >
                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${on ? 'border-accent bg-accent text-on-accent' : 'border-ink-4'}`}>{on && <Check size={11} strokeWidth={3} />}</span>
                            <span className="min-w-0 flex-1 truncate">{j.title}</span>
                            <span className="tabular shrink-0 text-xs text-ink-3">~{money(priceOf(j))}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div>
          <Card className="sticky top-6 p-4">
            <div className="section-label mb-3">Summary</div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Customer</dt><dd className="truncate text-right">{customer ? fullName(customer) : '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Vehicle</dt><dd className="truncate text-right">{vehicleId ? vehicleName(state.vehicles.find((v) => v.id === vehicleId)) : '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Services</dt><dd>{jobs.length}</dd></div>
              {site.multi && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-ink-3">Location</dt>
                  <dd>
                    <select className="input h-7 py-0 text-sm" value={locationId} onChange={(e) => setLocationId(e.target.value)} aria-label="Location">
                      {site.sites.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </dd>
                </div>
              )}
            </dl>
            <div className="mt-4 space-y-2">
              <button className="btn-primary w-full" disabled={!customerId} onClick={() => create('estimate')}>
                Create estimate
              </button>
              <button className="btn-secondary w-full" disabled={!customerId} onClick={() => create('approved')}>
                Create as approved work order
              </button>
            </div>
            <p className="mt-3 text-xs text-ink-3">You can add labor, parts and fees line-by-line on the next screen.</p>
          </Card>
        </div>
      </div>

      {newCustomer && <CustomerForm open onClose={() => setNewCustomer(false)} onSaved={(id) => setCustomerId(id)} />}
      {newVehicle && <VehicleForm open onClose={() => setNewVehicle(false)} initial={{ customerId }} onSaved={(id) => setVehicleId(id)} />}
    </>
  );
}
