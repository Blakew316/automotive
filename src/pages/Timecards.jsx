// Printable timecards for a pay period: each technician's punches by day, regular and overtime
// hours, flagged hours and pay, with signature lines for the employee and manager.
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Printer } from 'lucide-react';
import { useShop, useAccess } from '../store/hooks';
import { canSeePay } from '../lib/access';
import { payrollRows, payPeriod, payrollSettings } from '../lib/payroll';
import { money, dateShort, time, addDays, isoDate } from '../lib/format';

const parse = (s) => {
  const [y, m, d] = String(s || '').split('-').map(Number);
  return y ? new Date(y, m - 1, d) : null;
};

export default function Timecards() {
  const { state } = useShop();
  const { role } = useAccess();
  const [params] = useSearchParams();
  const fallback = payPeriod(payrollSettings(state.shop));
  const from = parse(params.get('from')) || fallback[0];
  const to = parse(params.get('to')) || fallback[1];
  const rows = useMemo(() => payrollRows(state, from, to).filter((r) => r.shiftH > 0 || r.flagged > 0), [state, from, to]);
  const pay = canSeePay(role);
  const punches = (techId, day) =>
    state.timeEntries
      .filter((e) => e.techId === techId && e.kind === 'shift' && isoDate(new Date(e.start)) === day)
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((e) => `${time(e.start)}–${e.end ? time(e.end) : 'open'}`)
      .join(', ');

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <div className="no-print glass sticky top-0 z-10 border-b border-line bg-canvas/80">
        <div className="mx-auto flex max-w-[860px] items-center gap-3 px-4 py-2.5">
          <Link to="/team?tab=pay" className="btn-plain -ml-2 px-1.5">
            <ChevronLeft size={17} strokeWidth={2} /> Team
          </Link>
          <span className="text-sm text-ink-3">{dateShort(from)} – {dateShort(addDays(to, -1))}</span>
          <button className="btn-primary ml-auto" onClick={() => window.print()}>
            <Printer size={15} /> Print / Save PDF
          </button>
        </div>
      </div>
      {rows.length === 0 && <p className="mt-10 text-center text-sm text-ink-3">No time on the clock in this period.</p>}
      {rows.map((r) => (
        <article key={r.tech.id} className="force-light print-sheet mx-auto mt-8 max-w-[860px] break-after-page rounded-lg bg-surface px-12 py-10 text-ink shadow-card">
          <header className="flex items-start justify-between gap-6 border-b border-line pb-4">
            <div>
              <div className="text-sm text-ink-2">{state.shop.name}</div>
              <h1 className="text-2xl font-bold tracking-tight">{r.tech.name}</h1>
              <div className="text-sm text-ink-2">{[r.tech.role, r.tech.payrollId && `Employee ID ${r.tech.payrollId}`].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-semibold">Timecard</div>
              <div className="text-sm text-ink-2">{dateShort(from)} – {dateShort(addDays(to, -1))}, {addDays(to, -1).getFullYear()}</div>
            </div>
          </header>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                <th className="pb-2 font-medium">Day</th>
                <th className="pb-2 font-medium">Clock in – out</th>
                <th className="pb-2 text-right font-medium">Hours</th>
              </tr>
            </thead>
            <tbody>
              {[...r.byDay.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([day, h]) => (
                  <tr key={day} className="border-b border-line/60">
                    <td className="py-1.5">{parse(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                    <td className="text-ink-2">{punches(r.tech.id, day) || 'Continued from the day before'}</td>
                    <td className="tabular text-right">{h.toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <dl className="ml-auto mt-4 w-72 space-y-1 text-sm">
            {r.flat ? (
              <div className="flex justify-between"><dt className="text-ink-2">Hours on the clock</dt><dd className="tabular">{(r.regular + r.overtime).toFixed(2)}</dd></div>
            ) : (
              <>
                <div className="flex justify-between"><dt className="text-ink-2">Regular hours</dt><dd className="tabular">{r.regular.toFixed(2)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-2">Overtime hours</dt><dd className="tabular">{r.overtime.toFixed(2)}</dd></div>
              </>
            )}
            <div className="flex justify-between"><dt className="text-ink-2">Flagged hours</dt><dd className="tabular">{r.flagged.toFixed(2)}</dd></div>
            {pay && (
              <>
                <div className="flex justify-between border-t border-line pt-1"><dt className="text-ink-2">{r.flat ? 'Flat-rate pay' : 'Regular + overtime pay'}</dt><dd className="tabular">{money(r.regularPay + r.overtimePay)}</dd></div>
                {r.commission > 0 && <div className="flex justify-between"><dt className="text-ink-2">Commission</dt><dd className="tabular">{money(r.commission)}</dd></div>}
                <div className="flex justify-between font-semibold"><dt>Gross pay</dt><dd className="tabular">{money(r.gross)}</dd></div>
              </>
            )}
          </dl>
          <div className="mt-10 grid grid-cols-2 gap-10 text-xs text-ink-2">
            <div>
              <div className="h-8 border-b border-ink-3" />
              <div className="mt-1">Employee signature — I confirm these hours are correct</div>
            </div>
            <div>
              <div className="h-8 border-b border-ink-3" />
              <div className="mt-1">Manager approval</div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
