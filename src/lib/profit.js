// Job and repair-order profitability: what the work earns after parts, sublet and the tech's pay.
import { serviceTotal, serviceHours, orderTotals } from './pricing';

const techRateFor = (techId, shop, technicians = []) => {
  const t = technicians.find((x) => x.id === techId);
  return Number(t?.payRate) || Number(shop?.techPayRate) || 0;
};

function costOf(service, rate) {
  let cost = 0;
  for (const i of service.items || []) {
    if (i.type === 'labor') cost += (Number(i.hours) || 0) * rate;
    else if (i.type === 'part' || i.type === 'sublet') cost += (Number(i.qty) || 0) * (Number(i.cost) || 0);
  }
  return cost;
}

/** Gross profit for one service line: GP$, GP%, GP per labor hour. */
export function jobProfit(service, shop, technicians, orderTechId = null) {
  const revenue = serviceTotal(service);
  const hours = serviceHours(service);
  const gp = revenue - costOf(service, techRateFor(service.techId || orderTechId, shop, technicians));
  return { revenue, gp, gpPct: revenue > 0 ? gp / revenue : 0, gpHr: hours > 0 ? gp / hours : null, hours };
}

/** The same for the whole RO (approved + pending work, before tax, after discount). */
export function orderProfit(order, shop, technicians) {
  const t = orderTotals(order, shop);
  const active = order.services.filter((s) => s.status !== 'declined');
  const cost = active.reduce((sum, s) => sum + costOf(s, techRateFor(s.techId || order.techId, shop, technicians)), 0);
  const revenue = t.subtotal - t.discount;
  const gp = revenue - cost;
  return { revenue, gp, gpPct: revenue > 0 ? gp / revenue : 0, gpHr: t.hours > 0 ? gp / t.hours : null, hours: t.hours };
}

/** ok / warn / bad against the shop's GP% target. */
export function profitTone(gpPct, targetPct = 55) {
  const target = targetPct / 100;
  if (gpPct >= target) return 'ok';
  if (gpPct >= target - 0.1) return 'warn';
  return 'bad';
}

export const TONE_TEXT = { ok: 'text-ok', warn: 'text-warn', bad: 'text-bad' };
export const TONE_BG = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' };
