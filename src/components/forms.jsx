import { useEffect, useMemo, useState } from 'react';
import { ScanLine, CircleAlert, CircleCheck } from 'lucide-react';
import { Modal, Field, Spinner, SearchInput, Avatar } from './ui';
import { keyboard } from '../lib/keyboard';
import { useShop, useUI } from '../store/hooks';
import { decodeOffline, cleanVin } from '../lib/vin';
import { decodeVinLocal } from '../lib/vindb';
import { fullName, vehicleName, isoDate } from '../lib/format';
import { ScanButton } from './Scanner';
import { SMALL_ENGINE, TERMS } from '../lib/edition';
import { EQUIPMENT_TYPES } from '../data/smallEngine';

const blankCustomer = { firstName: '', lastName: '', company: '', phone: '', email: '', address: '', city: '', state: '', zip: '', notes: '', tags: [] };

export function CustomerForm({ open, onClose, initial, onSaved }) {
  const { saveCustomer } = useShop();
  const { toast } = useUI();
  const [form, setForm] = useState(() => ({ ...blankCustomer, ...initial }));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.firstName.trim() || form.lastName.trim() || form.company.trim();

  const submit = (e) => {
    e?.preventDefault();
    if (!valid) return;
    const id = saveCustomer({ ...form, tags: typeof form.tags === 'string' ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : form.tags });
    toast(initial?.id ? 'Customer updated' : `${fullName(form)} added`, { tone: 'success' });
    onSaved?.(id);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? 'Edit customer' : 'New customer'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!valid} onClick={submit}>{initial?.id ? 'Save' : 'Add customer'}</button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="First name">{(id) => <input id={id} autoFocus {...keyboard.name} className="input" value={form.firstName} onChange={set('firstName')} />}</Field>
        <Field label="Last name">{(id) => <input id={id} {...keyboard.name} className="input" value={form.lastName} onChange={set('lastName')} />}</Field>
        <Field label="Mobile phone">{(id) => <input id={id} {...keyboard.phone} className="input" placeholder="(555) 555-0100" value={form.phone} onChange={set('phone')} />}</Field>
        <Field label="Email">{(id) => <input id={id} {...keyboard.email} className="input" value={form.email} onChange={set('email')} />}</Field>
        <Field label="Company" className="col-span-2" hint="For fleet and commercial accounts">{(id) => <input id={id} {...keyboard.words} className="input" value={form.company} onChange={set('company')} />}</Field>
        <Field label="Street address" className="col-span-2">{(id) => <input id={id} {...keyboard.words} className="input" value={form.address} onChange={set('address')} />}</Field>
        <div className="col-span-2 grid grid-cols-[1fr_80px_100px] gap-3">
          <Field label="City">{(id) => <input id={id} {...keyboard.words} className="input" value={form.city} onChange={set('city')} />}</Field>
          <Field label="State">{(id) => <input id={id} {...keyboard.code} className="input" maxLength={2} value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))} />}</Field>
          <Field label="ZIP">{(id) => <input id={id} {...keyboard.number} className="input" value={form.zip} onChange={set('zip')} />}</Field>
        </div>
        <Field label="Tags" className="col-span-2" hint="Comma separated, e.g. Fleet, VIP">
          {(id) => <input id={id} className="input" value={Array.isArray(form.tags) ? form.tags.join(', ') : form.tags} onChange={set('tags')} />}
        </Field>
        <Field label="Notes" className="col-span-2">{(id) => <textarea id={id} rows={2} className="input" value={form.notes} onChange={set('notes')} />}</Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

const blankVehicle = { vin: '', year: '', make: '', model: '', trim: '', engine: '', color: '', plate: '', plateState: '', mileage: '', notes: '', customerId: '' };

