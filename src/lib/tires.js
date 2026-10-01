// Tire quoting (good / better / best options on one service) and DOT TIN record keeping.
import { uid, fullName, vehicleName } from './format';

export const TIERS = { good: 'Good', better: 'Better', best: 'Best' };

export const newTireOption = (tier = 'good') => ({ id: uid('tire'), tier, brand: '', model: '', spec: '', warranty: '', cost: 0, price: 0 });

export const newTireQuote = (size = '', qty = 4) => ({ size, qty, selectedId: null, options: ['good', 'better', 'best'].map(newTireOption), dots: [], registered: false });

export const tireLabel = (o, size = '') => [o.brand, o.model, size].filter(Boolean).join(' ').trim() || 'Tire';

/**
 * DOT Tire Identification Number check. The last four digits are the week and year of manufacture
 * (e.g. 2324 = week 23 of 2024); the characters before them identify plant, size and options.
 */
export function checkTin(raw) {
  const tin = String(raw || '').toUpperCase().replace(/^DOT/, '').replace(/[^A-Z0-9]/g, '');
  if (!tin) return { ok: false, empty: true, tin };
  if (tin.length < 7 || tin.length > 13) return { ok: false, tin, message: 'A TIN is 7–13 letters and numbers after “DOT”' };
  const date = tin.slice(-4);
  if (!/^\d{4}$/.test(date)) return { ok: false, tin, message: 'Should end in a 4-digit date code (week + year)' };
  const week = Number(date.slice(0, 2));
  const year = 2000 + Number(date.slice(2));
  if (week < 1 || week > 53) return { ok: false, tin, message: `Week ${date.slice(0, 2)} isn’t valid (01–53)` };
  const made = new Date(year, 0, 1 + (week - 1) * 7);
  if (made > new Date(Date.now() + 14 * 86400000)) return { ok: false, tin, message: 'Date code is in the future' };
  const ageYears = (Date.now() - made.getTime()) / (365.25 * 86400000);
  return { ok: true, tin, week, year, ageYears, old: ageYears >= 6 };
}

/** Every tire installed on an invoiced RO, with its DOT number, for registration records. */
export function tireLog(state) {
  const rows = [];
  for (const o of state.orders) {
    if (!o.invoicedAt) continue;
    for (const s of o.services) {
      const q = s.tires;
      if (!q || s.status === 'declined') continue;
      const opt = q.options.find((x) => x.id === q.selectedId);
      if (!opt) continue;
      const c = state.customers.find((x) => x.id === o.customerId);
      const v = state.vehicles.find((x) => x.id === o.vehicleId);
      const count = Math.max(Number(q.qty) || 0, (q.dots || []).length);
      for (let i = 0; i < count; i++) {
        rows.push({ key: `${s.id}:${i}`, order: o, service: s, customer: c, vehicle: v, tire: tireLabel(opt, q.size), dot: (q.dots || [])[i] || '', registered: Boolean(q.registered), position: i + 1 });
      }
    }
  }
  return rows.sort((a, b) => b.order.invoicedAt.localeCompare(a.order.invoicedAt));
}

export const tireLogCsvRows = (rows) =>
  rows.map((r) => [r.order.invoicedAt.slice(0, 10), r.order.number, fullName(r.customer), r.customer?.address || '', r.customer?.city || '', r.customer?.state || '', r.customer?.zip || '', r.customer?.phone || '', r.vehicle ? vehicleName(r.vehicle) : '', r.vehicle?.vin || '', r.tire, r.dot, r.registered ? 'Yes' : 'No']);

export const TIRE_LOG_COLUMNS = ['Install date', 'RO', 'Customer', 'Address', 'City', 'State', 'ZIP', 'Phone', 'Vehicle', 'VIN', 'Tire', 'DOT TIN', 'Registered'];
