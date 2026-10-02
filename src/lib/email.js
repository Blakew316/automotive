// Email from the shop's own address: what a customer email says and which document goes with it.
// (The daily summary's numbers are in ./digest.js, loaded only when they're needed.)
/** Subject line for an RO email, by template. */
export function emailSubject(shop, order, templateId) {
  const ro = order ? `RO #${order.number}` : '';
  const what = { estimate: 'Your estimate', invoice: 'Your invoice', receipt: 'Your receipt', pay: 'Payment request', ready: 'Your vehicle is ready', update: 'Update on your vehicle', appt: 'Your appointment', review: 'How did we do?', service: 'Service reminder', declined: 'Recommended service', winback: 'We miss you' }[templateId];
  return [what, ro, shop.name].filter(Boolean).join(' — ');
}

/** Which RO document to offer as a PDF with an email (estimate before approval, invoice/receipt after). */
export const attachDefault = (templateId) => ['estimate', 'invoice', 'receipt', 'pay', 'ready', 'update'].includes(templateId);

// Later events win over earlier ones (an "opened" doesn't hide a bounce).
export const EMAIL_RANK = { sent: 0, delayed: 1, delivered: 2, opened: 3, complained: 4, bounced: 5 };
