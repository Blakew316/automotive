import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, MessageSquare, Mail, Plus, Trash2, ShieldAlert, ScanLine, ChevronRight, PenLine, HandCoins, Receipt, Building2, CalendarClock } from 'lucide-react';
import { orderProfit, profitTone, TONE_TEXT, TONE_BG } from '../../lib/profit';
import { useShop, useUI, useTotals, useSite } from '../../store/hooks';
import { Card, CardHeader, Avatar, CopyButton, NumInput, Modal, Field, Mono, ExternalLink, Toggle, InlineText } from '../../components/ui';
import { accountSummary, dueDate, hasTerms, termsLabel } from '../../lib/accounts';
import TransportCard from './TransportCard';
import { AuthorizationLog } from './AuthorizeModal';
import { financingOffer } from '../../lib/financing';
import { money, fullName, vehicleName, phone, dateShort, time, number, round2 } from '../../lib/format';
import { PAYMENT_METHODS } from '../../lib/workflow';
import { nhtsaVinRecallUrl } from '../../lib/nhtsa';
import CallButton from '../../components/CallButton';

const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function OrderSidebar({ order, customer, vehicle, editable, onTakePayment, onCharge, onCompose, onAuthorize }) {
  const { state, updateOrder, removePayment } = useShop();
  const totals = useTotals();
  const site = useSite();
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
              {customer.phone ? (
                <CallButton customer={customer} orderId={order.id} className="btn-secondary btn-sm h-auto flex-col gap-0.5 py-1.5">
                  <Phone size={15} /> Call
                </CallButton>
              ) : (
                <button className="btn-secondary btn-sm flex-col gap-0.5 py-1.5" style={{ height: 'auto' }} disabled>
                  <Phone size={15} /> Call
                </button>
              )}
              <button onClick={() => onCompose({ channel: 'sms', templateId: 'update' })} disabled={!customer.phone} className="btn-secondary btn-sm flex-col gap-0.5 py-1.5" style={{ height: 'auto' }}>
                <MessageSquare size={15} /> Text
              </button>
              <button onClick={() => onCompose({ channel: 'email', templateId: 'update' })} disabled={!customer.email} className="btn-secondary btn-sm flex-col gap-0.5 py-1.5" style={{ height: 'auto' }}>
                <Mail size={15} /> Email
              </button>
            </div>
          </>
        ) : (
          <div className="p-4 text-sm text-ink-3">No customer on this order.</div>
        )}
      </Card>

      {customer?.account && <AccountTerms order={order} customer={customer} total={t.total} />}

      {vehicle && (
        <Card>
          <Link to={`/vehicles/${vehicle.id}`} className="flex items-center gap-3 px-4 pb-2 pt-3.5 transition-colors hover:bg-fill/[0.04]">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{vehicle.unit ? <span className="mr-1.5 text-ink-2">Unit {vehicle.unit}</span> : null}{vehicleName(vehicle)}</div>
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
          {site.multi && (
            <Field label="Location">
              {(id) => (
                <select id={id} className="input" value={order.locationId || 'main'} onChange={(e) => updateOrder(order.id, { locationId: e.target.value === 'main' ? null : e.target.value })}>
                  {site.sites.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              )}
            </Field>
          )}
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

      {order.status !== 'closed' || order.transport || order.checkin ? <TransportCard order={order} customer={customer} /> : null}

      <Card>
        <CardHeader title="Totals" subtitle={t.hours ? `${t.hours} labor hours` : undefined} />
        <dl className="px-4 py-2 text-sm">
          <Row label="Labor" value={t.labor} />
          <Row label="Parts" value={t.parts} />
          {t.fees > 0 && <Row label="Fees" value={t.fees} />}
          {t.noCharge > 0 && (
            <div className="flex items-center justify-between py-1">
              <dt className="text-ink-2">No-charge work</dt>
              <dd className="tabular text-ink-3 line-through">{money(t.noCharge)}</dd>
            </div>
          )}
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
        <ProfitMeter order={order} />
        {t.declined > 0 && <div className="border-t border-line/70 px-4 py-2 text-xs text-ink-3">{money(t.declined)} declined — follow up from Marketing</div>}
      </Card>

      {(order.authorizations?.length > 0 || t.pending > 0) && (
        <Card>
          <CardHeader
            title="Authorizations"
            subtitle={t.pending ? `${t.pending} service${t.pending === 1 ? '' : 's'} awaiting approval` : undefined}
            actions={
              t.pending > 0 && (
                <button className="btn-plain btn-sm" onClick={onAuthorize}>
                  <PenLine size={13} /> Authorize
                </button>
              )
            }
          />
          {order.authorizations?.length ? <AuthorizationLog order={order} /> : <p className="px-4 py-3 text-sm text-ink-3">No approvals recorded yet.</p>}
        </Card>
      )}

      <FinancingCard order={order} total={t.total} />

      <Card>
        <CardHeader
          title="Payments"
          actions={
            order.status !== 'estimate' && (
              <span className="flex gap-1">
                {customer && t.balance > 0.004 && ['ready', 'closed'].includes(order.status) && (
                  <button className="btn-plain btn-sm" onClick={() => onCompose({ templateId: 'pay' })} title="Text or email a payment link">
                    <HandCoins size={14} /> Request
                  </button>
                )}
                {hasTerms(customer) && order.status === 'ready' && t.balance > 0.004 && (
                  <button className="btn-plain btn-sm" onClick={onCharge}>
                    <Building2 size={14} /> Charge
                  </button>
                )}
                <button className="btn-plain btn-sm" onClick={onTakePayment} disabled={t.balance <= 0.004}>
                  <Plus size={14} /> Take payment
                </button>
              </span>
            )
          }
        />
        {order.charge && (
          <div className="flex items-start gap-2.5 border-b border-line/70 px-4 py-2.5 text-sm">
            <CalendarClock size={15} className="mt-0.5 shrink-0 text-ink-3" />
            <div className="min-w-0 flex-1">
              <div>Charged to account · {termsLabel(order.charge.terms)}</div>
              <div className="text-xs text-ink-3">
                {dateShort(order.charge.at)} · due {dateShort(order.charge.dueAt)}
                {t.balance > 0.004 && new Date(order.charge.dueAt) < new Date() ? <span className="text-bad"> · past due</span> : ''}
              </div>
            </div>
          </div>
        )}
        {order.payments.length === 0 ? (
          <p className="px-4 py-3 text-sm text-ink-3">{order.status === 'estimate' ? 'Payments open once the estimate is approved.' : order.charge ? 'No payments yet — on the account’s statement.' : 'No payments yet.'}</p>
        ) : (
          <ul className="divide-y divide-line/70">
            {order.payments.map((p) => (
              <li key={p.id} className="group flex items-center gap-3 px-4 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div>{p.method}{p.ref ? <span className="text-ink-3"> · {p.ref}</span> : null}</div>
                  <div className="text-xs text-ink-3">
                    {dateShort(p.at)}, {time(p.at)}
                    {p.tip > 0 ? ` · tip ${money(p.tip)}` : ''}
                    {p.surcharge > 0 ? ` · surcharge ${money(p.surcharge)}` : ''}
                  </div>
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

/** Business account terms on the RO: PO number, pre-approved amount, credit and due date. */
function AccountTerms({ order, customer, total }) {
  const { state, updateOrder } = useShop();
  const a = customer.account;
  const sum = accountSummary(state, customer);
  const missingPo = a.poRequired && !order.po;
  const within = a.preApproved ? total <= a.preApproved : null;
  return (
    <Card>
      <Link to={`/customers/${customer.id}`} className="flex items-center gap-2 px-4 pb-2 pt-3 transition-colors hover:bg-fill/[0.04]">
        <Building2 size={15} className="shrink-0 text-ink-3" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{customer.company}</span>
        <span className="text-xs text-ink-3">{termsLabel(a.terms)}</span>
        <ChevronRight size={15} className="text-ink-4" />
      </Link>
      <dl className="px-4 pb-3 text-sm">
        <div className="flex items-center justify-between gap-2 py-1">
          <dt className={missingPo ? 'text-bad' : 'text-ink-3'}>PO #{a.poRequired ? ' (required)' : ''}</dt>
          <dd className="w-36">
            <InlineText
              value={order.po || ''}
              placeholder={a.poRequired ? 'Needed to invoice' : 'Optional'}
              onCommit={(po) => updateOrder(order.id, { po: po.trim() })}
              className={`input h-7 text-right text-sm ${missingPo ? 'border-bad/60' : ''}`}
              aria-label="PO number"
            />
          </dd>
        </div>
        {a.preApproved && order.status === 'estimate' && (
          <div className="flex justify-between gap-2 py-1">
            <dt className="text-ink-3">Pre-approved up to</dt>
            <dd className={within ? 'text-ok' : 'text-warn'}>{money(a.preApproved)} · {within ? 'within limit' : 'call for approval'}</dd>
          </div>
        )}
        <div className="flex justify-between gap-2 py-1">
          <dt className="text-ink-3">Account balance</dt>
          <dd className="tabular">
            {money(sum.balance)}
            {sum.pastDue > 0 && <span className="text-bad"> · {money(sum.pastDue)} past due</span>}
          </dd>
        </div>
        {a.creditLimit && (
          <div className="flex justify-between gap-2 py-1">
            <dt className="text-ink-3">Credit available</dt>
            <dd className={`tabular ${sum.available < 0 ? 'text-bad' : ''}`}>{money(sum.available)}</dd>
          </div>
        )}
        {['ready', 'closed'].includes(order.status) && hasTerms(customer) && (
          <div className="flex justify-between gap-2 py-1">
            <dt className="text-ink-3">Invoice due</dt>
            <dd>{dateShort(dueDate(order, customer))}</dd>
          </div>
        )}
        {a.taxExempt && !order.taxExempt && <p className="pt-1 text-xs text-warn">This account is tax exempt, but tax is being charged on this RO.</p>}
      </dl>
    </Card>
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

function FinancingCard({ order, total }) {
  const { state } = useShop();
  const offer = financingOffer(state.shop, total);
  if (!offer || order.status === 'closed') return null;
  return (
    <Card className="px-4 py-3">
      <div className="flex items-start gap-2.5">
        <HandCoins size={16} className="mt-0.5 shrink-0 text-ink-3" />
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-medium">
            As low as {money(offer.monthly)}/mo
            <span className="font-normal text-ink-3"> for {offer.months} months</span>
          </div>
          <div className="text-xs text-ink-3">
            {offer.terms.map((x) => `${money(x.monthly)} × ${x.months}`).join(' · ')} · {offer.apr}% APR example{offer.provider ? ` · ${offer.provider}` : ''}
          </div>
          {offer.url && (
            <ExternalLink href={offer.url} className="mt-1 text-xs">
              Application link
            </ExternalLink>
          )}
        </div>
      </div>
    </Card>
  );
}

export function PaymentModal({ order, onClose, onReceipt }) {
  const { state, addPayment } = useShop();
  const { toast } = useUI();
  const totals = useTotals();
  const pay = state.shop.payments || {};
  const balance = Math.max(0, totals(order).balance);
  const [amount, setAmount] = useState(balance.toFixed(2));
  const [method, setMethod] = useState('Card');
  const [ref, setRef] = useState('');
  const [tipPct, setTipPct] = useState(0);
  const [tipCustom, setTipCustom] = useState('');
  const [sendReceipt, setSendReceipt] = useState(true);
  const n = round2(parseFloat(amount) || 0);
  const tip = round2(tipCustom !== '' ? parseFloat(tipCustom) || 0 : (n * tipPct) / 100);
  const surcharge = method === 'Card' && pay.surchargePct > 0 ? round2(((n + tip) * pay.surchargePct) / 100) : 0;
  const charge = round2(n + tip + surcharge);

  const submit = () => {
    if (n <= 0) return;
    addPayment(order.id, { amount: n, method, ref, tip, surcharge });
    toast(`${money(charge)} ${method.toLowerCase()} payment recorded`, { tone: 'success' });
    onClose();
    if (sendReceipt) onReceipt?.(charge);
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
          <button className="btn-primary" disabled={n <= 0} onClick={submit}>Charge {money(charge)}</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Amount toward invoice">
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
            {PAYMENT_METHODS.filter((m) => m !== 'Fleet account').map((m) => (
              <button key={m} onClick={() => setMethod(m)} className={`chip h-7 ${method === m ? 'border-accent bg-accent/[0.08] text-ink' : 'hover:bg-fill/[0.05]'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
        {pay.tipsEnabled && (
          <div>
            <span className="field-label">Tip</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[0, 10, 15, 20].map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setTipPct(p);
                    setTipCustom('');
                  }}
                  className={`chip h-7 ${tipCustom === '' && tipPct === p ? 'border-accent bg-accent/[0.08] text-ink' : 'hover:bg-fill/[0.05]'}`}
                >
                  {p ? `${p}%` : 'No tip'}
                </button>
              ))}
              <input inputMode="decimal" placeholder="Custom $" value={tipCustom} onChange={(e) => setTipCustom(e.target.value)} className="input h-7 w-24 py-0 text-sm" aria-label="Custom tip" />
            </div>
          </div>
        )}
        <Field label="Reference" hint="Terminal approval code, last 4, check #…">{(id) => <input id={id} className="input" value={ref} onChange={(e) => setRef(e.target.value)} />}</Field>
        <dl className="space-y-1 rounded-[10px] bg-fill/[0.06] px-3 py-2 text-sm">
          <div className="flex justify-between"><dt className="text-ink-2">Toward invoice</dt><dd className="tabular">{money(n)}</dd></div>
          {tip > 0 && <div className="flex justify-between"><dt className="text-ink-2">Tip</dt><dd className="tabular">{money(tip)}</dd></div>}
          {surcharge > 0 && <div className="flex justify-between"><dt className="text-ink-2">Card surcharge ({pay.surchargePct}%)</dt><dd className="tabular">{money(surcharge)}</dd></div>}
          <div className="flex justify-between border-t border-line/70 pt-1 font-semibold"><dt>Charge</dt><dd className="tabular">{money(charge)}</dd></div>
        </dl>
        {n > 0 && n < balance && (
          <p className="text-xs text-ink-3">
            Partial payment — {money(balance - n)} will remain.{' '}
            <button className="text-accent hover:underline" onClick={() => setAmount(balance.toFixed(2))}>
              Pay in full
            </button>
          </p>
        )}
        {onReceipt && (
          <label className="flex items-center justify-between gap-3 text-sm text-ink-2">
            <span className="flex items-center gap-2">
              <Receipt size={14} className="text-ink-3" /> Send a receipt after recording
            </span>
            <Toggle checked={sendReceipt} onChange={setSendReceipt} label="Send receipt" />
          </label>
        )}
      </div>
    </Modal>
  );
}

/** GP%, GP$ and GP per labor hour with a bar against the shop's target. */
function ProfitMeter({ order }) {
  const { state } = useShop();
  const p = orderProfit(order, state.shop, state.technicians);
  const target = state.shop.goals?.gpPct ?? 55;
  const tone = profitTone(p.gpPct, target);
  if (p.revenue <= 0) return null;
  return (
    <div className="border-t border-line/70 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="section-label">Job profit</span>
        <span className="text-2xs text-ink-3">Target {target}% GP</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className={`tabular text-lg font-semibold ${TONE_TEXT[tone]}`}>{Math.round(p.gpPct * 100)}%</div>
          <div className="text-2xs text-ink-3">GP%</div>
        </div>
        <div>
          <div className="tabular text-lg font-semibold">{money(p.gp)}</div>
          <div className="text-2xs text-ink-3">GP$</div>
        </div>
        <div>
          <div className="tabular text-lg font-semibold">{p.gpHr == null ? '—' : money(p.gpHr)}</div>
          <div className="text-2xs text-ink-3">GP / labor hr</div>
        </div>
      </div>
      <div className="relative mt-2.5 h-1.5 rounded-full bg-fill/[0.14]">
        <div className={`h-full rounded-full ${TONE_BG[tone]}`} style={{ width: `${Math.max(0, Math.min(100, p.gpPct * 100))}%` }} />
        <span className="absolute -top-0.5 h-2.5 w-[2px] rounded-full bg-ink-2" style={{ left: `${target}%` }} title={`Target ${target}%`} />
      </div>
    </div>
  );
}
