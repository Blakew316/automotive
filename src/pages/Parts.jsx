import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Plus, Minus, Package, Boxes, Droplets, ArrowUpRight, Download, Pencil, Trash2, Store, ClipboardList, Disc3, BatteryCharging, Wrench, ArrowLeftRight } from 'lucide-react';
import PurchaseOrders from './parts/PurchaseOrders';
import TireLog from './parts/TireLog';
import CoreReturns from './parts/CoreReturns';
import { coreList } from '../lib/operations';
import { inventoryStatus, GROUPS, STOCK_STATUS, findPartByCode } from '../lib/inventory';
import Scanner, { ScanButton } from '../components/Scanner';
import { useUI, useScopedShop, useSite } from '../store/hooks';
import { siteFor, siteOf } from '../lib/locations';
import { PageHeader, Card, CardHeader, Tabs, SearchInput, Segmented, EmptyState, Modal, Field, Mono, ExternalLink, IconTile } from '../components/ui';
import { SUPPLIERS, B2B_PLATFORMS, OEM_PARTS, oemPartsFor } from '../lib/suppliers';
import { priceFromMatrix } from '../lib/pricing';
import { vehicleSpecs } from '../data/vehicleSpecs';
import { freeDocuments } from '../data/serviceInfo';
import { money, money0, vehicleName, fullName, dateShort, number } from '../lib/format';

const QUICK = ['Oil filter', 'Engine air filter', 'Cabin air filter', 'Front brake pads', 'Front brake rotors', 'Rear brake pads', 'Battery', 'Wiper blades', 'Spark plugs', 'Serpentine belt', 'Wheel hub bearing', 'Alternator', 'Starter', 'Thermostat', 'Water pump', 'O2 sensor'];

export default function Parts() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'catalog';
  const { state } = useScopedShop();
  const low = state.inventory.filter((p) => Number(p.qty) <= Number(p.min)).length;
  return (
    <>
      <PageHeader title="Parts & Inventory" subtitle="Look up parts across suppliers by vehicle, manage stock and purchase orders, and pull verified maintenance specs." />
      <Tabs
        className="mb-6"
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        tabs={[
          { value: 'catalog', label: 'Supplier lookup', icon: Search },
          { value: 'inventory', label: 'Inventory', icon: Boxes, count: low ? `${low} low` : state.inventory.length },
          { value: 'orders', label: 'Purchase orders', icon: ClipboardList, count: state.purchaseOrders.filter((p) => ['draft', 'ordered', 'partial'].includes(p.status)).length || null },
          { value: 'tires', label: 'Tires', icon: Disc3 },
          { value: 'cores', label: 'Cores', icon: BatteryCharging, count: coreList(state).filter((c) => c.status === 'owed').length || null },
          { value: 'specs', label: 'Maintenance specs', icon: Droplets, count: vehicleSpecs.length },
        ]}
      />
      {tab === 'catalog' && <Catalog />}
      {tab === 'inventory' && <Inventory />}
      {tab === 'orders' && <PurchaseOrders />}
      {tab === 'tires' && <TireLog />}
      {tab === 'cores' && <CoreReturns />}
      {tab === 'specs' && <Specs />}
    </>
  );
}

