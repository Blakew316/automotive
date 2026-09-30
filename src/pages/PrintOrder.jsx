import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Printer } from 'lucide-react';
import { useShop, useLookup, useTotals } from '../store/hooks';
import { Segmented, Toggle, EmptyState } from '../components/ui';
import { money, fullName, vehicleName, date, phone, number } from '../lib/format';
import { itemTotal, serviceTotal } from '../lib/pricing';
import { INSPECTION_RATINGS } from '../lib/workflow';

export default function PrintOrder() {
  const { id } = useParams();
  const { state } = useShop();
  const lookup = useLookup();
  const totals = useTotals();
  const order = state.orders.find((o) => o.id === id);
  const defaultKind = order ? (order.status === 'estimate' ? 'estimate' : ['ready', 'closed'].includes(order.status) ? 'invoice' : 'workorder') : 'estimate';
  const [kind, setKind] = useState(defaultKind);
  const [showParts, setShowParts] = useState(true);
  const [showDeclined, setShowDeclined] = useState(true);

  if (!order) return <EmptyState title="Repair order not found" action={<Link to="/orders" className="btn-secondary">Back</Link>} />;

  const shop = state.shop;
  const c = lookup.customer.get(order.customerId);
  const v = lookup.vehicle.get(order.vehicleId);
  const t = totals(order);
  const title = { estimate: 'Estimate', invoice: 'Invoice', workorder: 'Work Order' }[kind];
  const services = order.services.filter((s) => showDeclined || s.status !== 'declined');
  const flagged = Object.entries(order.inspection).filter(([, r]) => r.rating === 'soon' || r.rating === 'now');

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <div className="no-print glass sticky top-0 z-10 border-b border-line bg-canvas/80">
        <div className="mx-auto flex max-w-[860px] flex-wrap items-center gap-3 px-4 py-2.5">
          <Link to={`/orders/${order.id}`} className="btn-plain -ml-2 px-1.5">
            <ChevronLeft size={17} strokeWidth={2} /> RO #{order.number}
          </Link>
          <Segmented
            size="sm"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'estimate', label: 'Estimate' },
              { value: 'workorder', label: 'Work order' },
              { value: 'invoice', label: 'Invoice' },
            ]}
          />
          <label className="flex items-center gap-2 text-xs text-ink-2">
            <Toggle checked={showParts} onChange={setShowParts} label="Show part numbers" /> Part #s
          </label>
          <label className="flex items-center gap-2 text-xs text-ink-2">
            <Toggle checked={showDeclined} onChange={setShowDeclined} label="Show declined" /> Declined
          </label>
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
            <div className="text-3xl font-semibold tracking-tight text-ink">{title}</div>
            <div className="mt-1 text-sm text-ink-2">
              No. <span className="font-medium text-ink">{order.number}</span>
            </div>
            <div className="text-sm text-ink-2">{date(kind === 'invoice' ? order.invoicedAt || new Date() : order.createdAt)}</div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-8 border-b border-line py-5 text-sm">
          <div>
            <div className="section-label mb-1.5">Customer</div>
            <div className="font-medium">{fullName(c)}</div>
            {c?.company && <div className="text-ink-2">{c.company}</div>}
            <div className="text-ink-2">{c?.address}</div>
            <div className="text-ink-2">{[c?.city, c?.state].filter(Boolean).join(', ')} {c?.zip}</div>
            <div className="text-ink-2">{phone(c?.phone || '')}</div>
          </div>
          <div>
            <div className="section-label mb-1.5">Vehicle</div>
            <div className="font-medium">{vehicleName(v, { trim: true })}</div>
            {v?.engine && <div className="text-ink-2">{v.engine}</div>}
            <div className="font-mono text-[12px] text-ink-2">VIN {v?.vin || '—'}</div>
            <div className="text-ink-2">
              {v?.plate && <>Plate {v.plate} {v.plateState} · </>}
              Mileage in {order.mileageIn ? number(order.mileageIn) : '—'}
              {order.mileageOut ? ` / out ${number(order.mileageOut)}` : ''}
            </div>
          </div>
        </section>

        {order.concern && (
          <section className="border-b border-line py-4 text-sm">
            <div className="section-label mb-1">Customer concern</div>
            <p>{order.concern}</p>
          </section>
        )}

        <section className="py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-3">
                <th className="pb-2 font-medium">Description</th>
                <th className="w-20 pb-2 text-right font-medium">Qty/Hrs</th>
                <th className="w-24 pb-2 text-right font-medium">Rate</th>
                <th className="w-28 pb-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            {services.map((s) => {
              const declined = s.status === 'declined';
              return (
                <tbody key={s.id} className={`break-inside-avoid ${declined ? 'text-ink-3' : ''}`}>
                  <tr>
                    <td colSpan={3} className="pb-1 pt-4 font-semibold">
                      {s.title}
                      {declined && <span className="ml-2 text-xs font-normal">Declined — not included</span>}
                      {!declined && kind === 'estimate' && s.status === 'pending' && <span className="ml-2 text-xs font-normal text-ink-3">Awaiting approval</span>}
                    </td>
                    <td className="tabular pb-1 pt-4 text-right font-semibold">{money(serviceTotal(s))}</td>
                  </tr>
                  {s.items.map((i) => (
                    <tr key={i.id} className="text-ink-2">
                      <td className="py-0.5 pl-3">
                        {i.description || (i.type === 'labor' ? 'Labor' : 'Part')}
                        {showParts && i.type === 'part' && i.partNumber && <span className="ml-1.5 font-mono text-[11px] text-ink-3">{[i.brand, i.partNumber].filter(Boolean).join(' ')}</span>}
                      </td>
                      <td className="tabular py-0.5 text-right">{i.type === 'labor' ? Number(i.hours).toFixed(1) : i.qty}</td>
                      <td className="tabular py-0.5 text-right">{money(i.type === 'labor' ? i.rate : i.price)}</td>
                      <td className="tabular py-0.5 text-right">{money(itemTotal(i))}</td>
                    </tr>
                  ))}
                  {(s.cause || s.correction) && (
                    <tr>
                      <td colSpan={4} className="pb-1 pl-3 pt-1 text-xs leading-4 text-ink-2">
                        {s.cause && <div><span className="font-medium text-ink">Cause:</span> {s.cause}</div>}
                        {s.correction && <div><span className="font-medium text-ink">Correction:</span> {s.correction}</div>}
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </table>
        </section>

        <section className="flex justify-end border-t border-line pt-4">
          <dl className="w-72 space-y-1 text-sm">
            <Line label="Labor" value={t.labor} />
            <Line label="Parts" value={t.parts} />
            {t.fees > 0 && <Line label="Fees" value={t.fees} />}
            {t.sublet > 0 && <Line label="Sublet" value={t.sublet} />}
            {t.supplies > 0 && <Line label="Shop supplies" value={t.supplies} />}
            {t.discount > 0 && <Line label="Discount" value={-t.discount} />}
            <Line label={`Sales tax (${shop.taxRate}%)`} value={t.tax} />
            <div className="flex justify-between border-t border-line pt-2 text-lg font-semibold">
              <dt>Total</dt>
              <dd className="tabular">{money(t.total)}</dd>
            </div>
            {kind === 'invoice' && (
              <>
                <Line label="Paid" value={-t.paid} />
                <div className="flex justify-between font-semibold">
                  <dt>Balance due</dt>
                  <dd className="tabular">{money(Math.max(0, t.balance))}</dd>
                </div>
              </>
            )}
          </dl>
        </section>

        {flagged.length > 0 && (
          <section className="mt-6 break-inside-avoid border-t border-line pt-4 text-sm">
            <div className="section-label mb-2">Inspection findings</div>
            <ul className="grid grid-cols-2 gap-x-8 gap-y-1">
              {flagged.map(([key, r]) => (
                <li key={key} className="flex items-start gap-2">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${INSPECTION_RATINGS[r.rating].dot}`} />
                  <span>
                    {key.split('::')[1]} <span className="text-ink-3">— {INSPECTION_RATINGS[r.rating].short}{r.note ? `, ${r.note}` : ''}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-8 break-inside-avoid space-y-4 border-t border-line pt-5 text-xs leading-5 text-ink-2">
          <p>{kind === 'invoice' ? shop.invoiceTerms : shop.estimateTerms}</p>
          {shop.warranty && <p>Warranty: {shop.warranty}.</p>}
          {kind !== 'invoice' && (
            <div className="grid grid-cols-[1fr_180px] gap-8 pt-6">
              <div>
                <div className="h-8 border-b border-ink-3" />
                <div className="mt-1">I authorize the repairs above and agree to the terms. Customer signature</div>
              </div>
              <div>
                <div className="h-8 border-b border-ink-3" />
                <div className="mt-1">Date</div>
              </div>
            </div>
          )}
        </footer>
      </article>
    </div>
  );
}

function Line({ label, value }) {
  return (
    <div className="flex justify-between text-ink-2">
      <dt>{label}</dt>
      <dd className="tabular text-ink">{money(value)}</dd>
    </div>
  );
}
