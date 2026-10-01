// Message templates, merge fields and the links they reference (payment, booking, review).
import { orderTotals } from './pricing';
import { money, vehicleName, smsHref, mailHref, date, time, phone as fmtPhone } from './format';
import { bookingLink } from './booking';

/** Payment link through the shop's own processor, with the amount filled in where supported. */
export function payLink(shop, amount, memo = '') {
  const p = shop.payments || {};
  const amt = Number(amount || 0).toFixed(2);
  const handle = (p.handle || '').replace(/^[@$]/, '').trim();
  switch (p.provider) {
    case 'paypal':
      return handle ? `https://paypal.me/${encodeURIComponent(handle)}/${amt}` : '';
    case 'venmo':
      return handle ? `https://venmo.com/?txn=pay&audience=private&recipients=${encodeURIComponent(handle)}&amount=${amt}&note=${encodeURIComponent(memo)}` : '';
    case 'cashapp':
      return handle ? `https://cash.app/$${encodeURIComponent(handle)}/${amt}` : '';
    case 'stripe':
    case 'square':
    case 'other':
      return p.link || '';
    default:
      return '';
  }
}

export const PAY_PROVIDERS = [
  { value: 'none', label: 'Not set up' },
  { value: 'stripe', label: 'Stripe Payment Link', field: 'link', placeholder: 'https://buy.stripe.com/…', amount: false },
  { value: 'square', label: 'Square payment link', field: 'link', placeholder: 'https://square.link/…', amount: false },
  { value: 'paypal', label: 'PayPal.me', field: 'handle', placeholder: 'YourShop', amount: true },
  { value: 'venmo', label: 'Venmo Business', field: 'handle', placeholder: 'your-shop', amount: true },
  { value: 'cashapp', label: 'Cash App', field: 'handle', placeholder: '$YourShop', amount: true },
  { value: 'other', label: 'Other link', field: 'link', placeholder: 'https://…', amount: false },
];

/** Merge-field values for a customer (and optionally a repair order / appointment). */
export function messageContext(state, { customer, vehicle, order, appointment, extra = {} } = {}) {
  const shop = state.shop;
  const t = order ? orderTotals(order, shop) : null;
  const v = vehicle || (order && state.vehicles.find((x) => x.id === order.vehicleId)) || (customer && state.vehicles.find((x) => x.customerId === customer.id));
  const balance = t ? Math.max(0, t.balance) : 0;
  return {
    first: customer?.firstName || customer?.company || 'there',
    shop: shop.name,
    phone: fmtPhone(shop.phone),
    vehicle: v ? vehicleName(v) : 'vehicle',
    ro: order?.number ?? '',
    total: t ? money(t.total) : '',
    balance: t ? money(balance) : '',
    amount: extra.amount != null ? money(extra.amount) : '',
    link: order?.share && !order.share.revoked ? order.share.url : '',
    payLink: t ? payLink(shop, balance, `RO ${order.number}`) : '',
    reviewLink: shop.marketing?.reviewUrl || '',
    bookLink: bookingLink(state),
    date: appointment ? date(appointment.start) : '',
    time: appointment ? time(appointment.start) : '',
    service: extra.service || 'its next service',
    ...extra,
  };
}

const LINK_FIELDS = ['link', 'payLink', 'bookLink', 'reviewLink'];

/** Fill {fields}. A sentence that carries a link the shop hasn't set up is dropped, not left dangling. */
export function fillTemplate(body, ctx) {
  const sentences = body.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((p) => !LINK_FIELDS.some((k) => p.includes(`{${k}}`) && !ctx[k]));
  return kept
    .join(' ')
    .replace(/\{(\w+)\}/g, (_, k) => (ctx[k] == null ? '' : String(ctx[k])))
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export const template = (state, id) => (state.shop.templates || []).find((t) => t.id === id);

/** sms:/mailto: link for a message in the customer's preferred channel. */
export function sendHref(channel, customer, body, subject = '') {
  if (channel === 'email') return customer?.email ? mailHref(customer.email, subject, body) : null;
  return customer?.phone ? smsHref(customer.phone, body) : null;
}

export const CHANNEL_LABEL = { sms: 'Text', email: 'Email', portal: 'Customer portal', call: 'Call', note: 'Note' };
