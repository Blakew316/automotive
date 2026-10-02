import { useState } from 'react';
import { Trash2, MoreHorizontal, Wrench, Package, Receipt, Truck, Boxes, ArrowUpRight, Check, MessageSquareText, Camera, Disc3, ShieldCheck } from 'lucide-react';
import { useShop, useUI } from '../../store/hooks';
import { Menu, NumInput, InlineText, Segmented, Spinner } from '../../components/ui';
import { useIsPhone } from '../../lib/viewport';
import { itemTotal, serviceTotal, serviceValue, serviceHours } from '../../lib/pricing';
import { NO_CHARGE_REASONS, CORE_STATUS } from '../../lib/operations';
import { money } from '../../lib/format';
import { SUPPLIERS } from '../../lib/suppliers';
import { jobProfit, profitTone, TONE_TEXT } from '../../lib/profit';
import InventoryPicker from './InventoryPicker';
import TirePanel from './TirePanel';
import JobMemory from './JobMemory';
import { newTireQuote } from '../../lib/tires';
import { MediaThumb, PickButton } from './MediaPanel';
import { useIngest } from '../../lib/useMedia';

const TYPE_ICON = { labor: Wrench, part: Package, fee: Receipt, sublet: Truck };
const PART_STATUS = { needed: 'Needed', ordered: 'Ordered', received: 'In stock' };
const cell = 'h-7 w-full rounded-[6px] border border-transparent bg-transparent px-1.5 text-sm outline-none transition hover:border-line focus:border-accent/60 focus:bg-surface focus:ring-[3px] focus:ring-accent/15';

