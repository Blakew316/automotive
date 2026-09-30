import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, MessageSquare, Mail, Plus, Trash2, ShieldAlert, ScanLine, ChevronRight } from 'lucide-react';
import { useShop, useUI, useTotals } from '../../store/hooks';
import { Card, CardHeader, Avatar, CopyButton, NumInput, Modal, Field, Mono, ExternalLink } from '../../components/ui';
import { money, fullName, vehicleName, phone, telHref, smsHref, mailHref, dateShort, time, number, round2 } from '../../lib/format';
import { PAYMENT_METHODS } from '../../lib/workflow';
import { nhtsaVinRecallUrl } from '../../lib/nhtsa';

const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function OrderSidebar({ order, customer, vehicle, editable, onTakePayment }) {
  const { state, updateOrder, removePayment } = useShop();
  const totals = useTotals();
  const t = totals(order);

  return (
    <div className="space-y-4">
      <Card>
        {customer ? (
          <>
            <Link to={`/customers/${customer.id}`} className="flex items-center gap-3 px-4 pb-3 pt-4 transition-colors hover:bg-fill/[0.04]">
              <Avatar person={customer} size={38} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{fullName(customer)}</div>
                <div className="truncate text-sm text-ink-3">{customer.company || phone(customer.phone)}</div>
              </div>
              <ChevronRight size={16} className="text-ink-4" />
            </Link>
            <div className="grid grid-cols-3 gap-1.5 px-4 pb-4">
              <a href={telHref(customer.phone)} className="btn-secondary btn-sm flex-col gap-0.5 py-1.5" style={{ height: 'auto' }}>
                <Phone size={15} /> Call
              </a>
              <a href={smsHref(customer.phone)} className="btn-secondary btn-sm flex-col gap-0.5 py-1.5" style={{ height: 'auto' }}>
                <MessageSquare size={15} /> Text
              </a>
              <a href={mailHref(customer.email)} className="btn-secondary btn-sm flex-col gap-0.5 py-1.5" style={{ height: 'auto' }}>
                <Mail size={15} /> Email
              </a>
            </div>
          </>
        ) : (
          <div className="p-4 text-sm text-ink-3">No customer on this order.</div>
        )}
      </Card>

      {vehicle && (
        <Card>
          <Link to={`/vehicles/${vehicle.id}`} className="flex items-center gap-3 px-4 pb-2 pt-3.5 transition-colors hover:bg-fill/[0.04]">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{vehicleName(vehicle)}</div>
              <div className="truncate text-sm text-ink-3">{[vehicle.trim, vehicle.engine].filter(Boolean).join(' · ')}</div>
            </div>
            <ChevronRight size={16} className="text-ink-4" />
          </Link>
          <dl className="px-4 pb-3 text-sm">
            <div className="flex items-center justify-between gap-2 py-1">
              <dt className="text-ink-3">VIN</dt>
              <dd className="flex items-center">
                <Mono>{vehicle.vin || '—'}</Mono>
                {vehicle.vin && <CopyButton text={vehicle.vin} label="Copy VIN" className="-mr-2 h-6 w-6 px-0" />}
              </dd>
            </div>
            {vehicle.plate && (
              <div className="flex justify-between gap-2 py-1">
                <dt className="text-ink-3">Plate</dt>
                <dd>{vehicle.plate} {vehicle.plateState}</dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 py-1">
              <dt className="text-ink-3">Mileage in</dt>
              <dd className="w-28"><NumInput value={order.mileageIn} format={number} onCommit={(n) => updateOrder(order.id, { mileageIn: n })} disabled={!editable} className="input h-7 text-sm" /></dd>
            </div>
            <div className="flex items-center justify-between gap-2 py-1">
              <dt className="text-ink-3">Mileage out</dt>
              <dd className="w-28"><NumInput value={order.mileageOut} format={number} onCommit={(n) => updateOrder(order.id, { mileageOut: n })} className="input h-7 text-sm" placeholder="—" /></dd>
            </div>
          </dl>
          {vehicle.vin && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line/70 px-4 py-2.5 text-sm">
              <Link to={`/vin?vin=${vehicle.vin}`} className="inline-flex items-center gap-1 text-accent hover:underline">
                <ScanLine size={13} /> Decode & specs
              </Link>
              <ExternalLink href={nhtsaVinRecallUrl(vehicle.vin)}>
                <ShieldAlert size={13} className="mr-0.5" /> Open recalls
              </ExternalLink>
            </div>
          )}
        </Card>
      )}

      <Card className="px-4 py-3">
        <div className="space-y-2.5">
          <Field label="Technician">
            {(id) => (
              <select id={id} className="input" value={order.techId || ''} onChange={(e) => updateOrder(order.id, { techId: e.target.value || null })}>
                <option value="">Unassigned</option>
                {state.technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>{tech.name} — {tech.role}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Promised">
            {(id) => <input id={id} type="datetime-local" className="input" value={toLocalInput(order.promisedAt)} onChange={(e) => updateOrder(order.id, { promisedAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />}
          </Field>
          <Field label="Service advisor">
            {(id) => <input id={id} className="input" value={order.advisor || ''} onChange={(e) => updateOrder(order.id, { advisor: e.target.value })} />}
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Totals" subtitle={t.hours ? `${t.hours} labor hours` : undefined} />
        <dl className="px-4 py-2 text-sm">
          <Row label="Labor" value={t.labor} />
          <Row label="Parts" value={t.parts} />
          {t.fees > 0 && <Row label="Fees" value={t.fees} />}
          {t.sublet > 0 && <Row label="Sublet" value={t.sublet} />}
          <div className="flex items-center justify-between py-1">
            <dt className="flex items-center gap-2 text-ink-2">
              Shop supplies
              {editable && (
                <button className="text-xs text-accent hover:underline" onClick={() => updateOrder(order.id, { waiveSupplies: !order.waiveSupplies })}>
                  {order.waiveSupplies ? 'Apply' : 'Waive'}
                </button>
              )}
            </dt>
            <dd className="tabular">{money(t.supplies)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2 py-1">
            <dt className="flex items-center gap-2 text-ink-2">
              Discount
              {editable && (
                <select
                  value={order.discount?.type || 'amt'}
                  onChange={(e) => updateOrder(order.id, { discount: { ...order.discount, type: e.target.value } })}
                  className="h-6 rounded-[5px] border border-line bg-surface px-1 text-xs"
                  aria-label="Discount type"
                >
                  <option value="amt">$</option>
                  <option value="pct">%</option>
                </select>
              )}
            </dt>
            <dd className="w-24">
              <NumInput value={order.discount?.value || 0} onCommit={(value) => updateOrder(order.id, { discount: { ...order.discount, value } })} disabled={!editable} className="input h-7 text-sm" />
            </dd>
          </div>
          <Row label={`Tax (${state.shop.taxRate}%${state.shop.taxLabor ? '' : ', parts'})`} value={t.tax} />
          <div className="mt-1.5 flex items-baseline justify-between border-t border-line pt-2.5">
            <dt className="font-semibold">Total</dt>
            <dd className="tabular text-xl font-semibold">{money(t.total)}</dd>
          </div>
          {t.paid > 0 && <Row label="Paid" value={-t.paid} />}
          {order.status !== 'estimate' && (
            <div className="flex items-baseline justify-between py-1">
              <dt className="font-medium">Balance due</dt>
              <dd className={`tabular font-semibold ${t.balance > 0.004 ? 'text-ink' : 'text-ok'}`}>{money(Math.max(0, t.balance))}</dd>
            </div>
          )}
        </dl>
        <div className="border-t border-line/70 px-4 py-2.5 text-xs text-ink-3">
          Gross profit {money(t.grossProfit)} · {Math.round(t.gpPct * 100)}% GP
          {t.declined > 0 && <> · {money(t.declined)} declined</>}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Payments"
          actions={
            order.status !== 'estimate' && (
              <button className="btn-plain btn-sm" onClick={onTakePayment} disabled={t.balance <= 0.004}>
                <Plus size={14} /> Take payment
              </button>
            )
          }
        />
        {order.payments.length === 0 ? (
          <p className="px-4 py-3 text-sm text-ink-3">{order.status === 'estimate' ? 'Payments open once the estimate is approved.' : 'No payments yet.'}</p>
        ) : (
          <ul className="divide-y divide-line/70">
            {order.payments.map((p) => (
              <li key={p.id} className="group flex items-center gap-3 px-4 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div>{p.method}{p.ref ? <span className="text-ink-3"> · {p.ref}</span> : null}</div>
                  <div className="text-xs text-ink-3">{dateShort(p.at)}, {time(p.at)}</div>
                </div>
                <span className="tabular font-medium">{money(p.amount)}</span>
                <button onClick={() => removePayment(order.id, p.id)} className="btn-ghost btn-icon h-6 w-6 opacity-0 group-hover:opacity-100" aria-label="Remove payment">
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1">
      <dt className="text-ink-2">{label}</dt>
      <dd className="tabular">{money(value)}</dd>
    </div>
  );
}

export function PaymentModal({ order, onClose }) {
  const { addPayment } = useShop();
  const { toast } = useUI();
  const totals = useTotals();
  const balance = Math.max(0, totals(order).balance);
  const [amount, setAmount] = useState(balance.toFixed(2));
  const [method, setMethod] = useState('Card');
  const [ref, setRef] = useState('');
  const n = round2(parseFloat(amount) || 0);

  const submit = () => {
    if (n <= 0) return;
    addPayment(order.id, { amount: n, method, ref });
    toast(`${money(n)} ${method.toLowerCase()} payment recorded`, { tone: 'success' });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Take payment"
      subtitle={`RO #${order.number} · ${money(balance)} balance`}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={n <= 0} onClick={submit}>Record {money(n)}</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Amount">
          {(id) => (
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-ink-3">$</span>
              <input id={id} autoFocus inputMode="decimal" className="input tabular h-12 pl-7 text-2xl font-semibold" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
            </div>
          )}
        </Field>
        <div>
          <span className="field-label">Method</span>
          <div className="flex flex-wrap gap-1.5">
            {PAYMENT_METHODS.map((m) => (
              <button key={m} onClick={() => setMethod(m)} className={`chip h-7 ${method === m ? 'border-accent bg-accent/[0.08] text-ink' : 'hover:bg-fill/[0.05]'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <Field label="Reference" hint="Last 4, check #, authorization code…">{(id) => <input id={id} className="input" value={ref} onChange={(e) => setRef(e.target.value)} />}</Field>
        {n > 0 && n < balance && (
          <p className="text-xs text-ink-3">
            Partial payment — {money(balance - n)} will remain.{' '}
            <button className="text-accent hover:underline" onClick={() => setAmount(balance.toFixed(2))}>
              Pay in full
            </button>
          </p>
        )}
      </div>
    </Modal>
  );
}