function Catalog() {
  const { state } = useScopedShop();
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

const blankPart = { sku: '', barcode: '', partNumber: '', brand: '', description: '', category: 'Filters', location: '', qty: 0, min: 0, max: 0, cost: 0, vendor: '' };
const GROUP_ICON = { parts: Wrench, tires: Disc3, batteries: BatteryCharging, fluids: Droplets };
const GROUP_TONE = { parts: 'blue', tires: 'slate', batteries: 'teal', fluids: 'sky' };

function Inventory() {
  const { state, adjustInventory, saveInventoryItem, deleteInventoryItem } = useScopedShop();
  const { toast } = useUI();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const filter = params.get('filter') || 'all';
  const categories = useMemo(() => [...new Set(state.inventory.map((p) => p.category))].sort(), [state.inventory]);
  const [cat, setCat] = useState('all');
  const status = useMemo(() => inventoryStatus(state), [state]);
  const [group, setGroup] = useState('all');
  const [found, setFound] = useState(null);
  const [counting, setCounting] = useState(false);
  const [moving, setMoving] = useState(null);
  const site = useSite();
  const onScan = (code) => {
    const p = findPartByCode(state.inventory, code);
    if (p) {
      setFound(p.id);
      setQ('');
    } else toast(`No part with code ${code}`, { tone: 'error', action: { label: 'Add part', onClick: () => setEditing({ ...blankPart, barcode: code }) } });
  };
  const hit = found && state.inventory.find((p) => p.id === found);

  const rows = useMemo(() => {
    const query = q.toLowerCase();
    return state.inventory
      .filter((p) => filter !== 'low' || ['reorder', 'low'].includes(status.get(p.id)?.status))
      .filter((p) => cat === 'all' || p.category === cat)
      .filter((p) => group === 'all' || status.get(p.id)?.group === group)
      .filter((p) => !query || `${p.sku} ${p.barcode || ''} ${p.partNumber} ${p.brand} ${p.description} ${p.location} ${p.vendor}`.toLowerCase().includes(query));
  }, [state.inventory, q, filter, cat, group, status]);

  const value = state.inventory.reduce((s, p) => s + p.qty * p.cost, 0);
  const byGroup = GROUPS.map((g) => {
    const items = state.inventory.filter((p) => status.get(p.id)?.group === g.key);
    return { ...g, items: items.length, units: items.reduce((s, p) => s + (Number(p.qty) || 0), 0), value: items.reduce((s, p) => s + p.qty * p.cost, 0) };
  });

  const exportCsv = () => {
    const header = ['SKU', 'Part #', 'Brand', 'Description', 'Category', 'Location', 'On hand', 'On jobs', 'On order', 'Min', 'Max', 'Cost', 'Sell', 'Vendor', 'Last used'];
    const lines = state.inventory.map((p) => {
      const st = status.get(p.id);
      return [p.sku, p.partNumber, p.brand, p.description, p.category, p.location, p.qty, st.onJobs, st.ordered, p.min, p.max || '', p.cost, priceFromMatrix(p.cost, state.shop.matrix), p.vendor, st.lastUsed ? st.lastUsed.slice(0, 10) : ''];
    });
    const csv = [header, ...lines].map((r) => r.map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <Card className="mb-5 grid grid-cols-2 divide-line p-1 lg:grid-cols-5 lg:divide-x">
        <div className="col-span-2 px-4 py-3.5 lg:col-span-1">
          <div className="section-label">Total inventory</div>
          <div className="tabular mt-1 text-[24px] font-semibold leading-8 tracking-tight">{money0(value)}</div>
          <div className="text-xs text-ink-3">{number(state.inventory.reduce((s, p) => s + (Number(p.qty) || 0), 0))} units · {state.inventory.length} SKUs</div>
        </div>
        {byGroup.map((g) => (
          <button key={g.key} onClick={() => setGroup(group === g.key ? 'all' : g.key)} className={`flex items-start gap-3 rounded-[10px] px-4 py-3.5 text-left transition-colors ${group === g.key ? 'bg-accent/[0.06] ring-1 ring-accent/30' : 'hover:bg-fill/[0.05]'}`}>
            <IconTile icon={GROUP_ICON[g.key]} tone={GROUP_TONE[g.key]} size={30} className="mt-0.5" />
            <div className="min-w-0">
              <div className="section-label">{g.label}</div>
              <div className="tabular text-lg font-semibold">{money0(g.value)}</div>
              <div className="text-xs text-ink-3">{number(g.units)} units</div>
            </div>
          </button>
        ))}
      </Card>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex w-full gap-1.5 sm:w-auto">
          <SearchInput value={q} onChange={setQ} placeholder="Part #, SKU, barcode, brand, bin" className="w-full sm:w-72" />
          <ScanButton className="btn-secondary btn-icon shrink-0" label="Scan a part barcode" onResult={onScan} />
        </div>
        <Segmented size="sm" value={filter} onChange={(f) => setParams({ tab: 'inventory', ...(f === 'low' ? { filter: 'low' } : {}) })} options={[{ value: 'all', label: 'All' }, { value: 'low', label: 'Low stock' }]} />
        <select className="input h-7 w-auto text-xs" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button className="btn-secondary" onClick={() => setCounting(true)}><Boxes size={14} /> Count</button>
          <button className="btn-secondary" onClick={exportCsv}><Download size={14} /> CSV</button>
          <button className="btn-primary" onClick={() => setEditing(blankPart)}><Plus size={16} strokeWidth={2.2} /> Add part</button>
        </div>
      </div>
      {hit && (
        <Card className="mb-4 flex flex-wrap items-center gap-3 px-4 py-3">
          <Package size={18} className="text-ink-3" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">{hit.description}</div>
            <div className="text-xs text-ink-3">{[hit.brand, hit.partNumber, hit.location && `Bin ${hit.location}`].filter(Boolean).join(' · ')}</div>
          </div>
          <span className="tabular text-lg font-semibold">{hit.qty} <span className="text-xs font-normal text-ink-3">in stock</span></span>
          <button className="btn-secondary btn-sm" onClick={() => (adjustInventory(hit.id, -1), toast(`Pulled 1 × ${hit.description}`))}><Minus size={13} /> Pull 1</button>
          <button className="btn-secondary btn-sm" onClick={() => (adjustInventory(hit.id, 1), toast(`Received 1 × ${hit.description}`))}><Plus size={13} /> Receive 1</button>
          <button className="btn-plain btn-sm" onClick={() => setEditing(hit)}><Pencil size={13} /> Edit</button>
          <button className="btn-ghost btn-icon h-7 w-7" onClick={() => setFound(null)} aria-label="Dismiss">×</button>
        </Card>
      )}
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
                  <th className="text-center">In stock</th>
                  <th className="hidden text-right md:table-cell" title="Pulled onto open repair orders">On jobs</th>
                  <th className="hidden text-right md:table-cell" title="On open purchase orders">Ordered</th>
                  <th className="hidden text-right lg:table-cell">Min / max</th>
                  <th>Status</th>
                  <th className="text-right">Cost</th>
                  <th className="hidden text-right sm:table-cell">Sell</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const st = status.get(p.id);
                  const pill = STOCK_STATUS[st.status];
                  return (
                    <tr key={p.id} className="group">
                      <td>
                        <div className="font-medium">{p.description}</div>
                        <div className="text-xs text-ink-3">
                          {site.multi && site.current === 'all' && <span className="mr-1.5 rounded-[4px] border border-line px-1 text-2xs font-medium text-ink-2">{siteFor(state.shop, siteOf(p)).name}</span>}
                          {p.brand} {p.partNumber ? <Mono className="text-ink-2">{p.partNumber}</Mono> : <span className="text-ink-4">{p.sku}</span>}
                          {st.lastUsed && <span className="text-ink-4"> · used {dateShort(st.lastUsed)}</span>}
                        </div>
                      </td>
                      <td className="hidden text-ink-2 md:table-cell">{p.category}</td>
                      <td className="hidden whitespace-nowrap font-mono text-xs text-ink-2 sm:table-cell">{p.location}</td>
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          <button className="btn-ghost btn-icon h-6 w-6" onClick={() => adjustInventory(p.id, -1)} aria-label="Decrease"><Minus size={12} /></button>
                          <span className="tabular w-9 text-center font-semibold">{p.qty}</span>
                          <button className="btn-ghost btn-icon h-6 w-6" onClick={() => adjustInventory(p.id, 1)} aria-label="Increase"><Plus size={12} /></button>
                        </div>
                      </td>
                      <td className="tabular hidden text-right text-ink-2 md:table-cell">{st.onJobs || <span className="text-ink-4">0</span>}</td>
                      <td className="tabular hidden text-right md:table-cell">{st.ordered ? <span className="font-medium text-accent">+{st.ordered}</span> : <span className="text-ink-4">0</span>}</td>
                      <td className="tabular hidden text-right text-ink-3 lg:table-cell">{p.min}{p.max ? ` / ${p.max}` : ''}</td>
                      <td>
                        <span className={`pill ${pill.className}`}>{pill.label}</span>
                      </td>
                      <td className="tabular text-right text-ink-2">{money(p.cost)}</td>
                      <td className="tabular hidden text-right sm:table-cell">{money(priceFromMatrix(p.cost, state.shop.matrix))}</td>
                      <td className="text-right">
                        <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                          {p.partNumber && (
                            <a href={SUPPLIERS[0].search(p.partNumber)} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-icon h-7 w-7" title="Price on RockAuto">
                              <ArrowUpRight size={14} />
                            </a>
                          )}
                          {site.multi && p.qty > 0 && (
                            <button className="btn-ghost btn-icon h-7 w-7" onClick={() => setMoving(p)} aria-label={`Transfer ${p.description}`} title="Transfer to another location"><ArrowLeftRight size={13} /></button>
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
          {rows.length} of {state.inventory.length} SKUs · values at cost · sell prices from your markup matrix · “On jobs” are parts already pulled onto open repair orders
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
      {counting && <CountInventory onClose={() => setCounting(false)} />}
      {moving && <TransferModal part={moving} onClose={() => setMoving(null)} />}
    </>
  );
}

/** Move stock to another location (the same part there gets the quantity). */
function TransferModal({ part, onClose }) {
  const { state, transferInventory } = useScopedShop();
  const { toast } = useUI();
  const site = useSite();
  const from = siteOf(part);
  const options = site.sites.filter((l) => l.id !== from);
  const [to, setTo] = useState(options[0]?.id || '');
  const [qty, setQty] = useState('1');
  const n = Math.max(0, Math.min(Number(qty) || 0, Number(part.qty) || 0));
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title="Transfer stock"
      subtitle={`${part.description} · ${part.qty} at ${siteFor(state.shop, from).name}`}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!to || n <= 0}
            onClick={() => {
              transferInventory(part.id, to, n);
              toast(`Moved ${n} to ${siteFor(state.shop, to).name}`, { tone: 'success' });
              onClose();
            }}
          >
            Transfer {n || ''}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="To">
          {(id) => (
            <select id={id} className="input" value={to} onChange={(e) => setTo(e.target.value)}>
              {options.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Quantity">{(id) => <input id={id} inputMode="numeric" className="input" value={qty} onChange={(e) => setQty(e.target.value)} />}</Field>
      </div>
    </Modal>
  );
}

/** Cycle count: scan (or search) a part, enter what's on the shelf, and the count is corrected. */
function CountInventory({ onClose }) {
  const { state, saveInventoryItem } = useScopedShop();
  const { toast } = useUI();
  const [scanning, setScanning] = useState(true);
  const [id, setId] = useState(null);
  const [counted, setCounted] = useState('');
  const [log, setLog] = useState([]);
  const [miss, setMiss] = useState('');
  const p = id && state.inventory.find((x) => x.id === id);
  const pick = (code) => {
    const hit = findPartByCode(state.inventory, code);
    setMiss(hit ? '' : code);
    if (hit) {
      setId(hit.id);
      setCounted(String(hit.qty));
    }
  };
  const save = () => {
    const n = Math.max(0, Math.round(Number(counted) || 0));
    const diff = n - (Number(p.qty) || 0);
    saveInventoryItem({ id: p.id, qty: n, countedAt: new Date().toISOString() });
    setLog((l) => [{ id: p.id, name: p.description, was: p.qty, now: n }, ...l]);
    toast(diff ? `${p.description}: ${diff > 0 ? '+' : ''}${diff} → ${n}` : `${p.description}: count matches`, { tone: 'success' });
    setId(null);
    setScanning(true);
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Count inventory"
      subtitle="Scan each part (or pick it), enter what’s on the shelf, save — repeat."
      footer={<button className="btn-secondary" onClick={onClose}>Done</button>}
    >
      {p ? (
        <div className="space-y-3">
          <div className="rounded-[10px] border border-line px-3 py-2.5">
            <div className="font-medium">{p.description}</div>
            <div className="text-xs text-ink-3">{[p.brand, p.partNumber, p.location && `Bin ${p.location}`].filter(Boolean).join(' · ')} · system says {p.qty}</div>
          </div>
          <Field label="Counted on the shelf">{(fid) => <input id={fid} inputMode="numeric" className="input h-11 text-lg" value={counted} onChange={(e) => setCounted(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && save()} />}</Field>
          <div className="flex gap-2">
            <button className="btn-primary flex-1" onClick={save}>Save count</button>
            <button className="btn-secondary" onClick={() => setId(null)}>Skip</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <button className="btn-primary w-full" onClick={() => setScanning(true)}>Scan a part</button>
          <select className="input" value="" onChange={(e) => pick(state.inventory.find((x) => x.id === e.target.value)?.partNumber || state.inventory.find((x) => x.id === e.target.value)?.sku)} aria-label="Pick a part">
            <option value="">…or pick from the list</option>
            {state.inventory.map((x) => (
              <option key={x.id} value={x.id}>{x.description}{x.partNumber ? ` · ${x.partNumber}` : ''}</option>
            ))}
          </select>
          {miss && <p className="text-sm text-warn">No part with code {miss} — add it from Inventory → Add part.</p>}
        </div>
      )}
      {log.length > 0 && (
        <ul className="mt-4 divide-y divide-line/70 rounded-[10px] border border-line text-sm">
          {log.map((l, i) => (
            <li key={i} className="flex justify-between px-3 py-1.5">
              <span className="truncate">{l.name}</span>
              <span className={`tabular ${l.now !== l.was ? 'font-medium text-warn' : 'text-ink-3'}`}>{l.was} → {l.now}</span>
            </li>
          ))}
        </ul>
      )}
      {scanning && !p && <Scanner mode="part" title="Scan a part to count" onResult={pick} onClose={() => setScanning(false)} />}
    </Modal>
  );
}

function PartForm({ initial, onClose, onSave, onDelete }) {
  const { state } = useScopedShop();
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
        <Field label="Barcode (UPC/EAN)" className="col-span-2">
          {(id) => (
            <div className="flex gap-2">
              <input id={id} className="input font-mono" value={f.barcode || ''} onChange={set('barcode')} />
              <ScanButton className="btn-outline btn-icon" label="Scan the part’s barcode" onResult={(barcode) => setF((x) => ({ ...x, barcode }))} />
            </div>
          )}
        </Field>
        <Field label="Category">{(id) => <input id={id} className="input" list="part-cats" value={f.category} onChange={set('category')} />}</Field>
        <datalist id="part-cats">{[...new Set(state.inventory.map((p) => p.category))].map((c) => <option key={c} value={c} />)}</datalist>
        <Field label="Bin location">{(id) => <input id={id} className="input" value={f.location} onChange={set('location')} />}</Field>
        <Field label="Vendor">{(id) => <input id={id} className="input" value={f.vendor} onChange={set('vendor')} />}</Field>
        <Field label="On hand">{(id) => <input id={id} type="number" className="input" value={f.qty} onChange={set('qty', true)} />}</Field>
        <Field label="Reorder at (min)">{(id) => <input id={id} type="number" className="input" value={f.min} onChange={set('min', true)} />}</Field>
        <Field label="Max stock" hint="Flags overstock">{(id) => <input id={id} type="number" className="input" value={f.max || 0} onChange={set('max', true)} />}</Field>
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
