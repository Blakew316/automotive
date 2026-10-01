// Defaults for shop settings and collections added after the first release. `migrate` fills them
// into saved data and imported backups so older data keeps working.
import { INSPECTION_TEMPLATE } from '../lib/workflow';
import { defaultStaff } from '../lib/access';
import { SHOP_CLOUD } from '../lib/cloudDefaults';

export const MESSAGE_TEMPLATES = [
  { id: 'estimate', label: 'Estimate ready', body: 'Hi {first}, it’s {shop}. Your estimate for the {vehicle} is {total}. Reply YES to approve or call {phone} with questions. Photos and online approval: {link}' },
  { id: 'update', label: 'Status update', body: 'Hi {first}, quick update on your {vehicle} from {shop}: ' },
  { id: 'ready', label: 'Vehicle ready', body: 'Hi {first}, your {vehicle} is ready for pickup at {shop}. Balance due {balance}. Pay ahead here: {payLink}' },
  { id: 'pay', label: 'Payment request', body: 'Hi {first}, your invoice from {shop} for RO #{ro} is {balance}. Pay securely here: {payLink}' },
  { id: 'receipt', label: 'Payment receipt', body: 'Thank you, {first}! We received your payment of {amount} for RO #{ro}. — {shop}' },
  { id: 'appt', label: 'Appointment reminder', body: 'Hi {first}, it’s {shop}: your {vehicle} is booked for {date} at {time}. Reply C to confirm or call {phone} to reschedule.' },
  { id: 'service', label: 'Service reminder', body: 'Hi {first}, it’s {shop}. Your {vehicle} is due for {service}. Call {phone} to schedule. Book online: {bookLink}' },
  { id: 'declined', label: 'Declined work follow-up', body: 'Hi {first}, it’s {shop}. At your last visit we recommended {service} for your {vehicle}. Want us to get that scheduled? Book online: {bookLink}' },
  { id: 'review', label: 'Review request', body: 'Thanks for choosing {shop}, {first}! Would you take 30 seconds to share how we did? {reviewLink}' },
  { id: 'winback', label: 'We miss you', body: 'Hi {first}, it’s {shop}. It’s been a while since we’ve seen your {vehicle}. Call {phone} or book online: {bookLink}' },
];

export const EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Insurance', 'Office payroll', 'Software', 'Advertising', 'Shop supplies', 'Tools & equipment', 'Repairs & maintenance', 'Bank & card fees', 'Vehicle & fuel', 'Professional services', 'Other'];

export const DEFAULT_INSPECTION_TEMPLATE = { id: 'insp-standard', name: 'Standard multi-point', sections: INSPECTION_TEMPLATE.map((s) => ({ section: s.section, items: [...s.items] })) };

const WEEK_HOURS = { 0: null, 1: ['07:30', '17:30'], 2: ['07:30', '17:30'], 3: ['07:30', '17:30'], 4: ['07:30', '17:30'], 5: ['07:30', '17:30'], 6: ['08:00', '12:00'] };

export const SHOP_DEFAULTS = {
  hours: WEEK_HOURS,
  payments: { surchargePct: 0, tipsEnabled: true, provider: 'none', link: '', handle: '' },
  financing: { enabled: false, provider: '', url: '', apr: 9.99, terms: [6, 12, 24], minAmount: 300 },
  booking: { enabled: true, slotMinutes: 30, leadHours: 2, daysAhead: 21, capacity: 2, jobIds: ['cj-oil', 'cj-rotate', 'cj-fbrakes', 'cj-diag', 'cj-align', 'cj-ac', 'cj-battery', 'cj-inspect'], note: 'We’ll confirm your appointment by text.' },
  marketing: { reviewUrl: '', oilMonths: 6, oilMiles: 5000, milesPerDay: 35, winbackMonths: 9 },
  // Public shop website (Settings → Website). Rating and reviews are what the shop enters.
  website: {
    tagline: 'Honest, dealer-quality repair for every make and model.',
    since: 1998,
    about: 'Family-owned and ASE-certified. We show you photos of what we find, explain your options, and never start work without your OK.',
    rating: 4.9,
    reviews: 212,
    testimonials: [
      { name: 'Megan R.', text: 'They texted me photos of my brakes and explained exactly what was needed. Fair price and done the same day.' },
      { name: 'Chris D.', text: 'Booked online at 10pm, dropped the truck off at 7:30, picked it up at lunch. Easiest shop I’ve used.' },
      { name: 'Laura N.', text: 'Honest advice — they told me what could wait. That’s why I keep coming back.' },
    ],
    highlights: ['ASE-certified technicians', '24-month / 24,000-mile warranty', 'Digital inspections with photos', 'Text updates & online approval'],
  },
  // Monthly scorecard targets (Reports → Goals). GP% also colors job profitability on ROs.
  goals: { carCount: 150, aro: 600, gpPct: 55, partsMargin: 50, elr: 135, closeRate: 65 },
  templates: MESSAGE_TEMPLATES,
};

const TECH_DEFAULTS = { payType: 'hourly', laborCommissionPct: 0, partsCommissionPct: 0, active: true, phone: '', email: '' };

/** Bring saved or imported data up to the current shape without touching existing values. */
export function migrate(data) {
  const d = { ...data };
  d.shop = { ...SHOP_DEFAULTS, ...d.shop };
  for (const k of ['payments', 'financing', 'booking', 'marketing', 'goals', 'website']) d.shop[k] = { ...SHOP_DEFAULTS[k], ...(d.shop[k] || {}) };
  if (!Array.isArray(d.shop.templates) || !d.shop.templates.length) d.shop.templates = MESSAGE_TEMPLATES;
  else {
    // Keep the shop's edits; add any templates introduced since.
    const have = new Set(d.shop.templates.map((t) => t.id));
    d.shop.templates = [...d.shop.templates, ...MESSAGE_TEMPLATES.filter((t) => !have.has(t.id))];
  }
  d.technicians = (d.technicians || []).map((t) => ({ ...TECH_DEFAULTS, ...t }));
  if (!Array.isArray(d.shop.staff) || !d.shop.staff.length) d.shop.staff = defaultStaff(d.technicians);
  // Connected to the shop's own cloud project unless another one was set up.
  if (!d.shop.cloud?.url) d.shop.cloud = { ...SHOP_CLOUD };
  for (const k of ['purchaseOrders', 'timeEntries', 'messages', 'expenses', 'bookingRequests', 'campaigns']) if (!Array.isArray(d[k])) d[k] = [];
  if (!Array.isArray(d.inspectionTemplates) || !d.inspectionTemplates.length) d.inspectionTemplates = [DEFAULT_INSPECTION_TEMPLATE];
  d.counters = { po: 2000, ...(d.counters || {}) };
  d.orders = (d.orders || []).map((o) => (o.authorizations ? o : { ...o, authorizations: [] }));
  return d;
}
