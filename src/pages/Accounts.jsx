// Fleet & business accounts at a glance, and every open invoice the shop is waiting to be paid on
// (accounts receivable), aged by due date.
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Plus, HandCoins, Printer } from 'lucide-react';
import { useShop } from '../store/hooks';
import { PageHeader, Card, CardHeader, EmptyState, Segmented, Stat, Modal } from '../components/ui';
import AgingBar from '../components/AgingBar';
import { CustomerPicker, CustomerForm } from '../components/forms';
import AccountForm from './customer/AccountForm';
import ReceivePayment from './customer/ReceivePayment';
import { accountSummary, aging, openInvoices, termsLabel, isAccount } from '../lib/accounts';
import { money, money0, dateShort, fullName } from '../lib/format';

export default function Accounts() {
  const { state } = useShop();
  const navigate = useNavigate();
  const [view, setView] = useState('accounts');
  const [filter, setFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const [setup, setSetup] = useState(null);
  const [receiving, setReceiving] = useState(null);

  const accounts = useMemo(
    () =>
      state.customers
        .filter(isAccount)
        .map((c) => ({ c, s: accountSummary(state, c) }))
        .sort((a, b) => b.s.pastDue - a.s.pastDue || b.s.balance - a.s.balance || (a.c.company || '').localeCompare(b.c.company || '')),
    [state],
  );
  const invoices = useMemo(() => openInvoices(state), [state]);
  const buckets = useMemo(() => aging(invoices), [invoices]);
  const total = invoices.reduce((s, i) => s + i.balance, 0);
  const pastDue = invoices.filter((i) => i.pastDue > 0).reduce((s, i) => s + i.balance, 0);
  const overLimit = accounts.filter((a) => a.s.available != null && a.s.available < 0).length;
  const pmUnits = accounts.reduce((n, a) => n + a.s.pmOverdue + a.s.pmDue, 0);
  const shown = invoices
    .filter((i) => (filter === 'past' ? i.pastDue > 0 : filter === 'accounts' ? isAccount(i.customer) : true))
    .sort((a, b) => b.pastDue - a.pastDue || a.invoiced.localeCompare(b.invoiced));

  return (
    <>
      <PageHeader
        title="Fleet & accounts"
        subtitle={`${accounts.length} business account${accounts.length === 1 ? '' : 's'} · ${money0(total)} receivable`}
        actions={
          <button className="btn-primary" onClick={() => setAdding(true)}>
            <Plus size={15} /> Business account
          </button>
        }
      />
      <Card className="mb-6 grid grid-cols-2 divide-line p-1 md:grid-cols-4 md:divide-x">
        <Stat label="Receivable" value={money0(total)} sub={`${invoices.length} open invoice${invoices.length === 1 ? '' : 's'}`} />
        <Stat label="Past due" value={money0(pastDue)} sub={`${invoices.filter((i) => i.pastDue > 0).length} invoices`} />
        <Stat label="Over credit limit" value={overLimit} sub="accounts" />
        <Stat label="Units needing PM" value={pmUnits} sub="overdue or due soon" />
      </Card>

      <Segmented
        className="mb-4"
        value={view}
        onChange={setView}
        options={[
          { value: 'accounts', label: 'Accounts' },
          { value: 'receivables', label: 'Receivables' },
        ]}
      />

      {view === 'accounts' ? (
        <Card>
          {accounts.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No business accounts yet"
              body="Turn a fleet or commercial customer into an account to invoice on terms, track every unit’s maintenance, send statements and share a fleet portal."
              action={<button className="btn-primary" onClick={() => setAdding(true)}><Plus size={15} /> Business account</button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th className="hidden md:table-cell">Terms</th>
                    <th className="text-right">Units</th>
                    <th className="hidden text-right sm:table-cell">Need PM</th>
                    <th className="text-right">Balance</th>
                    <th className="text-right">Past due</th>
                    <th className="hidden lg:table-cell">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map(({ c, s }) => {
                    const used = s.creditLimit ? Math.min(1, s.balance / s.creditLimit) : null;
                    return (
                      <tr key={c.id} className="row-link" onClick={() => navigate(`/customers/${c.id}`)}>
                        <td>
                          <div className="font-medium">{c.company || fullName(c)}</div>
                          <div className="text-xs text-ink-3">{fullName(c)}{s.openOrders ? ` · ${s.openOrders} in the shop` : ''}</div>
                        </td>
                        <td className="hidden text-ink-2 md:table-cell">{termsLabel(c.account.terms)}</td>
                        <td className="tabular text-right">{s.units.length}</td>
                        <td className={`tabular hidden text-right sm:table-cell ${s.pmOverdue ? 'text-bad' : s.pmDue ? 'text-warn' : 'text-ink-3'}`}>{s.pmOverdue + s.pmDue || '—'}</td>
                        <td className="tabular text-right font-medium">{money(s.balance)}</td>
                        <td className={`tabular text-right ${s.pastDue > 0 ? 'font-medium text-bad' : 'text-ink-3'}`}>
                          {s.pastDue > 0 ? money(s.pastDue) : '—'}
                          {s.pastDue > 0 && <div className="text-xs font-normal">{s.oldest} days</div>}
                        </td>
                        <td className="hidden lg:table-cell">
                          {used == null ? (
                            <span className="text-xs text-ink-3">No limit</span>
                          ) : (
                            <div className="w-28">
                              <div className="h-1.5 overflow-hidden rounded-full bg-fill/[0.1]" role="img" aria-label={`${Math.round(used * 100)}% of credit used`}>
                                <div className={`h-full rounded-full ${used >= 1 ? 'bg-bad' : used >= 0.8 ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${Math.max(2, used * 100)}%` }} />
                              </div>
                              <div className="mt-0.5 text-xs text-ink-3">{money0(s.available)} of {money0(s.creditLimit)} left</div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <CardHeader title="Accounts receivable" subtitle="Every invoice with money still owed, aged by its due date" />
          {invoices.length === 0 ? (
            <EmptyState icon={HandCoins} title="Nothing owed" body="Every invoice is paid." />
          ) : (
            <>
              <AgingBar buckets={buckets} className="border-b border-line/70 px-4 py-4" />
              <div className="flex items-center gap-2 border-b border-line/70 px-4 py-2.5">
                <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'past', label: 'Past due' }, { value: 'accounts', label: 'Business accounts' }]} />
              </div>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Customer</th>
                      <th className="hidden md:table-cell">Invoiced</th>
                      <th>Due</th>
                      <th className="text-right">Balance</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((i) => (
                      <tr key={i.order.id}>
                        <td>
                          <Link to={`/orders/${i.order.id}`} className="tabular font-medium hover:underline">RO #{i.order.number}</Link>
                          {i.order.po && <div className="text-xs text-ink-3">PO {i.order.po}</div>}
                        </td>
                        <td>
                          {i.customer ? (
                            <Link to={`/customers/${i.customer.id}`} className="hover:underline">{isAccount(i.customer) ? i.customer.company : fullName(i.customer)}</Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="hidden text-ink-2 md:table-cell">{dateShort(i.invoiced)}</td>
                        <td className={i.pastDue > 0 ? 'text-bad' : 'text-ink-2'}>
                          {dateShort(i.due)}
                          {i.pastDue > 0 && <span className="block text-xs">{i.pastDue} days past due</span>}
                        </td>
                        <td className="tabular text-right font-medium">{money(i.balance)}</td>
                        <td>
                          <span className="flex justify-end gap-1">
                            {i.customer && isAccount(i.customer) && (
                              <Link to={`/customers/${i.customer.id}/statement`} className="btn-ghost btn-icon h-7 w-7" aria-label={`Statement for ${i.customer.company}`} title="Statement">
                                <Printer size={14} />
                              </Link>
                            )}
                            {i.customer && (
                              <button className="btn-ghost btn-icon h-7 w-7" onClick={() => setReceiving(i.customer)} aria-label={`Receive payment from ${fullName(i.customer)}`} title="Receive payment">
                                <HandCoins size={14} />
                              </button>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}

      {adding && <PickCustomer onClose={() => setAdding(false)} onPick={(c) => (setAdding(false), setSetup(c.id))} />}
      {setup && state.customers.find((c) => c.id === setup) && <AccountForm customer={state.customers.find((c) => c.id === setup)} onSaved={() => navigate(`/customers/${setup}`)} onClose={() => setSetup(null)} />}
      {receiving && <ReceivePayment customer={receiving} invoices={invoices.filter((i) => i.customer?.id === receiving.id)} onClose={() => setReceiving(null)} />}
    </>
  );
}

function PickCustomer({ onPick, onClose }) {
  const { state } = useShop();
  const [creating, setCreating] = useState(false);
  if (creating) return <CustomerForm open onClose={onClose} onSaved={(id) => onPick({ id, ...state.customers.find((c) => c.id === id) })} />;
  return (
    <Modal open onClose={onClose} title="New business account" subtitle="Pick the customer who runs the fleet, or add the company as a new customer.">
      <CustomerPicker value="" onChange={(id) => onPick(state.customers.find((c) => c.id === id) || { id })} onCreate={() => setCreating(true)} />
    </Modal>
  );
}
