// Printable account statement: open invoices, aging and recent payments for a business account.
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Printer } from 'lucide-react';
import { useShop, useSync } from '../store/hooks';
import { EmptyState } from '../components/ui';
import { accountSummary, accountPayments, termsLabel } from '../lib/accounts';
import { portalLink } from '../lib/fleetPortal';
import { payLink } from '../lib/messaging';
import { money, fullName, vehicleName, date, dateShort, phone } from '../lib/format';

export default function Statement() {
  const { id } = useParams();
  const { state } = useShop();
  const sync = useSync();
  const c = state.customers.find((x) => x.id === id);
  const sum = useMemo(() => (c ? accountSummary(state, c) : null), [state, c]);
  const payments = useMemo(() => (c ? accountPayments(state, c.id, 90) : []), [state, c]);
  if (!c) return <EmptyState title="Customer not found" action={<Link to="/customers" className="btn-secondary">Back</Link>} />;

  const shop = state.shop;
  const vehicles = new Map(state.vehicles.map((v) => [v.id, v]));
  const portal = c.account?.portal;
  const portalUrl = portal?.id && !portal.off && sync?.cfg ? portalLink(sync.cfg, portal.id) : '';
  const pay = sum.balance > 0.004 ? payLink(shop, sum.balance, `${c.company || fullName(c)} statement`) : '';

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <div className="no-print glass sticky top-0 z-10 border-b border-line bg-canvas/80">
        <div className="mx-auto flex max-w-[860px] items-center gap-3 px-4 py-2.5">
          <Link to={`/customers/${c.id}`} className="btn-plain -ml-2 px-1.5">
            <ChevronLeft size={17} strokeWidth={2} /> {c.company || fullName(c)}
          </Link>
          <button className="btn-primary ml-auto" onClick={() => window.print()}>
            <Printer size={15} /> Print / Save PDF
          </button>
        </div>
      </div>

      <article className="force-light print-sheet mx-auto mt-8 max-w-[860px] rounded-lg bg-surface px-12 py-12 text-ink shadow-card">
        <header className="flex items-start justify-between gap-8 border-b border-line pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{shop.name}</h1>
            <p className="mt-1 text-sm leading-5 text-ink-2">
              {shop.address}
              <br />
              {shop.city}, {shop.state} {shop.zip}
              <br />
              {shop.phone} · {shop.email}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-semibold tracking-tight">Statement</div>
            <div className="mt-1 text-sm text-ink-2">{date(new Date().toISOString())}</div>
            {c.account && <div className="text-sm text-ink-2">Terms: {termsLabel(c.account.terms)}</div>}
          </div>
        </header>

        <section className="grid grid-cols-2 gap-8 border-b border-line py-5 text-sm">
          <div>
            <div className="section-label mb-1.5">Bill to</div>
            <div className="font-medium">{c.company || fullName(c)}</div>
            {c.company && <div className="text-ink-2">Attn: {fullName(c)}</div>}
            <div className="text-ink-2">{c.address}</div>
            <div className="text-ink-2">{[c.city, c.state].filter(Boolean).join(', ')} {c.zip}</div>
            <div className="text-ink-2">{c.account?.billingEmail || c.email}</div>
            {c.phone && <div className="text-ink-2">{phone(c.phone)}</div>}
          </div>
          <div className="text-right">
            <div className="section-label mb-1.5">Amount due</div>
            <div className="tabular text-3xl font-semibold">{money(sum.balance)}</div>
            {sum.pastDue > 0 && <div className="mt-1 text-sm font-medium text-bad">{money(sum.pastDue)} past due</div>}
          </div>
        </section>

        <section className="border-b border-line py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-ink-3">
                {sum.aging.map((b) => (
                  <th key={b.key} className="pb-1 text-right font-medium">{b.label}</th>
                ))}
                <th className="pb-1 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {sum.aging.map((b) => (
                  <td key={b.key} className={`tabular text-right ${b.amount > 0 && b.key !== 'current' ? 'font-medium text-bad' : ''}`}>{money(b.amount)}</td>
                ))}
                <td className="tabular text-right font-semibold">{money(sum.balance)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="py-4">
          <div className="section-label mb-2">Open invoices</div>
          {sum.invoices.length === 0 ? (
            <p className="text-sm text-ink-2">No open invoices — thank you.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Invoice</th>
                  <th className="pb-2 font-medium">PO</th>
                  <th className="pb-2 font-medium">Unit / vehicle</th>
                  <th className="pb-2 font-medium">Due</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                  <th className="pb-2 text-right font-medium">Paid</th>
                  <th className="pb-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {sum.invoices.map((i) => {
                  const v = vehicles.get(i.order.vehicleId);
                  return (
                    <tr key={i.order.id} className="border-b border-line/60">
                      <td className="py-1.5">{dateShort(i.invoiced)}</td>
                      <td className="tabular">{i.order.number}</td>
                      <td>{i.order.po || '—'}</td>
                      <td>{v ? (v.unit ? `Unit ${v.unit} · ${v.year} ${v.model}` : vehicleName(v)) : '—'}</td>
                      <td className={i.pastDue > 0 ? 'font-medium text-bad' : ''}>
                        {dateShort(i.due)}
                        {i.pastDue > 0 ? ` (${i.pastDue}d)` : ''}
                      </td>
                      <td className="tabular text-right">{money(i.total)}</td>
                      <td className="tabular text-right">{i.paid ? money(i.paid) : '—'}</td>
                      <td className="tabular text-right font-medium">{money(i.balance)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {payments.length > 0 && (
          <section className="break-inside-avoid border-t border-line py-4">
            <div className="section-label mb-2">Payments received · last 90 days</div>
            <table className="w-full text-sm">
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-1">{dateShort(p.at)}</td>
                    <td>{p.method}{p.ref ? ` ${p.method === 'Check' ? '#' : ''}${p.ref}` : ''}</td>
                    <td className="text-ink-2">Applied to {p.orders.map((n) => `#${n}`).join(', ')}</td>
                    <td className="tabular text-right">{money(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer className="mt-6 break-inside-avoid space-y-2 border-t border-line pt-5 text-xs leading-5 text-ink-2">
          <p>
            Please remit to {shop.name}, {shop.address}, {shop.city}, {shop.state} {shop.zip}. Reference the invoice numbers with your payment.
          </p>
          {pay && <p>Pay online: {pay}</p>}
          {portalUrl && <p>Invoices, payments and maintenance schedules for every unit: {portalUrl}</p>}
          {c.account?.invoiceNote && <p>{c.account.invoiceNote}</p>}
          <p>Questions about this statement? Call {shop.phone}.</p>
        </footer>
      </article>
    </div>
  );
}
