import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Plus, Minus, Package, Boxes, Droplets, ArrowUpRight, Download, Pencil, Trash2, Store } from 'lucide-react';
import { useShop, useUI } from '../store/hooks';
import { PageHeader, Card, CardHeader, Tabs, SearchInput, Segmented, EmptyState, Modal, Field, Mono, ExternalLink, Dot } from '../components/ui';
import { SUPPLIERS, B2B_PLATFORMS, OEM_PARTS, oemPartsFor } from '../lib/suppliers';
import { priceFromMatrix } from '../lib/pricing';
import { vehicleSpecs } from '../data/vehicleSpecs';
import { freeDocuments } from '../data/serviceInfo';
import { money, vehicleName, fullName } from '../lib/format';

const QUICK = ['Oil filter', 'Engine air filter', 'Cabin air filter', 'Front brake pads', 'Front brake rotors', 'Rear brake pads', 'Battery', 'Wiper blades', 'Spark plugs', 'Serpentine belt', 'Wheel hub bearing', 'Alternator', 'Starter', 'Thermostat', 'Water pump', 'O2 sensor'];

export default function Parts() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'catalog';
  const { state } = useShop();
  const low = state.inventory.filter((p) => Number(p.qty) <= Number(p.min)).length;
  return (
    <>
      <PageHeader title="Parts & Inventory" subtitle="Look up parts across suppliers by vehicle, manage stock, and pull verified maintenance specs." />
      <Tabs
        className="mb-6"
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        tabs={[
          { value: 'catalog', label: 'Supplier lookup', icon: Search },
          { value: 'inventory', label: 'Inventory', icon: Boxes, count: low ? `${low} low` : state.inventory.length },
          { value: 'specs', label: 'Maintenance specs', icon: Droplets, count: vehicleSpecs.length },
        ]}
      />
      {tab === 'catalog' && <Catalog />}
      {tab === 'inventory' && <Inventory />}
      {tab === 'specs' && <Specs />}
    </>
  );
}

