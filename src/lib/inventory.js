// Inventory status: what's on the shelf, what's out on open jobs, what's on order, and how that
// compares with each part's min/max.
import { onOrderByItem } from './purchasing';

const OPEN = ['estimate', 'approved', 'in_progress', 'waiting_parts'];

export const GROUPS = [
  { key: 'parts', label: 'Parts' },
  { key: 'tires', label: 'Tires' },
  { key: 'batteries', label: 'Batteries' },
  { key: 'fluids', label: 'Fluids & supplies' },
];

export function groupOf(p) {
  const d = `${p.description} ${p.category}`.toLowerCase();
  if (p.category === 'Tires' && /\btire\b/.test(p.description.toLowerCase())) return 'tires';
  if (/battery/.test(d)) return 'batteries';
  if (p.category === 'Fluids' || p.category === 'Shop supplies') return 'fluids';
  return 'parts';
}

/** Per item: on jobs (pulled onto open ROs), ordered (open POs), last used, and status. */
export function inventoryStatus(state) {
  const onOrder = onOrderByItem(state.purchaseOrders);
  const onJobs = new Map();
  const lastUsed = new Map();
  for (const o of state.orders) {
    for (const s of o.services) {
      if (s.status === 'declined') continue;
      for (const i of s.items) {
        if (!i.inventoryId) continue;
        const at = o.invoicedAt || o.updatedAt || o.createdAt;
        if (!lastUsed.has(i.inventoryId) || at > lastUsed.get(i.inventoryId)) lastUsed.set(i.inventoryId, at);
        if (OPEN.includes(o.status)) onJobs.set(i.inventoryId, (onJobs.get(i.inventoryId) || 0) + (Number(i.qty) || 0));
      }
    }
  }
  const map = new Map();
  for (const p of state.inventory) {
    const qty = Number(p.qty) || 0;
    const ordered = onOrder.get(p.id) || 0;
    const min = Number(p.min) || 0;
    const max = Number(p.max) || 0;
    const status = qty + ordered <= min && min > 0 ? 'reorder' : qty <= min && min > 0 ? 'low' : max > 0 && qty > max ? 'over' : 'ok';
    map.set(p.id, { qty, ordered, onJobs: onJobs.get(p.id) || 0, lastUsed: lastUsed.get(p.id) || null, status, group: groupOf(p) });
  }
  return map;
}

export const STOCK_STATUS = {
  reorder: { label: 'Reorder', className: 'bg-bad/10 text-bad' },
  low: { label: 'Low · on order', className: 'bg-warn/15 text-warn' },
  over: { label: 'Above max', className: 'bg-sky/15 text-accent' },
  ok: { label: 'OK', className: 'bg-ok/10 text-ok' },
};
