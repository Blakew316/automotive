// The numbers for the owner's daily summary email. Kept current by a signed-in owner or manager
// device (components/EmailLine.jsx); the server emails them at the hour the owner picked.
import { orderTotals } from './pricing';
import { shopAt } from './locations';
import { profitAndLoss, paymentsIn } from './accounting';
import { WIP_STATUSES } from './workflow';
import { fullName, vehicleName, time, addDays, startOfDay, isoDate } from './format';

/**
 * Today's numbers for the owner's daily summary. Kept current by a signed-in device; the server
 * emails them at the hour the owner picked.
 */
export function digestData(state, now = new Date()) {
  const from = startOfDay(now);
  const to = addDays(from, 1);
  const totals = (o) => orderTotals(o, shopAt(state.shop, o.locationId));
  const pl = profitAndLoss(state, from, to);
  const pays = paymentsIn(state, from, to);
  const orders = state.orders;
  const invoiced = pl.orders.length;
  const wip = orders.filter((o) => WIP_STATUSES.includes(o.status));
  const estimates = orders.filter((o) => o.status === 'estimate');
  const receivable = orders.filter((o) => ['ready', 'closed'].includes(o.status) && totals(o).balance > 0.004);
  const cust = (id) => state.customers.find((c) => c.id === id);
  const veh = (id) => state.vehicles.find((v) => v.id === id);
  const tomorrowStart = to;
  const tomorrowEnd = addDays(to, 1);
  const tomorrow = state.appointments
    .filter((a) => new Date(a.start) >= tomorrowStart && new Date(a.start) < tomorrowEnd && a.status !== 'cancelled')
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((a) => `${time(a.start)} — ${fullName(cust(a.customerId))}${veh(a.vehicleId) ? ` · ${vehicleName(veh(a.vehicleId))}` : ''}${a.title ? ` · ${a.title}` : ''}`);
  const attention = [];
  const late = wip.filter((o) => o.promisedAt && new Date(o.promisedAt) < now);
  if (late.length) attention.push(`${late.length} RO${late.length === 1 ? '' : 's'} past the promised time`);
  const parts = orders.filter((o) => o.status === 'waiting_parts').length;
  if (parts) attention.push(`${parts} waiting on parts`);
  const unread = state.messages.filter((m) => m.dir === 'in' && !m.read).length;
  if (unread) attention.push(`${unread} unread customer message${unread === 1 ? '' : 's'}`);
  const requests = state.bookingRequests.filter((b) => b.status === 'new').length;
  if (requests) attention.push(`${requests} booking request${requests === 1 ? '' : 's'} to confirm`);
  const low = state.inventory.filter((p) => Number(p.qty) <= Number(p.min)).length;
  if (low) attention.push(`${low} inventory item${low === 1 ? '' : 's'} at or below minimum`);
  const sales = Math.round(pl.netSales * 100) / 100;
  return {
    day: isoDate(now),
    data: {
      shop: state.shop.name,
      asOf: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      today: {
        sales,
        invoiced,
        carCount: invoiced,
        aro: invoiced ? Math.round((sales / invoiced) * 100) / 100 : 0,
        collected: Math.round(pays.reduce((s, p) => s + p.deposit, 0) * 100) / 100,
        payments: pays.length,
      },
      inShop: wip.length,
      waitingParts: parts,
      estimates: estimates.length,
      estimatesValue: Math.round(estimates.reduce((s, o) => s + totals(o).total, 0) * 100) / 100,
      receivables: Math.round(receivable.reduce((s, o) => s + totals(o).balance, 0) * 100) / 100,
      unpaid: receivable.length,
      tomorrow: tomorrow.slice(0, 12),
      attention,
    },
  };
}
