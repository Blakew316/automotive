import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Users, Clock, BadgeDollarSign, LayoutList, Plus, Pencil, Download, Trash2, Timer, ShieldCheck, Printer, CircleCheck, Settings2 } from 'lucide-react';
import { useShop, useUI, useLookup, useAccess } from '../store/hooks';
import { canSeePay } from '../lib/access';
import Access from './team/Access';
import Logins from './team/Logins';
import { PageHeader, Card, CardHeader, Tabs, Segmented, Avatar, Modal, Field, Toggle, EmptyState, Dot } from '../components/ui';
import { teamSummary, useNow, entryMs, fmtDuration, runningJob, openShift } from '../lib/time';
import { serviceHours } from '../lib/pricing';
import { money, pct, dateShort, time, startOfDay, addDays, vehicleName, isoDate } from '../lib/format';
import { payPeriod, payrollSettings, payrollRows, payrollCsv, hoursImportCsv, periodKey, PAY_PERIODS } from '../lib/payroll';

const PERIODS = [
  { value: 'pp', label: 'This pay period' },
  { value: 'ppl', label: 'Last pay period' },
  { value: 'week', label: 'This week' },
  { value: 'last', label: 'Last week' },
  { value: 'month', label: 'This month' },
  { value: '30', label: '30 days' },
];

function periodRange(p, settings, now = new Date()) {
  if (p === 'pp' || p === 'ppl') return payPeriod(settings, now, p === 'ppl' ? -1 : 0);
  const today = startOfDay(now);
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  if (p === 'week') return [monday, addDays(monday, 7)];
  if (p === 'last') return [addDays(monday, -7), monday];
  if (p === 'month') return [new Date(today.getFullYear(), today.getMonth(), 1), addDays(today, 1)];
  return [addDays(today, -29), addDays(today, 1)];
}

export default function Team() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'board';
  const [period, setPeriod] = useState('pp');
  const { state } = useShop();
  const { role } = useAccess();
  const settings = useMemo(() => payrollSettings(state.shop), [state.shop]);
  const [from, to] = useMemo(() => periodRange(period, settings), [period, settings]);
  const summary = useMemo(() => teamSummary(state, from, to), [state, from, to]);

  return (
    <>
      <PageHeader title="Team" subtitle="Assignments, time clock, productivity and pay" actions={<Link to="/tech" className="btn-secondary"><Timer size={15} /> Tech view</Link>} />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        tabs={[
          { value: 'board', label: 'Right now', icon: LayoutList },
          { value: 'time', label: 'Timesheets', icon: Clock },
          ...(canSeePay(role) ? [{ value: 'pay', label: 'Pay & commissions', icon: BadgeDollarSign }] : []),
          { value: 'people', label: 'Technicians', icon: Users, count: state.technicians.length },
          ...(role === 'owner' ? [{ value: 'access', label: 'Staff & access', icon: ShieldCheck, count: (state.shop.staff || []).length }] : []),
        ]}
      />
      {(tab === 'time' || tab === 'pay') && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Segmented value={period} onChange={setPeriod} options={PERIODS} />
          <span className="text-sm text-ink-3">
            {dateShort(from)} – {dateShort(addDays(to, -1))}
          </span>
        </div>
      )}
      {tab === 'board' && <Board />}
      {tab === 'time' && <Timesheets summary={summary} from={from} to={to} />}
      {tab === 'pay' && canSeePay(role) && <Pay from={from} to={to} />}
      {tab === 'people' && <People />}
      {tab === 'access' && role === 'owner' && (
        <div className="space-y-6">
          <Access />
          <Logins />
        </div>
      )}
    </>
  );
}