export default function ServiceBlock({ order, service, vehicle, index, editable, onOpenMedia }) {
  const { state, updateService, removeService, addItem, updateItem, removeItem, adjustInventory } = useShop();
  const { toast } = useUI();
  const [picking, setPicking] = useState(false);
  const [story, setStory] = useState(Boolean(service.cause || service.correction));
  const { ingest, busy } = useIngest(order);
  const linked = (order.media || []).filter((m) => m.serviceId === service.id);
  const total = serviceTotal(service);
  const hours = serviceHours(service);
  const profit = jobProfit(service, state.shop, state.technicians, order.techId);
  const tone = profitTone(profit.gpPct, state.shop.goals?.gpPct);
  const declined = service.status === 'declined';
  const up = (patch) => updateService(order.id, service.id, patch);
  const upItem = (itemId, patch) => updateItem(order.id, service.id, itemId, patch);
  const removeLine = (item) => {
    if (item.inventoryId) adjustInventory(item.inventoryId, Number(item.qty) || 0);
    removeItem(order.id, service.id, item.id);
  };
  const phone = useIsPhone();

  const add = (type) =>
    addItem(order.id, service.id, {
      type,
      description: '',
      ...(type === 'labor' ? { hours: 1 } : type === 'part' ? { qty: 1, cost: 0, partNumber: '' } : type === 'sublet' ? { qty: 1, cost: 0, price: 0, vendor: '' } : { qty: 1, price: 0 }),
    });

  const vehicleQuery = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : '';

  return (
    <section className={`rounded-lg bg-surface shadow-card ${declined ? 'opacity-60' : ''}`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2.5">
        <button
          disabled={!editable || declined}
          onClick={() => up({ done: !service.done })}
          title={service.done ? 'Mark not done' : 'Mark done'}
          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors ${service.done ? 'border-ok bg-ok text-white' : 'border-ink-4 hover:border-ink-2'} disabled:cursor-default`}
        >
          {service.done && <Check size={11} strokeWidth={3.2} />}
        </button>
        <span className="tabular text-xs text-ink-4">{index + 1}</span>
        <InlineText
          value={service.title}
          onCommit={(title) => up({ title })}
          disabled={!editable}
          multiline={phone}
          submitOnEnter
          rows={1}
          enterKeyHint="done"
          className={`min-w-[160px] flex-1 resize-none rounded-[6px] border border-transparent bg-transparent px-1.5 py-0.5 text-md font-semibold outline-none [field-sizing:content] hover:border-line focus:border-accent/60 focus:ring-[3px] focus:ring-accent/15 ${declined ? 'line-through' : ''}`}
        />
        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <Segmented
              size="sm"
              value={service.status}
              onChange={(status) => up({ status })}
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'declined', label: 'Declined' },
              ]}
            />
          )}
          <select
            value={service.techId || ''}
            onChange={(e) => up({ techId: e.target.value || null })}
            disabled={!editable}
            className="input h-7 w-auto min-w-[120px] py-0 text-xs"
            aria-label="Technician"
          >
            <option value="">Unassigned</option>
            {state.technicians.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {editable && (
            <Menu
              trigger={({ toggle }) => (
                <button onClick={toggle} className="btn-ghost btn-icon h-7 w-7" aria-label="Service options">
                  <MoreHorizontal size={16} />
                </button>
              )}
              items={[
                { label: story ? 'Hide cause & correction' : 'Add cause & correction', icon: MessageSquareText, onClick: () => setStory((s) => !s) },
                { label: service.noCharge ? 'Charge for this service' : 'No charge (warranty, comeback…)', icon: ShieldCheck, onClick: () => up({ noCharge: service.noCharge ? null : order.comeback ? 'comeback' : 'warranty' }) },
                ...(service.tires ? [] : [{ label: 'Quote tire options', icon: Disc3, onClick: () => up({ tires: newTireQuote() }) }]),
                '-',
                { label: 'Remove service', icon: Trash2, danger: true, onClick: () => removeService(order.id, service.id) },
              ]}
            />
          )}
        </div>
      </header>

      {service.note && <p className="border-b border-line/70 bg-raised px-4 py-2 text-xs text-ink-2">{service.note}</p>}
      <JobMemory order={order} service={service} vehicle={vehicle} editable={editable} />
      {service.noCharge && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line/70 bg-raised px-4 py-2 text-xs text-ink-2">
          <ShieldCheck size={14} className="text-ink-3" />
          <span className="font-medium text-ink">No charge</span>
          <select value={service.noCharge} onChange={(e) => up({ noCharge: e.target.value })} disabled={!editable} className="h-6 rounded-[5px] border border-line bg-surface px-1 text-xs" aria-label="No-charge reason">
            {Object.entries(NO_CHARGE_REASONS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <span>The customer isn’t billed — parts and labor still count as the shop’s cost ({money(serviceValue(service))} at your prices).</span>
        </div>
      )}

      {service.items.length > 0 && phone && (
        <ul className="border-t border-line/60">
          {service.items.map((item) => (
            <PhoneLine key={item.id} item={item} editable={editable} upItem={upItem} vehicle={vehicle} vehicleQuery={vehicleQuery} onRemove={() => removeLine(item)} />
          ))}
        </ul>
      )}
      {service.items.length > 0 && !phone && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-xs text-ink-3">
                <th className="w-8 py-2 pl-4 text-left font-medium" />
                <th className="py-2 text-left font-medium">Description</th>
                <th className="w-[76px] py-2 text-right font-medium">Qty / Hrs</th>
                <th className="w-[92px] py-2 text-right font-medium">Cost</th>
                <th className="w-[96px] py-2 text-right font-medium">Price</th>
                <th className="w-[96px] py-2 pr-2 text-right font-medium">Total</th>
                <th className="w-9 py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {service.items.map((item) => {
                const Icon = TYPE_ICON[item.type] || Package;
                const isLabor = item.type === 'labor';
                const isPart = item.type === 'part';
                return (
                  <tr key={item.id} className="group border-t border-line/60 align-top">
                    <td className="py-1.5 pl-4 pt-3">
                      <Icon size={14} strokeWidth={1.8} className="text-ink-3" />
                    </td>
                    <td className="py-1.5 pr-2">
                      <InlineText value={item.description} placeholder={isLabor ? 'Labor operation' : isPart ? 'Part description' : item.type === 'sublet' ? 'Sublet work' : 'Fee'} onCommit={(description) => upItem(item.id, { description })} disabled={!editable} className={cell} />
                      {isPart && <PartMeta item={item} editable={editable} upItem={upItem} vehicle={vehicle} vehicleQuery={vehicleQuery} />}
                      {item.type === 'sublet' && (
                        <InlineText value={item.vendor} placeholder="Vendor" onCommit={(vendor) => upItem(item.id, { vendor })} disabled={!editable} className="ml-1.5 mt-0.5 h-6 w-48 rounded-[5px] border border-transparent bg-transparent px-1 text-xs text-ink-2 outline-none hover:border-line focus:border-accent/60" />
                      )}
                    </td>
                    <td className="py-1.5">
                      <NumInput value={isLabor ? item.hours : item.qty} onCommit={(n) => upItem(item.id, isLabor ? { hours: n } : { qty: n })} disabled={!editable} className={cell} aria-label={isLabor ? 'Hours' : 'Quantity'} />
                    </td>
                    <td className="py-1.5">
                      {isPart || item.type === 'sublet' ? (
                        <NumInput value={item.cost} format={(v) => Number(v).toFixed(2)} onCommit={(cost) => upItem(item.id, { cost })} disabled={!editable} className={`${cell} text-ink-2`} aria-label="Unit cost" />
                      ) : (
                        <span className="block px-1.5 pt-1.5 text-right text-ink-4">—</span>
                      )}
                    </td>
                    <td className="py-1.5">
                      <NumInput
                        value={isLabor ? item.rate : item.price}
                        format={(v) => Number(v).toFixed(2)}
                        onCommit={(n) => upItem(item.id, isLabor ? { rate: n } : { price: n, autoPrice: false })}
                        disabled={!editable}
                        className={cell}
                        aria-label={isLabor ? 'Labor rate' : 'Unit price'}
                        title={isLabor ? 'Hourly rate' : isPart ? 'Unit price — set automatically from your markup matrix when cost changes' : 'Unit price'}
                      />
                    </td>
                    <td className="tabular py-1.5 pr-2 pt-3 text-right font-medium">{money(itemTotal(item))}</td>
                    <td className="py-1.5 pr-3 pt-2 text-right">
                      {editable && (
                        <button
                          onClick={() => removeLine(item)}
                          className="hover-reveal btn-ghost btn-icon h-6 w-6"
                          aria-label="Remove line"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {service.tires && <TirePanel order={order} service={service} editable={editable} />}

      {story && (
        <div className="grid gap-3 border-t border-line/70 px-4 py-3 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Cause</span>
            <InlineText multiline rows={2} value={service.cause} onCommit={(cause) => up({ cause })} disabled={!editable} className="input" placeholder="What the tech found" />
          </label>
          <label className="block">
            <span className="field-label">Correction</span>
            <InlineText multiline rows={2} value={service.correction} onCommit={(correction) => up({ correction })} disabled={!editable} className="input" placeholder="What was done to fix it" />
          </label>
        </div>
      )}

      {linked.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-line/70 px-4 py-2.5">
          {linked.map((m) => (
            <MediaThumb key={m.id} media={m} showMeta={false} onClick={() => onOpenMedia?.(m.id)} className="h-14 w-14" />
          ))}
        </div>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line/70 px-3 py-2">
        {editable ? (
          <div className="flex flex-wrap gap-0.5">
            <button className="btn-ghost btn-sm" onClick={() => add('labor')}><Wrench size={13} /> Labor</button>
            <button className="btn-ghost btn-sm" onClick={() => add('part')}><Package size={13} /> Part</button>
            <button className="btn-ghost btn-sm" onClick={() => setPicking(true)}><Boxes size={13} /> From inventory</button>
            <button className="btn-ghost btn-sm" onClick={() => add('fee')}><Receipt size={13} /> Fee</button>
            <button className="btn-ghost btn-sm" onClick={() => add('sublet')}><Truck size={13} /> Sublet</button>
            <PickButton capture onFiles={(f) => ingest(f, { serviceId: service.id })} className="btn-ghost btn-sm" title="Take or attach photos/video for this service">
              {busy ? <Spinner size={13} /> : <Camera size={13} />} Photo
            </PickButton>
          </div>
        ) : (
          <PickButton capture onFiles={(f) => ingest(f, { serviceId: service.id })} className="btn-ghost btn-sm" title="Take or attach photos/video for this service">
            {busy ? <Spinner size={13} /> : <Camera size={13} />} Photo
          </PickButton>
        )}
        <div className="flex items-baseline gap-3 pr-1 text-sm">
          {total > 0 && !declined && !service.noCharge && (
            <span className="tabular hidden items-baseline gap-2 font-mono text-2xs text-ink-3 sm:flex" title="Gross profit after parts, sublet and technician pay">
              <span>
                GP <b className={TONE_TEXT[tone]}>{Math.round(profit.gpPct * 100)}%</b>
              </span>
              <span>{money(profit.gp)}</span>
              {profit.gpHr != null && <span>{money(profit.gpHr)}/hr</span>}
            </span>
          )}
          {hours > 0 && <span className="text-xs text-ink-3">{hours.toFixed(1)} hr</span>}
          {service.noCharge ? (
            <span className="flex items-baseline gap-2">
              <span className="tabular text-xs text-ink-4 line-through">{money(serviceValue(service))}</span>
              <span className="font-semibold">No charge</span>
            </span>
          ) : (
            <span className="tabular font-semibold">{money(total)}</span>
          )}
        </div>
      </footer>

      {picking && (
        <InventoryPicker
          onClose={() => setPicking(false)}
          onPick={(p, qty) => {
            addItem(order.id, service.id, { type: 'part', description: p.description, partNumber: p.partNumber, brand: p.brand, qty, cost: p.cost, partStatus: 'received', inventoryId: p.id });
            adjustInventory(p.id, -qty);
            toast(`Pulled ${qty} × ${p.partNumber || p.description} from stock`, { tone: 'success' });
          }}
        />
      )}
    </section>
  );
}

/** Part number, stock status, core charge and supplier lookup under a part line. */
function PartMeta({ item, editable, upItem, vehicle, vehicleQuery, phone = false }) {
  const small = phone
    ? 'h-8 rounded-[8px] border border-transparent bg-fill/[0.08] px-2 text-xs text-ink-2 outline-none focus:border-accent/60 focus:bg-surface'
    : 'h-6 rounded-[5px] border border-transparent bg-transparent px-1 text-xs text-ink-2 outline-none hover:border-line focus:border-accent/60';
  return (
    <div className={phone ? 'flex flex-wrap items-center gap-2' : 'mt-0.5 flex flex-wrap items-center gap-1.5 pl-1.5'}>
      <InlineText value={item.partNumber} placeholder="Part #" onCommit={(partNumber) => upItem(item.id, { partNumber })} disabled={!editable} autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="done" className={`${small} w-32 font-mono`} />
      <select value={item.partStatus || 'needed'} onChange={(e) => upItem(item.id, { partStatus: e.target.value })} disabled={!editable} className={small} aria-label="Part status">
        {Object.entries(PART_STATUS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      <span className="flex items-center gap-0.5 text-xs text-ink-3" title="Core charge the vendor refunds when the old part goes back">
        Core
        <NumInput
          value={item.core?.amount || ''}
          format={(v) => Number(v).toFixed(2)}
          placeholder="—"
          onCommit={(amount) => upItem(item.id, { core: amount > 0 ? { status: 'owed', ...(item.core || {}), amount } : null })}
          className={`${small} w-16`}
          aria-label="Core charge"
        />
      </span>
      {item.core?.amount > 0 && (
        <select value={item.core.status || 'owed'} onChange={(e) => upItem(item.id, { core: { ...item.core, status: e.target.value, ...(e.target.value === 'returned' && !item.core.returnedAt ? { returnedAt: new Date().toISOString() } : {}) } })} className={small} aria-label="Core status">
          {Object.entries(CORE_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      )}
      <Menu
        align="left"
        trigger={({ toggle }) => (
          <button onClick={toggle} className={`flex items-center gap-0.5 rounded-[5px] px-1 text-xs text-accent hover:bg-fill/[0.08] ${phone ? 'h-8 px-2' : 'h-6'}`}>
            Find part <ArrowUpRight size={11} />
          </button>
        )}
        items={SUPPLIERS.map((s) => ({
          label: s.name,
          hint: item.partNumber ? item.partNumber : 'vehicle',
          onClick: () => {
            const url = item.partNumber ? s.search(item.partNumber) : s.vehicle && vehicle ? s.vehicle(vehicle) : s.search(`${vehicleQuery} ${item.description}`.trim());
            window.open(url, '_blank', 'noopener');
          },
        }))}
      />
    </div>
  );
}

const phoneCell = 'h-9 w-full rounded-[8px] border border-transparent bg-fill/[0.08] px-2 text-[16px] outline-none transition focus:border-accent/60 focus:bg-surface disabled:bg-transparent';

/** One line on a phone: what it is on top (wrapping, never cut off), then quantity, cost, price and total. */
function PhoneLine({ item, editable, upItem, vehicle, vehicleQuery, onRemove }) {
  const Icon = TYPE_ICON[item.type] || Package;
  const isLabor = item.type === 'labor';
  const isPart = item.type === 'part';
  const costly = isPart || item.type === 'sublet';
  const label = 'mb-1 block text-2xs font-medium text-ink-3';
  return (
    <li className="border-b border-line/60 px-4 pb-3.5 pt-2.5 last:border-b-0">
      <div className="flex items-start gap-2">
        <Icon size={16} strokeWidth={1.8} className="mt-[11px] shrink-0 text-ink-3" />
        <InlineText
          multiline
          submitOnEnter
          rows={1}
          enterKeyHint="done"
          value={item.description}
          placeholder={isLabor ? 'Labor operation' : isPart ? 'Part description' : item.type === 'sublet' ? 'Sublet work' : 'Fee'}
          onCommit={(description) => upItem(item.id, { description })}
          disabled={!editable}
          className="min-h-[38px] min-w-0 flex-1 resize-none rounded-[8px] border border-transparent bg-transparent px-1.5 py-[7px] text-[16px] font-medium leading-6 outline-none [field-sizing:content] focus:border-accent/60 focus:bg-surface"
        />
        {editable && (
          <button onClick={onRemove} className="btn-ghost btn-icon -mr-2 h-9 w-9 shrink-0 text-ink-4" aria-label="Remove line">
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <div className="mt-1.5 grid grid-cols-[1fr_1fr_1fr_1.15fr] items-end gap-2">
        <label className="block min-w-0">
          <span className={label}>{isLabor ? 'Hours' : 'Qty'}</span>
          <NumInput value={isLabor ? item.hours : item.qty} onCommit={(n) => upItem(item.id, isLabor ? { hours: n } : { qty: n })} disabled={!editable} className={phoneCell} aria-label={isLabor ? 'Hours' : 'Quantity'} />
        </label>
        <label className="block min-w-0">
          <span className={label}>Cost</span>
          {costly ? (
            <NumInput value={item.cost} format={(v) => Number(v).toFixed(2)} onCommit={(cost) => upItem(item.id, { cost })} disabled={!editable} className={`${phoneCell} text-ink-2`} aria-label="Unit cost" />
          ) : (
            <span className="block h-9 px-2 text-right leading-9 text-ink-4">—</span>
          )}
        </label>
        <label className="block min-w-0">
          <span className={label}>{isLabor ? 'Rate' : 'Price'}</span>
          <NumInput
            value={isLabor ? item.rate : item.price}
            format={(v) => Number(v).toFixed(2)}
            onCommit={(n) => upItem(item.id, isLabor ? { rate: n } : { price: n, autoPrice: false })}
            disabled={!editable}
            className={phoneCell}
            aria-label={isLabor ? 'Labor rate' : 'Unit price'}
          />
        </label>
        <div className="min-w-0 text-right">
          <span className={label}>Total</span>
          <span className="tabular block h-9 truncate text-[16px] font-semibold leading-9 text-ink">{money(itemTotal(item))}</span>
        </div>
      </div>
      {isPart && (
        <div className="mt-2.5">
          <PartMeta item={item} editable={editable} upItem={upItem} vehicle={vehicle} vehicleQuery={vehicleQuery} phone />
        </div>
      )}
      {item.type === 'sublet' && (
        <InlineText value={item.vendor} placeholder="Vendor" onCommit={(vendor) => upItem(item.id, { vendor })} disabled={!editable} className={`${phoneCell} mt-2.5 text-left text-ink-2`} />
      )}
    </li>
  );
}
