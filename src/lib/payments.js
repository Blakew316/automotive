// Online payments through the shop's own Stripe account: pay links for a repair order's balance,
// the customer's pay page address, and how online payments read on the RO.

/** The repair order's Stripe pay link, if it's still open and for the current balance. */
export function openPayLink(order, balance) {
  const l = order?.payLink;
  if (!l?.url || l.status === 'paid' || l.status === 'void') return null;
  return Math.abs((Number(l.amount) || 0) - (Number(balance) || 0)) < 0.005 ? l : null;
}

/** The Supabase project ref (https://<ref>.supabase.co) — the pay page uses it to find the link. */
export function projectRef(cfg) {
  const m = /^https:\/\/([a-z0-9]{20})\.supabase\.(co|in)\/?$/i.exec(cfg?.url || '');
  return m ? m[1] : '';
}

/** Where the customer's pay page lives in this copy of the app. */
export function payPageBase() {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${import.meta.env.BASE_URL}pay`;
}

/** The pay-link function for a project ref (the public pay page has no shop data of its own). */
export const payFunction = (ref) => `https://${ref}.supabase.co/functions/v1/pay-link`;

const BRAND = { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', discover: 'Discover', diners: 'Diners', jcb: 'JCB', unionpay: 'UnionPay' };
const TYPE = { link: 'Link', affirm: 'Affirm', klarna: 'Klarna', afterpay_clearpay: 'Afterpay', us_bank_account: 'Bank account', cashapp: 'Cash App' };

/** How an online payment reads: “Visa •••• 4242 · online”, “Affirm · online”. */
export function onlineRef(p) {
  const what = p.brand ? `${BRAND[p.brand] || p.brand}${p.last4 ? ` •••• ${p.last4}` : ''}` : TYPE[p.type] ? `${TYPE[p.type]}${p.last4 ? ` •••• ${p.last4}` : ''}` : 'Card';
  return `${what} · ${p.source === 'terminal' ? 'card reader' : 'online'}`;
}

/** Card processing fees Stripe kept, from online payments in a list. */
export const processingFees = (payments) => payments.reduce((s, p) => s + (Number(p.stripe?.fee) || 0), 0);
