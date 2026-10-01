// Panels on a business account's customer page: account terms, contacts, maintenance plans, the
// units with their PM status, open invoices with aging, and the fleet portal link.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Printer, Mail, HandCoins, Link2, MessageSquare, Power, Truck, Search } from 'lucide-react';
import { useShop, useUI, useSync } from '../../store/hooks';
import { Card, CardHeader, Modal, Field, EmptyState, StatusLabel, CopyButton, KV, Segmented, Spinner } from '../../components/ui';
import AgingBar from '../../components/AgingBar';
import ComposeModal from '../../components/Compose';
import ReceivePayment from './ReceivePayment';
import { termsLabel, PM_PRESETS, accountPayments, statementText } from '../../lib/accounts';
import { newPortalId, portalLink, portalPayload, portalFingerprint, publishPortal, revokePortal } from '../../lib/fleetPortal';
import { money, money0, dateShort, number, vehicleName, phone as fmtPhone, telHref, mailHref, uid, isoDate, relTime } from '../../lib/format';

const PM_TONE = { overdue: 'text-bad', due: 'text-warn', ok: 'text-ok', unknown: 'text-ink-3' };
const PM_DOT = { overdue: 'bg-bad', due: 'bg-warn', ok: 'bg-ok', unknown: 'bg-ink-4' };
const PM_WORD = { overdue: 'Overdue', due: 'Due soon', ok: 'OK', unknown: 'No record' };
const interval = (p) => [p.miles && `${number(p.miles)} mi`, p.months && `${p.months} month${Number(p.months) === 1 ? '' : 's'}`].filter(Boolean).join(' or ') || 'No interval';

/** Terms, credit, PO and tax settings at a glance. */
export function AccountCard({ customer, summary, onEdit }) {
  const a = customer.account;
  const used = summary.creditLimit ? Math.min(1, summary.balance / summary.creditLimit) : 0;
  return (
    <Card>
      <CardHeader title="Business account" subtitle={customer.company} actions={<button className="btn-plain btn-sm" onClick={onEdit}><Pencil size={13} /> Edit</button>} />
      <dl className="divide-y divide-line/70 px-4 py-1">
        <KV label="Terms">{termsLabel(a.terms)}</KV>
        <KV label="Credit limit">
          {summary.creditLimit ? (
            <span className="block">
              {money0(summary.creditLimit)}
              <span className="mt-1 block h-1.5 w-28 overflow-hidden rounded-full bg-fill/[0.1]" role="img" aria-label={`${Math.round(used * 100)}% used`}>
                <span className={`block h-full rounded-full ${used >= 1 ? 'bg-bad' : used >= 0.8 ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${Math.max(2, used * 100)}%` }} />
              </span>
            </span>
          ) : (
            'No limit'
          )}
        </KV>
        <KV label="Pre-approved up to">{a.preApproved ? money0(a.preApproved) : 'Call for every repair'}</KV>
        <KV label="PO numbers">{a.poRequired ? 'Required' : 'Optional'}</KV>
        <KV label="Sales tax">{a.taxExempt ? `Exempt${a.taxId ? ` · ${a.taxId}` : ''}` : 'Taxable'}</KV>
        <KV label="Billing email">{a.billingEmail ? <a href={mailHref(a.billingEmail)} className="link break-all">{a.billingEmail}</a> : '—'}</KV>
      </dl>
    </Card>
  );
}

function ContactModal({ initial, onSave, onClose }) {
  const [f, setF] = useState(() => ({ name: '', role: '', phone: '', email: '', ...initial }));
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={initial?.id ? 'Edit contact' : 'Add contact'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!f.name.trim()} onClick={() => onSave({ ...f, name: f.name.trim(), id: f.id || uid('ct') })}>Save</button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Name">{(id) => <input id={id} className="input" value={f.name} onChange={set('name')} autoFocus />}</Field>
        <Field label="Role" hint="e.g. Fleet manager, Accounts payable, Driver">{(id) => <input id={id} className="input" value={f.role} onChange={set('role')} />}</Field>
        <Field label="Phone">{(id) => <input id={id} type="tel" className="input" value={f.phone} onChange={set('phone')} />}</Field>
        <Field label="Email">{(id) => <input id={id} type="email" className="input" value={f.email} onChange={set('email')} />}</Field>
      </div>
    </Modal>
  );
}

