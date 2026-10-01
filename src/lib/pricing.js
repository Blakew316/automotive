import { round2 } from './format';

export const DEFAULT_MATRIX = [
  { upTo: 5, markup: 150 },
  { upTo: 10, markup: 120 },
  { upTo: 25, markup: 90 },
  { upTo: 50, markup: 70 },
  { upTo: 100, markup: 55 },
  { upTo: 250, markup: 45 },
  { upTo: 500, markup: 38 },
  { upTo: null, markup: 30 },
];

/** Sell price for a part from its cost using the shop's markup matrix (tiers by unit cost). */
export function priceFromMatrix(cost, matrix = DEFAULT_MATRIX) {
  const c = Number(cost) || 0;
  const tier = matrix.find((t) => t.upTo == null || c <= t.upTo) || matrix[matrix.length - 1];
  return round2(c * (1 + (tier?.markup || 0) / 100));
}

export const ITEM_TYPES = {
  labor: { label: 'Labor', short: 'LAB' },
  part: { label: 'Part', short: 'PRT' },
  fee: { label: 'Fee', short: 'FEE' },
  sublet: { label: 'Sublet', short: 'SUB' },
};

export function itemTotal(item) {
  if (item.type === 'labor') return round2((Number(item.hours) || 0) * (Number(item.rate) || 0));
  return round2((Number(item.qty) || 0) * (Number(item.price) || 0));
}

export function itemCost(item, techRate = 0) {
  if (item.type === 'labor') return (Number(item.hours) || 0) * techRate;
  return (Number(item.qty) || 0) * (Number(item.cost) || 0);
}

/** What the work is worth at the shop's prices (shown struck through when it's done at no charge). */
export function serviceValue(service) {
  return round2((service.items || []).reduce((s, i) => s + itemTotal(i), 0));
}

/** What the customer pays for a service: nothing for warranty, comeback or goodwill work. */
export function serviceTotal(service) {
  return service.noCharge ? 0 : serviceValue(service);
}

export const serviceHours = (service) =>
  (service.items || []).filter((i) => i.type === 'labor').reduce((s, i) => s + (Number(i.hours) || 0), 0);

/**
 * Totals for a repair order. Declined services are excluded.
 * Discount is applied pre-tax, spread proportionally across the taxable base.
 */
export function orderTotals(order, shop) {
  const active = (order.services || []).filter((s) => s.status !== 'declined');
  const sums = { labor: 0, parts: 0, fees: 0, sublet: 0, hours: 0, cost: 0, partsCost: 0, ncValue: 0, ncCost: 0 };
  const techRate = Number(shop?.techPayRate) || 0;
  for (const s of active) {
    for (const i of s.items || []) {
      const t = itemTotal(i);
      // No-charge work (warranty, comeback, goodwill) costs the shop but isn't billed.
      if (s.noCharge) {
        sums.ncValue += t;
        sums.ncCost += itemCost(i, techRate);
        sums.cost += itemCost(i, techRate);
        continue;
      }
      if (i.type === 'labor') {
        sums.labor += t;
        sums.hours += Number(i.hours) || 0;
      } else if (i.type === 'part') {
        sums.parts += t;
        sums.partsCost += itemCost(i);
      } else if (i.type === 'fee') sums.fees += t;
      else if (i.type === 'sublet') sums.sublet += t;
      sums.cost += itemCost(i, techRate);
    }
  }
  const suppliesPct = Number(shop?.shopSuppliesPct) || 0;
  const suppliesCap = Number(shop?.shopSuppliesCap) || Infinity;
  const supplies = order.waiveSupplies ? 0 : round2(Math.min(sums.labor * (suppliesPct / 100), suppliesCap));

  const subtotal = round2(sums.labor + sums.parts + sums.fees + sums.sublet + supplies);
  const discountValue = Number(order.discount?.value) || 0;
  const discount = round2(Math.min(subtotal, order.discount?.type === 'pct' ? subtotal * (discountValue / 100) : discountValue));

  const taxRate = (Number(shop?.taxRate) || 0) / 100;
  const taxableGross = sums.parts + sums.fees + sums.sublet + supplies + (shop?.taxLabor ? sums.labor : 0);
  const taxableNet = subtotal > 0 ? taxableGross - discount * (taxableGross / subtotal) : 0;
  const tax = order.taxExempt ? 0 : round2(Math.max(0, taxableNet) * taxRate);

  const total = round2(subtotal - discount + tax);
  const paid = round2((order.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0));
  const revenue = subtotal - discount;
  const grossProfit = round2(revenue - sums.cost);

  return {
    labor: round2(sums.labor),
    parts: round2(sums.parts),
    fees: round2(sums.fees),
    sublet: round2(sums.sublet),
    supplies,
    subtotal,
    discount,
    tax,
    total,
    paid,
    balance: round2(total - paid),
    hours: Math.round(sums.hours * 10) / 10,
    partsCost: round2(sums.partsCost),
    grossProfit,
    gpPct: revenue > 0 ? grossProfit / revenue : 0,
    pending: active.filter((s) => s.status === 'pending').length,
    noCharge: round2(sums.ncValue),
    noChargeCost: round2(sums.ncCost),
    declined: round2((order.services || []).filter((s) => s.status === 'declined').reduce((sum, s) => sum + serviceTotal(s), 0)),
  };
}

/** Memoized per-order totals for one shop configuration (orders are immutable snapshots). */
export function totalsCalculator(shop) {
  const cache = new WeakMap();
  return (order) => {
    if (!cache.has(order)) cache.set(order, orderTotals(order, shop));
    return cache.get(order);
  };
}
