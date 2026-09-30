import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useShop, useLookup, useTotals } from '../store/hooks';
import { PageHeader, Card, CardHeader, Segmented } from '../components/ui';
import { ColumnChart, MixBar, RankBars } from '../components/charts';
import { money, money0, moneyShort, pct, startOfDay, addDays, dateShort, fullName, number } from '../lib/format';

const RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '6 months' },
];

export default function Reports() {
  const { state } = useShop();
  const lookup = useLookup();
  const totals = useTotals();
  const [days, setDays] = useState(30);
  const now = useMemo(() => new Date(), []);

  const r = useMemo(() => {
    const from = startOfDay(addDays(now, -days + 1));
    const prevFrom = addDays(from, -days);
    const invoiced = state.orders.filter((o) => o.invoicedAt && new Date(o.invoicedAt) >= from);
    const prev = state.orders.filter((o) => o.invoicedAt && new Date(o.invoicedAt) >= prevFrom && new Date(o.invoicedAt) < from);
    const sum = (list, k) => list.reduce((s, o) => s + totals(o)[k], 0);

    const revenue = sum(invoiced, 'total');
    const prevRevenue = sum(prev, 'total');
    const labor = sum(invoiced, 'labor');
    const parts = sum(invoiced, 'parts');
    const other = sum(invoiced, 'fees') + sum(invoiced, 'sublet') + sum(invoiced, 'supplies');
    const hours = sum(invoiced, 'hours');
    const gp = sum(invoiced, 'grossProfit');
    const net = invoiced.reduce((s, o) => s + totals(o).subtotal - totals(o).discount, 0);

    // Weekly buckets (daily for 7-day range).
    const bucketDays = days <= 7 ? 1 : 7;
    const buckets = [];
    for (let start = new Date(from); start <= now; start = addDays(start, bucketDays)) {
      const end = addDays(start, bucketDays);
      const list = invoiced.filter((o) => new Date(o.invoicedAt) >= start && new Date(o.invoicedAt) < end);
      buckets.push({
        key: start.toISOString(),
        label: bucketDays === 1 ? dateShort(start) : `Week of ${dateShort(start)}`,
        short: dateShort(start),
        value: list.reduce((s, o) => s + totals(o).total, 0),
        sub: `${list.length} RO${list.length === 1 ? '' : 's'}`,
      });
    }

    const techHours = new Map();
    invoiced.forEach((o) =>
      o.services
        .filter((s) => s.status !== 'declined')
        .forEach((s) => {
          const tid = s.techId || o.techId;
          const h = s.items.filter((i) => i.type === 'labor').reduce((a, i) => a + (Number(i.hours) || 0), 0);
          if (tid) techHours.set(tid, (techHours.get(tid) || 0) + h);
        }),
    );

    const serviceStats = new Map();
    let approved = 0;
    let declined = 0;
    state.orders
      .filter((o) => new Date(o.createdAt) >= from)
      .forEach((o) =>
        o.services.forEach((s) => {
          const v = s.items.reduce((a, i) => a + (i.type === 'labor' ? i.hours * i.rate : i.qty * i.price), 0);
          if (s.status === 'declined') declined += v;
          else if (s.status === 'approved') approved += v;
          if (s.status === 'declined' || !invoiced.includes(o)) return;
          const cur = serviceStats.get(s.title) || { count: 0, value: 0 };
          serviceStats.set(s.title, { count: cur.count + 1, value: cur.value + v });
        }),
      );

    const payments = new Map();
    state.orders.forEach((o) => o.payments.forEach((p) => new Date(p.at) >= from && payments.set(p.method, (payments.get(p.method) || 0) + Number(p.amount))));

    const unpaid = state.orders.filter((o) => (o.status === 'ready' || o.status === 'closed') && totals(o).balance > 0.004);
    const aging = [
      { label: '0–30 days', test: (d) => d <= 30 },
      { label: '31–60 days', test: (d) => d > 30 && d <= 60 },
      { label: '60+ days', test: (d) => d > 60 },
    ].map((b) => {
      const list = unpaid.filter((o) => b.test((now - new Date(o.invoicedAt)) / 86400000));
      return { ...b, list, amount: list.reduce((s, o) => s + totals(o).balance, 0) };
    });

    return {
      revenue,
      delta: prevRevenue ? (revenue - prevRevenue) / prevRevenue : null,
      carCount: invoiced.length,
      aro: invoiced.length ? revenue / invoiced.length : 0,
      gpPct: net ? gp / net : 0,
      gp,
      hours,
      elr: hours ? labor / hours : 0,
      labor,
      parts,
      other,
      buckets,
      techs: state.technicians.map((t) => ({ label: t.name, value: techHours.get(t.id) || 0, sub: t.role })).sort((a, b) => b.value - a.value),
      services: [...serviceStats.entries()].map(([title, s]) => ({ title, ...s })).sort((a, b) => b.value - a.value).slice(0, 8),
      closeRate: approved + declined ? approved / (approved + declined) : 0,
      declined,
      payments: [...payments.entries()].sort((a, b) => b[1] - a[1]),
      aging,
      unpaid,
    };
  }, [state.orders, state.technicians, days, totals, now]);

  return (
    <>
      <PageHeader title="Reports" subtitle="Invoiced work, profitability and productivity. Every number below respects the selected range." />
      <div className="mb-5">
        <Segmented options={RANGES} value={days} onChange={setDays} />
      </div>

      <Card className="mb-6 grid grid-cols-2 divide-line p-1 md:grid-cols-3 lg:grid-cols-6 lg:divide-x">
        <Kpi label="Revenue" value={money0(r.revenue)} sub={r.delta == null ? 'No prior period' : `${r.delta >= 0 ? '▲' : '▼'} ${pct(Math.abs(r.delta))} vs prior ${days} days`} />
        <Kpi label="Car count" value={r.carCount} sub="Invoiced repair orders" />
        <Kpi label="Avg repair order" value={money0(r.aro)} sub="ARO, incl. tax" />
        <Kpi label="Gross profit" value={pct(r.gpPct)} sub={`${money0(r.gp)} on parts & labor`} />
        <Kpi label="Hours sold" value={r.hours.toFixed(1)} sub={`${(r.hours / Math.max(1, r.carCount)).toFixed(1)} per RO`} />
        <Kpi label="Effective labor rate" value={money0(r.elr)} sub="Labor $ ÷ hours sold" />
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title={days <= 7 ? 'Revenue by day' : 'Revenue by week'} subtitle={`${money(r.revenue)} invoiced`} />
          <div className="px-3 pb-2 pt-3">
            <ColumnChart data={r.buckets} height={240} format={money0} tickFormat={moneyShort} label="Invoiced revenue over time" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Sales mix" subtitle="Before tax" />
          <div className="p-4">
            <MixBar format={money0} segments={[{ label: 'Labor', value: r.labor }, { label: 'Parts', value: r.parts }, { label: 'Fees & supplies', value: r.other }]} />
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm">
              <div>
                <div className="text-ink-3">Estimate close rate</div>
                <div className="text-xl font-semibold">{pct(r.closeRate)}</div>
                <div className="text-xs text-ink-3">of quoted service value approved</div>
              </div>
              <div>
                <div className="text-ink-3">Declined work</div>
                <div className="text-xl font-semibold">{money0(r.declined)}</div>
                <div className="text-xs text-ink-3">follow-up opportunity</div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Technician hours" subtitle="Billed labor hours on invoiced work" />
          <div className="p-4">
            <RankBars rows={r.techs} format={(v) => `${v.toFixed(1)} hr`} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Top services" subtitle="By revenue" />
          <table className="table">
            <tbody>
              {r.services.map((s) => (
                <tr key={s.title}>
                  <td className="max-w-[180px] truncate">{s.title}</td>
                  <td className="tabular text-right text-ink-3">{s.count}×</td>
                  <td className="tabular text-right">{money0(s.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Receivables aging" subtitle={`${r.unpaid.length} unpaid invoices`} />
            <dl className="px-4 py-2">
              {r.aging.map((b) => (
                <div key={b.label} className="flex justify-between border-b border-line/60 py-2 text-sm last:border-0">
                  <dt className="text-ink-2">{b.label} <span className="text-ink-4">· {b.list.length}</span></dt>
                  <dd className="tabular font-medium">{money(b.amount)}</dd>
                </div>
              ))}
            </dl>
            {r.unpaid.slice(0, 4).map((o) => (
              <Link key={o.id} to={`/orders/${o.id}`} className="flex justify-between border-t border-line/60 px-4 py-2 text-xs hover:bg-fill/[0.04]">
                <span className="text-ink-2">#{o.number} · {fullName(lookup.customer.get(o.customerId))}</span>
                <span className="tabular">{money(totals(o).balance)}</span>
              </Link>
            ))}
          </Card>
          <Card>
            <CardHeader title="Payments received" />
            <dl className="px-4 py-2">
              {r.payments.map(([m, v]) => (
                <div key={m} className="flex justify-between border-b border-line/60 py-2 text-sm last:border-0">
                  <dt className="text-ink-2">{m}</dt>
                  <dd className="tabular">{money(v)}</dd>
                </div>
              ))}
              {!r.payments.length && <p className="py-2 text-sm text-ink-3">No payments in this range.</p>}
            </dl>
          </Card>
        </div>
      </div>
      <p className="mt-6 text-xs text-ink-3">
        Gross profit uses part costs and your tech pay rate ({money(state.shop.techPayRate)}/hr) from Settings. {number(state.orders.length)} repair orders on file.
      </p>
    </>
  );
}

function Kpi({ label, value, sub }) {
  return (
    <div className="px-4 py-3.5">
      <div className="text-sm text-ink-2">{label}</div>
      <div className="mt-1 text-[26px] font-semibold leading-8 tracking-tight">{value}</div>
      <div className="mt-0.5 truncate text-xs text-ink-3">{sub}</div>
    </div>
  );
}
