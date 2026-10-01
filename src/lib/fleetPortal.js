// Fleet portal: a private link for a fleet manager to see every unit, what's due for maintenance,
// what's in the shop right now, open invoices and the account balance. Like the live status page it
// reads one small public file the shop's devices keep up to date — never the shop's own data.
import { publishPublicJson, publicFolder, newShareId, trackLink } from './cloudShare';
import { accountSummary, accountPayments, termsLabel } from './accounts';
import { payLink } from './messaging';
import { bookingLink } from './booking';
import { vehicleName } from './format';
import { STATUS } from './workflow';

export const newPortalId = () => newShareId();

export function portalLink(cfg, id) {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`;
  return `${base}fleet/${id}?from=${encodeURIComponent(publicFolder(cfg, 'fleet'))}`;
}

/** What the fleet manager sees. Totals per invoice, no line costs, margins or internal notes. */
export function portalPayload(state, customer, cfg, now = new Date()) {
  const shop = state.shop;
  const sum = accountSummary(state, customer, now);
  const vehicles = new Map(state.vehicles.map((v) => [v.id, v]));
  const unitName = (v) => (v ? (v.unit ? `Unit ${v.unit}` : vehicleName(v)) : '—');
  return {
    v: 1,
    shop: { name: shop.name, phone: shop.phone, email: shop.email || '', address: [shop.address, [shop.city, shop.state].filter(Boolean).join(', ')].filter(Boolean).join(', ') },
    company: customer.company || [customer.firstName, customer.lastName].filter(Boolean).join(' '),
    terms: termsLabel(customer.account?.terms),
    balance: sum.balance,
    pastDue: sum.pastDue,
    creditLimit: sum.creditLimit,
    aging: sum.aging,
    invoices: sum.invoices.map((i) => {
      const v = vehicles.get(i.order.vehicleId);
      return { ro: i.order.number, date: i.invoiced, po: i.order.po || '', unit: unitName(v), vehicle: v ? vehicleName(v) : '', total: i.total, paid: i.paid, balance: i.balance, due: i.due, pastDue: i.pastDue };
    }),
    units: sum.units.map(({ vehicle: v, pm, worst, openOrder: o }) => ({
      unit: v.unit || '',
      vehicle: vehicleName(v),
      plate: [v.plate, v.plateState].filter(Boolean).join(' '),
      vin: v.vin ? v.vin.slice(-8) : '',
      mileage: v.mileage || null,
      driver: v.driver || '',
      worst,
      pm: pm.map((p) => ({ label: p.plan.label, status: p.status, text: p.text, last: p.last?.date || null })),
      open: o
        ? {
            ro: o.number,
            status: STATUS[o.status]?.label || o.status,
            track: o.track?.id && !o.track.off && cfg ? trackLink(cfg, o.track.id) : null,
            report: o.share && !o.share.revoked ? o.share.url : null,
          }
        : null,
    })),
    payments: accountPayments(state, customer.id, 120, now).slice(0, 12).map((p) => ({ at: p.at, method: p.method, ref: p.ref, amount: p.amount, ros: p.orders })),
    payLink: sum.balance > 0.004 ? payLink(shop, sum.balance, `${customer.company || 'Account'} statement`) || null : null,
    bookLink: bookingLink(state) || null,
    updatedAt: now.toISOString(),
  };
}

/** What the page shows, minus the clock — republish only when this changes (or once a day, so PM countdowns stay fresh). */
export function portalFingerprint(state, customer, cfg, now = new Date()) {
  const p = portalPayload(state, customer, cfg, now);
  delete p.updatedAt;
  return `${now.toDateString()}|${JSON.stringify(p)}`;
}

export const publishPortal = (cfg, id, payload) => publishPublicJson(cfg, `fleet/${id}.json`, payload, 30);
export const revokePortal = (cfg, id) => publishPublicJson(cfg, `fleet/${id}.json`, { v: 1, revoked: true }, 30);
