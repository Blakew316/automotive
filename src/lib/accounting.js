// Bookkeeping views over the shop's own records: profit & loss, deposits, sales tax, and exports
// shaped for QuickBooks Online's import screens (and readable by any spreadsheet or ledger app).
import { orderTotals, itemTotal, totalsCalculator } from './pricing';
import { teamSummary } from './time';
import { toCsv } from './serviceHistory';
import { addDays, fullName, isoDate, startOfDay, vehicleName, round2 } from './format';
import { processingFees } from './payments';

export const ACCOUNTING_PERIODS = [
  { value: 'month', label: 'This month' },
  { value: 'last', label: 'Last month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'ytd', label: 'Year to date' },
  { value: '12m', label: '12 months' },
];

export function accountingRange(p, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const tomorrow = addDays(startOfDay(now), 1);
  if (p === 'last') return [new Date(y, m - 1, 1), new Date(y, m, 1)];
  if (p === 'quarter') return [new Date(y, m - (m % 3), 1), tomorrow];
  if (p === 'ytd') return [new Date(y, 0, 1), tomorrow];
  if (p === '12m') return [new Date(y, m - 11, 1), tomorrow];
  return [new Date(y, m, 1), tomorrow];
}

const inRange = (iso, from, to) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t < to.getTime();
};

/** Orders recognized as sales in the period (accrual basis: the invoice date). */
export const invoicedIn = (state, from, to) => state.orders.filter((o) => inRange(o.invoicedAt, from, to));

