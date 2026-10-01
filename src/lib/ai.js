// AI assistant: what each task is for, and the shop data sent with it. Only what the task needs is
// sent — no payment details, no other customers — through the shop's own server function, which
// holds the Anthropic API key.
import { orderTotals, serviceTotal } from './pricing';
import { STATUS, INSPECTION_RATINGS } from './workflow';
import { fullName, vehicleName, money, dateShort, number } from './format';

export const AI_MODELS = [
  { value: 'claude-opus-5-5', label: 'Claude Opus 5.5 — most capable (recommended)' },
  { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — faster, lower cost' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — fastest, lowest cost' },
];
// Saved before the Haiku id was shortened.
export const modelValue = (v) => (v === 'claude-haiku-4-5-20251001' ? 'claude-haiku-4-5' : v);

/** Integration keys the shop can store (values stay on the server). */
export const KEY_GROUPS = [
  {
    title: 'AI assistant',
    keys: [{ name: 'anthropic_api_key', label: 'Anthropic API key', hint: 'From console.anthropic.com → API keys. Starts with sk-ant-.', ready: true }],
  },
  {
    title: 'Texting & calls (Twilio)',
    setup: { to: '/settings?tab=messaging', label: 'Connect the number in Settings → Messaging' },
    keys: [
      { name: 'twilio_account_sid', label: 'Account SID', hint: 'Twilio console → Account info (starts with AC)', ready: true },
      { name: 'twilio_auth_token', label: 'Auth token', hint: 'Twilio console → Account info', ready: true },
      { name: 'twilio_phone', label: 'Business phone number', hint: 'Your Twilio number, e.g. +15125550100', setting: true, ready: true },
    ],
  },
  {
    title: 'Card payments (Stripe)',
    keys: [
      { name: 'stripe_secret_key', label: 'Secret key', hint: 'Stripe dashboard → Developers → API keys (sk_live_… or a restricted key)' },
      { name: 'stripe_webhook_secret', label: 'Webhook signing secret', hint: 'Stripe dashboard → Developers → Webhooks (whsec_…)' },
    ],
  },
  {
    title: 'QuickBooks Online',
    keys: [
      { name: 'quickbooks_client_id', label: 'Client ID', hint: 'Intuit Developer → your app → Keys & credentials' },
      { name: 'quickbooks_client_secret', label: 'Client secret', hint: 'Intuit Developer → your app → Keys & credentials' },
    ],
  },
  {
    title: 'Connected cars (Smartcar)',
    keys: [
      { name: 'smartcar_client_id', label: 'Client ID', hint: 'Smartcar dashboard → Configuration' },
      { name: 'smartcar_client_secret', label: 'Client secret', hint: 'Smartcar dashboard → Configuration' },
    ],
  },
];

export const AI_TASKS = {
  explain: { label: 'Explain the estimate to the customer', short: 'Explain to customer', use: 'message' },
  update: { label: 'Draft a status text', short: 'Status text', use: 'message' },
  diagnose: { label: 'Diagnostic ideas for the tech', short: 'Diagnostic ideas', use: 'note' },
  story: { label: 'Write cause & correction', short: 'Cause & correction', use: 'story' },
  summary: { label: 'Summarize this customer', short: 'Customer summary', use: 'note' },
  reply: { label: 'Suggest a reply', short: 'Suggest reply', use: 'message' },
  ask: { label: 'Ask anything', short: 'Ask', use: 'note' },
};

const line = (k, v) => (v == null || v === '' ? '' : `${k}: ${v}`);