function VinVehicleForm({ open, onClose, initial, onSaved }) {
  const { state, saveVehicle } = useShop();
  const { toast } = useUI();
  const [form, setForm] = useState(() => ({ ...blankVehicle, ...initial }));
  const [decode, setDecode] = useState({ status: 'idle' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.make && form.model && form.year;

  const runDecode = async (scanned) => {
    const offline = decodeOffline(typeof scanned === 'string' ? scanned : form.vin);
    if (!offline.valid) return setDecode({ status: 'error', message: offline.errors[0] });
    setForm((f) => ({ ...f, vin: offline.vin, year: f.year || offline.year || '', make: f.make || offline.make || '' }));
    setDecode({ status: 'loading' });
    try {
      const d = await decodeVinLocal(offline.vin);
      setForm((f) => ({
        ...f,
        year: d.year || f.year,
        make: d.make || f.make,
        model: d.model || f.model,
        trim: d.trim || f.trim,
        engine: d.engine || f.engine,
      }));
      setDecode({ status: 'done', message: d.complete ? 'Decoded from the on-device NHTSA database' : d.errorText || 'Partially decoded' });
    } catch (err) {
      setDecode({ status: 'offline', message: `${err.message}. Filled year & make from the VIN itself.` });
    }
  };

  const submit = (e) => {
    e?.preventDefault();
    if (!valid) return;
    const id = saveVehicle({ ...form, vin: cleanVin(form.vin), year: Number(form.year), mileage: Number(String(form.mileage).replace(/\D/g, '')) || 0, customerId: form.customerId || null, ...(form.unit != null ? { unit: String(form.unit).trim() } : {}), ...(form.driver != null ? { driver: String(form.driver).trim() } : {}) });
    toast(initial?.id ? 'Vehicle updated' : `${vehicleName(form)} added`, { tone: 'success' });
    onSaved?.(id);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? 'Edit vehicle' : 'New vehicle'}
      subtitle="Enter the VIN and decode to fill in the details automatically."
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!valid} onClick={submit}>{initial?.id ? 'Save' : 'Add vehicle'}</button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-6 gap-3">
        <Field label="VIN" className="col-span-6">
          {(id) => (
            <div className="flex gap-2">
              <input
                id={id}
                autoFocus={!initial?.vin}
                {...keyboard.code}
                enterKeyHint="search"
                className="input font-mono uppercase tracking-wider"
                maxLength={17}
                placeholder="17 characters"
                value={form.vin}
                onChange={(e) => setForm((f) => ({ ...f, vin: cleanVin(e.target.value) }))}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), runDecode())}
              />
              <ScanButton mode="vin" className="btn-outline btn-icon" onResult={(v) => runDecode(v)} />
              <button type="button" className="btn-outline" disabled={form.vin.length !== 17 || decode.status === 'loading'} onClick={runDecode}>
                {decode.status === 'loading' ? <Spinner size={14} /> : <ScanLine size={15} />} Decode
              </button>
            </div>
          )}
        </Field>
        {decode.message && (
          <p className={`col-span-6 -mt-1 flex items-center gap-1.5 text-xs ${decode.status === 'error' ? 'text-bad' : 'text-ink-2'}`}>
            {decode.status === 'done' ? <CircleCheck size={13} className="text-ok" /> : <CircleAlert size={13} className={decode.status === 'error' ? '' : 'text-warn'} />}
            {decode.message}
          </p>
        )}
        <Field label="Year" className="col-span-2">{(id) => <input id={id} {...keyboard.number} maxLength={4} className="input" value={form.year} onChange={set('year')} />}</Field>
        <Field label="Make" className="col-span-2">{(id) => <input id={id} {...keyboard.name} className="input" value={form.make} onChange={set('make')} />}</Field>
        <Field label="Model" className="col-span-2">{(id) => <input id={id} {...keyboard.name} className="input" value={form.model} onChange={set('model')} />}</Field>
        <Field label="Trim" className="col-span-3">{(id) => <input id={id} className="input" value={form.trim} onChange={set('trim')} />}</Field>
        <Field label="Engine" className="col-span-3">{(id) => <input id={id} className="input" value={form.engine} onChange={set('engine')} />}</Field>
        <Field label="Plate" className="col-span-2">{(id) => <input id={id} {...keyboard.code} className="input uppercase" value={form.plate} onChange={set('plate')} />}</Field>
        <Field label="State" className="col-span-1">{(id) => <input id={id} {...keyboard.code} maxLength={2} className="input uppercase" value={form.plateState} onChange={set('plateState')} />}</Field>
        <Field label="Mileage" className="col-span-3">{(id) => <input id={id} {...keyboard.number} className="input tabular" value={form.mileage} onChange={set('mileage')} />}</Field>
        <Field label="Color" className="col-span-3">{(id) => <input id={id} className="input" value={form.color} onChange={set('color')} />}</Field>
        <Field label="Owner" className="col-span-3">
          {(id) => (
            <select id={id} className="input" value={form.customerId || ''} onChange={set('customerId')}>
              <option value="">No owner</option>
              {[...state.customers].sort((a, b) => fullName(a).localeCompare(fullName(b))).map((c) => (
                <option key={c.id} value={c.id}>{fullName(c)}</option>
              ))}
            </select>
          )}
        </Field>
        {state.customers.find((c) => c.id === form.customerId)?.account && (
          <>
            <Field label="Unit #" className="col-span-2" hint="The fleet’s own number">{(id) => <input id={id} {...keyboard.code} className="input" value={form.unit || ''} onChange={set('unit')} />}</Field>
            <Field label="Driver / department" className="col-span-4">{(id) => <input id={id} className="input" value={form.driver || ''} onChange={set('driver')} />}</Field>
          </>
        )}
        <Field label="Notes" className="col-span-6">{(id) => <textarea id={id} rows={2} className="input" value={form.notes} onChange={set('notes')} />}</Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

