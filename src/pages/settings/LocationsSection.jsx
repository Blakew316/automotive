// Settings → General → Locations: a second (third…) shop under the same business. Each location can
// have its own address, phone, sales tax and labor rate; everything else is shared.
import { useState } from 'react';
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import { useShop, useUI, useSite } from '../../store/hooks';
import { Card, CardHeader, Field, InlineText, Modal } from '../../components/ui';
import { uid } from '../../lib/format';
import { siteOf } from '../../lib/locations';

export default function LocationsSection() {
  const { state, updateShop } = useShop();
  const { toast } = useUI();
  const site = useSite();
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const list = state.shop.locations || [];
  const count = (id) => state.orders.filter((o) => siteOf(o) === id).length;

  const save = (loc) => {
    updateShop({ locations: list.some((l) => l.id === loc.id) ? list.map((l) => (l.id === loc.id ? loc : l)) : [...list, loc] });
    toast(list.some((l) => l.id === loc.id) ? 'Location updated' : `${loc.name} added — pick it from the menu under the shop name`, { tone: 'success' });
    setEditing(null);
  };

  return (
    <Card>
      <CardHeader
        title="Locations"
        icon={MapPin}
        subtitle={list.length ? `${list.length + 1} locations · each device picks the one it works at (under the shop name in the sidebar)` : 'Add a location to run more than one shop from the same data'}
        actions={<button className="btn-plain btn-sm" onClick={() => setEditing({})}><Plus size={14} /> Add location</button>}
      />
      <div className="px-4 pb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="This (main) location’s name" hint="The shop profile above is its address">
            {(id) => <InlineText id={id} className="input" value={state.shop.locationName || ''} placeholder="Main location" onCommit={(locationName) => updateShop({ locationName: locationName.trim() })} />}
          </Field>
        </div>
        {list.length > 0 && (
          <ul className="mt-3 divide-y divide-line/70 rounded-[10px] border border-line">
            {list.map((l) => (
              <li key={l.id} className="flex items-center gap-2 px-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{l.name}{site.current === l.id && <span className="ml-1.5 text-xs font-normal text-accent">· this device</span>}</span>
                  <span className="block truncate text-xs text-ink-3">
                    {[l.address, [l.city, l.state].filter(Boolean).join(', ')].filter(Boolean).join(', ') || 'Same address as the shop'}
                    {l.taxRate != null && l.taxRate !== '' ? ` · tax ${l.taxRate}%` : ''}
                    {l.laborRate ? ` · labor $${l.laborRate}/hr` : ''} · {count(l.id)} ROs
                  </span>
                </span>
                <button className="btn-ghost btn-icon h-7 w-7" onClick={() => setEditing(l)} aria-label={`Edit ${l.name}`}><Pencil size={13} /></button>
                <button className="btn-ghost btn-icon h-7 w-7 text-ink-3 hover:text-bad" onClick={() => setRemoving(l)} aria-label={`Remove ${l.name}`}><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {editing && <LocationModal initial={editing} onSave={save} onClose={() => setEditing(null)} />}
      {removing && (
        <Modal
          open
          size="sm"
          onClose={() => setRemoving(null)}
          title={`Remove ${removing.name}?`}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setRemoving(null)}>Cancel</button>
              <button
                className="btn-primary !bg-bad"
                onClick={() => {
                  updateShop({ locations: list.filter((l) => l.id !== removing.id) });
                  if (site.current === removing.id) site.setCurrent('all');
                  toast(`${removing.name} removed`);
                  setRemoving(null);
                }}
              >
                Remove
              </button>
            </>
          }
        >
          <p className="text-sm text-ink-2">{count(removing.id) ? `Its ${count(removing.id)} repair orders, appointments and parts stay on file and show under all locations.` : 'Nothing is on file at this location yet.'}</p>
        </Modal>
      )}
    </Card>
  );
}

function LocationModal({ initial, onSave, onClose }) {
  const [f, setF] = useState(() => ({ name: '', address: '', city: '', state: '', zip: '', phone: '', email: '', taxRate: '', laborRate: '', ...initial }));
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const num = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  return (
    <Modal
      open
      onClose={onClose}
      title={initial.id ? 'Edit location' : 'Add a location'}
      subtitle="Blank fields use the main shop’s details."
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!f.name.trim()} onClick={() => onSave({ ...f, id: f.id || uid('loc'), name: f.name.trim(), state: f.state.toUpperCase(), taxRate: num(f.taxRate), laborRate: num(f.laborRate) })}>Save</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" className="col-span-2" hint="e.g. West Side, Downtown">{(id) => <input id={id} className="input" value={f.name} onChange={set('name')} autoFocus />}</Field>
        <Field label="Street address" className="col-span-2">{(id) => <input id={id} className="input" value={f.address} onChange={set('address')} />}</Field>
        <div className="col-span-2 grid grid-cols-[1fr_80px_100px] gap-3">
          <Field label="City">{(id) => <input id={id} className="input" value={f.city} onChange={set('city')} />}</Field>
          <Field label="State">{(id) => <input id={id} className="input" maxLength={2} value={f.state} onChange={set('state')} />}</Field>
          <Field label="ZIP">{(id) => <input id={id} className="input" value={f.zip} onChange={set('zip')} />}</Field>
        </div>
        <Field label="Phone">{(id) => <input id={id} type="tel" className="input" value={f.phone} onChange={set('phone')} />}</Field>
        <Field label="Email">{(id) => <input id={id} type="email" className="input" value={f.email} onChange={set('email')} />}</Field>
        <Field label="Sales tax (%)" hint="If different here">{(id) => <input id={id} inputMode="decimal" className="input" value={f.taxRate ?? ''} onChange={set('taxRate')} />}</Field>
        <Field label="Labor rate ($/hr)" hint="If different here">{(id) => <input id={id} inputMode="decimal" className="input" value={f.laborRate ?? ''} onChange={set('laborRate')} />}</Field>
      </div>
    </Modal>
  );
}
