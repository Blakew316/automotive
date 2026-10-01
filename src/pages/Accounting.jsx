import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Landmark, Receipt, Wallet, Percent, FileDown, Plus, Download, Pencil, Trash2, ArrowUpRight, Info } from 'lucide-react';
import { useShop, useUI } from '../store/hooks';
import { PageHeader, Card, CardHeader, Tabs, Segmented, Modal, Field, EmptyState, SearchInput } from '../components/ui';
import { ColumnChart, RankBars } from '../components/charts';
import { EXPENSE_CATEGORIES } from '../store/defaults';
import { ACCOUNTING_PERIODS, accountingRange, profitAndLoss, paymentsIn, expensesIn, salesTaxByMonth, invoicesCsv, paymentsCsv, expensesCsv, customersCsv, journalCsv, downloadCsv } from '../lib/accounting';
import { money, money0, moneyShort, pct, date, dateShort, time, fullName, isoDate, addDays } from '../lib/format';
import QuickBooksSync from './accounting/QuickBooksSync';

const TABS = [
  { value: 'pl', label: 'Profit & loss', icon: Landmark },
  { value: 'expenses', label: 'Expenses', icon: Receipt },
  { value: 'deposits', label: 'Deposits', icon: Wallet },
  { value: 'tax', label: 'Sales tax', icon: Percent },
  { value: 'export', label: 'QuickBooks & exports', icon: FileDown },
];

