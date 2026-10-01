import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ClipboardList, PackageCheck, Send, Trash2, Wand2, Mail, Copy, Check, Search } from 'lucide-react';
import { useShop, useUI } from '../../store/hooks';
import { Card, Segmented, EmptyState, Modal, Field, Dot, Mono, SearchInput } from '../../components/ui';
import { money, dateShort, mailHref, isoDate } from '../../lib/format';
import { PO_STATUS, poTotal, onOrderByItem } from '../../lib/purchasing';

export default function PurchaseOrders() {
  const { state, savePO } = useShop();
  const { toast } = useUI();
  const [filter, setFilter] = useState('open');
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const list = state.purchaseOrders.filter((p) => (filter === 'open' ? ['draft', 'ordered', 'partial'].includes(p.status) : filter === 'received' ? p.status === 'received' : true));
  const low = state.inventory.filter((p) => Number(p.qty) <= Number(p.min));
  const onOrder = onOrderByItem(state.purchaseOrders);
  const toReorder = low.filter((p) => !onOrder.get(p.id));

  const reorder = () => {
    const byVendor = new Map();
    for (const p of toReorder) {
      const qty = Math.max(1, Math.ceil(Number(p.min) * 2 - Number(p.qty)));
      if (!byVendor.has(p.vendor || 'Unassigned vendor')) byVendor.set(p.vendor || 'Unassigned vendor', []);
      byVendor.get(p.vendor || 'Unassigned vendor').push({ id: `l${p.id}`, inventoryId: p.id, partNumber: p.partNumber, description: p.description, qty, received: 0, cost: p.cost, orderId: null });
    }
    for (const [vendor, lines] of byVendor) savePO({ vendor, lines, notes: 'Restock below minimum' });
    toast(`${byVendor.size} draft PO${byVendor.size === 1 ? '' : 's'} created for ${toReorder.length} low-stock items`, { tone: 'success' });
    setFilter('open');
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'open', label: 'Open', count: state.purchaseOrders.filter((p) => ['draft', 'ordered', 'partial'].includes(p.status)).length },
            { value: 'received', label: 'Received' },
            { value: 'all', label: 'All' },
          ]}
        />
        <div className="ml-auto flex gap-2">
          {toReorder.length > 0 && (
            <button className="btn-secondary" onClick={reorder} title="Draft POs for everything at or below its minimum, grouped by vendor">
              <Wand2 size={14} /> Reorder {toReorder.length} low-stock
            </button>
          )}
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} strokeWidth={2.2} /> New PO
          </button>
        </div>
      </div>
      <Card>
        {list.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No purchase orders" body="Create one to order stock or parts for a repair order, then receive it to update inventory." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>PO</th>
                  <th>Vendor</th>
                  <th>Status</th>
                  <th className="hidden sm:table-cell">Items</th>
                  <th className="hidden md:table-cell">Ordered</th>
                  <th className="hidden md:table-cell">Expected</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {list.map((po) => {
                  const st = PO_STATUS[po.status];
                  const units = po.lines.reduce((s, l) => s + Number(l.qty || 0), 0);
                  const rec = po.lines.reduce((s, l) => s + Number(l.received || 0), 0);
                  return (
                    <tr key={po.id} className="row-link" onClick={() => setOpenId(po.id)}>
                      <td className="tabular font-medium">#{po.number}</td>
                      <td>
                        <div className="font-medium">{po.vendor}</div>
                        {po.notes && <div className="max-w-[260px] truncate text-xs text-ink-3">{po.notes}</div>}
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
                          <Dot className={st.dot} size={7} /> {st.label}
                        </span>
                      </td>
                      <td className="tabular hidden text-ink-2 sm:table-cell">
                        {po.lines.length} lines · {po.status === 'partial' ? `${rec}/${units}` : units} units
                      </td>
                      <td className="hidden whitespace-nowrap text-ink-2 md:table-cell">{po.orderedAt ? dateShort(po.orderedAt) : '—'}</td>
                      <td className="hidden whitespace-nowrap text-ink-2 md:table-cell">{po.expectedAt ? dateShort(po.expectedAt) : '—'}</td>
                      <td className="tabular text-right">{money(poTotal(po))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {(openId || creating) && (
        <POModal
          po={openId ? state.purchaseOrders.find((p) => p.id === openId) : null}
          onClose={() => {
            setOpenId(null);
            setCreating(false);
          }}
          onCreated={(id) => {
            setCreating(false);
            setOpenId(id);
          }}
        />
      )}
    </>
  );
}

function POModal({ po, onClose, onCreated }) {
  const { state, savePO, deletePO, setPOStatus, receivePO } = useShop();
  const { toast } = useUI();
  const [draft, setDraft] = useState(() => po || { vendor: '', vendorEmail: '', expectedAt: null, notes: '', lines: [] });
  const [mode, setMode] = useState(po && ['ordered', 'partial'].includes(po.status) ? 'view' : 'edit');
  const [receipts, setReceipts] = useState(() => Object.fromEntries((po?.lines || []).map((l) => [l.id, Math.max(0, l.qty - l.received)])));
  const [picking, setPicking] = useState(false);
  const [copied, setCopied] = useState(false);
  const editable = !po || po.status === 'draft';
  const vendors = useMemo(() => [...new Set([...state.inventory.map((p) => p.vendor), ...state.purchaseOrders.map((p) => p.vendor)].filter(Boolean))].sort(), [state.inventory, state.purchaseOrders]);
  const total = poTotal(draft);
  const setLine = (id, patch) => setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const save = () => {
    if (po) savePO({ ...draft, id: po.id });
    else onCreated(savePO(draft));
    toast('Purchase order saved', { tone: 'success' });
  };
  const text = `Purchase order #${po?.number || ''} — ${state.shop.name}\n${draft.lines.map((l) => `${l.qty} × ${l.partNumber ? `${l.partNumber} ` : ''}${l.description}`).join('\n')}\n\n${state.shop.name}, ${state.shop.address}, ${state.shop.city} ${state.shop.state} · ${state.shop.phone}`;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={po ? `PO #${po.number}` : 'New purchase order'}
      subtitle={po ? `${PO_STATUS[po.status].label} · created ${dateShort(po.createdAt)}` : 'Order stock or parts for a repair order'}
      footer={
        <>
          {po && editable && (
            <button
              className="btn-plain mr-auto text-bad"
              onClick={() => {
                deletePO(po.id);
                toast(`PO #${po.number} deleted`);
                onClose();
              }}
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
          {mode === 'receive' ? (
            <>
              <button className="btn-secondary" onClick={() => setMode('view')}>Cancel</button>
              <button
                className="btn-primary"
                onClick={() => {
                  receivePO(po.id, receipts);
                  toast('Received — inventory updated', { tone: 'success' });
                  onClose();
                }}
              >
                <PackageCheck size={15} /> Receive {Object.values(receipts).reduce((s, n) => s + (Number(n) || 0), 0)} items
              </button>
            </>
          ) : (
            <>
              <span className="mr-auto tabular text-sm text-ink-2">{money(total)} at cost</span>
              {editable && (
                <button className="btn-secondary" disabled={!draft.vendor || !draft.lines.length} onClick={save}>
                  Save draft
                </button>
              )}
              {editable && po && (
                <button
                  className="btn-primary"
                  disabled={!draft.vendor || !draft.lines.length}
                  onClick={() => {
                    savePO({ ...draft, id: po.id });
                    setPOStatus(po.id, 'ordered');
                    toast(`PO #${po.number} marked ordered`, { tone: 'success' });
                    onClose();
                  }}
                >
                  <Send size={14} /> Mark ordered
                </button>
              )}
              {po && ['ordered', 'partial'].includes(po.status) && (
                <button className="btn-primary" onClick={() => setMode('receive')}>
                  <PackageCheck size={15} /> Receive items
                </button>
              )}
            </>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Vendor">
            {(id) => (
              <>
                <input id={id} list="po-vendors" className="input" disabled={!editable} value={draft.vendor} onChange={(e) => setDraft({ ...draft, vendor: e.target.value })} />
                <datalist id="po-vendors">
                  {vendors.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Vendor email">{(id) => <input id={id} type="email" className="input" disabled={!editable} value={draft.vendorEmail || ''} onChange={(e) => setDraft({ ...draft, vendorEmail: e.target.value })} />}</Field>
          <Field label="Expected">
            {(id) => <input id={id} type="date" className="input" value={draft.expectedAt ? isoDate(draft.expectedAt) : ''} onChange={(e) => setDraft({ ...draft, expectedAt: e.target.value ? new Date(`${e.target.value}T10:00`).toISOString() : null })} />}
          </Field>
        </div>

        <div className="overflow-x-auto rounded-[10px] border border-line">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-3">
                <th className="px-3 py-2 text-left font-medium">Part</th>
                <th className="w-20 py-2 text-right font-medium">Qty</th>
                <th className="w-24 py-2 text-right font-medium">Unit cost</th>
                {mode === 'receive' ? <th className="w-28 py-2 pr-3 text-right font-medium">Receiving now</th> : <th className="w-24 py-2 pr-3 text-right font-medium">{po && po.status !== 'draft' ? 'Received' : 'Total'}</th>}
                {editable && <th className="w-9" />}
              </tr>
            </thead>
            <tbody>
              {draft.lines.map((l) => {
                const ro = l.orderId && state.orders.find((o) => o.id === l.orderId);
                return (
                  <tr key={l.id} className="border-t border-line/60 align-top">
                    <td className="px-3 py-2">
                      {editable ? (
                        <input className="input h-7 py-0 text-sm" value={l.description} onChange={(e) => setLine(l.id, { description: e.target.value })} aria-label="Description" />
                      ) : (
                        <div className="font-medium">{l.description}</div>
                      )}
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                        {editable ? (
                          <input className="h-6 w-32 rounded-[5px] border border-transparent bg-transparent px-1 font-mono text-xs hover:border-line focus:border-accent/60 focus:outline-none" placeholder="Part #" value={l.partNumber || ''} onChange={(e) => setLine(l.id, { partNumber: e.target.value })} />
                        ) : (
                          l.partNumber && <Mono>{l.partNumber}</Mono>
                        )}
                        {l.inventoryId && <span>Stock item</span>}
                        {ro && (
                          <Link to={`/orders/${ro.id}`} className="text-accent hover:underline">
                            For RO #{ro.number}
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      {editable ? <input inputMode="numeric" className="input h-7 w-16 py-0 text-right text-sm" value={l.qty} onChange={(e) => setLine(l.id, { qty: Math.max(0, Number(e.target.value) || 0) })} aria-label="Quantity" /> : <span className="tabular">{l.qty}</span>}
                    </td>
                    <td className="py-2 text-right">
                      {editable ? <input inputMode="decimal" className="input h-7 w-20 py-0 text-right text-sm" value={l.cost} onChange={(e) => setLine(l.id, { cost: e.target.value })} onBlur={(e) => setLine(l.id, { cost: Number(e.target.value) || 0 })} aria-label="Unit cost" /> : <span className="tabular">{money(l.cost)}</span>}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {mode === 'receive' ? (
                        <input
                          inputMode="numeric"
                          className="input h-7 w-16 py-0 text-right text-sm"
                          value={receipts[l.id] ?? 0}
                          onChange={(e) => setReceipts({ ...receipts, [l.id]: Math.max(0, Math.min(l.qty - l.received, Number(e.target.value) || 0)) })}
                          aria-label={`Receive ${l.description}`}
                        />
                      ) : po && po.status !== 'draft' ? (
                        <span className={`tabular ${l.received >= l.qty ? 'text-ok' : 'text-ink-2'}`}>
                          {l.received}/{l.qty}
                        </span>
                      ) : (
                        <span className="tabular">{money((Number(l.qty) || 0) * (Number(l.cost) || 0))}</span>
                      )}
                    </td>
                    {editable && (
                      <td className="py-2 pr-2">
                        <button className="btn-ghost btn-icon h-7 w-7" onClick={() => setDraft({ ...draft, lines: draft.lines.filter((x) => x.id !== l.id) })} aria-label="Remove line">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {!draft.lines.length && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-ink-3">No lines yet — add stock items or parts needed on repair orders.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {editable && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary btn-sm" onClick={() => setPicking('stock')}>
              <Plus size={13} /> Stock item
            </button>
            <button className="btn-secondary btn-sm" onClick={() => setPicking('ro')}>
              <Plus size={13} /> Parts needed on ROs
            </button>
            <button className="btn-secondary btn-sm" onClick={() => setDraft({ ...draft, lines: [...draft.lines, { id: `l${Date.now()}`, inventoryId: null, partNumber: '', description: '', qty: 1, received: 0, cost: 0, orderId: null }] })}>
              <Plus size={13} /> Blank line
            </button>
          </div>
        )}

        <Field label="Notes">{(id) => <input id={id} className="input" value={draft.notes || ''} disabled={!editable} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />}</Field>

        {po && draft.lines.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {draft.vendorEmail && (
              <a className="btn-secondary btn-sm" href={mailHref(draft.vendorEmail, `Purchase order #${po.number} — ${state.shop.name}`, text)}>
                <Mail size={13} /> Email to vendor
              </a>
            )}
            <button
              className="btn-secondary btn-sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  // Clipboard blocked — nothing to do.
                }
              }}
            >
              {copied ? <Check size={13} className="text-ok" /> : <Copy size={13} />} Copy for phone order
            </button>
          </div>
        )}
      </div>
      {picking && (
        <LinePicker
          kind={picking}
          onClose={() => setPicking(false)}
          onAdd={(lines) => {
            setDraft((d) => ({ ...d, lines: [...d.lines, ...lines] }));
            setPicking(false);
          }}
        />
      )}
    </Modal>
  );
}

function LinePicker({ kind, onClose, onAdd }) {
  const { state } = useShop();
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState({});
  const roParts = useMemo(
    () =>
      state.orders
        .filter((o) => !['closed', 'ready'].includes(o.status))
        .flatMap((o) => o.services.filter((s) => s.status !== 'declined').flatMap((s) => s.items.filter((i) => i.type === 'part' && i.partStatus === 'needed' && !i.inventoryId).map((i) => ({ o, s, i }))))
        .filter(({ i }) => !state.purchaseOrders.some((po) => po.status !== 'cancelled' && po.lines.some((l) => l.itemId === i.id))),
    [state.orders, state.purchaseOrders],
  );
  const stock = state.inventory.filter((p) => !q || `${p.description} ${p.partNumber} ${p.brand} ${p.vendor}`.toLowerCase().includes(q.toLowerCase()));
  const rows = kind === 'ro' ? roParts : stock;
  const add = () => {
    const lines = [];
    if (kind === 'ro')
      roParts.forEach(({ o, s, i }) => chosen[i.id] && lines.push({ id: `l${i.id}`, inventoryId: null, partNumber: i.partNumber || '', description: i.description, qty: Number(i.qty) || 1, received: 0, cost: Number(i.cost) || 0, orderId: o.id, serviceId: s.id, itemId: i.id }));
    else stock.forEach((p) => chosen[p.id] && lines.push({ id: `l${p.id}${Date.now()}`, inventoryId: p.id, partNumber: p.partNumber, description: p.description, qty: Math.max(1, Math.ceil(Number(p.min) * 2 - Number(p.qty))), received: 0, cost: p.cost, orderId: null }));
    onAdd(lines);
  };
  const count = Object.values(chosen).filter(Boolean).length;
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={kind === 'ro' ? 'Parts needed on repair orders' : 'Add stock items'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!count} onClick={add}>
            Add {count || ''} line{count === 1 ? '' : 's'}
          </button>
        </>
      }
    >
      {kind === 'stock' && <SearchInput value={q} onChange={setQ} placeholder="Search inventory" className="mb-3" />}
      <ul className="max-h-[50vh] divide-y divide-line/70 overflow-y-auto rounded-[10px] border border-line">
        {rows.map((r) => {
          const key = kind === 'ro' ? r.i.id : r.id;
          return (
            <li key={key}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-fill/[0.04]">
                <input type="checkbox" checked={Boolean(chosen[key])} onChange={(e) => setChosen({ ...chosen, [key]: e.target.checked })} className="accent-[rgb(var(--accent))]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{kind === 'ro' ? r.i.description : r.description}</span>
                  <span className="block text-xs text-ink-3">
                    {kind === 'ro' ? `RO #${r.o.number} · ${r.s.title} · qty ${r.i.qty}` : `${r.brand} ${r.partNumber || ''} · ${r.qty} on hand (min ${r.min}) · ${r.vendor}`}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
        {!rows.length && (
          <li className="flex flex-col items-center gap-2 px-3 py-8 text-sm text-ink-3">
            <Search size={18} />
            {kind === 'ro' ? 'No repair-order parts are waiting to be ordered.' : 'No matching inventory.'}
          </li>
        )}
      </ul>
    </Modal>
  );
}
