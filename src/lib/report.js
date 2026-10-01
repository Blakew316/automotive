// Customer-facing snapshot of a repair order: what the customer (or anyone with the link) sees.
// Deliberately excludes internal data — costs, margins, technician pay, internal notes, and any
// photo or video marked internal.
import { orderTotals, serviceTotal, itemTotal } from './pricing';
import { STATUS } from './workflow';
import { payLink } from './messaging';
import { financingOffer } from './financing';
import { inspectionTemplateFor } from './inspection';

export const REPORT_VERSION = 1;

export function buildReport(order, state, { showPrices = true } = {}) {
  const shop = state.shop;
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
      status: s.status,
      done: Boolean(s.done),
      cause: s.cause || '',
      correction: s.correction || '',
      total: showPrices ? serviceTotal(s) : null,
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

/** Text a customer can send back to approve pending work. */
export function approvalText(report) {
  const pending = report.services.filter((s) => s.status === 'pending').map((s) => s.title);
  return pending.length ? `I approve RO #${report.ro.number}: ${pending.join(', ')}` : `Question about RO #${report.ro.number}`;
}
