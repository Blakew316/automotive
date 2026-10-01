// Period-over-period comparison, monthly goals scorecard and a growth planner.
import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, Minus, Target, Pencil, TrendingUp, Calculator, CalendarRange } from 'lucide-react';
import { useUI, useScopedShop } from '../../store/hooks';
import { Card, CardHeader, Modal, Field, NumInput, Segmented } from '../../components/ui';
import { periodMetrics, COMPARE_ROWS, goalProgress } from '../../lib/kpis';
import { money, money0, pct, number, addDays, startOfDay, dateShort } from '../../lib/format';

const fmt = (kind, v) => (kind === 'money' ? money0(v) : kind === 'pct' ? pct(v, 1) : kind === 'hours' ? v.toFixed(1) : number(Math.round(v)));

/** Previous vs current period with % change, for the same number of days. */
export function PeriodCompare({ days }) {
  const { state } = useScopedShop();
  const now = useMemo(() => new Date(), []);
  const cur = useMemo(() => {
    const to = addDays(startOfDay(now), 1);
    const from = addDays(to, -days);
    const prevFrom = addDays(from, -days);
    return { from, to, prevFrom, a: periodMetrics(state, prevFrom, from), b: periodMetrics(state, from, to) };
  }, [state, now, days]);
  return (
    <Card>
      <CardHeader icon={CalendarRange} tone="blue" title="Period over period" subtitle={`${dateShort(cur.from)} – ${dateShort(addDays(cur.to, -1))} vs the ${days} days before`} />
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Metric</th>
              <th className="text-right">Previous</th>
              <th className="text-right">Current</th>
              <th className="text-right">Change</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((r) => {
              const a = cur.a[r.key];
              const b = cur.b[r.key];
              const change = r.kind === 'pct' ? b - a : a ? (b - a) / a : null;
              const up = change > 0.0005;
              const down = change < -0.0005;
              const Icon = up ? ArrowUp : down ? ArrowDown : Minus;
              return (
                <tr key={r.key}>
                  <td className="font-medium">{r.label}</td>
                  <td className="tabular text-right text-ink-2">{fmt(r.kind, a)}</td>
                  <td className="tabular bg-accent/[0.04] text-right font-semibold">{fmt(r.kind, b)}</td>
                  <td className={`tabular text-right ${up ? 'text-ok' : down ? 'text-bad' : 'text-ink-3'}`}>
                    {change == null ? (
                      '—'
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Icon size={13} />
                        {r.kind === 'pct' ? `${(Math.abs(change) * 100).toFixed(1)} pts` : pct(Math.abs(change), 1)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line/70 px-4 py-2 text-xs text-ink-3">Hours presented are labor hours on every estimate written; hours sold are labor hours on work invoiced. Green is better than the previous period.</p>
    </Card>
  );
}

export function GoalsReport() {
  const { state } = useScopedShop();
  const now = useMemo(() => new Date(), []);
  // In the first few days of a month, open on last month's complete scorecard.
  const [which, setWhich] = useState(() => (goalProgress(state, now).elapsed <= 3 ? 'last' : 'this'));
  const g = useMemo(() => goalProgress(state, now, { last: which === 'last' }), [state, now, which]);
  const [editing, setEditing] = useState(false);
  const monthName = g.start.toLocaleDateString('en-US', { month: 'long' });
  return (
    <>
      <Card className="mb-6">
        <CardHeader
          icon={Target}
          tone="blue"
          title={`${monthName} scorecard`}
          subtitle={g.complete ? `Full month · ${g.total} business days` : `Month to date · business day ${g.elapsed} of ${g.total}`}
          actions={
            <>
              <Segmented
                size="sm"
                value={which}
                onChange={setWhich}
                options={[
                  { value: 'this', label: 'This month' },
                  { value: 'last', label: 'Last month' },
                ]}
              />
              <button className="btn-secondary btn-sm" onClick={() => setEditing(true)}>
                <Pencil size={13} /> Edit targets
              </button>
            </>
          }
        />
        <div className="grid gap-px bg-line/60 sm:grid-cols-2 xl:grid-cols-3">
          {g.rows.map((r) => {
            // Early in the month a projection is noise; judge counts on pace only after the first week.
            const value = r.projected != null && g.elapsed >= 5 ? r.projected : r.projected != null ? r.actual * (g.total / g.elapsed) : r.actual;
            const ratio = r.target ? value / r.target : 0;
            const tone = ratio >= 1 ? 'ok' : ratio >= 0.9 ? 'warn' : 'bad';
            const bar = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' }[tone];
            const text = { ok: 'text-ok', warn: 'text-warn', bad: 'text-bad' }[tone];
            return (
              <div key={r.key} className="bg-surface px-4 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="section-label">{r.label}</div>
                  <span className={`pill ${tone === 'ok' ? 'bg-ok/10' : tone === 'warn' ? 'bg-warn/15' : 'bg-bad/10'} ${text}`}>{tone === 'ok' ? 'On target' : tone === 'warn' ? 'Close' : 'Behind'}</span>
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="tabular text-[26px] font-semibold leading-8 tracking-tight">{fmt(r.kind, r.actual)}</span>
                  <span className="text-xs text-ink-3">target {fmt(r.kind, r.target || 0)}</span>
                </div>
                {r.projected != null && <div className="text-xs text-ink-2">On pace for {number(r.projected)} this month</div>}
                <div className="mt-2.5 h-1.5 rounded-full bg-fill/[0.12]">
                  <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <GrowthPlanner />
      {editing && <TargetsModal onClose={() => setEditing(false)} />}
    </>
  );
}

function TargetsModal({ onClose }) {
  const { state, updateShop } = useScopedShop();
  const { toast } = useUI();
  const [f, setF] = useState({ ...state.shop.goals });
  const num = (k, label, hint) => (
    <Field label={label} hint={hint}>{(id) => <NumInput id={id} align="left" className="input" value={f[k] ?? 0} onCommit={(v) => setF((x) => ({ ...x, [k]: Math.max(0, v) }))} />}</Field>
  );
  return (
    <Modal
      open
      onClose={onClose}
      title="Monthly targets"
      subtitle="Used by the scorecard and job profitability colors"
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => {
              updateShop({ goals: f });
              toast('Targets saved', { tone: 'success' });
              onClose();
            }}
          >
            Save
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {num('carCount', 'Car count / month')}
        {num('aro', 'Average repair order ($)')}
        {num('gpPct', 'Gross profit (%)', 'Jobs below this show amber or red')}
        {num('partsMargin', 'Parts margin (%)')}
        {num('elr', 'Effective labor rate ($/hr)')}
        {num('closeRate', 'Close rate (%)')}
      </div>
    </Modal>
  );
}

function Slider({ label, value, onChange, min, max, step, format }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-sm">
        <span className="text-ink-2">{label}</span>
        <span className="tabular font-semibold">{format(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[rgb(var(--accent))]" />
    </label>
  );
}

/** What-if: how changes in car count, ARO and close rate move monthly sales and gross profit. */
function GrowthPlanner() {
  const { state } = useScopedShop();
  const base = useMemo(() => {
    const to = addDays(startOfDay(new Date()), 1);
    const m = periodMetrics(state, addDays(to, -90), to);
    const perMonth = 30.4 / 90;
    return { cars: m.carCount * perMonth, aro: m.aro, gpPct: m.gpPct, closeRate: m.closeRate, sales: m.sales * perMonth };
  }, [state]);
  const [cars, setCars] = useState(10);
  const [aroUp, setAroUp] = useState(25);
  const [closeUp, setCloseUp] = useState(5);
  // Sales scale with cars × ARO; a better close rate lifts ARO proportionally (more of what's presented is sold).
  const aro = (base.aro + aroUp) * (base.closeRate ? (base.closeRate + closeUp / 100) / base.closeRate : 1);
  const carsNew = base.cars * (1 + cars / 100);
  const ratio = base.aro ? base.sales / (base.cars * base.aro || 1) : 1;
  const sales = carsNew * aro * ratio;
  const gpNow = base.sales * base.gpPct;
  const gpNew = sales * base.gpPct;
  return (
    <Card>
      <CardHeader icon={Calculator} tone="teal" title="Growth planner" subtitle="Based on your last 90 days — move the sliders to see the monthly impact" />
      <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Slider label="More cars per month" value={cars} onChange={setCars} min={0} max={50} step={1} format={(v) => `+${v}% (${Math.round(base.cars * (1 + v / 100))} cars)`} />
          <Slider label="Higher average repair order" value={aroUp} onChange={setAroUp} min={0} max={200} step={5} format={(v) => `+${money0(v)} (${money0(base.aro + v)})`} />
          <Slider label="Better close rate" value={closeUp} onChange={setCloseUp} min={0} max={20} step={1} format={(v) => `+${v} pts (${pct(base.closeRate + v / 100)})`} />
          <p className="text-xs text-ink-3">Typical levers: online booking and reminders (car count), menu pricing and inspections with photos (ARO), and texting estimates with approval links (close rate).</p>
        </div>
        <div className="grid grid-cols-2 gap-3 self-start">
          <div className="rounded-[10px] bg-fill/[0.06] p-3">
            <div className="section-label">Monthly sales now</div>
            <div className="tabular mt-1 text-xl font-semibold">{money0(base.sales)}</div>
          </div>
          <div className="rounded-[10px] bg-accent/[0.07] p-3 ring-1 ring-accent/20">
            <div className="section-label">With changes</div>
            <div className="tabular mt-1 text-xl font-semibold text-accent">{money0(sales)}</div>
          </div>
          <div className="rounded-[10px] bg-fill/[0.06] p-3">
            <div className="section-label">Gross profit now</div>
            <div className="tabular mt-1 text-xl font-semibold">{money0(gpNow)}</div>
          </div>
          <div className="rounded-[10px] bg-ok/[0.08] p-3 ring-1 ring-ok/20">
            <div className="section-label">Added profit / year</div>
            <div className="tabular mt-1 flex items-center gap-1 text-xl font-semibold text-ok">
              <TrendingUp size={18} /> {money0((gpNew - gpNow) * 12)}
            </div>
          </div>
          <p className="col-span-2 text-2xs text-ink-3">Estimates hold your current gross-profit percentage ({pct(base.gpPct)}) and ARO-to-sales ratio. {money(gpNew - gpNow)} more gross profit per month.</p>
        </div>
      </div>
    </Card>
  );
}