function Catalog() {
  const { state } = useShop();
  const [params] = useSearchParams();
  const [vehicleId, setVehicleId] = useState(() => state.vehicles.find((v) => v.vin && v.vin === params.get('vin'))?.id || '');
  const [manual, setManual] = useState(() => {
    const m = /^(\d{4})\s+(\S+)\s+(.+)$/.exec(params.get('q') || '');
    return m ? { year: m[1], make: m[2], model: m[3] } : { year: '', make: '', model: '' };
  });
  const [q, setQ] = useState('');
  const picked = state.vehicles.find((v) => v.id === vehicleId);
  const v = picked || (manual.year && manual.make && manual.model ? manual : null);
  const oem = v && oemPartsFor(v.make);
  const isPartNumber = /\d/.test(q) && !/\s/.test(q.trim());
  const text = (term) => (v ? `${v.year} ${v.make} ${v.model} ${term}` : term).trim();

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Field label="Vehicle">
            {(id) => (
              <select id={id} className="input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                <option value="">Enter year / make / model manually…</option>
                {state.vehicles.map((x) => (
                  <option key={x.id} value={x.id}>
                    {vehicleName(x, { trim: true })} — {fullName(state.customers.find((c) => c.id === x.customerId))}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {!picked && (
            <div className="grid grid-cols-[80px_1fr_1fr] gap-2">
              <Field label="Year">{(id) => <input id={id} className="input" inputMode="numeric" value={manual.year} onChange={(e) => setManual({ ...manual, year: e.target.value })} />}</Field>
              <Field label="Make">{(id) => <input id={id} className="input" value={manual.make} onChange={(e) => setManual({ ...manual, make: e.target.value })} />}</Field>
              <Field label="Model">{(id) => <input id={id} className="input" value={manual.model} onChange={(e) => setManual({ ...manual, model: e.target.value })} />}</Field>
            </div>
          )}
        </div>
        <div className="mt-3">
          <span className="field-label">Part name or number</span>
          <SearchInput value={q} onChange={setQ} placeholder="e.g. front brake pads, FL-500S, 04152-YZZA1" />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {QUICK.map((term) => (
            <button key={term} onClick={() => setQ(term)} className={`chip ${q === term ? 'border-accent/60 text-ink' : 'hover:border-accent/40 hover:text-ink'}`}>
              {term}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SUPPLIERS.map((s) => {
          const href = q ? (s.id === 'rockauto' && !isPartNumber && v ? s.vehicle(v) : s.search(s.id === 'rockauto' || isPartNumber ? q.trim() : text(q))) : v && s.vehicle ? s.vehicle(v) : null;
          return (
            <Card key={s.id} className="flex items-center gap-3 p-4">
              <Store size={18} strokeWidth={1.6} className="shrink-0 text-ink-3" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{s.name}</div>
                <div className="truncate text-xs text-ink-3">
                  {href ? (q ? (s.id === 'rockauto' && !isPartNumber ? `${v ? 'Vehicle catalog' : 'Part-number search'}` : `“${isPartNumber || s.id === 'rockauto' ? q.trim() : text(q)}”`) : 'Vehicle catalog') : s.kind}
                </div>
              </div>
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                  Open <ArrowUpRight size={13} />
                </a>
              ) : (
                <span className="text-xs text-ink-4">Enter a search</span>
              )}
            </Card>
          );
        })}
        {oem && (
          <Card className="flex items-center gap-3 p-4">
            <Package size={18} strokeWidth={1.6} className="shrink-0 text-ink-3" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{oem.name}</div>
              <div className="truncate text-xs text-ink-3">Genuine OEM parts & diagrams by VIN</div>
            </div>
            <a href={oem.url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
              Open <ArrowUpRight size={13} />
            </a>
          </Card>
        )}
      </div>
      <p className="-mt-3 text-xs text-ink-3">Links open each supplier’s own site with your search pre-filled — pricing, stock and fitment come straight from them. RockAuto’s search matches part numbers only, so text searches open its vehicle catalog.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Shop ordering platforms" subtitle="Commercial accounts with live local stock & your pricing" />
          <ul className="divide-y divide-line/70">
            {B2B_PLATFORMS.map((p) => (
              <li key={p.id} className="px-4 py-3">
                <ExternalLink href={p.url} className="font-medium">{p.name}</ExternalLink>
                <p className="text-sm text-ink-3">{p.desc}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Genuine OEM parts stores" subtitle="Manufacturer-operated catalogs with exploded diagrams" />
          <ul className="divide-y divide-line/70">
            {OEM_PARTS.map((p) => (
              <li key={p.url} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <ExternalLink href={p.url} className="font-medium">{p.name}</ExternalLink>
                <span className="truncate text-xs text-ink-3">{p.makes.join(', ')}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

const blankPart = { sku: '', partNumber: '', brand: '', description: '', category: 'Filters', location: '', qty: 0, min: 0, cost: 0, vendor: '' };

function Inventory() {
  const { state, adjustInventory, saveInventoryItem, deleteInventoryItem } = useShop();
  const { toast } = useUI();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const filter = params.get('filter') || 'all';
  const categories = useMemo(() => [...new Set(state.inventory.map((p) => p.category))].sort(), [state.inventory]);
  const [cat, setCat] = useState('all');

  const rows = useMemo(() => {
    const query = q.toLowerCase();
    return state.inventory
      .filter((p) => filter !== 'low' || Number(p.qty) <= Number(p.min))
      .filter((p) => cat === 'all' || p.category === cat)
      .filter((p) => !query || `${p.sku} ${p.partNumber} ${p.brand} ${p.description} ${p.location} ${p.vendor}`.toLowerCase().includes(query));
  }, [state.inventory, q, filter, cat]);

  const value = state.inventory.reduce((s, p) => s + p.qty * p.cost, 0);

  const exportCsv = () => {
    const header = ['SKU', 'Part #', 'Brand', 'Description', 'Category', 'Location', 'On hand', 'Min', 'Cost', 'Sell', 'Vendor'];
    const lines = state.inventory.map((p) => [p.sku, p.partNumber, p.brand, p.description, p.category, p.location, p.qty, p.min, p.cost, priceFromMatrix(p.cost, state.shop.matrix), p.vendor]);
    const csv = [header, ...lines].map((r) => r.map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Part #, SKU, brand, description, bin" className="w-full sm:w-72" />
        <Segmented size="sm" value={filter} onChange={(f) => setParams({ tab: 'inventory', ...(f === 'low' ? { filter: 'low' } : {}) })} options={[{ value: 'all', label: 'All' }, { value: 'low', label: 'Low stock' }]} />
        <select className="input h-7 w-auto text-xs" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button className="btn-secondary" onClick={exportCsv}><Download size={14} /> CSV</button>
          <button className="btn-primary" onClick={() => setEditing(blankPart)}><Plus size={16} strokeWidth={2.2} /> Add part</button>
        </div>
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={Package} title="No parts match" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Part</th>
                  <th className="hidden md:table-cell">Category</th>
                  <th className="hidden sm:table-cell">Bin</th>
                  <th className="text-center">On hand</th>
                  <th className="hidden text-right lg:table-cell">Min</th>
                  <th className="text-right">Cost</th>
                  <th className="hidden text-right sm:table-cell">Sell</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const isLow = Number(p.qty) <= Number(p.min);
                  return (
                    <tr key={p.id} className="group">
                      <td>
                        <div className="font-medium">{p.description}</div>
                        <div className="text-xs text-ink-3">
                          {p.brand} {p.partNumber ? <Mono className="text-ink-2">{p.partNumber}</Mono> : <span className="text-ink-4">{p.sku}</span>}
                        </div>
                      </td>
                      <td className="hidden text-ink-2 md:table-cell">{p.category}</td>
                      <td className="hidden whitespace-nowrap text-ink-2 sm:table-cell">{p.location}</td>
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          <button className="btn-ghost btn-icon h-6 w-6" onClick={() => adjustInventory(p.id, -1)} aria-label="Decrease"><Minus size={12} /></button>
                          <span className="tabular inline-flex w-12 items-center justify-center gap-1.5 font-medium">
                            {isLow && <Dot className="bg-warn" size={6} />}
                            {p.qty}
                          </span>
                          <button className="btn-ghost btn-icon h-6 w-6" onClick={() => adjustInventory(p.id, 1)} aria-label="Increase"><Plus size={12} /></button>
                        </div>
                      </td>
                      <td className="tabular hidden text-right text-ink-3 lg:table-cell">{p.min}</td>
                      <td className="tabular text-right text-ink-2">{money(p.cost)}</td>
                      <td className="tabular hidden text-right sm:table-cell">{money(priceFromMatrix(p.cost, state.shop.matrix))}</td>
                      <td className="text-right">
                        <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                          {p.partNumber && (
                            <a href={SUPPLIERS[0].search(p.partNumber)} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-icon h-7 w-7" title="Price on RockAuto">
                              <ArrowUpRight size={14} />
                            </a>
                          )}
                          <button className="btn-ghost btn-icon h-7 w-7" onClick={() => setEditing(p)} aria-label="Edit"><Pencil size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-line px-4 py-2.5 text-xs text-ink-3">
          {state.inventory.length} SKUs · {money(value)} on hand at cost · sell prices from your markup matrix
        </div>
      </Card>
      {editing && (
        <PartForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(p) => {
            saveInventoryItem(p);
            toast(p.id ? 'Part updated' : 'Part added', { tone: 'success' });
            setEditing(null);
          }}
          onDelete={
            editing.id &&
            (() => {
              deleteInventoryItem(editing.id);
              toast('Part removed');
              setEditing(null);
            })
          }
        />
      )}
    </>
  );
}

function PartForm({ initial, onClose, onSave, onDelete }) {
  const { state } = useShop();
  const [f, setF] = useState(initial);
  const set = (k, num) => (e) => setF((x) => ({ ...x, [k]: num ? Number(e.target.value) || 0 : e.target.value }));
  return (
    <Modal
      open
      onClose={onClose}
      title={initial.id ? 'Edit part' : 'Add part'}
      footer={
        <>
          {onDelete && <button className="btn-danger mr-auto" onClick={onDelete}><Trash2 size={14} /> Delete</button>}
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!f.description} onClick={() => onSave(f)}>Save</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Description" className="col-span-2">{(id) => <input id={id} autoFocus className="input" value={f.description} onChange={set('description')} />}</Field>
        <Field label="Brand">{(id) => <input id={id} className="input" value={f.brand} onChange={set('brand')} />}</Field>
        <Field label="Part number">{(id) => <input id={id} className="input font-mono" value={f.partNumber} onChange={set('partNumber')} />}</Field>
        <Field label="Internal SKU">{(id) => <input id={id} className="input" value={f.sku} onChange={set('sku')} />}</Field>
        <Field label="Category">{(id) => <input id={id} className="input" list="part-cats" value={f.category} onChange={set('category')} />}</Field>
        <datalist id="part-cats">{[...new Set(state.inventory.map((p) => p.category))].map((c) => <option key={c} value={c} />)}</datalist>
        <Field label="Bin location">{(id) => <input id={id} className="input" value={f.location} onChange={set('location')} />}</Field>
        <Field label="Vendor">{(id) => <input id={id} className="input" value={f.vendor} onChange={set('vendor')} />}</Field>
        <Field label="On hand">{(id) => <input id={id} type="number" className="input" value={f.qty} onChange={set('qty', true)} />}</Field>
        <Field label="Reorder at">{(id) => <input id={id} type="number" className="input" value={f.min} onChange={set('min', true)} />}</Field>
        <Field label="Unit cost" hint={`Sells for ${money(priceFromMatrix(f.cost, state.shop.matrix))} with your matrix`}>{(id) => <input id={id} type="number" step="0.01" className="input" value={f.cost} onChange={set('cost', true)} />}</Field>
      </div>
    </Modal>
  );
}

function Specs() {
  const manuals = freeDocuments.filter((d) => d.category === 'Owner manuals');
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        {vehicleSpecs.map((s) => (
          <Card key={s.id}>
            <CardHeader title={`${s.make} ${s.model}`} subtitle={`${s.years[0]}${s.years[1] !== s.years[0] ? `–${s.years[1]}` : ''} · ${s.engine}`} />
            <dl className="grid gap-x-8 px-4 py-2 sm:grid-cols-2">
              {[
                ['Engine oil', s.oil && [s.oil.viscosity, s.oil.spec, s.oil.capacityQt && `${s.oil.capacityQt} qt`].filter(Boolean).join(' · ')],
                ['Oil filter', s.oilFilter, true],
                ['Engine air filter', s.engineAirFilter, true],
                ['Cabin filter', s.cabinAirFilter, true],
                ['Spark plugs', s.sparkPlugs?.part, true],
                ['Coolant', s.coolant],
                ['Transmission fluid', s.transmissionFluid],
                ['Brake fluid', s.brakeFluid],
              ]
                .filter(([, v]) => v)
                .map(([k, v, mono]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-line/50 py-1.5 text-sm">
                    <dt className="shrink-0 text-ink-3">{k}</dt>
                    <dd className={`text-right ${mono ? 'font-mono text-[12.5px]' : ''}`}>{v}</dd>
                  </div>
                ))}
            </dl>
            <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 pb-3 text-xs text-ink-3">
              Sources:
              {s.sources.map((u) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="hover:text-accent hover:underline">{new URL(u).hostname.replace(/^www\./, '')}</a>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <div className="space-y-4">
        <Card className="p-4 text-sm text-ink-2">
          <p className="font-medium text-ink">Verified-only by design</p>
          <p className="mt-1">Every value here was confirmed against an OEM owner’s manual, OEM parts catalog or a major retailer’s fitment page, with sources linked. Fields that couldn’t be confirmed are left out rather than guessed.</p>
          <p className="mt-2">Always confirm fitment by VIN before ordering.</p>
        </Card>
        <Card>
          <CardHeader title="Owner’s manual portals" subtitle="Fluid specs, capacities & fuse charts — free" />
          <ul className="divide-y divide-line/70">
            {manuals.map((m) => (
              <li key={m.id} className="px-4 py-2.5 text-sm">
                <ExternalLink href={m.url}>{m.title}</ExternalLink>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
