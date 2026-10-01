import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useShop, useTotals } from '../../store/hooks';
import { Card, CardHeader, EmptyState } from '../../components/ui';
import { RankBars, MixBar, StackedColumnChart } from '../../components/charts';
import { bookingChannels } from '../../lib/kpis';
import { teamSummary } from '../../lib/time';
import { serviceTotal } from '../../lib/pricing';
import { AUTH_METHODS } from '../../lib/authMethods';
import { money, money0, pct, fullName, number } from '../../lib/format';

function Kpis({ items }) {
  return (
    <Card className={`mb-6 grid grid-cols-2 divide-line p-1 md:grid-cols-3 lg:divide-x ${items.length > 4 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
      {items.map(([label, value, sub]) => (
        <div key={label} className="px-4 py-3.5">
          <div className="text-sm text-ink-2">{label}</div>
          <div className="mt-1 text-[24px] font-semibold leading-8 tracking-tight">{value}</div>
          <div className="mt-0.5 truncate text-xs text-ink-3">{sub}</div>
        </div>
      ))}
    </Card>
  );
}

export function TechReport({ from, to }) {
  const { state } = useShop();
  const rows = useMemo(() => teamSummary(state, from, to).filter((r) => r.tech.active !== false || r.jobs), [state, from, to]);
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  const flagged = sum('flagged');
  const jobH = sum('jobH');
  const shiftH = sum('shiftH');
  return (
    <>
      <Kpis
        items={[
          ['Hours flagged', flagged.toFixed(1), 'Billed labor on invoiced work'],
          ['Hours on jobs', jobH.toFixed(1), 'Clocked against repair orders'],
          ['Shop efficiency', jobH ? pct(flagged / jobH) : '—', 'Flagged ÷ clocked job hours'],
          ['Shop productivity', shiftH ? pct(jobH / shiftH) : '—', 'Job hours ÷ hours on the clock'],
          ['Labor sales', money0(sum('laborSales')), `${flagged ? money0(sum('laborSales') / flagged) : '—'} per flagged hour`],
        ]}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="By technician" actions={<Link to="/team?tab=time" className="btn-plain btn-sm">Timesheets</Link>} />
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Technician</th>
                  <th className="text-right">Jobs</th>
                  <th className="text-right">Flagged</th>
                  <th className="text-right">Clocked</th>
                  <th className="text-right">Efficiency</th>
                  <th className="hidden text-right md:table-cell">Productivity</th>
                  <th className="text-right">Labor sales</th>
                  <th className="hidden text-right lg:table-cell">Commission</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.tech.id}>
                    <td>
                      <div className="font-medium">{r.tech.name}</div>
                      <div className="text-xs text-ink-3">{r.tech.role}</div>
                    </td>
                    <td className="tabular text-right">{r.jobs}</td>
                    <td className="tabular text-right">{r.flagged.toFixed(1)}</td>
                    <td className="tabular text-right">{r.jobH.toFixed(1)}</td>
                    <td className={`tabular text-right ${r.efficiency >= 1 ? 'text-ok' : r.jobH && r.efficiency < 0.8 ? 'text-warn' : ''}`}>{r.jobH ? pct(r.efficiency) : '—'}</td>
                    <td className="tabular hidden text-right md:table-cell">{r.shiftH ? pct(r.productivity) : '—'}</td>
                    <td className="tabular text-right">{money0(r.laborSales)}</td>
                    <td className="tabular hidden text-right lg:table-cell">{money(r.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line/70 px-4 py-2 text-xs text-ink-3">Efficiency over 100% means jobs are finished faster than the labor time billed. Productivity shows how much of the paid day is spent on repair orders.</p>
        </Card>
        <Card>
          <CardHeader title="Flagged hours" />
          <div className="p-4">
            <RankBars rows={rows.map((r) => ({ label: r.tech.name, value: r.flagged, sub: r.tech.role })).sort((a, b) => b.value - a.value)} format={(v) => `${v.toFixed(1)} hr`} />
          </div>
        </Card>
      </div>
    </>
  );
}

export function EstimateReport({ from, to }) {
  const { state } = useShop();
  const r = useMemo(() => {
    const f = from.toISOString();
    const t = to.toISOString();
    const orders = state.orders.filter((o) => o.createdAt >= f && o.createdAt < t);
    let quoted = 0;
    let approved = 0;
    let declined = 0;
    let pending = 0;
    const declinedBy = new Map();
    for (const o of orders)
      for (const s of o.services) {
        const v = serviceTotal(s);
        quoted += v;
        if (s.status === 'declined') {
          declined += v;
          const cur = declinedBy.get(s.title) || { count: 0, value: 0 };
          declinedBy.set(s.title, { count: cur.count + 1, value: cur.value + v });
        } else if (s.status === 'pending') pending += v;
        else approved += v;
      }
    const waits = orders.filter((o) => o.authorizedAt).map((o) => (new Date(o.authorizedAt) - new Date(o.createdAt)) / 3600000).sort((a, b) => a - b);
    const median = waits.length ? waits[Math.floor(waits.length / 2)] : null;
    const methods = new Map();
    for (const o of state.orders)
      for (const a of o.authorizations || []) {
        if (a.at < f || a.at >= t) continue;
        const cur = methods.get(a.method) || { count: 0, amount: 0 };
        methods.set(a.method, { count: cur.count + 1, amount: cur.amount + (Number(a.amount) || 0) });
      }
    return {
      orders: orders.length,
      quoted,
      approved,
      declined,
      pending,
      closeRate: approved + declined ? approved / (approved + declined) : 0,
      median,
      methods: [...methods.entries()].sort((a, b) => b[1].amount - a[1].amount),
      declinedTop: [...declinedBy.entries()].map(([title, x]) => ({ title, ...x })).sort((a, b) => b.value - a.value).slice(0, 8),
    };
  }, [state.orders, from, to]);
  const fmtWait = (h) => (h == null ? '—' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} hr` : `${Math.round(h / 24)} days`);

  return (
    <>
      <Kpis
        items={[
          ['Estimates written', number(r.orders), `${money0(r.quoted)} quoted`],
          ['Approved', money0(r.approved), `${pct(r.closeRate)} close rate`],
          ['Declined', money0(r.declined), 'Follow up in Marketing'],
          ['Still pending', money0(r.pending), 'Awaiting a decision'],
          ['Time to approve', fmtWait(r.median), 'Median, estimate → approval'],
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Quoted work outcome" />
          <div className="p-4">
            <MixBar
              format={money0}
              segments={[
                { label: 'Approved', value: r.approved },
                { label: 'Declined', value: r.declined },
                { label: 'Pending', value: r.pending },
              ]}
            />
          </div>
          <CardHeader title="How customers approve" subtitle="Approvals recorded in the period" />
          {r.methods.length ? (
            <dl className="px-4 py-2">
              {r.methods.map(([m, x]) => {
                const M = AUTH_METHODS[m] || AUTH_METHODS.phone;
                return (
                  <div key={m} className="flex items-center justify-between border-b border-line/60 py-2 text-sm last:border-0">
                    <dt className="flex items-center gap-2 text-ink-2">
                      <M.icon size={14} /> {M.label}
                    </dt>
                    <dd className="tabular">
                      {x.count} · {money0(x.amount)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          ) : (
            <p className="px-4 py-3 text-sm text-ink-3">No approvals recorded in this period.</p>
          )}
        </Card>
        <Card>
          <CardHeader title="Most declined services" actions={<Link to="/marketing?tab=declined" className="btn-plain btn-sm">Follow up</Link>} />
          {r.declinedTop.length ? (
            <table className="table">
              <tbody>
                {r.declinedTop.map((s) => (
                  <tr key={s.title}>
                    <td className="max-w-[220px] truncate">{s.title}</td>
                    <td className="tabular text-right text-ink-3">{s.count}×</td>
                    <td className="tabular text-right">{money0(s.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title="Nothing declined" className="py-10" />
          )}
        </Card>
      </div>
    </>
  );
}

export function CustomerReport({ from, to }) {
  const { state } = useShop();
  const totals = useTotals();
  const r = useMemo(() => {
    const f = from.toISOString();
    const t = to.toISOString();
    const invoiced = state.orders.filter((o) => o.invoicedAt && o.invoicedAt >= f && o.invoicedAt < t);
    const customers = new Map();
    for (const o of invoiced) {
      if (!o.customerId) continue;
      const cur = customers.get(o.customerId) || { visits: 0, spend: 0 };
      customers.set(o.customerId, { visits: cur.visits + 1, spend: cur.spend + totals(o).total });
    }
    let returning = 0;
    for (const id of customers.keys()) if (state.orders.some((o) => o.customerId === id && o.invoicedAt && o.invoicedAt < f)) returning += 1;
    const newCustomers = state.customers.filter((c) => c.createdAt >= f && c.createdAt < t).length;
    const bookings = state.bookingRequests.filter((b) => b.createdAt >= f && b.createdAt < t);
    const online = state.appointments.filter((a) => a.source === 'online' && a.start >= f && a.start < t).length;
    const msgs = state.messages.filter((m) => m.at >= f && m.at < t);
    const campaigns = state.campaigns.filter((c) => c.at >= f && c.at < t);
    return {
      served: customers.size,
      returning,
      newCustomers,
      top: [...customers.entries()].map(([id, x]) => ({ c: state.customers.find((c) => c.id === id), ...x })).filter((x) => x.c).sort((a, b) => b.spend - a.spend).slice(0, 8),
      bookings: bookings.length,
      accepted: bookings.filter((b) => b.status === 'accepted').length,
      online,
      sent: msgs.filter((m) => m.dir === 'out' && m.channel !== 'note').length,
      received: msgs.filter((m) => m.dir === 'in').length,
      campaignSends: campaigns.reduce((s, c) => s + (c.count || 0), 0),
    };
  }, [state, from, to, totals]);
  const channels = useMemo(() => bookingChannels(state), [state]);

  return (
    <>
      <Kpis
        items={[
          ['Customers served', number(r.served), `${r.served ? pct(r.returning / r.served) : '—'} returning`],
          ['New customers', number(r.newCustomers), 'Added in the period'],
          ['Online bookings', number(r.bookings), `${r.accepted} confirmed · ${r.online} on the calendar`],
          ['Messages', number(r.sent + r.received), `${r.sent} sent · ${r.received} received`],
          ['Campaign sends', number(r.campaignSends), 'Reminders, follow-ups & promos'],
        ]}
      />
      <Card className="mb-6">
        <CardHeader title="How customers book" subtitle="Visits by booking channel, last 6 months — online booking frees up the phone" />
        <div className="px-3 pb-3 pt-3">
          <StackedColumnChart
            data={channels}
            series={[
              { label: 'Online booking', color: 'var(--series-1)' },
              { label: 'Phone & walk-in', color: 'var(--series-3)' },
            ]}
            height={220}
            format={(v) => number(v)}
            label="Visits per month by booking channel"
          />
        </div>
      </Card>
      <Card>
        <CardHeader title="Top customers" subtitle="By invoiced total in the period" />
        {r.top.length ? (
          <table className="table">
            <tbody>
              {r.top.map(({ c, visits, spend }) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/customers/${c.id}`} className="font-medium hover:underline">
                      {fullName(c)}
                    </Link>
                    {(c.tags || []).length > 0 && <span className="ml-2 text-xs text-ink-3">{c.tags.join(', ')}</span>}
                  </td>
                  <td className="tabular text-right text-ink-3">
                    {visits} visit{visits === 1 ? '' : 's'}
                  </td>
                  <td className="tabular text-right font-medium">{money(spend)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title="No invoiced work in this period" className="py-10" />
        )}
      </Card>
    </>
  );
}
