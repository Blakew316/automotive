import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, CalendarPlus, ArrowRight, Clock, Package, FileText, Receipt, CircleAlert, CalendarDays, Globe, MessageSquare, Truck, Timer } from 'lucide-react';
import { useShop, useLookup, useTotals } from '../store/hooks';
import { PageHeader, Card, CardHeader, StatusLabel, Avatar, EmptyState, Dot } from '../components/ui';
import { ColumnChart } from '../components/charts';
import { AppointmentForm } from '../components/forms';
import { money, money0, moneyShort, fullName, vehicleName, time, relTime, sameDay, startOfDay, addDays, dateShort, weekday } from '../lib/format';
import { STATUSES, WIP_STATUSES } from '../lib/workflow';
import { openShift, runningJob, entryMs, fmtDuration, useNow } from '../lib/time';

export default function Dashboard() {
  const { state } = useShop();
  const lookup = useLookup();
  const totals = useTotals();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(false);
  const now = useMemo(() => new Date(), []);

  const data = useMemo(() => {
    const orders = state.orders;
    const wip = orders.filter((o) => WIP_STATUSES.includes(o.status));
    const estimates = orders.filter((o) => o.status === 'estimate');
    const ready = orders.filter((o) => o.status === 'ready');
    const invoicedToday = orders.filter((o) => o.invoicedAt && sameDay(o.invoicedAt, now));
    const receivable = orders.filter((o) => (o.status === 'ready' || o.status === 'closed') && totals(o).balance > 0.004);
    const inShop = orders
      .filter((o) => ['approved', 'in_progress', 'waiting_parts', 'ready'].includes(o.status))
      .sort((a, b) => STATUSES.findIndex((s) => s.id === a.status) - STATUSES.findIndex((s) => s.id === b.status) || new Date(a.promisedAt || 0) - new Date(b.promisedAt || 0));

    const attention = [];
    orders.forEach((o) => {
      const v = lookup.vehicle.get(o.vehicleId);
      const name = `#${o.number} · ${v ? `${v.year} ${v.model}` : fullName(lookup.customer.get(o.customerId))}`;
      if (o.promisedAt && new Date(o.promisedAt) < now && WIP_STATUSES.includes(o.status)) attention.push({ id: `late-${o.id}`, icon: Clock, text: `${name} is past its promise time`, sub: `Promised ${time(o.promisedAt)}`, to: `/orders/${o.id}`, tone: 'bg-bad' });
      if (o.status === 'waiting_parts') attention.push({ id: `parts-${o.id}`, icon: Package, text: `${name} waiting on parts`, sub: o.notes[0]?.text, to: `/orders/${o.id}`, tone: 'bg-warn' });
      if (o.status === 'estimate' && now - new Date(o.createdAt) > 3 * 3600000) attention.push({ id: `est-${o.id}`, icon: FileText, text: `${name} estimate needs a follow-up`, sub: `Sent ${relTime(o.createdAt, now)} · ${money0(totals(o).total)}`, to: `/orders/${o.id}`, tone: 'bg-info' });
    });
    receivable.filter((o) => o.status === 'ready').forEach((o) => attention.push({ id: `bal-${o.id}`, icon: Receipt, text: `#${o.number} ready — ${money(totals(o).balance)} due`, sub: fullName(lookup.customer.get(o.customerId)), to: `/orders/${o.id}`, tone: 'bg-ok' }));
    const requests = state.bookingRequests.filter((b) => b.status === 'new');
    if (requests.length) attention.unshift({ id: 'book', icon: Globe, text: `${requests.length} online booking request${requests.length === 1 ? '' : 's'} to confirm`, sub: requests.map((b) => b.name).join(', '), to: '/calendar', tone: 'bg-accent' });
    const unread = state.messages.filter((m) => m.dir === 'in' && !m.read);
    if (unread.length) {
      const who = [...new Set(unread.map((m) => fullName(lookup.customer.get(m.customerId))))];
      attention.unshift({ id: 'msgs', icon: MessageSquare, text: `${unread.length} unread customer message${unread.length === 1 ? '' : 's'}`, sub: who.slice(0, 3).join(', '), to: unread.length && who.length === 1 ? `/messages/${unread[0].customerId}` : '/messages', tone: 'bg-accent' });
    }
    state.purchaseOrders
      .filter((po) => (po.status === 'ordered' || po.status === 'partial') && po.expectedAt && new Date(po.expectedAt) < addDays(startOfDay(now), 1))
      .forEach((po) => attention.push({ id: `po-${po.id}`, icon: Truck, text: `PO #${po.number} from ${po.vendor} ${new Date(po.expectedAt) < startOfDay(now) ? 'is overdue' : 'arrives today'}`, sub: `${po.lines.length} line${po.lines.length === 1 ? '' : 's'} — receive it when it lands`, to: '/parts?tab=orders', tone: 'bg-warn' }));
    const low = state.inventory.filter((p) => Number(p.qty) <= Number(p.min));
    if (low.length) attention.push({ id: 'low', icon: Package, text: `${low.length} inventory items at or below minimum`, sub: low.slice(0, 3).map((p) => p.partNumber || p.description).join(', '), to: '/parts?tab=inventory&filter=low', tone: 'bg-warn' });

    const days = Array.from({ length: 14 }, (_, i) => startOfDay(addDays(now, i - 13)));
    const revenue = days.map((d) => ({
      key: d.toISOString(),
      label: `${weekday(d)}, ${dateShort(d)}`,
      short: dateShort(d).split(' ')[1],
      value: orders.filter((o) => o.invoicedAt && sameDay(o.invoicedAt, d)).reduce((s, o) => s + totals(o).total, 0),
    }));

    return {
      wip,
      estimates,
      ready,
      inShop,
      attention,
      revenue,
      billedToday: invoicedToday.reduce((s, o) => s + totals(o).total, 0),
      invoicedTodayCount: invoicedToday.length,
      estimateValue: estimates.reduce((s, o) => s + totals(o).total, 0),
      readyBalance: ready.reduce((s, o) => s + totals(o).balance, 0),
      receivableTotal: receivable.reduce((s, o) => s + totals(o).balance, 0),
      receivableCount: receivable.length,
    };
  }, [state.orders, state.inventory, state.bookingRequests, state.messages, state.purchaseOrders, lookup, totals, now]);

  const appointments = state.appointments.filter((a) => sameDay(a.start, now)).sort((a, b) => new Date(a.start) - new Date(b.start));
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const fortnight = data.revenue.reduce((s, d) => s + d.value, 0);

  return (
    <>
      <PageHeader
        eyebrow={now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        title={greeting}
        actions={
          <>
            <button className="btn-secondary" onClick={() => setBooking(true)}>
              <CalendarPlus size={15} /> Book appointment
            </button>
            <Link to="/orders/new" className="btn-primary">
              <Plus size={16} strokeWidth={2.2} /> New repair order
            </Link>
          </>
        }
      />

      <Card className="mb-6 grid grid-cols-2 divide-line p-1 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
        <Stat label="In the shop" value={data.wip.length} sub={`${appointments.length} appointments today`} to="/workflow" />
        <Stat label="Billed today" value={money0(data.billedToday)} sub={`${data.invoicedTodayCount} invoice${data.invoicedTodayCount === 1 ? '' : 's'}`} to="/orders?status=ready" />
        <Stat label="Awaiting approval" value={money0(data.estimateValue)} sub={`${data.estimates.length} open estimates`} to="/orders?status=estimate" />
        <Stat label="Ready for pickup" value={data.ready.length} sub={`${money0(data.readyBalance)} to collect`} to="/orders?status=ready" />
        <Stat label="Receivables" value={money0(data.receivableTotal)} sub={`${data.receivableCount} unpaid`} to="/reports" />
      </Card>

      <div className="grid gap-6 min-[1420px]:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="In the shop"
              subtitle={`${data.inShop.length} vehicles on the lot`}
              actions={
                <Link to="/workflow" className="btn-plain btn-sm">
                  Workflow <ArrowRight size={13} />
                </Link>
              }
            />
            {data.inShop.length === 0 ? (
              <EmptyState icon={SquareIcon} title="No vehicles in the shop" body="Approved repair orders will show up here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table [&_td:first-child]:pl-4 [&_td]:px-3 [&_th:first-child]:pl-4 [&_th]:px-3">
                  <thead>
                    <tr>
                      <th>Repair order</th>
                      <th>Vehicle</th>
                      <th className="hidden md:table-cell">Tech</th>
                      <th>Status</th>
                      <th className="hidden sm:table-cell">Promised</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.inShop.map((o) => {
                      const c = lookup.customer.get(o.customerId);
                      const v = lookup.vehicle.get(o.vehicleId);
                      const tech = lookup.tech.get(o.techId);
                      const late = o.promisedAt && new Date(o.promisedAt) < now && WIP_STATUSES.includes(o.status);
                      return (
                        <tr key={o.id} className="row-link" onClick={() => navigate(`/orders/${o.id}`)}>
                          <td className="whitespace-nowrap">
                            <div className="font-medium">#{o.number}</div>
                            <div className="text-xs text-ink-3">{fullName(c)}</div>
                          </td>
                          <td>
                            <div className="max-w-[180px] truncate">{vehicleName(v)}</div>
                            <div className="max-w-[180px] truncate text-xs text-ink-3">{o.concern || o.services[0]?.title}</div>
                          </td>
                          <td className="hidden md:table-cell">
                            {tech ? <Avatar name={tech.name} size={24} /> : <span className="text-ink-4">—</span>}
                          </td>
                          <td><StatusLabel status={o.status} /></td>
                          <td className={`hidden whitespace-nowrap sm:table-cell ${late ? 'text-bad' : 'text-ink-2'}`}>
                            {o.promisedAt ? (
                              <>
                                <div>{time(o.promisedAt)}</div>
                                <div className="text-xs text-ink-3">{sameDay(o.promisedAt, now) ? 'Today' : dateShort(o.promisedAt)}</div>
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="tabular text-right font-medium">{money(totals(o).total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Today’s appointments"
              subtitle={`${appointments.length} scheduled`}
              actions={
                <Link to="/calendar" className="btn-plain btn-sm">
                  Calendar <ArrowRight size={13} />
                </Link>
              }
            />
            {appointments.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Nothing on the books today" action={<button className="btn-secondary btn-sm" onClick={() => setBooking(true)}>Book appointment</button>} />
            ) : (
              <ul className="divide-y divide-line/70">
                {appointments.map((a) => {
                  const c = lookup.customer.get(a.customerId);
                  const v = lookup.vehicle.get(a.vehicleId);
                  const linked = a.orderId && lookup.order.get(a.orderId);
                  return (
                    <li key={a.id} className="flex items-center gap-4 px-4 py-3">
                      <div className="tabular w-16 shrink-0 text-sm font-medium text-ink">{time(a.start)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {fullName(c)} <span className="font-normal text-ink-3">· {vehicleName(v)}</span>
                        </div>
                        <div className="truncate text-xs text-ink-3">{a.title}</div>
                      </div>
                      {linked ? (
                        <Link to={`/orders/${linked.id}`} className="btn-ghost btn-sm">
                          <Dot className="bg-ok" size={6} /> RO #{linked.number}
                        </Link>
                      ) : a.status === 'arrived' ? (
                        <Link to={`/orders/new?appointment=${a.id}`} className="btn-secondary btn-sm">Start RO</Link>
                      ) : (
                        <Link to={`/orders/new?appointment=${a.id}`} className="btn-outline btn-sm">Check in</Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid min-w-0 content-start gap-6 md:grid-cols-2 min-[1420px]:grid-cols-1">
          <Card>
            <CardHeader title="Needs attention" subtitle={data.attention.length ? `${data.attention.length} items` : 'All clear'} />
            {data.attention.length === 0 ? (
              <EmptyState icon={CircleAlert} title="You’re all caught up" />
            ) : (
              <ul className="divide-y divide-line/70">
                {data.attention.slice(0, 8).map((a) => (
                  <li key={a.id}>
                    <Link to={a.to} className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-fill/[0.05]">
                      <span className="relative mt-0.5 shrink-0">
                        <a.icon size={16} strokeWidth={1.8} className="text-ink-3" />
                        <span className={`absolute -right-0.5 -top-0.5 h-[7px] w-[7px] rounded-full ring-2 ring-surface ${a.tone}`} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm text-ink">{a.text}</span>
                        {a.sub && <span className="block truncate text-xs text-ink-3">{a.sub}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <OnTheClock />

          <Card>
            <CardHeader
              title="Invoiced, last 14 days"
              subtitle={`${money0(fortnight)} total`}
              actions={
                <Link to="/reports" className="btn-plain btn-sm">
                  Reports <ArrowRight size={13} />
                </Link>
              }
            />
            <div className="px-3 pb-2 pt-3">
              <ColumnChart data={data.revenue} height={170} format={money0} tickFormat={moneyShort} label="Invoiced revenue per day, last 14 days" highlight={(_, i) => i === data.revenue.length - 1} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Activity" />
            <ul className="px-4 py-2">
              {state.activity.slice(0, 7).map((a) => (
                <li key={a.id} className="flex gap-3 py-1.5">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-4" />
                  <span className="min-w-0 flex-1 text-sm text-ink-2">{a.text}</span>
                  <span className="shrink-0 text-xs text-ink-4">{relTime(a.at, now)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {booking && <AppointmentForm open onClose={() => setBooking(false)} />}
    </>
  );
}

function Stat({ label, value, sub, to }) {
  return (
    <Link to={to} className="block rounded-[10px] px-4 py-3.5 transition-colors hover:bg-fill/[0.05]">
      <div className="text-sm text-ink-2">{label}</div>
      <div className="mt-1 text-[26px] font-semibold leading-8 tracking-tight text-ink">{value}</div>
      <div className="mt-0.5 truncate text-xs text-ink-3">{sub}</div>
    </Link>
  );
}

/** Who's clocked in and what they're working on right now. */
function OnTheClock() {
  const { state } = useShop();
  const lookup = useLookup();
  const now = useNow(30000);
  const techs = state.technicians.filter((t) => t.active !== false);
  const rows = techs.map((t) => {
    const shift = openShift(state.timeEntries, t.id);
    const job = runningJob(state.timeEntries, t.id);
    const order = job && lookup.order.get(job.orderId);
    return { t, shift, job, order, service: order?.services.find((s) => s.id === job.serviceId) };
  });
  const clocked = rows.filter((r) => r.shift).length;
  return (
    <Card>
      <CardHeader
        title="On the clock"
        subtitle={`${clocked} of ${techs.length} technicians in`}
        actions={
          <Link to="/team" className="btn-plain btn-sm">
            Team <ArrowRight size={13} />
          </Link>
        }
      />
      <ul className="divide-y divide-line/70">
        {rows.map(({ t, shift, job, order, service }) => (
          <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="relative">
              <Avatar name={t.name} size={30} />
              <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface ${job ? 'bg-ok' : shift ? 'bg-warn' : 'bg-ink-4'}`} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{t.name}</div>
              <div className="truncate text-xs text-ink-3">
                {job && order ? (
                  <Link to={`/orders/${order.id}`} className="hover:text-ink">
                    {service?.title || 'Job'} · RO #{order.number}
                  </Link>
                ) : shift ? (
                  'Clocked in — no job running'
                ) : (
                  'Off the clock'
                )}
              </div>
            </div>
            {job ? (
              <span className="tabular flex items-center gap-1 text-xs text-ok">
                <Timer size={12} /> {fmtDuration(entryMs(job, now))}
              </span>
            ) : shift ? (
              <span className="tabular text-xs text-ink-3">since {time(shift.start)}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SquareIcon(props) {
  return <Package {...props} />;
}