/** Every payment received in the period with its order and customer. */
export function paymentsIn(state, from, to) {
  const out = [];
  for (const o of state.orders) {
    for (const p of o.payments || []) {
      if (!inRange(p.at, from, to)) continue;
      const amount = Number(p.amount) || 0;
      const tip = Number(p.tip) || 0;
      const surcharge = Number(p.surcharge) || 0;
      out.push({ ...p, order: o, customer: state.customers.find((c) => c.id === o.customerId), amount, tip, surcharge, deposit: round2(amount + tip + surcharge) });
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export const expensesIn = (state, from, to) => state.expenses.filter((e) => inRange(e.date, from, to));

/**
 * Profit & loss for the period. Income and cost of sales come from invoiced repair orders,
 * technician pay from the time clock and pay plans, overhead from the expense ledger.
 */
export function profitAndLoss(state, from, to) {
  const totals = totalsCalculator(state.shop);
  const orders = invoicedIn(state, from, to);
  const income = { labor: 0, parts: 0, fees: 0, sublet: 0, supplies: 0, discount: 0 };
  const cogs = { parts: 0, sublet: 0, techPay: 0 };
  let tax = 0;
  for (const o of orders) {
    const t = totals(o);
    income.labor += t.labor;
    income.parts += t.parts;
    income.fees += t.fees;
    income.sublet += t.sublet;
    income.supplies += t.supplies;
    income.discount += t.discount;
    tax += t.tax;
    for (const s of o.services) {
      if (s.status === 'declined') continue;
      for (const i of s.items) {
        const c = (Number(i.qty) || 0) * (Number(i.cost) || 0);
        if (i.type === 'part') cogs.parts += c;
        if (i.type === 'sublet') cogs.sublet += c;
      }
    }
  }
  const team = teamSummary(state, from, to);
  cogs.techPay = team.reduce((s, r) => s + r.totalPay, 0);

  const payments = paymentsIn(state, from, to);
  const surcharges = payments.reduce((s, p) => s + p.surcharge, 0);
  const tips = payments.reduce((s, p) => s + p.tip, 0);

  const netSales = income.labor + income.parts + income.fees + income.sublet + income.supplies - income.discount;
  const otherIncome = surcharges;
  const totalCogs = cogs.parts + cogs.sublet + cogs.techPay;
  const gross = netSales + otherIncome - totalCogs;

  const byCategory = new Map();
  for (const e of expensesIn(state, from, to)) byCategory.set(e.category, (byCategory.get(e.category) || 0) + (Number(e.amount) || 0));
  // Fees Stripe kept on online payments (recorded with each payment).
  const cardFees = processingFees(payments);
  if (cardFees > 0.004) byCategory.set('Card processing (Stripe)', (byCategory.get('Card processing (Stripe)') || 0) + cardFees);
  const expenses = [...byCategory.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  return {
    orders,
    income,
    netSales,
    otherIncome,
    surcharges,
    cogs,
    totalCogs,
    gross,
    grossPct: netSales ? gross / (netSales + otherIncome) : 0,
    expenses,
    totalExpenses,
    net: gross - totalExpenses,
    tax,
    tips,
    collected: payments.reduce((s, p) => s + p.deposit, 0),
    team,
  };
}

/** Sales tax by month: what was taxable, what was exempt, and what was collected. */
export function salesTaxByMonth(state, from, to) {
  const shop = state.shop;
  const months = new Map();
  for (const o of invoicedIn(state, from, to)) {
    const d = new Date(o.invoicedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const row = months.get(key) || { key, label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), gross: 0, taxable: 0, exempt: 0, tax: 0, orders: 0 };
    const t = orderTotals(o, shop);
    const net = t.subtotal - t.discount;
    const taxableGross = t.parts + t.fees + t.sublet + t.supplies + (shop.taxLabor ? t.labor : 0);
    const taxableNet = t.subtotal > 0 ? taxableGross - t.discount * (taxableGross / t.subtotal) : 0;
    row.gross += net;
    if (o.taxExempt) row.exempt += net;
    else row.taxable += taxableNet;
    row.tax += t.tax;
    row.orders += 1;
    months.set(key, row);
  }
  return [...months.values()].sort((a, b) => b.key.localeCompare(a.key));
}

// ---------------------------------------------------------------- Exports

const d = (iso) => {
  const x = new Date(iso);
  return `${String(x.getMonth() + 1).padStart(2, '0')}/${String(x.getDate()).padStart(2, '0')}/${x.getFullYear()}`;
};
const n2 = (x) => (Math.round((Number(x) || 0) * 100) / 100).toFixed(2);

const PRODUCT = { labor: 'Labor', part: 'Parts', fee: 'Shop fees', sublet: 'Sublet' };

/** QuickBooks Online "Import invoices" layout — one row per line item. */
export function invoicesCsv(state, from, to) {
  const shop = state.shop;
  const rows = [];
  for (const o of invoicedIn(state, from, to)) {
    const c = state.customers.find((x) => x.id === o.customerId);
    const v = state.vehicles.find((x) => x.id === o.vehicleId);
    const t = orderTotals(o, shop);
    const memo = `RO #${o.number}${v ? ` · ${vehicleName(v)}${v.vin ? ` · VIN ${v.vin}` : ''}` : ''}`;
    const base = [o.number, fullName(c), d(o.invoicedAt), d(o.invoicedAt), 'Due on receipt', memo];
    for (const s of o.services) {
      if (s.status === 'declined' || s.noCharge) continue;
      for (const i of s.items) {
        const qty = i.type === 'labor' ? Number(i.hours) || 0 : Number(i.qty) || 0;
        const rate = i.type === 'labor' ? Number(i.rate) || 0 : Number(i.price) || 0;
        const taxable = !o.taxExempt && (i.type !== 'labor' || shop.taxLabor);
        rows.push([...base, PRODUCT[i.type] || 'Services', `${s.title}: ${i.description || PRODUCT[i.type]}${i.partNumber ? ` (${i.partNumber})` : ''}`, qty, n2(rate), n2(itemTotal(i)), taxable ? 'Y' : 'N', taxable ? `${shop.taxRate}%` : '', d(o.invoicedAt)]);
      }
    }
    if (t.supplies) rows.push([...base, 'Shop supplies', 'Shop supplies', 1, n2(t.supplies), n2(t.supplies), o.taxExempt ? 'N' : 'Y', o.taxExempt ? '' : `${shop.taxRate}%`, d(o.invoicedAt)]);
    if (t.discount) rows.push([...base, 'Discount', 'Discount', 1, n2(-t.discount), n2(-t.discount), 'N', '', d(o.invoicedAt)]);
  }
  return toCsv(['InvoiceNo', 'Customer', 'InvoiceDate', 'DueDate', 'Terms', 'Memo', 'Item(Product/Service)', 'ItemDescription', 'ItemQuantity', 'ItemRate', 'ItemAmount', 'Taxable', 'TaxRate', 'ServiceDate'], rows);
}

/** Payments received — the deposits to match against the bank. */
export function paymentsCsv(state, from, to) {
  const rows = paymentsIn(state, from, to).map((p) => [d(p.at), p.order.number, fullName(p.customer), p.method, p.ref || '', n2(p.amount), n2(p.tip), n2(p.surcharge), n2(p.deposit)]);
  return toCsv(['Date', 'InvoiceNo', 'Customer', 'PaymentMethod', 'Reference', 'AmountApplied', 'Tip', 'Surcharge', 'TotalReceived'], rows);
}

/** Expenses as bank-style transactions (QuickBooks "Upload from file" accepts Date, Description, Amount). */
export function expensesCsv(state, from, to) {
  const rows = expensesIn(state, from, to)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => [d(e.date), `${e.vendor}${e.memo ? ` — ${e.memo}` : ''}`, n2(-(Number(e.amount) || 0)), e.category, e.vendor, e.method]);
  return toCsv(['Date', 'Description', 'Amount', 'Category', 'Payee', 'PaymentMethod'], rows);
}

/** Customer list in QuickBooks Online's customer import layout. */
export function customersCsv(state) {
  const rows = state.customers.map((c) => [fullName(c), c.company || '', c.email || '', c.phone || '', c.address || '', c.city || '', c.state || '', c.zip || '', 'USA', c.notes || '']);
  return toCsv(['Name', 'Company', 'Email', 'Phone', 'Street', 'City', 'State', 'ZIP', 'Country', 'Notes'], rows);
}

/**
 * The accounts the daily sales journal posts to, with what each usually is in QuickBooks Online
 * (used to suggest a match from the shop's chart of accounts).
 */
export const JOURNAL_ACCOUNTS = [
  { name: 'Accounts Receivable', types: ['Accounts Receivable'], match: /receivable|a\/r/i },
  { name: 'Undeposited Funds', types: ['Other Current Asset'], subTypes: ['UndepositedFunds'], match: /undeposited|payments to deposit/i },
  { name: 'Labor Income', types: ['Income'], match: /labor|labour|service income|services/i },
  { name: 'Parts Income', types: ['Income'], match: /parts|sales of product|product income/i },
  { name: 'Shop Fees & Supplies Income', types: ['Income', 'Other Income'], match: /fee|suppl/i },
  { name: 'Sublet Income', types: ['Income'], match: /sublet|outside/i },
  { name: 'Discounts Given', types: ['Income'], subTypes: ['DiscountsRefundsGiven'], match: /discount/i },
  { name: 'Card Surcharge Income', types: ['Income', 'Other Income'], match: /surcharge|convenience/i },
  { name: 'Sales Tax Payable', types: ['Other Current Liability'], subTypes: ['SalesTaxPayable'], match: /sales tax/i },
  { name: 'Tips Payable', types: ['Other Current Liability'], match: /tip|gratuit/i },
  { name: 'Card Processing Fees', types: ['Expense', 'Other Expense'], subTypes: ['BankCharges'], match: /merchant|processing|card fee|bank (charge|fee)|stripe/i },
];

/** Best guess at which QuickBooks account each journal account should post to. */
export function suggestAccountMap(accounts, current = {}) {
  const out = {};
  for (const a of JOURNAL_ACCOUNTS) {
    if (current[a.name] && accounts.some((x) => x.id === current[a.name].id)) {
      out[a.name] = current[a.name];
      continue;
    }
    const fits = accounts.filter((x) => a.types.includes(x.type));
    const pick =
      fits.find((x) => x.name.toLowerCase() === a.name.toLowerCase()) ||
      fits.find((x) => a.subTypes?.includes(x.subType) && a.match.test(x.name)) ||
      fits.find((x) => a.match.test(x.name)) ||
      fits.find((x) => a.subTypes?.includes(x.subType));
    if (pick) out[a.name] = { id: pick.id, name: pick.name };
  }
  return out;
}

/**
 * Daily sales summary journals: one balanced entry per day for shops that post summaries instead
 * of invoices — sales (accrual, on the invoice date) and the payments received that day.
 * Returns [{ date: 'YYYY-MM-DD', no: 'SALES-YYYYMMDD', memo, lines: [{ account, debit, credit }] }].
 */
export function salesJournals(state, from, to) {
  const shop = state.shop;
  const days = new Map();
  const add = (day, account, debit, credit) => {
    if (!debit && !credit) return;
    const row = days.get(day) || new Map();
    const cur = row.get(account) || { debit: 0, credit: 0 };
    cur.debit += debit;
    cur.credit += credit;
    row.set(account, cur);
    days.set(day, row);
  };
  for (const o of invoicedIn(state, from, to)) {
    const t = orderTotals(o, shop);
    const day = isoDate(new Date(o.invoicedAt));
    add(day, 'Accounts Receivable', t.total, 0);
    add(day, 'Labor Income', 0, t.labor);
    add(day, 'Parts Income', 0, t.parts);
    add(day, 'Shop Fees & Supplies Income', 0, t.fees + t.supplies);
    add(day, 'Sublet Income', 0, t.sublet);
    add(day, 'Discounts Given', t.discount, 0);
    add(day, 'Sales Tax Payable', 0, t.tax);
  }
  for (const p of paymentsIn(state, from, to)) {
    const day = isoDate(new Date(p.at));
    add(day, 'Undeposited Funds', p.deposit, 0);
    add(day, 'Accounts Receivable', 0, p.amount);
    add(day, 'Tips Payable', 0, p.tip);
    add(day, 'Card Surcharge Income', 0, p.surcharge);
    // Stripe pays out the payment less its fee.
    const fee = Number(p.stripe?.fee) || 0;
    add(day, 'Card Processing Fees', fee, 0);
    add(day, 'Undeposited Funds', 0, fee);
  }
  return [...days.keys()].sort().map((day) => {
    const lines = [];
    for (const [account, v] of days.get(day)) {
      const net = Math.round((v.debit - v.credit) * 100);
      if (net) lines.push({ account, cents: net });
    }
    // Each amount is rounded to the cent on its own; put any leftover cent on the largest line so
    // the day still balances.
    const off = lines.reduce((s, l) => s + l.cents, 0);
    if (off && Math.abs(off) <= lines.length) {
      const side = lines.filter((l) => Math.sign(l.cents) === Math.sign(off) * -1);
      const big = (side.length ? side : lines).reduce((a, b) => (Math.abs(b.cents) > Math.abs(a.cents) ? b : a));
      big.cents -= off;
    }
    return {
      date: day,
      no: `SALES-${day.replace(/-/g, '')}`,
      memo: `Daily sales summary for ${new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} from AutoShop Pro`,
      lines: lines.filter((l) => l.cents).map((l) => ({ account: l.account, debit: l.cents > 0 ? l.cents / 100 : 0, credit: l.cents < 0 ? -l.cents / 100 : 0 })),
    };
  });
}

/** The same daily journals as a CSV in QuickBooks Online's journal entry import layout. */
export function journalCsv(state, from, to) {
  const rows = [];
  salesJournals(state, from, to).forEach((j, i) => {
    for (const l of j.lines) rows.push([j.no, d(`${j.date}T12:00:00`), l.account, l.debit ? n2(l.debit) : '', l.credit ? n2(l.credit) : '', `Daily sales summary ${i + 1}`]);
  });
  return toCsv(['JournalNo', 'JournalDate', 'AccountName', 'Debits', 'Credits', 'Description'], rows);
}

export function downloadCsv(csv, filename) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