/** People at the company: fleet manager, accounts payable, drivers. */
export function ContactsCard({ customer }) {
  const { saveAccount } = useShop();
  const [editing, setEditing] = useState(null);
  const contacts = customer.account.contacts || [];
  const save = (c) => {
    saveAccount(customer.id, { contacts: contacts.some((x) => x.id === c.id) ? contacts.map((x) => (x.id === c.id ? c : x)) : [...contacts, c] });
    setEditing(null);
  };
  return (
    <Card>
      <CardHeader title="Contacts" subtitle={`${contacts.length + 1} people`} actions={<button className="btn-plain btn-sm" onClick={() => setEditing({})}><Plus size={14} /> Add</button>} />
      <ul className="divide-y divide-line/70">
        <li className="px-4 py-2.5 text-sm">
          <div className="font-medium">{[customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Main contact'} <span className="font-normal text-ink-3">· primary</span></div>
          <div className="text-xs text-ink-3">{[customer.phone && fmtPhone(customer.phone), customer.email].filter(Boolean).join(' · ')}</div>
        </li>
        {contacts.map((c) => (
          <li key={c.id} className="group flex items-start gap-2 px-4 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{c.name}{c.role && <span className="font-normal text-ink-3"> · {c.role}</span>}</div>
              <div className="flex flex-wrap gap-x-2 text-xs">
                {c.phone && <a href={telHref(c.phone)} className="link">{fmtPhone(c.phone)}</a>}
                {c.email && <a href={mailHref(c.email)} className="link break-all">{c.email}</a>}
              </div>
            </div>
            <button className="btn-ghost btn-icon h-7 w-7" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}><Pencil size={13} /></button>
            <button className="btn-ghost btn-icon h-7 w-7 text-ink-3 hover:text-bad" onClick={() => saveAccount(customer.id, { contacts: contacts.filter((x) => x.id !== c.id) })} aria-label={`Remove ${c.name}`}><Trash2 size={13} /></button>
          </li>
        ))}
      </ul>
      {editing && <ContactModal initial={editing} onSave={save} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function PlanModal({ initial, onSave, onClose }) {
  const { state } = useShop();
  const [f, setF] = useState(() => ({ label: '', miles: '', months: '', jobId: '', ...initial }));
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const num = (v) => (Number(String(v).replace(/[^0-9]/g, '')) > 0 ? Number(String(v).replace(/[^0-9]/g, '')) : null);
  const ok = f.label.trim() && (num(f.miles) || num(f.months));
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={initial?.id ? 'Edit maintenance plan' : 'Add maintenance plan'}
      subtitle="Due by whichever comes first."
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!ok} onClick={() => onSave({ id: f.id || uid('pm'), label: f.label.trim(), miles: num(f.miles), months: num(f.months), jobId: f.jobId || null })}>Save</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" className="col-span-2">{(id) => <input id={id} className="input" placeholder="e.g. Oil & filter service" value={f.label} onChange={set('label')} autoFocus />}</Field>
        <Field label="Every (miles)">{(id) => <input id={id} inputMode="numeric" className="input tabular" placeholder="5,000" value={f.miles ?? ''} onChange={set('miles')} />}</Field>
        <Field label="Or every (months)">{(id) => <input id={id} inputMode="numeric" className="input tabular" placeholder="6" value={f.months ?? ''} onChange={set('months')} />}</Field>
        <Field label="Canned job" className="col-span-2" hint="Repair orders with this job count as the PM being done, and new ROs for a due unit start with it.">
          {(id) => (
            <select id={id} className="input" value={f.jobId || ''} onChange={set('jobId')}>
              <option value="">None — match by name</option>
              {state.cannedJobs.map((j) => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
          )}
        </Field>
      </div>
    </Modal>
  );
}

/** The account's preventive-maintenance program. */
export function PmPlansCard({ customer }) {
  const { state, saveAccount } = useShop();
  const [editing, setEditing] = useState(null);
  const plans = customer.account.pmPlans || [];
  const save = (p) => {
    saveAccount(customer.id, { pmPlans: plans.some((x) => x.id === p.id) ? plans.map((x) => (x.id === p.id ? p : x)) : [...plans, p] });
    setEditing(null);
  };
  const addPresets = () => saveAccount(customer.id, { pmPlans: [...plans, ...PM_PRESETS.filter((p) => state.cannedJobs.some((j) => j.id === p.jobId) || !p.jobId).map((p) => ({ ...p, id: uid('pm') }))] });
  return (
    <Card>
      <CardHeader title="Maintenance plans" subtitle="Applied to every unit on the account" actions={<button className="btn-plain btn-sm" onClick={() => setEditing({})}><Plus size={14} /> Add plan</button>} />
      {plans.length === 0 ? (
        <div className="px-4 py-4 text-sm text-ink-2">
          No plans yet. Fleets usually track oil service, tire rotation and an annual inspection.
          <button className="btn-secondary btn-sm mt-3 flex" onClick={addPresets}>
            <Plus size={14} /> Add oil, rotation & annual inspection
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-line/70">
          {plans.map((p) => {
            const job = state.cannedJobs.find((j) => j.id === p.jobId);
            return (
              <li key={p.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{p.label}</div>
                  <div className="text-xs text-ink-3">Every {interval(p)}{job ? ` · ${job.title}` : ''}</div>
                </div>
                <button className="btn-ghost btn-icon h-7 w-7" onClick={() => setEditing(p)} aria-label={`Edit ${p.label}`}><Pencil size={13} /></button>
                <button className="btn-ghost btn-icon h-7 w-7 text-ink-3 hover:text-bad" onClick={() => saveAccount(customer.id, { pmPlans: plans.filter((x) => x.id !== p.id) })} aria-label={`Remove ${p.label}`}><Trash2 size={13} /></button>
              </li>
            );
          })}
        </ul>
      )}
      {editing && <PlanModal initial={editing} onSave={save} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function PmDoneModal({ vehicle, pm, onClose }) {
  const { recordPm } = useShop();
  const { toast } = useUI();
  const [day, setDay] = useState(isoDate(new Date()));
  const [miles, setMiles] = useState(String(vehicle.mileage || ''));
  const save = () => {
    const m = Number(String(miles).replace(/[^0-9]/g, '')) || null;
    recordPm(vehicle.id, pm.plan.id, { date: new Date(`${day}T12:00:00`).toISOString(), miles: m });
    toast(`${pm.plan.label} recorded for ${vehicle.unit ? `unit ${vehicle.unit}` : vehicleName(vehicle)}`, { tone: 'success' });
    onClose();
  };
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={pm.plan.label}
      subtitle={`${vehicle.unit ? `Unit ${vehicle.unit} · ` : ''}${vehicleName(vehicle)}`}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save}>Record as done</button>
        </>
      }
    >
      <p className="mb-3 text-sm text-ink-2">
        {pm.last ? `Last done ${dateShort(pm.last.date)}${pm.last.miles ? ` at ${number(pm.last.miles)} mi` : ''}${pm.last.ro ? ` (RO #${pm.last.ro})` : pm.last.manual ? ' (recorded by hand)' : ''}.` : 'No record of this service here yet.'} Work done at this shop is picked up from repair orders automatically — record it here only if it was done elsewhere.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date done">{(id) => <input id={id} type="date" className="input" value={day} max={isoDate(new Date())} onChange={(e) => setDay(e.target.value || isoDate(new Date()))} />}</Field>
        <Field label="Odometer">{(id) => <input id={id} inputMode="numeric" className="input tabular" value={miles} onChange={(e) => setMiles(e.target.value)} />}</Field>
      </div>
    </Modal>
  );
}

/** Every unit with its maintenance status and what's in the shop now. */
export function UnitsCard({ customer, summary, onAddUnit }) {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [marking, setMarking] = useState(null);
  const plans = customer.account.pmPlans || [];
  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return summary.units.filter((u) => {
      if (filter === 'pm' && !['overdue', 'due'].includes(u.worst)) return false;
      if (filter === 'shop' && !u.openOrder) return false;
      if (!query) return true;
      const v = u.vehicle;
      return `${v.unit || ''} ${v.plate || ''} ${v.vin || ''} ${vehicleName(v)} ${v.driver || ''}`.toLowerCase().includes(query);
    });
  }, [summary.units, filter, q]);
  const needPm = summary.pmOverdue + summary.pmDue;
  const inShop = summary.units.filter((u) => u.openOrder).length;

  return (
    <Card>
      <CardHeader
        title="Units"
        icon={Truck}
        subtitle={`${summary.units.length} vehicle${summary.units.length === 1 ? '' : 's'}${plans.length ? ` · ${summary.pmOverdue} overdue, ${summary.pmDue} due soon` : ''}`}
        actions={<button className="btn-plain btn-sm" onClick={onAddUnit}><Plus size={14} /> Add unit</button>}
      />
      {summary.units.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line/70 px-4 py-2.5">
          <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'pm', label: `Needs PM${needPm ? ` · ${needPm}` : ''}` }, { value: 'shop', label: `In shop${inShop ? ` · ${inShop}` : ''}` }]} />
          {summary.units.length > 6 && (
            <label className="relative ml-auto">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4" />
              <input className="input h-8 w-48 pl-8 text-sm" placeholder="Unit, plate, VIN, driver" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search units" />
            </label>
          )}
        </div>
      )}
      {summary.units.length === 0 ? (
        <EmptyState icon={Truck} title="No units yet" body="Add the company’s vehicles with their unit numbers." />
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-ink-3">No units match.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Unit</th>
                {plans.length > 0 && <th>Maintenance</th>}
                <th className="text-right">In shop</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ vehicle: v, pm, openOrder }) => {
                const due = pm.filter((p) => p.status === 'overdue' || p.status === 'due');
                const jobs = due.map((p) => p.plan.jobId).filter(Boolean);
                return (
                  <tr key={v.id}>
                    <td>
                      <Link to={`/vehicles/${v.id}`} className="block hover:underline">
                        <span className="font-medium">{v.unit ? `Unit ${v.unit}` : vehicleName(v)}</span>
                      </Link>
                      <div className="text-xs text-ink-3">{[v.unit && vehicleName(v), v.plate].filter(Boolean).join(' · ')}</div>
                      <div className="text-xs text-ink-3">{[v.mileage && `${number(v.mileage)} mi`, v.driver].filter(Boolean).join(' · ')}</div>
                    </td>
                    {plans.length > 0 && (
                      <td>
                        <ul className="space-y-0.5">
                          {pm.map((p) => (
                            <li key={p.plan.id}>
                              <button className="flex items-center gap-1.5 whitespace-nowrap text-left text-xs hover:underline" onClick={() => setMarking({ vehicle: v, pm: p })} title={`${p.plan.label}: ${PM_WORD[p.status]} — click to record it as done elsewhere`}>
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PM_DOT[p.status]}`} />
                                <span className="text-ink-2">{p.plan.label}</span>
                                <span className={PM_TONE[p.status]}>{p.status === 'unknown' ? PM_WORD.unknown : p.text}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </td>
                    )}
                    <td className="text-right">
                      {openOrder ? (
                        <Link to={`/orders/${openOrder.id}`} className="inline-flex flex-col items-end hover:underline">
                          <span className="tabular text-sm font-medium">RO #{openOrder.number}</span>
                          <StatusLabel status={openOrder.status} />
                        </Link>
                      ) : (
                        <Link to={`/orders/new?customer=${customer.id}&vehicle=${v.id}${jobs.length ? `&jobs=${jobs.join(',')}` : ''}${due.length ? `&concern=${encodeURIComponent(`Scheduled maintenance: ${due.map((p) => p.plan.label).join(', ')}`)}` : ''}`} className="btn-secondary btn-sm">
                          <Plus size={13} /> {due.length ? 'PM RO' : 'RO'}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {marking && <PmDoneModal vehicle={marking.vehicle} pm={marking.pm} onClose={() => setMarking(null)} />}
    </Card>
  );
}

/** Open invoices with aging, batch payments and statements. */
export function InvoicesCard({ customer, summary }) {
  const { state } = useShop();
  const [receiving, setReceiving] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const payments = useMemo(() => accountPayments(state, customer.id, 90), [state, customer.id]);
  const portal = customer.account.portal;
  const cfg = useSync()?.cfg;
  const portalUrl = portal?.id && !portal.off && cfg ? portalLink(cfg, portal.id) : '';
  const billTo = { ...customer, email: customer.account.billingEmail || customer.email };

  return (
    <Card>
      <CardHeader
        title="Invoices & payments"
        subtitle={summary.invoices.length ? `${summary.invoices.length} open · ${money(summary.balance)}` : 'Nothing owed'}
        actions={
          <>
            <Link to={`/customers/${customer.id}/statement`} className="btn-plain btn-sm"><Printer size={13} /> Statement</Link>
            <button className="btn-plain btn-sm" onClick={() => setEmailing(true)} disabled={!billTo.email}><Mail size={13} /> Email</button>
            {summary.invoices.length > 0 && <button className="btn-primary btn-sm" onClick={() => setReceiving(true)}><HandCoins size={13} /> Receive payment</button>}
          </>
        }
      />
      {summary.invoices.length > 0 && <AgingBar buckets={summary.aging} className="border-b border-line/70 px-4 py-4" />}
      {summary.invoices.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th className="hidden sm:table-cell">Unit</th>
                <th>Due</th>
                <th className="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {summary.invoices.map((i) => {
                const v = state.vehicles.find((x) => x.id === i.order.vehicleId);
                return (
                  <tr key={i.order.id}>
                    <td>
                      <Link to={`/orders/${i.order.id}`} className="tabular font-medium hover:underline">RO #{i.order.number}</Link>
                      <div className="text-xs text-ink-3">{dateShort(i.invoiced)}{i.order.po ? ` · PO ${i.order.po}` : ''}</div>
                    </td>
                    <td className="hidden max-w-[200px] truncate text-ink-2 sm:table-cell">{v ? (v.unit ? `Unit ${v.unit}` : vehicleName(v)) : '—'}</td>
                    <td className={`whitespace-nowrap ${i.pastDue > 0 ? 'text-bad' : 'text-ink-2'}`}>
                      {dateShort(i.due)}
                      {i.pastDue > 0 && <span className="block text-xs">{i.pastDue} days past due</span>}
                    </td>
                    <td className="tabular text-right font-medium">{money(i.balance)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="border-t border-line/70 px-4 py-3">
        <div className="section-label mb-1.5">Payments · last 90 days</div>
        {payments.length === 0 ? (
          <p className="text-sm text-ink-3">None recorded.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {payments.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0">
                  {dateShort(p.at)} · {p.method}{p.ref ? ` ${p.method === 'Check' ? '#' : ''}${p.ref}` : ''}
                  <span className="block truncate text-xs text-ink-3">RO {p.orders.map((n) => `#${n}`).join(', ')}</span>
                </span>
                <span className="tabular shrink-0 font-medium">{money(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {receiving && <ReceivePayment customer={customer} invoices={summary.invoices} onClose={() => setReceiving(false)} />}
      {emailing && (
        <ComposeModal
          customer={billTo}
          channel="email"
          subject={`Statement — ${customer.company} — ${state.shop.name}`}
          initialBody={statementText(state, customer, summary, { portalUrl })}
          onClose={() => setEmailing(false)}
        />
      )}
    </Card>
  );
}

/** Private link for the fleet manager: units, maintenance, open ROs, invoices and balance. */
export function PortalCard({ customer }) {
  const { state, saveAccount } = useShop();
  const { toast } = useUI();
  const sync = useSync();
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(null);
  const portal = customer.account.portal;
  const live = portal?.id && !portal.off;
  const url = live && sync?.cfg ? portalLink(sync.cfg, portal.id) : '';
  const manager = (customer.account.contacts || []).find((c) => /fleet|manager/i.test(c.role || '')) || null;

  const create = async () => {
    if (!sync?.staff) return toast('Sign in under Settings → Shop Cloud to share a fleet portal', { tone: 'error' });
    setBusy(true);
    try {
      const id = portal?.id || newPortalId();
      const now = new Date();
      await publishPortal(sync.cfg, id, portalPayload(state, customer, sync.cfg, now));
      saveAccount(customer.id, { portal: { id, off: false, fp: portalFingerprint(state, customer, sync.cfg, now), publishedAt: now.toISOString() } });
      toast('Fleet portal is live', { tone: 'success' });
    } catch (e) {
      toast(e.message || 'Couldn’t publish the portal', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  const stop = async () => {
    try {
      if (sync?.staff) await revokePortal(sync.cfg, portal.id);
      saveAccount(customer.id, { portal: { ...portal, off: true } });
      toast('Fleet portal turned off');
    } catch (e) {
      toast(e.message, { tone: 'error' });
    }
  };
  const body = `Hi${manager ? ` ${manager.name.split(' ')[0]}` : customer.firstName ? ` ${customer.firstName}` : ''}, here’s your fleet page from ${state.shop.name}: every unit’s maintenance schedule, what’s in the shop, open invoices and your balance. It stays up to date — bookmark it: ${url}`;

  return (
    <Card>
      <CardHeader title="Fleet portal" icon={Link2} subtitle={live ? `Updated ${portal.publishedAt ? relTime(portal.publishedAt) : 'just now'}` : 'Private link for the fleet manager'} />
      <div className="px-4 pb-4 text-sm">
        {live ? (
          <>
            <div className="flex items-center gap-1 rounded-[8px] border border-line bg-raised px-2 py-1.5">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-2">{url}</span>
              <CopyButton text={url} label="Copy portal link" className="h-7 w-7 px-0" />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button className="btn-secondary btn-sm" onClick={() => setSending('sms')} disabled={!(manager?.phone || customer.phone)}><MessageSquare size={13} /> Text</button>
              <button className="btn-secondary btn-sm" onClick={() => setSending('email')} disabled={!(manager?.email || customer.email)}><Mail size={13} /> Email</button>
              <a href={url} target="_blank" rel="noopener noreferrer" className="btn-plain btn-sm">Open</a>
              <button className="btn-plain btn-sm ml-auto text-ink-3" onClick={stop}><Power size={13} /> Turn off</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-ink-2">Units, maintenance due, what’s in the shop now, open invoices and the balance — on one page that updates itself. Nothing else from your shop is shared.</p>
            <button className="btn-primary btn-sm mt-3" onClick={create} disabled={busy}>
              {busy ? <Spinner size={13} /> : <Link2 size={13} />} {portal?.off ? 'Turn the portal back on' : 'Create portal link'}
            </button>
          </>
        )}
      </div>
      {sending && (
        <ComposeModal
          customer={{ ...customer, phone: manager?.phone || customer.phone, email: manager?.email || customer.email, firstName: manager?.name.split(' ')[0] || customer.firstName }}
          channel={sending}
          subject={`Your fleet page — ${state.shop.name}`}
          initialBody={body}
          onClose={() => setSending(null)}
        />
      )}
    </Card>
  );
}