function Board() {
  const { state } = useShop();
  const lookup = useLookup();
  const now = useNow(15000);
  const active = state.orders.filter((o) => ['approved', 'in_progress', 'waiting_parts'].includes(o.status));
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {state.technicians
        .filter((t) => t.active !== false)
        .map((t) => {
          const shift = openShift(state.timeEntries, t.id);
          const run = runningJob(state.timeEntries, t.id);
          const runOrder = run && lookup.order.get(run.orderId);
          const runSvc = runOrder?.services.find((s) => s.id === run.serviceId);
          const jobs = active.flatMap((o) => o.services.filter((s) => s.status === 'approved' && !s.done && (s.techId || o.techId) === t.id).map((s) => ({ o, s })));
          const load = jobs.reduce((sum, j) => sum + serviceHours(j.s), 0);
          return (
            <Card key={t.id} className="flex flex-col">
              <div className="flex items-center gap-3 border-b border-line/70 px-4 py-3">
                <Avatar name={t.name} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{t.name}</div>
                  <div className="flex items-center gap-1.5 text-xs text-ink-3">
                    <Dot className={run ? 'bg-ok' : shift ? 'bg-warn' : 'bg-ink-4'} size={6} />
                    {run ? 'On a job' : shift ? `Clocked in ${time(shift.start)} · idle` : 'Off the clock'}
                  </div>
                </div>
              </div>
              {run && runSvc && (
                <Link to={`/orders/${runOrder.id}`} className="border-b border-line/70 bg-ok/[0.05] px-4 py-2.5 text-sm hover:bg-ok/[0.08]">
                  <div className="truncate font-medium">{runSvc.title}</div>
                  <div className="flex justify-between text-xs text-ink-3">
                    <span className="truncate">{vehicleName(lookup.vehicle.get(runOrder.vehicleId))}</span>
                    <span className="tabular">{fmtDuration(entryMs(run, now))}</span>
                  </div>
                </Link>
              )}
              <ul className="flex-1 divide-y divide-line/60">
                {jobs.map(({ o, s }) => (
                  <li key={s.id}>
                    <Link to={`/orders/${o.id}`} className="block px-4 py-2 text-sm hover:bg-fill/[0.04]">
                      <div className="truncate">{s.title}</div>
                      <div className="truncate text-xs text-ink-3">
                        #{o.number} · {vehicleName(lookup.vehicle.get(o.vehicleId))} · {serviceHours(s).toFixed(1)} hr
                      </div>
                    </Link>
                  </li>
                ))}
                {!jobs.length && <li className="px-4 py-4 text-sm text-ink-3">No open jobs assigned.</li>}
              </ul>
              <div className="border-t border-line/70 px-4 py-2 text-xs text-ink-3">{load.toFixed(1)} hr of work assigned</div>
            </Card>
          );
        })}
    </div>
  );
}

