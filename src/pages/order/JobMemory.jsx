// Labor & parts memory on a service: how long this shop took on the same job before (same model
// first, then the same make, then any vehicle) and the parts it used, with one tap to apply them.
import { useMemo, useState } from 'react';
import { History, ChevronDown, Plus, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useShop } from '../../store/hooks';
import { jobMemory } from '../../lib/memory';
import { money } from '../../lib/format';

const key = (i) => (i.partNumber || i.description || '').trim().toLowerCase();

export default function JobMemory({ order, service, vehicle, editable }) {
  const { state, updateService, updateItem, addItem } = useShop();
  const [open, setOpen] = useState(false);
  const mem = useMemo(() => jobMemory(state, { title: service.title, orderId: order.id, serviceId: service.id, vehicle }), [state, service.title, order.id, service.id, vehicle]);
  if (!mem || !editable || service.status === 'declined' || service.memoryHidden) return null;

  const labor = service.items.filter((i) => i.type === 'labor');
  const hoursNow = labor.reduce((t, i) => t + (Number(i.hours) || 0), 0);
  const have = new Set(service.items.filter((i) => i.type === 'part').map(key));
  const missing = mem.parts.filter((p) => !have.has(key(p)));
  const hoursOff = mem.hours && Math.abs(hoursNow - mem.hours.usual) > 0.04;
  const where = mem.level === 'any' ? 'on all vehicles' : `on ${mem.scope}${mem.level === 'make' ? ' vehicles' : 's'}`;

  const useHours = () => {
    if (labor[0]) updateItem(order.id, service.id, labor[0].id, { hours: mem.hours.usual });
    else addItem(order.id, service.id, { type: 'labor', description: service.title, hours: mem.hours.usual });
  };
  const addParts = (list) => list.forEach((p) => addItem(order.id, service.id, { type: 'part', description: p.description, partNumber: p.partNumber, brand: p.brand, qty: p.qty, cost: p.cost, vendor: p.vendor, partStatus: 'needed' }));

  return (
    <div className="border-b border-line/70 bg-accent/[0.03] px-4 py-2 text-xs" data-testid="job-memory">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <History size={13} className="shrink-0 text-accent" />
        <span className="text-ink-2">
          Done <b className="text-ink">{mem.count}×</b> {where}
          {mem.hours && (
            <>
              {' '}· usually <b className="text-ink">{mem.hours.usual} h</b>
              {mem.hours.max > mem.hours.min && ` (${mem.hours.min}–${mem.hours.max})`}
            </>
          )}
          {' '}· last on{' '}
          <Link to={`/orders/${mem.last.orderId}`} className="link">
            RO #{mem.last.ro}
          </Link>
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {mem.hours && hoursOff && (
            <button className="chip h-6 hover:border-accent/50" onClick={useHours}>
              Use {mem.hours.usual} h
            </button>
          )}
          {missing.length > 0 && (
            <button className="chip h-6 hover:border-accent/50" onClick={() => addParts(missing)}>
              <Plus size={11} /> Add {missing.length} part{missing.length === 1 ? '' : 's'}
            </button>
          )}
          {!hoursOff && !missing.length && (
            <span className="inline-flex items-center gap-1 text-ok">
              <Check size={12} /> Matches past jobs
            </span>
          )}
          {mem.parts.length > 0 && (
            <button className="btn-ghost btn-icon h-6 w-6" onClick={() => setOpen((v) => !v)} aria-label={open ? 'Hide parts used before' : 'Show parts used before'} aria-expanded={open}>
              <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          )}
          <button className="btn-ghost btn-icon h-6 w-6 text-ink-4" onClick={() => updateService(order.id, service.id, { memoryHidden: true })} aria-label="Hide job history">
            <X size={12} />
          </button>
        </span>
      </div>
      {open && (
        <ul className="mt-1.5 space-y-1 pl-5">
          {mem.parts.map((p) => (
            <li key={key(p)} className="flex flex-wrap items-center gap-x-2">
              <span className="text-ink">{p.description || p.partNumber}</span>
              {p.partNumber && <span className="font-mono text-2xs text-ink-3">{p.partNumber}</span>}
              <span className="text-ink-3">
                {p.qty > 1 ? `${p.qty} × ` : ''}
                {money(p.cost)} cost{p.vendor ? ` · ${p.vendor}` : ''} · used {p.uses}×
              </span>
              {have.has(key(p)) ? (
                <Check size={12} className="text-ok" />
              ) : (
                <button className="link" onClick={() => addParts([p])}>
                  Add
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