export default function Accounting() {
  const { state } = useShop();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'pl';
  // Early in a month, open on last month's complete books.
  const [period, setPeriod] = useState(() => (new Date().getDate() <= 5 ? 'last' : 'month'));
  const [editing, setEditing] = useState(null);
  const [from, to] = useMemo(() => accountingRange(period), [period]);
  const pl = useMemo(() => profitAndLoss(state, from, to), [state, from, to]);
  const label = `${dateShort(from)} – ${dateShort(addDays(to, -1))}`;

  return (
    <>
      <PageHeader
        title="Accounting"
        subtitle="Profit & loss, expenses, deposits and sales tax — synced to QuickBooks"
        actions={
          <button className="btn-primary" onClick={() => setEditing({ date: new Date().toISOString(), category: 'Shop supplies', vendor: '', amount: '', method: 'Card', memo: '' })}>
            <Plus size={15} /> Add expense
          </button>
        }
      />
      <Tabs className="mb-5" value={tab} onChange={(t) => setParams(t === 'pl' ? {} : { tab: t }, { replace: true })} tabs={TABS} />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented options={ACCOUNTING_PERIODS} value={period} onChange={setPeriod} />
        <span className="text-sm text-ink-3">{label}</span>
      </div>

      {tab === 'pl' && <ProfitLoss pl={pl} state={state} from={from} to={to} />}
      {tab === 'expenses' && <Expenses from={from} to={to} onEdit={setEditing} />}
      {tab === 'deposits' && <Deposits from={from} to={to} />}
      {tab === 'tax' && <SalesTax from={from} to={to} />}
      {tab === 'export' && <Exports from={from} to={to} label={label} />}

      {editing && <ExpenseForm expense={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function Kpi({ label, value, sub, tone = '' }) {
  return (
    <div className="px-4 py-3.5">
      <div className="text-sm text-ink-2">{label}</div>
      <div className={`mt-1 text-[24px] font-semibold leading-8 tracking-tight ${tone}`}>{value}</div>
      <div className="mt-0.5 truncate text-xs text-ink-3">{sub}</div>
    </div>
  );
}

function Line({ label, value, indent = 0, strong = false, muted = false, negative = false }) {
  return (
    <div className={`flex justify-between gap-4 py-1.5 text-sm ${strong ? 'font-semibold' : ''} ${muted ? 'text-ink-3' : ''}`} style={{ paddingLeft: indent * 16 }}>
      <span>{label}</span>
      <span className="tabular">{negative && value ? `(${money(value)})` : money(value)}</span>
    </div>
  );
}

function ProfitLoss({ pl, state, from, to }) {
  const months = useMemo(() => {
    const out = [];
    for (let d = new Date(from.getFullYear(), from.getMonth(), 1); d < to; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const m = profitAndLoss(state, d, end < to ? end : to);
      out.push({ key: d.toISOString(), label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), short: d.toLocaleDateString('en-US', { month: 'short' }), value: Math.round(m.netSales), sub: `Net income ${money0(m.net)}` });
    }
    return out;
  }, [state, from, to]);

  return (
    <>
      <Card className="mb-6 grid grid-cols-2 divide-line p-1 md:grid-cols-3 lg:grid-cols-5 lg:divide-x">
        <Kpi label="Net sales" value={money0(pl.netSales)} sub={`${pl.orders.length} invoiced ROs`} />
        <Kpi label="Gross profit" value={money0(pl.gross)} sub={`${pct(pl.grossPct)} margin after parts & tech pay`} />
        <Kpi label="Operating expenses" value={money0(pl.totalExpenses)} sub={`${pl.expenses.length} categories`} />
        <Kpi label="Net income" value={money0(pl.net)} sub={pl.netSales ? `${pct(pl.net / pl.netSales)} of sales` : '—'} tone={pl.net < 0 ? 'text-bad' : ''} />
        <Kpi label="Cash collected" value={money0(pl.collected)} sub="Payments incl. tips & surcharges" />
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Profit & loss statement" subtitle="Accrual basis — sales recognized on the invoice date" />
          <div className="divide-y divide-line/70 px-4 py-2">
            <div className="py-2">
              <div className="section-label mb-1">Income</div>
              <Line label="Labor" value={pl.income.labor} indent={1} />
              <Line label="Parts" value={pl.income.parts} indent={1} />
              <Line label="Shop fees & supplies" value={pl.income.fees + pl.income.supplies} indent={1} />
              <Line label="Sublet" value={pl.income.sublet} indent={1} />
              <Line label="Discounts" value={pl.income.discount} indent={1} negative />
              {pl.otherIncome > 0 && <Line label="Card surcharges" value={pl.otherIncome} indent={1} />}
              <Line label="Total income" value={pl.netSales + pl.otherIncome} strong />
            </div>
            <div className="py-2">
              <div className="section-label mb-1">Cost of sales</div>
              <Line label="Parts cost" value={pl.cogs.parts} indent={1} />
              <Line label="Sublet cost" value={pl.cogs.sublet} indent={1} />
              <Line label="Technician pay & commission" value={pl.cogs.techPay} indent={1} />
              <Line label="Total cost of sales" value={pl.totalCogs} strong />
            </div>
            <div className="py-2">
              <Line label="Gross profit" value={pl.gross} strong />
            </div>
            <div className="py-2">
              <div className="section-label mb-1">Operating expenses</div>
              {pl.expenses.map((e) => (
                <Line key={e.category} label={e.category} value={e.amount} indent={1} />
              ))}
              {!pl.expenses.length && <p className="py-1.5 pl-4 text-sm text-ink-3">No expenses recorded in this period.</p>}
              <Line label="Total operating expenses" value={pl.totalExpenses} strong />
            </div>
            <div className={`flex justify-between py-3 text-md font-semibold ${pl.net < 0 ? 'text-bad' : ''}`}>
              <span>Net income</span>
              <span className="tabular">{money(pl.net)}</span>
            </div>
            <div className="py-2">
              <div className="section-label mb-1">Collected for others (not income)</div>
              <Line label="Sales tax collected" value={pl.tax} indent={1} muted />
              <Line label="Tips for technicians" value={pl.tips} indent={1} muted />
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          {months.length > 1 && (
            <Card>
              <CardHeader title="Sales by month" subtitle="Hover a month for its net income" />
              <div className="px-3 pb-2 pt-3">
                <ColumnChart data={months} height={200} format={money0} tickFormat={moneyShort} label="Net sales by month" />
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title="Where the money goes" subtitle="Cost of sales and overhead" />
            <div className="p-4">
              {pl.totalCogs + pl.totalExpenses === 0 && <p className="text-sm text-ink-3">No costs recorded in this period.</p>}
              <RankBars
                format={money0}
                rows={[
                  { label: 'Parts cost', value: pl.cogs.parts },
                  { label: 'Technician pay', value: pl.cogs.techPay },
                  ...pl.expenses.map((e) => ({ label: e.category, value: e.amount })),
                  { label: 'Sublet cost', value: pl.cogs.sublet },
                ]
                  .filter((r) => r.value > 0)
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 8)}
              />
            </div>
          </Card>
          <p className="flex items-start gap-2 text-xs text-ink-3">
            <Info size={13} className="mt-0.5 shrink-0" />
            <span>
              Technician pay comes from the time clock and each tech’s pay plan (<Link to="/team?tab=pay" className="link">Team → Pay</Link>). Part costs come from each RO line. This is a management report — have your accountant review before filing.
            </span>
          </p>
        </div>
      </div>
    </>
  );
}

function Expenses({ from, to, onEdit }) {
  const { state, deleteExpense } = useShop();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const list = expensesIn(state, from, to)
    .filter((e) => !cat || e.category === cat)
    .filter((e) => !q || `${e.vendor} ${e.memo} ${e.category}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = list.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-line/70 px-4 py-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search vendor or memo" className="w-full sm:w-64" />
        <select className="input h-8 w-auto py-0 text-sm" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <span className="ml-auto text-sm text-ink-2">
          {list.length} expense{list.length === 1 ? '' : 's'} · <span className="tabular font-semibold text-ink">{money(total)}</span>
        </span>
      </div>
      {list.length ? (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Vendor</th>
                <th>Category</th>
                <th className="hidden md:table-cell">Paid with</th>
                <th className="text-right">Amount</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className="group">
                  <td className="whitespace-nowrap text-ink-2">{date(e.date)}</td>
                  <td>
                    <div className="font-medium">{e.vendor || '—'}</div>
                    {e.memo && <div className="text-xs text-ink-3">{e.memo}</div>}
                  </td>
                  <td>
                    <span className="chip">{e.category}</span>
                  </td>
                  <td className="hidden text-ink-2 md:table-cell">{e.method}</td>
                  <td className="tabular text-right font-medium">{money(Number(e.amount) || 0)}</td>
                  <td className="text-right">
                    <span className="inline-flex opacity-60 group-hover:opacity-100">
                      <button className="btn-ghost btn-icon h-7 w-7" onClick={() => onEdit(e)} aria-label="Edit expense">
                        <Pencil size={13} />
                      </button>
                      <button className="btn-ghost btn-icon h-7 w-7" onClick={() => deleteExpense(e.id)} aria-label="Delete expense">
                        <Trash2 size={13} />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Receipt} title="No expenses" body="Record rent, utilities, software and other overhead to see true profit." className="py-12" />
      )}
    </Card>
  );
}

const EXPENSE_METHODS = ['Card', 'ACH', 'Check', 'Cash', 'Other'];

function ExpenseForm({ expense, onClose }) {
  const { saveExpense } = useShop();
  const { toast } = useUI();
  const [f, setF] = useState({ ...expense, amount: expense.amount === '' ? '' : String(expense.amount) });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const amount = parseFloat(f.amount);
  const valid = f.vendor.trim() && amount > 0 && f.date;
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={expense.id ? 'Edit expense' : 'Add expense'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!valid}
            onClick={() => {
              saveExpense({ ...f, vendor: f.vendor.trim(), amount: Math.round(amount * 100) / 100 });
              toast(expense.id ? 'Expense updated' : 'Expense added', { tone: 'success' });
              onClose();
            }}
          >
            Save
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vendor / payee" className="col-span-2">{(id) => <input id={id} className="input" value={f.vendor} onChange={set('vendor')} autoFocus />}</Field>
        <Field label="Amount">{(id) => <input id={id} className="input" inputMode="decimal" placeholder="0.00" value={f.amount} onChange={set('amount')} />}</Field>
        <Field label="Date">{(id) => <input id={id} type="date" className="input" value={isoDate(new Date(f.date))} onChange={(e) => e.target.value && setF({ ...f, date: new Date(`${e.target.value}T12:00:00`).toISOString() })} />}</Field>
        <Field label="Category">
          {(id) => (
            <select id={id} className="input" value={f.category} onChange={set('category')}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Paid with">
          {(id) => (
            <select id={id} className="input" value={f.method} onChange={set('method')}>
              {EXPENSE_METHODS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Memo" className="col-span-2">{(id) => <input id={id} className="input" value={f.memo} onChange={set('memo')} />}</Field>
      </div>
    </Modal>
  );
}

function Deposits({ from, to }) {
  const { state } = useShop();
  const list = paymentsIn(state, from, to);
  const byMethod = new Map();
  list.forEach((p) => byMethod.set(p.method, (byMethod.get(p.method) || 0) + p.deposit));
  const days = new Map();
  list.forEach((p) => {
    const k = isoDate(new Date(p.at));
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(p);
  });
  const total = list.reduce((s, p) => s + p.deposit, 0);
  const tips = list.reduce((s, p) => s + p.tip, 0);
  const surcharges = list.reduce((s, p) => s + p.surcharge, 0);

  if (!list.length) return <Card><EmptyState icon={Wallet} title="No payments in this period" body="Payments recorded on repair orders appear here, grouped by day for bank reconciliation." className="py-12" /></Card>;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader title="Payments by day" subtitle="Match these totals to your bank and card processor deposits" />
        {[...days.entries()].map(([day, items]) => (
          <div key={day}>
            <div className="flex justify-between bg-fill/[0.05] px-4 py-1.5 text-xs font-semibold text-ink-2">
              <span>{date(`${day}T12:00:00`)}</span>
              <span className="tabular">{money(items.reduce((s, p) => s + p.deposit, 0))}</span>
            </div>
            <ul className="divide-y divide-line/60">
              {items.map((p) => (
                <li key={p.id}>
                  <Link to={`/orders/${p.order.id}`} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-fill/[0.04]">
                    <span className="w-16 shrink-0 text-xs text-ink-3">{time(p.at)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      #{p.order.number} · {fullName(p.customer)}
                      {(p.tip > 0 || p.surcharge > 0) && (
                        <span className="block text-xs text-ink-3">
                          {money(p.amount)} applied{p.tip > 0 ? ` · ${money(p.tip)} tip` : ''}
                          {p.surcharge > 0 ? ` · ${money(p.surcharge)} surcharge` : ''}
                        </span>
                      )}
                    </span>
                    <span className="chip">{p.method}</span>
                    <span className="tabular w-24 text-right font-medium">{money(p.deposit)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader title="By payment method" subtitle={`${money(total)} received`} />
          <div className="p-4">
            <RankBars rows={[...byMethod.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))} format={money} />
          </div>
        </Card>
        <Card>
          <dl className="px-4 py-2 text-sm">
            <div className="flex justify-between border-b border-line/60 py-2"><dt className="text-ink-2">Applied to invoices</dt><dd className="tabular">{money(total - tips - surcharges)}</dd></div>
            <div className="flex justify-between border-b border-line/60 py-2"><dt className="text-ink-2">Tips (owed to techs)</dt><dd className="tabular">{money(tips)}</dd></div>
            <div className="flex justify-between py-2"><dt className="text-ink-2">Card surcharges</dt><dd className="tabular">{money(surcharges)}</dd></div>
          </dl>
        </Card>
      </div>
    </div>
  );
}

function SalesTax({ from, to }) {
  const { state } = useShop();
  const rows = salesTaxByMonth(state, from, to);
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  const shop = state.shop;
  return (
    <Card>
      <CardHeader
        title="Sales tax summary"
        subtitle={`${shop.taxRate}% on parts, fees and supplies${shop.taxLabor ? ' and labor' : ' (labor not taxed)'}`}
        actions={
          <Link to="/settings" className="btn-plain btn-sm">
            Tax settings <ArrowUpRight size={13} />
          </Link>
        }
      />
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="text-right">ROs</th>
                <th className="text-right">Gross sales</th>
                <th className="text-right">Taxable sales</th>
                <th className="hidden text-right sm:table-cell">Exempt sales</th>
                <th className="text-right">Tax collected</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="font-medium">{r.label}</td>
                  <td className="tabular text-right text-ink-2">{r.orders}</td>
                  <td className="tabular text-right">{money(r.gross)}</td>
                  <td className="tabular text-right">{money(r.taxable)}</td>
                  <td className="tabular hidden text-right sm:table-cell">{money(r.exempt)}</td>
                  <td className="tabular text-right font-semibold">{money(r.tax)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td>Total</td>
                <td className="tabular text-right">{sum('orders')}</td>
                <td className="tabular text-right">{money(sum('gross'))}</td>
                <td className="tabular text-right">{money(sum('taxable'))}</td>
                <td className="tabular hidden text-right sm:table-cell">{money(sum('exempt'))}</td>
                <td className="tabular text-right">{money(sum('tax'))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <EmptyState icon={Percent} title="No invoiced sales in this period" className="py-12" />
      )}
      <p className="border-t border-line/70 px-4 py-2 text-xs text-ink-3">Gross sales are after discounts and before tax. Use these totals for your state sales tax return; tax-exempt ROs (fleet, resale, government) are listed separately.</p>
    </Card>
  );
}

function Exports({ from, to, label }) {
  const { state } = useShop();
  const { toast } = useUI();
  const stamp = `${isoDate(from)}-to-${isoDate(addDays(to, -1))}`;
  const counts = {
    invoices: state.orders.filter((o) => o.invoicedAt && new Date(o.invoicedAt) >= from && new Date(o.invoicedAt) < to).length,
    payments: paymentsIn(state, from, to).length,
    expenses: expensesIn(state, from, to).length,
  };
  const files = [
    { key: 'invoices', title: 'Invoices', body: 'Every invoiced RO, one row per line item, with tax flags and the VIN in the memo. Matches QuickBooks Online’s invoice import.', count: `${counts.invoices} invoices`, make: () => invoicesCsv(state, from, to), file: `invoices-${stamp}.csv` },
    { key: 'payments', title: 'Payments received', body: 'Payment date, RO, customer, method, tips and surcharges — for receiving payments and bank reconciliation.', count: `${counts.payments} payments`, make: () => paymentsCsv(state, from, to), file: `payments-${stamp}.csv` },
    { key: 'expenses', title: 'Expenses', body: 'Date, description and amount (negative for money out) in the bank-upload layout, plus category and payee columns.', count: `${counts.expenses} expenses`, make: () => expensesCsv(state, from, to), file: `expenses-${stamp}.csv` },
    { key: 'journal', title: 'Daily sales journal', body: 'One balanced journal entry per day (receivables, income by type, sales tax, tips). Use instead of invoices if your accountant posts summaries.', count: label, make: () => journalCsv(state, from, to), file: `sales-journal-${stamp}.csv` },
    { key: 'customers', title: 'Customer list', body: 'Names, contact details and addresses for setting up customers in QuickBooks before importing invoices.', count: `${state.customers.length} customers`, make: () => customersCsv(state), file: 'customers.csv' },
  ];
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="xl:col-span-2">
        <QuickBooksSync from={from} to={to} label={label} />
      </div>
      <Card>
        <CardHeader title="Exports" subtitle={`For ${label}`} />
        <ul className="divide-y divide-line/70">
          {files.map((f) => (
            <li key={f.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{f.title}</div>
                <p className="text-xs text-ink-3">{f.body}</p>
              </div>
              <span className="text-xs text-ink-3">{f.count}</span>
              <button
                className="btn-secondary btn-sm"
                onClick={() => {
                  downloadCsv(f.make(), f.file);
                  toast(`${f.title} exported`, { tone: 'success' });
                }}
              >
                <Download size={13} /> CSV
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Importing files into QuickBooks" subtitle="Without the direct connection, or for invoices and expenses" />
        <ol className="list-decimal space-y-2 py-3 pl-9 pr-4 text-sm text-ink-2">
          <li>Import the <b>customer list</b> first so invoice names match.</li>
          <li>
            In QuickBooks, open <b>Settings → Import data</b> and choose the type (Customers, Invoices, Journal entries). Upload the CSV and map the columns — the headers here use QuickBooks’ own field names.
          </li>
          <li>
            For <b>expenses</b>, use <b>Transactions → Bank transactions → Upload from file</b> on the account you paid from, then categorize.
          </li>
          <li>Record <b>payments</b> against the imported invoices, or deposit them in bulk using the daily totals on the Deposits tab.</li>
        </ol>
        <p className="border-t border-line/70 px-4 py-2.5 text-xs text-ink-3">
          The same files open in Excel, Google Sheets, Xero, Wave and QuickBooks Desktop’s spreadsheet import. Products/services named Labor, Parts, Shop fees, Sublet, Shop supplies and Discount should exist in QuickBooks before importing invoices.
        </p>
      </Card>
    </div>
  );
}