/** One repair order as plain text: vehicle, concern, services, inspection findings, notes. */
export function orderContext(state, order, { serviceId } = {}) {
  const c = state.customers.find((x) => x.id === order.customerId);
  const v = state.vehicles.find((x) => x.id === order.vehicleId);
  const t = orderTotals(order, state.shop);
  const tech = (id) => state.technicians.find((x) => x.id === id)?.name;
  const services = order.services
    .filter((s) => !serviceId || s.id === serviceId)
    .map((s) => {
      const items = (s.items || []).map((i) => `    - ${i.type}: ${i.description || ''}${i.type === 'labor' ? ` (${i.hours} h)` : i.qty ? ` ×${i.qty}` : ''}`).join('\n');
      return [`- ${s.title} — ${s.status}${s.done ? ', done' : ''}${s.noCharge ? ', no charge' : ''} — ${money(serviceTotal(s))}${s.techId ? ` — tech ${tech(s.techId)}` : ''}`, items, s.cause && `    cause: ${s.cause}`, s.correction && `    correction: ${s.correction}`, s.note && `    note: ${s.note}`].filter(Boolean).join('\n');
    })
    .join('\n');
  const flagged = Object.entries(order.inspection || {})
    .filter(([, e]) => e?.rating && e.rating !== 'good' && e.rating !== 'na')
    .map(([k, e]) => `- ${k.split('::')[1] || k}: ${INSPECTION_RATINGS[e.rating]?.label || e.rating}${e.measure != null && e.measure !== '' ? ` (${e.measure})` : ''}${e.note ? ` — ${e.note}` : ''}`)
    .join('\n');
  const notes = (order.notes || []).slice(0, 12).map((n) => `- ${dateShort(n.at)}${n.internal ? ' (internal)' : ''}: ${n.text}`).join('\n');
  return [
    `Repair order #${order.number} — ${STATUS[order.status]?.label || order.status}`,
    line('Customer first name', c?.firstName || c?.company),
    line('Vehicle', v ? `${vehicleName(v, { trim: true })}${v.engine ? `, ${v.engine}` : ''}` : ''),
    line('Mileage', order.mileageIn ? `${number(order.mileageIn)} mi` : v?.mileage ? `${number(v.mileage)} mi` : ''),
    line('Customer concern', order.concern),
    line('Promised', order.promisedAt ? new Date(order.promisedAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : ''),
    `Services:\n${services || '- none yet'}`,
    flagged && `Inspection findings:\n${flagged}`,
    notes && `Notes:\n${notes}`,
    `Total ${money(t.total)}${t.pending ? ` · ${t.pending} service(s) awaiting approval` : ''}${t.balance > 0.004 && ['ready', 'closed'].includes(order.status) ? ` · balance ${money(t.balance)}` : ''}`,
    line('Shop', `${state.shop.name}, ${state.shop.phone}`),
  ]
    .filter(Boolean)
    .join('\n');
}

/** A customer's vehicles and recent visits (no payment details). */
export function customerContext(state, customer) {
  const vehicles = state.vehicles.filter((v) => v.customerId === customer.id);
  const orders = state.orders.filter((o) => o.customerId === customer.id).sort((a, b) => b.number - a.number).slice(0, 10);
  return [
    `Customer: ${fullName(customer)}${customer.company ? ` (${customer.company})` : ''}`,
    line('Customer since', dateShort(customer.createdAt)),
    line('Tags', (customer.tags || []).join(', ')),
    line('Notes', customer.notes),
    customer.account && `Business account: ${customer.account.terms}${customer.account.poRequired ? ', PO required' : ''}`,
    `Vehicles:\n${vehicles.map((v) => `- ${vehicleName(v, { trim: true })}${v.mileage ? `, ${number(v.mileage)} mi` : ''}${v.unit ? `, unit ${v.unit}` : ''}`).join('\n') || '- none'}`,
    `Recent repair orders:\n${
      orders
        .map((o) => {
          const v = vehicles.find((x) => x.id === o.vehicleId);
          const done = o.services.filter((s) => s.status !== 'declined').map((s) => s.title).join(', ');
          const declined = o.services.filter((s) => s.status === 'declined').map((s) => s.title).join(', ');
          return `- #${o.number} ${dateShort(o.invoicedAt || o.createdAt)} ${v ? `${v.year} ${v.model}` : ''} — ${STATUS[o.status]?.label}: ${done || '—'}${declined ? ` · declined: ${declined}` : ''}`;
        })
        .join('\n') || '- none'
    }`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** The last messages with a customer, oldest first. */
export function threadContext(state, customerId) {
  const c = state.customers.find((x) => x.id === customerId);
  const msgs = state.messages.filter((m) => m.customerId === customerId).sort((a, b) => a.at.localeCompare(b.at)).slice(-14);
  const open = state.orders.filter((o) => o.customerId === customerId && !['closed'].includes(o.status)).slice(0, 2);
  return [
    `Conversation with ${c?.firstName || fullName(c)}:`,
    ...msgs.map((m) => `[${new Date(m.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}] ${m.dir === 'in' ? 'Customer' : 'Shop'} (${m.channel}): ${m.body}`),
    ...open.map((o) => `\nOpen repair order:\n${orderContext(state, o)}`),
  ].join('\n');
}

/** Split a "Cause: … / Correction: …" answer into its two parts. */
export function parseStory(text) {
  const cause = /cause\s*:\s*([\s\S]*?)(?:\n\s*correction\s*:|$)/i.exec(text)?.[1]?.trim() || '';
  const correction = /correction\s*:\s*([\s\S]*)$/i.exec(text)?.[1]?.trim() || '';
  return { cause, correction };
}
