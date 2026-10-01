// Purchase order helpers.
export const PO_STATUS = {
  draft: { label: 'Draft', dot: 'bg-ink-4' },
  ordered: { label: 'Ordered', dot: 'bg-info' },
  partial: { label: 'Partially received', dot: 'bg-warn' },
  received: { label: 'Received', dot: 'bg-ok' },
  cancelled: { label: 'Cancelled', dot: 'bg-ink-4' },
};
export const poTotal = (po) => po.lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.cost) || 0), 0);

/** Open parts on purchase orders, by inventory item. */
export function onOrderByItem(purchaseOrders) {
  const m = new Map();
  for (const po of purchaseOrders) {
    if (!['ordered', 'partial'].includes(po.status)) continue;
    for (const l of po.lines) if (l.inventoryId) m.set(l.inventoryId, (m.get(l.inventoryId) || 0) + Math.max(0, l.qty - l.received));
  }
  return m;
}
