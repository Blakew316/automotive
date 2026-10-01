// Business texting & calling through the shop's own Twilio number: settings, what the server
// needs to answer calls (the "profile"), automatic appointment texts, and turning call records into
// conversation entries.
import { OPEN_STATUSES } from './workflow';
import { fillTemplate, messageContext, template } from './messaging';
import { bookingLink } from './booking';
import { vehicleName, phone as fmtPhone, addDays, startOfDay } from './format';

export const PHONE_DEFAULTS = {
  // Send texts from the business number (instead of opening the device's Messages app).
  enabled: true,
  forward: [], // [{ number, label }] — phones that ring for incoming calls
  ringSeconds: 20,
  receptionist: 'missed', // off | after_hours | missed | always
  receptionistModel: 'claude-haiku-4-5',
  voice: 'Polly.Joanna-Neural',
  greeting: '',
  voicemailGreeting: '',
  knowledge: '',
  allowStatus: true,
  allowBooking: true,
  textBack: true,
  textBackBody: 'Sorry we missed your call! This is {shop} — reply here and we’ll get right back to you.',
  afterHoursReply: false,
  afterHoursBody: 'Thanks for your message! {shop} is closed right now — we’ll reply as soon as we open.',
  autoConfirm: false,
  autoReminder: false,
  reminderHour: 10,
  autoSince: null,
};

export const RECEPTIONIST_MODES = [
  { value: 'off', label: 'Off — voicemail only', hint: 'Calls ring your phones; missed and after-hours calls go to voicemail.' },
  { value: 'after_hours', label: 'After hours', hint: 'Answers when you’re closed. During hours, missed calls go to voicemail.' },
  { value: 'missed', label: 'When no one answers', hint: 'Answers calls nobody picks up, and every call after hours.' },
  { value: 'always', label: 'Answers every call', hint: 'Picks up first and transfers to your phones when the caller asks for a person.' },
];

// The receptionist talks in real time, so speed matters more here than in the assistant drawer.
export const RECEPTIONIST_MODELS = [
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — quickest replies (recommended for calls)' },
  { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — more capable, slower to answer' },
  { value: 'claude-opus-5-5', label: 'Claude Opus 5.5 — most capable, slowest to answer' },
];

export const VOICES = [
  { value: 'Polly.Joanna-Neural', label: 'Joanna (female, US)' },
  { value: 'Polly.Salli-Neural', label: 'Salli (female, US)' },
  { value: 'Polly.Ruth-Generative', label: 'Ruth (female, US, most natural)' },
  { value: 'Polly.Matthew-Neural', label: 'Matthew (male, US)' },
  { value: 'Polly.Joey-Neural', label: 'Joey (male, US)' },
  { value: 'Polly.Stephen-Generative', label: 'Stephen (male, US, most natural)' },
];

export const lineSettings = (shop) => ({ ...PHONE_DEFAULTS, ...(shop.phoneLine || {}) });

export function e164(p = '') {
  const raw = String(p || '').trim();
  const d = raw.replace(/\D/g, '');
  if (raw.startsWith('+') && d.length >= 8 && d.length <= 15) return `+${d}`;
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d[0] === '1') return `+${d}`;
  return '';
}
export const last10 = (p = '') => String(p || '').replace(/\D/g, '').slice(-10);

/** The customer with this phone number, if any. */
export function customerByPhone(state, p) {
  const d = last10(p);
  return d.length === 10 ? state.customers.find((c) => last10(c.phone) === d) : null;
}

const fillShop = (text, shop) => String(text || '').replace(/\{shop\}/g, shop.name || 'the shop');

// What the receptionist may say about a vehicle in the shop.
const STATUS_WORDS = {
  estimate: 'being inspected — the estimate is being put together',
  approved: 'approved and waiting for a technician',
  in_progress: 'being worked on',
  waiting_parts: 'waiting on parts',
  ready: 'ready for pickup',
};

const when = (iso) => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * Everything the phone server needs to answer calls and texts: hours, the receptionist's settings
 * and knowledge, and a small directory (first name, open repair orders, next appointment) so it
 * can greet a known caller and tell them where their vehicle is. Stored privately (staff only).
 */
export function phoneProfile(state) {
  const shop = state.shop;
  const line = lineSettings(shop);
  const soon = addDays(new Date(), 14).toISOString();
  const nowIso = new Date().toISOString();
  const byCustomer = new Map();
  for (const o of state.orders) {
    if (!OPEN_STATUSES.includes(o.status) || !o.customerId) continue;
    const v = state.vehicles.find((x) => x.id === o.vehicleId);
    const list = byCustomer.get(o.customerId) || [];
    list.push({ vehicle: v ? vehicleName(v) : 'vehicle', status: STATUS_WORDS[o.status], promised: o.promisedAt ? when(o.promisedAt) : '', ready: o.status === 'ready' });
    byCustomer.set(o.customerId, list);
  }
  const appts = new Map();
  for (const a of state.appointments) {
    if (a.start < nowIso || a.start > soon || ['cancelled', 'no_show'].includes(a.status) || a.orderId) continue;
    if (!appts.has(a.customerId) || a.start < appts.get(a.customerId)) appts.set(a.customerId, a.start);
  }
  const directory = state.customers
    .filter((c) => last10(c.phone).length === 10 && (byCustomer.has(c.id) || appts.has(c.id)))
    .map((c) => ({ p: last10(c.phone), first: c.firstName || c.company || '', orders: byCustomer.get(c.id) || [], appt: appts.has(c.id) ? when(appts.get(c.id)) : '' }));
  const services = [...new Set(state.cannedJobs.map((j) => j.title))].slice(0, 40);
  return {
    v: 1,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago',
    hours: shop.hours,
    shop: { name: shop.name, phone: shop.phone, address: shop.address, city: shop.city, state: shop.state, zip: shop.zip, bookingLink: bookingLink(state) },
    services,
    line: {
      forward: line.forward.filter((f) => e164(f.number)).map((f) => ({ number: e164(f.number), label: f.label || '' })),
      ringSeconds: line.ringSeconds,
      receptionist: line.receptionist,
      receptionistModel: line.receptionistModel,
      voice: line.voice,
      greeting: fillShop(line.greeting, shop),
      voicemailGreeting: fillShop(line.voicemailGreeting, shop),
      knowledge: line.knowledge,
      allowStatus: line.allowStatus,
      allowBooking: line.allowBooking,
      textBack: line.textBack,
      textBackBody: fillShop(line.textBackBody, shop),
      afterHoursReply: line.afterHoursReply,
      afterHoursBody: fillShop(line.afterHoursBody, shop),
    },
    directory,
  };
}