function Timesheets({ summary, from, to }) {
  const { state, deleteTimeEntry } = useShop();
  const lookup = useLookup();
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null);
  const now = useNow(30000);
  return (
    <>
      <Card>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Technician</th>
                <th className="text-right">On the clock</th>
                <th className="text-right">On jobs</th>
                <th className="text-right">Flagged</th>
                <th className="text-right" title="Flagged hours ÷ hours clocked on jobs">Efficiency</th>
                <th className="hidden text-right sm:table-cell" title="Hours on jobs ÷ hours on the clock">Productivity</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((r) => (
                <tr key={r.tech.id} className="row-link" onClick={() => setOpen(open === r.tech.id ? null : r.tech.id)}>
                  <td className="font-medium">{r.tech.name}</td>
                  <td className="tabular text-right">{r.shiftH.toFixed(1)} hr</td>
                  <td className="tabular text-right">{r.jobH.toFixed(1)} hr</td>
                  <td className="tabular text-right">{r.flagged.toFixed(1)} hr</td>
                  <td className={`tabular text-right ${r.efficiency >= 1 ? 'text-ok' : r.efficiency && r.efficiency < 0.8 ? 'text-warn' : ''}`}>{r.jobH ? pct(r.efficiency) : '—'}</td>
                  <td className="tabular hidden text-right sm:table-cell">{r.shiftH ? pct(r.productivity) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line/70 px-4 py-2 text-xs text-ink-3">Flagged hours are billed labor hours on work invoiced in the period. Tap a technician to see and edit time entries.</p>
      </Card>
      {open && (
        <Card className="mt-6">
          <CardHeader
            title={`${lookup.tech.get(open)?.name} · time entries`}
            actions={
              <button className="btn-plain btn-sm" onClick={() => setEditing({ techId: open, kind: 'shift', start: new Date(from.getTime() + 8 * 3600000).toISOString(), end: new Date(from.getTime() + 16.5 * 3600000).toISOString() })}>
                <Plus size={14} /> Add entry
              </button>
            }
          />
          <ul className="divide-y divide-line/70">
            {state.timeEntries
              .filter((e) => e.techId === open && new Date(e.start) < to && (!e.end || new Date(e.end) > from))
              .sort((a, b) => b.start.localeCompare(a.start))
              .map((e) => {
                const o = e.orderId && lookup.order.get(e.orderId);
                const s = o?.services.find((x) => x.id === e.serviceId);
                return (
                  <li key={e.id} className="group flex items-center gap-3 px-4 py-2 text-sm">
                    <Dot className={e.kind === 'shift' ? 'bg-ink-4' : 'bg-accent'} size={7} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{e.kind === 'shift' ? 'Shift' : s ? `${s.title} · RO #${o.number}` : 'Job'}</div>
                      <div className="text-xs text-ink-3">
                        {dateShort(e.start)} · {time(e.start)} – {e.end ? time(e.end) : 'now'}
                      </div>
                    </div>
                    <span className="tabular">{fmtDuration(entryMs(e, now))}</span>
                    <button className="btn-ghost btn-icon h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => setEditing(e)} aria-label="Edit entry">
                      <Pencil size={13} />
                    </button>
                    <button className="btn-ghost btn-icon h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => deleteTimeEntry(e.id)} aria-label="Delete entry">
                      <Trash2 size={13} />
                    </button>
                  </li>
                );
              })}
          </ul>
        </Card>
      )}
      {editing && <EntryForm entry={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

const toLocal = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${isoDate(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function EntryForm({ entry, onClose }) {
  const { saveTimeEntry } = useShop();
  const [f, setF] = useState(entry);
  const valid = f.start && (!f.end || new Date(f.end) > new Date(f.start));
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={entry.id ? 'Edit time entry' : 'Add time entry'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!valid}
            onClick={() => {
              saveTimeEntry(f);
              onClose();
            }}
          >
            Save
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {!entry.id && (
          <Segmented
            size="sm"
            value={f.kind}
            onChange={(kind) => setF({ ...f, kind })}
            options={[
              { value: 'shift', label: 'Shift' },
              { value: 'job', label: 'Job time' },
            ]}
          />
        )}
        <Field label="Start">{(id) => <input id={id} type="datetime-local" className="input" value={toLocal(f.start)} onChange={(e) => setF({ ...f, start: new Date(e.target.value).toISOString() })} />}</Field>
        <Field label="End" hint="Leave empty if still running">{(id) => <input id={id} type="datetime-local" className="input" value={toLocal(f.end)} onChange={(e) => setF({ ...f, end: e.target.value ? new Date(e.target.value).toISOString() : null })} />}</Field>
      </div>
    </Modal>
  );
}

function Pay({ from, to }) {
  const { state, updateShop } = useShop();
  const { toast } = useUI();
  const { user } = useAccess();
  const [editing, setEditing] = useState(false);
  const settings = payrollSettings(state.shop);
  const rows = useMemo(() => payrollRows(state, from, to), [state, from, to]);
  const total = rows.reduce((s, r) => s + r.gross, 0);
  const key = periodKey(from);
  const approved = settings.approved?.[key];
  const download = (text, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`${name} downloaded`, { tone: 'success' });
  };
  const stamp = `${isoDate(from)}-to-${isoDate(addDays(to, -1))}`;
  const approve = () => {
    updateShop({ payroll: { ...settings, approved: { ...(settings.approved || {}), [key]: approved ? undefined : { at: new Date().toISOString(), by: user?.name || 'Owner', gross: Math.round(total * 100) / 100 } } } });
    toast(approved ? 'Approval removed' : 'Pay period approved', { tone: 'success' });
  };
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Gross pay"
          subtitle={`${money(total)} for ${dateShort(from)} – ${dateShort(addDays(to, -1))} · ${PAY_PERIODS[settings.period]?.toLowerCase()} pay, overtime over ${settings.overtimeWeekly || '—'} h/week${settings.overtimeDaily ? ` or ${settings.overtimeDaily} h/day` : ''}`}
          actions={
            <>
              <button className="btn-plain btn-sm" onClick={() => setEditing(true)}><Settings2 size={13} /> Settings</button>
              <Link to={`/team/timecards?from=${isoDate(from)}&to=${isoDate(to)}`} className="btn-secondary btn-sm"><Printer size={13} /> Timecards</Link>
              <button className="btn-secondary btn-sm" onClick={() => download(hoursImportCsv(rows), `payroll-hours-${stamp}.csv`)}><Download size={13} /> Hours import</button>
              <button className="btn-secondary btn-sm" onClick={() => download(payrollCsv(rows, from, to), `payroll-${stamp}.csv`)}><Download size={13} /> Payroll CSV</button>
            </>
          }
        />
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Technician</th>
                <th>Pay</th>
                <th className="text-right">Regular</th>
                <th className="text-right">Overtime</th>
                <th className="hidden text-right md:table-cell">Flagged</th>
                <th className="text-right">Base pay</th>
                <th className="text-right">Commission</th>
                <th className="text-right">Gross</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.tech.id}>
                  <td>
                    <div className="font-medium">{r.tech.name}</div>
                    {r.tech.payrollId && <div className="text-xs text-ink-3">ID {r.tech.payrollId}</div>}
                  </td>
                  <td className="whitespace-nowrap text-ink-2">
                    {r.flat ? 'Flat rate' : 'Hourly'} {money(r.rate)}/hr
                    {(r.tech.laborCommissionPct > 0 || r.tech.partsCommissionPct > 0) && (
                      <span className="block text-xs text-ink-3">
                        +{r.tech.laborCommissionPct || 0}% labor{r.tech.partsCommissionPct ? `, ${r.tech.partsCommissionPct}% parts` : ''}
                      </span>
                    )}
                  </td>
                  <td className="tabular text-right">{(r.flat ? r.flagged : r.regular).toFixed(2)}</td>
                  <td className={`tabular text-right ${r.overtime > 0 && !r.flat ? 'font-medium text-warn' : 'text-ink-3'}`}>{r.flat ? '—' : r.overtime.toFixed(2)}</td>
                  <td className="tabular hidden text-right text-ink-2 md:table-cell">{r.flagged.toFixed(1)}</td>
                  <td className="tabular text-right">{money(r.regularPay + r.overtimePay)}</td>
                  <td className="tabular text-right">{money(r.commission)}</td>
                  <td className="tabular text-right font-semibold">{money(r.gross)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 px-4 py-3">
          <p className="max-w-2xl text-xs text-ink-3">
            Hourly techs: clock hours, overtime at {settings.otMultiplier}× by workweek. Flat-rate techs: flagged hours on work invoiced in the period (check your state’s minimum-wage and overtime rules for flat-rate pay). Commission is on labor and parts sales invoiced in the period. <b>Hours import</b> is the simple spreadsheet most payroll services (Gusto, ADP, Paychex, QuickBooks Payroll) take — match its columns on your provider’s import screen; set each tech’s payroll employee ID under Technicians.
          </p>
          <button className={approved ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'} onClick={approve}>
            <CircleCheck size={13} /> {approved ? `Approved by ${approved.by} · ${dateShort(approved.at)}` : 'Approve this period'}
          </button>
        </div>
      </Card>
      {editing && <PayrollSettings settings={settings} onSave={(patch) => updateShop({ payroll: { ...settings, ...patch } })} onClose={() => setEditing(false)} />}
    </div>
  );
}

function PayrollSettings({ settings, onSave, onClose }) {
  const [f, setF] = useState(() => ({ ...settings, overtimeDaily: settings.overtimeDaily ?? '' }));
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const num = (v) => (Number(v) > 0 ? Number(v) : null);
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title="Payroll settings"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => {
              onSave({ period: f.period, anchor: f.anchor, weekStart: Number(f.weekStart), overtimeWeekly: num(f.overtimeWeekly), overtimeDaily: num(f.overtimeDaily), otMultiplier: Number(f.otMultiplier) || 1.5 });
              onClose();
            }}
          >
            Save
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pay period" className="col-span-2">
          {(id) => (
            <select id={id} className="input" value={f.period} onChange={set('period')}>
              {Object.entries(PAY_PERIODS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          )}
        </Field>
        {(f.period === 'weekly' || f.period === 'biweekly') && (
          <Field label="A period starts on" className="col-span-2" hint="Any first day of a pay period — later periods follow from it">{(id) => <input id={id} type="date" className="input" value={f.anchor} onChange={set('anchor')} />}</Field>
        )}
        <Field label="Workweek starts">
          {(id) => (
            <select id={id} className="input" value={f.weekStart} onChange={set('weekStart')}>
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Overtime rate (×)">{(id) => <input id={id} inputMode="decimal" className="input" value={f.otMultiplier} onChange={set('otMultiplier')} />}</Field>
        <Field label="Overtime after (hours / week)">{(id) => <input id={id} inputMode="decimal" className="input" value={f.overtimeWeekly ?? ''} onChange={set('overtimeWeekly')} />}</Field>
        <Field label="…or (hours / day)" hint="Leave blank unless your state has daily overtime">{(id) => <input id={id} inputMode="decimal" className="input" value={f.overtimeDaily} onChange={set('overtimeDaily')} />}</Field>
      </div>
    </Modal>
  );
}

function People() {
  const { state } = useShop();
  const [editing, setEditing] = useState(null);
  return (
    <>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={() => setEditing({ name: '', role: '', certs: '', payType: 'hourly', payRate: 30, laborCommissionPct: 0, partsCommissionPct: 0, active: true, phone: '', email: '' })}>
          <Plus size={16} strokeWidth={2.2} /> Add team member
        </button>
      </div>
      <Card>
        {state.technicians.length === 0 ? (
          <EmptyState icon={Users} title="No team members yet" />
        ) : (
          <ul className="divide-y divide-line/70">
            {state.technicians.map((t) => (
              <li key={t.id} className={`flex items-center gap-3 px-4 py-3 ${t.active === false ? 'opacity-60' : ''}`}>
                <Avatar name={t.name} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {t.name}
                    {t.active === false && <span className="ml-2 text-xs text-ink-3">Inactive</span>}
                  </div>
                  <div className="truncate text-xs text-ink-3">{[t.role, t.certs].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="hidden text-right text-sm sm:block">
                  <div>
                    {t.payType === 'flat' ? 'Flat rate' : 'Hourly'} · {money(t.payRate)}/hr
                  </div>
                  {(t.laborCommissionPct > 0 || t.partsCommissionPct > 0) && (
                    <div className="text-xs text-ink-3">
                      {t.laborCommissionPct || 0}% labor · {t.partsCommissionPct || 0}% parts commission
                    </div>
                  )}
                </div>
                <button className="btn-ghost btn-icon h-8 w-8" onClick={() => setEditing(t)} aria-label={`Edit ${t.name}`}>
                  <Pencil size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {editing && <MemberForm initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function MemberForm({ initial, onClose }) {
  const { saveTechnician } = useShop();
  const { toast } = useUI();
  const [f, setF] = useState(initial);
  const set = (k, num) => (e) => setF({ ...f, [k]: num ? Number(e.target.value) || 0 : e.target.value });
  return (
    <Modal
      open
      onClose={onClose}
      title={initial.id ? `Edit ${initial.name}` : 'Add team member'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!f.name.trim()}
            onClick={() => {
              saveTechnician({ ...f, name: f.name.trim() });
              toast(initial.id ? 'Saved' : `${f.name} added`, { tone: 'success' });
              onClose();
            }}
          >
            Save
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">{(id) => <input id={id} autoFocus className="input" value={f.name} onChange={set('name')} />}</Field>
        <Field label="Role">{(id) => <input id={id} className="input" value={f.role || ''} onChange={set('role')} />}</Field>
        <Field label="Certifications">{(id) => <input id={id} className="input" value={f.certs || ''} onChange={set('certs')} />}</Field>
        <Field label="Mobile">{(id) => <input id={id} className="input" value={f.phone || ''} onChange={set('phone')} />}</Field>
        <Field label="Email">{(id) => <input id={id} type="email" className="input" value={f.email || ''} onChange={set('email')} />}</Field>
        <div className="sm:col-span-2">
          <span className="field-label">Pay plan</span>
          <Segmented
            size="sm"
            value={f.payType || 'hourly'}
            onChange={(payType) => setF({ ...f, payType })}
            options={[
              { value: 'hourly', label: 'Hourly (clock hours)' },
              { value: 'flat', label: 'Flat rate (flagged hours)' },
            ]}
          />
        </div>
        <Field label={f.payType === 'flat' ? 'Rate per flagged hour ($)' : 'Hourly rate ($)'}>{(id) => <input id={id} inputMode="decimal" className="input" value={f.payRate} onChange={set('payRate', true)} />}</Field>
        <Field label="Payroll employee ID" hint="As it appears in your payroll service">{(id) => <input id={id} className="input" value={f.payrollId || ''} onChange={set('payrollId')} />}</Field>
        <Field label="Labor commission (%)">{(id) => <input id={id} inputMode="decimal" className="input" value={f.laborCommissionPct || 0} onChange={set('laborCommissionPct', true)} />}</Field>
        <Field label="Parts commission (%)">{(id) => <input id={id} inputMode="decimal" className="input" value={f.partsCommissionPct || 0} onChange={set('partsCommissionPct', true)} />}</Field>
        <label className="flex items-center justify-between gap-3 rounded-[8px] border border-line px-3 py-2 text-sm sm:col-span-2">
          Active — appears in assignments and the tech view
          <Toggle checked={f.active !== false} onChange={(active) => setF({ ...f, active })} label="Active" />
        </label>
      </div>
    </Modal>
  );
}
