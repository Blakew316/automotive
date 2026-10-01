// Customer-facing snapshot of a repair order: what the customer (or anyone with the link) sees.
// Deliberately excludes internal data — costs, margins, technician pay, internal notes, and any
// photo or video marked internal.
import { priceFromMatrix, orderTotals, serviceTotal, itemTotal } from './pricing';
import { STATUS } from './workflow';
import { payLink } from './messaging';
import { financingOffer } from './financing';
import { inspectionTemplateFor } from './inspection';
import { shopAt } from './locations';

export const REPORT_VERSION = 1;

export function buildReport(order, state, { showPrices = true } = {}) {
  const shop = shopAt(state.shop, order.locationId);
  const customer = state.customers.find((c) => c.id === order.customerId);
  const vehicle = state.vehicles.find((v) => v.id === order.vehicleId);
  const t = orderTotals(order, shop);
  const media = (order.media || []).filter((m) => m.customer);
  const keys = inspectionTemplateFor(state, order).sections.flatMap((s) => s.items.map((label) => ({ key: `${s.section}::${label}`, section: s.section, label })));
  const inspection = keys
    .map((k) => ({ ...k, ...(order.inspection?.[k.key] || {}) }))
    .filter((i) => i.rating && i.rating !== 'na');

  return {
    v: REPORT_VERSION,
    generatedAt: new Date().toISOString(),
    showPrices,
    shop: { name: shop.name, phone: shop.phone, email: shop.email, address: shop.address, city: shop.city, state: shop.state, zip: shop.zip, warranty: shop.warranty },
    customer: { firstName: customer?.firstName || customer?.company || '' },
    vehicle: vehicle
      ? { year: vehicle.year, make: vehicle.make, model: vehicle.model, trim: vehicle.trim || '', vin: vehicle.vin || '', color: vehicle.color || '', mileage: order.mileageOut || order.mileageIn || vehicle.mileage || null }
      : null,
    ro: {
      number: order.number,
      status: order.status,
      statusLabel: STATUS[order.status]?.label || order.status,
      createdAt: order.createdAt,
      promisedAt: order.promisedAt || null,
      concern: order.concern || '',
    },
    services: order.services.map((s) => ({
      id: s.id,
      title: s.title,
      tires: tireQuoteFor(s, shop, showPrices),
      status: s.status,
      done: Boolean(s.done),
      cause: s.cause || '',
      correction: s.correction || '',
      total: showPrices ? serviceTotal(s) : null,
      noCharge: Boolean(s.noCharge),
      lines: (s.items || [])
        .filter((i) => i.description)
        .map((i) => ({ type: i.type, description: i.description, qty: i.type === 'labor' ? null : Number(i.qty) || 1, total: showPrices ? itemTotal(i) : null })),
    })),
    totals: showPrices ? { subtotal: t.subtotal, discount: t.discount, supplies: t.supplies, tax: t.tax, total: t.total, paid: t.paid, balance: t.balance } : null,
    payLink: showPrices && t.balance > 0.004 && ['ready', 'closed'].includes(order.status) ? payLink(shop, t.balance, `RO ${order.number}`) || null : null,
    financing: showPrices && !['closed'].includes(order.status) ? financingOffer(shop, t.total) : null,
    inspection: {
      counts: { good: inspection.filter((i) => i.rating === 'good').length, soon: inspection.filter((i) => i.rating === 'soon').length, now: inspection.filter((i) => i.rating === 'now').length },
      items: inspection.map(({ key, section, label, rating, note, measure }) => ({ key, section, label, rating, note: note || '', measure: measure ?? null, unit: /\(mm\)/i.test(label) ? 'mm' : /\(32nds\)/i.test(label) ? '/32 in' : '' })),
    },
    notes: (order.notes || []).filter((n) => !n.internal).map((n) => ({ at: n.at, text: n.text })),
    media: media.map(({ id, kind, caption, serviceId, inspectionKey, width, height, duration, type, hasThumb, createdAt }) => ({
      id,
      kind,
      caption: caption || '',
      serviceId: serviceId || null,
      inspectionKey: inspectionKey || null,
      width,
      height,
      duration,
      type,
      hasThumb: Boolean(hasThumb),
      createdAt,
    })),
  };
}

function tireQuoteFor(s, shop, showPrices) {
  const q = s.tires;
  if (!q) return null;
  const qty = Number(q.qty) || 4;
  const options = q.options
    .filter((o) => o.brand || o.model)
    .map((o) => {
      const each = Number(o.price) || priceFromMatrix(Number(o.cost) || 0, shop.matrix);
      return { id: o.id, tier: o.tier, brand: o.brand, model: o.model, spec: o.spec || '', warranty: o.warranty || '', each: showPrices ? each : null, set: showPrices ? each * qty : null };
    });
  if (!options.length) return null;
  const current = options.find((o) => o.id === q.selectedId);
  return { size: q.size, qty, selectedId: current ? q.selectedId : null, options, base: showPrices ? serviceTotal(s) - (current?.set || 0) : null };
}

/** A service's total with the customer's tire choice applied (decisions key `tire:<serviceId>`). */
export function totalWithChoice(s, decisions = {}) {
  if (!s.tires || s.total == null) return s.total;
  const pick = s.tires.options.find((o) => o.id === (decisions[`tire:${s.id}`] || s.tires.selectedId));
  return s.tires.base + (pick?.set || 0);
}

/** Text a customer can send back to approve pending work. */
export function approvalText(report) {
  const pending = report.services.filter((s) => s.status === 'pending').map((s) => s.title);
  return pending.length ? `I approve RO #${report.ro.number}: ${pending.join(', ')}` : `Question about RO #${report.ro.number}`;
}