/**
 * Appointment texts the server should send on its own: a confirmation when an appointment is
 * booked and a reminder the day before. Keys include the appointment's date, so rescheduling
 * queues a fresh text and the old one is cancelled.
 */
export function appointmentTexts(state, now = new Date()) {
  const line = lineSettings(state.shop);
  if (!line.autoConfirm && !line.autoReminder) return [];
  const since = line.autoSince || now.toISOString();
  const tpl = template(state, 'appt')?.body || '';
  const out = [];
  const horizon = addDays(now, 8).toISOString();
  for (const a of state.appointments) {
    if (['cancelled', 'no_show', 'completed'].includes(a.status) || a.orderId) continue;
    const start = new Date(a.start);
    if (start <= now || a.start > horizon) continue;
    const c = state.customers.find((x) => x.id === a.customerId);
    const to = e164(c?.phone);
    if (!c || !to || c.textOptIn === false) continue;
    const v = state.vehicles.find((x) => x.id === a.vehicleId);
    const body = fillTemplate(tpl, messageContext(state, { customer: c, vehicle: v, appointment: a }));
    if (!body) continue;
    const day = a.start.slice(0, 10);
    const meta = { automation: '', template: 'appt', appointmentId: a.id, customerId: c.id };
    const sent = (kind) => state.messages.some((m) => m.meta?.appointmentId === a.id && m.meta?.automation === kind && m.meta?.apptStart === a.start);
    // Confirmation: only for appointments booked after automatic texts were turned on.
    const booked = a.createdAt || null;
    const fresh = booked && booked >= since;
    if (line.autoConfirm && fresh && !sent('confirm')) out.push({ key: `appt-confirm:${a.id}:${day}`, to_phone: to, body, send_at: now.toISOString(), immediate: true, meta: { ...meta, automation: 'confirm', apptStart: a.start } });
    // Reminder: the day before at the shop's chosen hour — skipped when the booking was made so
    // close to the visit that the confirmation already covers it.
    if (line.autoReminder && !sent('reminder')) {
      const at = addDays(startOfDay(start), -1);
      at.setHours(Number(line.reminderHour) || 10, 0, 0, 0);
      const sendAt = at < now ? now : at;
      const lead = start - sendAt;
      const recentBooking = line.autoConfirm && fresh && start - new Date(booked) < 30 * 3600_000;
      if (lead > 3 * 3600_000 && !recentBooking) out.push({ key: `appt-reminder:${a.id}:${day}`, to_phone: to, body, send_at: sendAt.toISOString(), immediate: sendAt === now, meta: { ...meta, automation: 'reminder', apptStart: a.start } });
    }
  }
  return out;
}

const mins = (s) => {
  const n = Math.round(Number(s) || 0);
  return n < 60 ? `${n} sec` : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};

/** One line for a call in the conversation. */
export function callText(p = {}) {
  if (p.direction === 'out') return `Called ${p.to ? fmtPhone(p.to) : 'the customer'} from the business line`;
  if (p.status === 'answered') return `Answered call${p.talkSeconds ? ` · ${mins(p.talkSeconds)}` : ''}`;
  if (p.receptionist && (p.turns?.length || 0) > 1) return p.summary || p.message || 'Talked with the AI receptionist';
  if (p.voicemailPath || p.voicemailText) return `Voicemail${p.voicemailSeconds ? ` (${mins(p.voicemailSeconds)})` : ''}${p.voicemailText ? `: “${p.voicemailText}”` : ''}`;
  return 'Missed call';
}

/** The part of a call record kept on the conversation entry. */
export function callMeta(p = {}) {
  return {
    status: p.status || 'missed',
    direction: p.direction || 'in',
    from: p.from || '',
    to: p.to || '',
    seconds: p.seconds || 0,
    talkSeconds: p.talkSeconds || 0,
    voicemailPath: p.voicemailPath || null,
    voicemailSeconds: p.voicemailSeconds || 0,
    voicemailText: p.voicemailText || '',
    receptionist: Boolean(p.receptionist && (p.turns?.length || 0) > 1),
    turns: (p.turns || []).slice(0, 60),
    summary: p.summary || '',
    message: p.message || '',
    appointment: p.appointment || null,
    textedBack: Boolean(p.textedBack),
    callerName: p.callerGivenName || p.callerName || '',
  };
}

/** A missed call needs a callback until someone calls or texts the customer afterwards. */
export function needsCallback(state, m) {
  if (m.channel !== 'call' || m.dir !== 'in') return false;
  const c = m.meta?.call;
  if (!c || c.status === 'answered') return false;
  // The receptionist handled it unless it took a message for the staff.
  if (c.receptionist && !c.message) return false;
  return !state.messages.some((x) => x.customerId === m.customerId && x.dir === 'out' && x.at > m.at && !x.meta?.automation);
}