const blankEquipment = { type: '', make: '', model: '', vin: '', year: '', mileage: '', engine: '', plate: '', notes: '', customerId: '' };
const TYPE_GROUPS = [...new Set(EQUIPMENT_TYPES.map((t) => t.group))];

// Brand names for the Brand field's suggestions; the brand list loads only when the form opens.
function useBrandNames() {
  const [names, setNames] = useState([]);
  useEffect(() => {
    let live = true;
    import('../data/smallEngineBrands').then((m) => live && setNames(m.SE_BRAND_NAMES || (m.SE_BRANDS || []).map((b) => b.name))).catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return names;
}

/** The Small Engine Edition's unit form: type, brand, model and serial numbers, hours, engine. */
function EquipmentForm({ open, onClose, initial, onSaved }) {
  const { state, saveVehicle } = useShop();
  const { toast } = useUI();
  const brands = useBrandNames();
  const [form, setForm] = useState(() => ({ ...blankEquipment, ...initial }));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = String(form.make || '').trim() || String(form.model || '').trim() || form.type;

  const submit = (e) => {
    e?.preventDefault();
    if (!valid) return;
    const year = Number(String(form.year || '').replace(/\D/g, ''));
    const id = saveVehicle({
      ...form,
      make: String(form.make || '').trim(),
      model: String(form.model || '').trim(),
      vin: String(form.vin || '').trim().toUpperCase(),
      year: year || '',
      mileage: Number(String(form.mileage).replace(/[^\d.]/g, '')) || 0,
      customerId: form.customerId || null,
      ...(form.unit != null ? { unit: String(form.unit).trim() } : {}),
      ...(form.driver != null ? { driver: String(form.driver).trim() } : {}),
    });
    toast(initial?.id ? 'Equipment updated' : `${vehicleName(form)} added`, { tone: 'success' });
    onSaved?.(id);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? 'Edit equipment' : 'New equipment'}
      subtitle="The model and serial numbers are on the unit’s ID tag or engine shroud."
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!valid} onClick={submit}>{initial?.id ? 'Save' : 'Add equipment'}</button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-6 gap-3">
        <Field label="Type" className="col-span-6 sm:col-span-3">
          {(id) => (
            <select id={id} autoFocus={!initial?.id} className="input" value={form.type || ''} onChange={set('type')}>
              <option value="">Choose a type…</option>
              {TYPE_GROUPS.map((g) => (
                <optgroup key={g} label={g}>
                  {EQUIPMENT_TYPES.filter((t) => t.group === g).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </optgroup>
              ))}
            </select>
          )}
        </Field>
        <Field label="Brand" className="col-span-6 sm:col-span-3">
          {(id) => (
            <>
              <input id={id} {...keyboard.name} list={`${id}-brands`} className="input" placeholder="e.g. Toro, Stihl, Honda" value={form.make} onChange={set('make')} />
              <datalist id={`${id}-brands`}>{brands.map((b) => <option key={b} value={b} />)}</datalist>
            </>
          )}
        </Field>
        <Field label="Model #" className="col-span-3">{(id) => <input id={id} {...keyboard.code} className="input" value={form.model} onChange={set('model')} />}</Field>
        <Field label="Serial #" className="col-span-3">{(id) => <input id={id} {...keyboard.code} className="input font-mono uppercase" value={form.vin} onChange={set('vin')} />}</Field>
        <Field label="Engine" className="col-span-6 sm:col-span-4" hint="Engine make & model, e.g. Kawasaki FR691V">{(id) => <input id={id} className="input" value={form.engine} onChange={set('engine')} />}</Field>
        <Field label="Year" className="col-span-2" hint="Optional">{(id) => <input id={id} {...keyboard.number} maxLength={4} className="input" value={form.year || ''} onChange={set('year')} />}</Field>
        <Field label="Hours" className="col-span-3" hint="From the hour meter, if it has one">{(id) => <input id={id} {...keyboard.number} className="input tabular" value={form.mileage || ''} onChange={set('mileage')} />}</Field>
        <Field label="Tag #" className="col-span-3" hint="Your claim tag or the owner’s unit number">{(id) => <input id={id} {...keyboard.code} className="input uppercase" value={form.plate || ''} onChange={set('plate')} />}</Field>
        <Field label="Owner" className="col-span-6">
          {(id) => (
            <select id={id} className="input" value={form.customerId || ''} onChange={set('customerId')}>
              <option value="">No owner</option>
              {[...state.customers].sort((a, b) => fullName(a).localeCompare(fullName(b))).map((c) => (
                <option key={c.id} value={c.id}>{fullName(c)}</option>
              ))}
            </select>
          )}
        </Field>
        {state.customers.find((c) => c.id === form.customerId)?.account && (
          <>
            <Field label="Unit #" className="col-span-2" hint="The account’s own number">{(id) => <input id={id} {...keyboard.code} className="input" value={form.unit || ''} onChange={set('unit')} />}</Field>
            <Field label="Crew / department" className="col-span-4">{(id) => <input id={id} className="input" value={form.driver || ''} onChange={set('driver')} />}</Field>
          </>
        )}
        <Field label="Notes" className="col-span-6">{(id) => <textarea id={id} rows={2} className="input" value={form.notes} onChange={set('notes')} />}</Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

/** Add or edit a vehicle — or, in the Small Engine Edition, a piece of equipment. */
export const VehicleForm = SMALL_ENGINE ? EquipmentForm : VinVehicleForm;

/** Searchable customer list used by new-RO and appointment flows. */
export function CustomerPicker({ value, onChange, onCreate }) {
  const { state } = useShop();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const query = q.toLowerCase();
    return state.customers
      .filter((c) => !query || `${fullName(c)} ${c.phone} ${c.email} ${c.company}`.toLowerCase().includes(query))
      .sort((a, b) => fullName(a).localeCompare(fullName(b)))
      .slice(0, 50);
  }, [q, state.customers]);
  return (
    <div>
      <div className="flex gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search name, phone, email" className="flex-1" autoFocus />
        {onCreate && <button type="button" className="btn-secondary" onClick={onCreate}>New</button>}
      </div>
      <div className="mt-2 max-h-64 overflow-y-auto rounded-[9px] border border-line">
        {list.map((c) => {
          const vehicles = state.vehicles.filter((v) => v.customerId === c.id);
          const active = value === c.id;
          return (
            <button
              type="button"
              key={c.id}
              onClick={() => onChange(c.id)}
              className={`flex w-full items-center gap-3 border-b border-line/70 px-3 py-2 text-left last:border-0 ${active ? 'bg-accent/[0.08]' : 'hover:bg-fill/[0.05]'}`}
            >
              <Avatar person={c} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{fullName(c)}</span>
                <span className="block truncate text-xs text-ink-3">{[c.phone, vehicles.map((v) => (SMALL_ENGINE ? vehicleName(v) : `${v.year} ${v.model}`)).join(', ')].filter(Boolean).join(' · ')}</span>
              </span>
              {active && <CircleCheck size={17} className="text-accent" />}
            </button>
          );
        })}
        {!list.length && <div className="px-3 py-6 text-center text-sm text-ink-3">No matching customers</div>}
      </div>
    </div>
  );
}

export function AppointmentForm({ open, onClose, initial }) {
  const { state, saveAppointment, deleteAppointment } = useShop();
  const { toast } = useUI();
  const start = initial?.start ? new Date(initial.start) : (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  })();
  const [form, setForm] = useState(() => ({
    customerId: '',
    vehicleId: '',
    title: '',
    duration: 60,
    techId: '',
    notes: '',
    ...initial,
    date: isoDate(start),
    time: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
  }));
  const vehicles = state.vehicles.filter((v) => v.customerId === form.customerId);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.customerId && form.date && form.time;

  const submit = () => {
    if (!valid) return;
    const [h, m] = form.time.split(':').map(Number);
    const [y, mo, d] = form.date.split('-').map(Number);
    const startAt = new Date(y, mo - 1, d, h, m).toISOString();
    const { date: _date, time: _time, ...rest } = form;
    saveAppointment({ ...rest, start: startAt, duration: Number(form.duration), vehicleId: form.vehicleId || vehicles[0]?.id || null, techId: form.techId || null, title: form.title || 'Service appointment' });
    toast(initial?.id ? 'Appointment updated' : 'Appointment booked', { tone: 'success' });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? 'Edit appointment' : 'Book appointment'}
      footer={
        <>
          {initial?.id && (
            <button
              className="btn-danger mr-auto"
              onClick={() => {
                deleteAppointment(initial.id);
                toast('Appointment removed');
                onClose();
              }}
            >
              Delete
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!valid} onClick={submit}>{initial?.id ? 'Save' : 'Book'}</button>
        </>
      }
    >
      <div className="space-y-4">
        {!initial?.id && <CustomerPicker value={form.customerId} onChange={(id) => setForm((f) => ({ ...f, customerId: id, vehicleId: '' }))} />}
        {form.customerId && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={TERMS.vehicle} className="col-span-2">
              {(id) => (
                <select id={id} className="input" value={form.vehicleId || ''} onChange={set('vehicleId')}>
                  {vehicles.length === 0 && <option value="">{`No ${TERMS.vehicles.toLowerCase()} on file`}</option>}
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{vehicleName(v, { trim: true })}</option>)}
                </select>
              )}
            </Field>
            <Field label="Reason for visit" className="col-span-2">{(id) => <input id={id} className="input" placeholder={SMALL_ENGINE ? 'e.g. Tune-up, won’t start' : 'e.g. Oil change, brake noise'} value={form.title} onChange={set('title')} />}</Field>
            <Field label="Date">{(id) => <input id={id} type="date" className="input" value={form.date} onChange={set('date')} />}</Field>
            <Field label="Time">{(id) => <input id={id} type="time" step={900} className="input" value={form.time} onChange={set('time')} />}</Field>
            <Field label="Duration">
              {(id) => (
                <select id={id} className="input" value={form.duration} onChange={set('duration')}>
                  {[30, 45, 60, 90, 120, 180, 240, 480].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} hr`}</option>)}
                </select>
              )}
            </Field>
            <Field label="Technician">
              {(id) => (
                <select id={id} className="input" value={form.techId || ''} onChange={set('techId')}>
                  <option value="">Unassigned</option>
                  {state.technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </Field>
            <Field label="Notes" className="col-span-2">{(id) => <textarea id={id} rows={2} className="input" value={form.notes} onChange={set('notes')} />}</Field>
          </div>
        )}
      </div>
    </Modal>
  );
}
