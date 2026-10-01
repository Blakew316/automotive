// Payroll: pay periods, overtime and the files a payroll service imports. Hourly techs are paid
// on clock hours with overtime by workweek (and optionally by day); flat-rate techs on flagged
// hours; commission on labor and parts sales invoiced in the period.
import { teamSummary } from './time';
import { addDays, isoDate, startOfDay } from './format';

export const PAY_PERIODS = {
  weekly: 'Weekly',
  biweekly: 'Every two weeks',
  semimonthly: 'Twice a month (1st–15th, 16th–end)',
  monthly: 'Monthly',
};

export const PAYROLL_DEFAULTS = { period: 'weekly', anchor: '2026-01-05', weekStart: 1, overtimeWeekly: 40, overtimeDaily: null, otMultiplier: 1.5, approved: {} };

export const payrollSettings = (shop) => ({ ...PAYROLL_DEFAULTS, ...(shop.payroll || {}) });

const parseDay = (s) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

/** The pay period containing `ref` (offset -1 for the one before), as [from, to). */
export function payPeriod(settings, ref = new Date(), offset = 0) {
  const s = { ...PAYROLL_DEFAULTS, ...settings };
  const day = startOfDay(ref);
  if (s.period === 'monthly') {
    const from = new Date(day.getFullYear(), day.getMonth() + offset, 1);
    return [from, new Date(from.getFullYear(), from.getMonth() + 1, 1)];
  }
  if (s.period === 'semimonthly') {
    // Count half-months from a fixed point so the offset can step across months.
    const half = day.getFullYear() * 24 + day.getMonth() * 2 + (day.getDate() > 15 ? 1 : 0) + offset;
    const y = Math.floor(half / 24);
    const m = Math.floor((half % 24) / 2);
    const second = half % 2 === 1;
    return second ? [new Date(y, m, 16), new Date(y, m + 1, 1)] : [new Date(y, m, 1), new Date(y, m, 16)];
  }
  const len = s.period === 'biweekly' ? 14 : 7;
  const anchor = parseDay(s.anchor);
  const n = Math.floor(Math.round((day - anchor) / 86_400_000) / len) + offset;
  const from = addDays(anchor, n * len);
  return [from, addDays(from, len)];
}

export const periodKey = (from) => isoDate(from);

/** A technician's clock hours per calendar day (shifts split across midnight), in [from, to). */
export function hoursByDay(state, techId, from, to, now = Date.now()) {
  const out = new Map();
  for (const e of state.timeEntries) {
    if (e.techId !== techId || e.kind !== 'shift') continue;
    let a = Math.max(new Date(e.start).getTime(), from.getTime());
    const b = Math.min(e.end ? new Date(e.end).getTime() : now, to.getTime());
    while (a < b) {
      const dayStart = startOfDay(new Date(a));
      const next = Math.min(b, addDays(dayStart, 1).getTime());
      const k = isoDate(dayStart);
      out.set(k, (out.get(k) || 0) + (next - a) / 3_600_000);
      a = next;
    }
  }
  return out;
}

/** Split hours into regular and overtime: daily overtime first (if set), then weekly over the threshold. */
export function overtimeSplit(byDay, settings) {
  const s = { ...PAYROLL_DEFAULTS, ...settings };
  const weeks = new Map();
  let regular = 0;
  let overtime = 0;
  for (const [k, h] of [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const d = parseDay(k);
    const back = (d.getDay() - (s.weekStart ?? 1) + 7) % 7;
    const wk = isoDate(addDays(d, -back));
    let reg = h;
    if (s.overtimeDaily) {
      const ot = Math.max(0, h - s.overtimeDaily);
      overtime += ot;
      reg = h - ot;
    }
    const before = weeks.get(wk) || 0;
    const room = s.overtimeWeekly ? Math.max(0, s.overtimeWeekly - before) : Infinity;
    const weekOt = Math.max(0, reg - room);
    overtime += weekOt;
    regular += reg - weekOt;
    weeks.set(wk, before + reg - weekOt);
  }
  return { regular, overtime };
}

const r2 = (n) => Math.round(n * 100) / 100;

/** One row per technician with hours, overtime and gross pay for the period. */
export function payrollRows(state, from, to) {
  const s = payrollSettings(state.shop);
  return teamSummary(state, from, to)
    .filter((r) => r.tech.active !== false || r.shiftH > 0 || r.flagged > 0)
    .map((r) => {
      const rate = Number(r.tech.payRate) || 0;
      const byDay = hoursByDay(state, r.tech.id, from, to);
      const { regular, overtime } = overtimeSplit(byDay, s);
      const flat = r.tech.payType === 'flat';
      const regularPay = flat ? r2(r.flagged * rate) : r2(regular * rate);
      const overtimePay = flat ? 0 : r2(overtime * rate * (Number(s.otMultiplier) || 1.5));
      const commission = r2(r.commission);
      return { ...r, byDay, regular: r2(regular), overtime: r2(overtime), rate, flat, regularPay, overtimePay, commission, gross: r2(regularPay + overtimePay + commission) };
    });
}

const q = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const csv = (head, rows) => [head, ...rows].map((r) => r.map(q).join(',')).join('\n');

/** Everything for the bookkeeper: hours, overtime, flat-rate and commission per tech. */
export function payrollCsv(rows, from, to) {
  const end = isoDate(addDays(to, -1));
  return csv(
    ['Employee', 'Employee ID', 'Period start', 'Period end', 'Pay type', 'Rate', 'Regular hours', 'Overtime hours', 'Flagged hours', 'Regular pay', 'Overtime pay', 'Commission', 'Gross pay'],
    rows.map((r) => [r.tech.name, r.tech.payrollId || '', isoDate(from), end, r.flat ? 'Flat rate' : 'Hourly', r.rate.toFixed(2), r.regular.toFixed(2), r.overtime.toFixed(2), r.flagged.toFixed(2), r.regularPay.toFixed(2), r.overtimePay.toFixed(2), r.commission.toFixed(2), r.gross.toFixed(2)]),
  );
}

/**
 * Hours (and extra earnings) in the simple layout payroll services import from a spreadsheet —
 * match the columns on your provider's import screen. Flat-rate techs' hours are their flagged
 * hours; their pay is in the flat-rate column.
 */
export function hoursImportCsv(rows) {
  return csv(
    ['Employee ID', 'Employee name', 'Regular hours', 'Overtime hours', 'Flat-rate pay', 'Commission'],
    rows.map((r) => [r.tech.payrollId || '', r.tech.name, (r.flat ? r.flagged : r.regular).toFixed(2), r.overtime.toFixed(2), r.flat ? r.regularPay.toFixed(2) : '0.00', r.commission.toFixed(2)]),
  );
}
