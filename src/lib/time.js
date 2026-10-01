// Time clock math: shifts (on the clock) and job time (clocked against a service).
import { useEffect, useState } from 'react';
import { serviceHours } from './pricing';

/** Re-render on an interval (for live timers). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export const entryMs = (e, now = Date.now(), from = -Infinity, to = Infinity) => {
  const s = Math.max(new Date(e.start).getTime(), from);
  const end = Math.min(e.end ? new Date(e.end).getTime() : now, to);
  return Math.max(0, end - s);
};

export const hours = (ms) => ms / 3600000;

export const openShift = (entries, techId) => entries.find((e) => e.kind === 'shift' && e.techId === techId && !e.end);
export const runningJob = (entries, techId) => entries.find((e) => e.kind === 'job' && e.techId === techId && !e.end);

/** Clocked time on one service (all techs), in ms. */
export const serviceClockMs = (entries, serviceId, now = Date.now()) => entries.filter((e) => e.kind === 'job' && e.serviceId === serviceId).reduce((s, e) => s + entryMs(e, now), 0);

export function fmtDuration(ms, { seconds = false } = {}) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (seconds) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/**
 * Per-technician totals for a period: hours on the clock, hours clocked on jobs, hours flagged
 * (billed labor on invoiced work), labor and parts sales for commissions, and pay.
 */
export function teamSummary(state, from, to) {
  const now = Date.now();
  const f = from.getTime();
  const t = to.getTime();
  return state.technicians.map((tech) => {
    const mine = state.timeEntries.filter((e) => e.techId === tech.id);
    const shiftMs = mine.filter((e) => e.kind === 'shift').reduce((s, e) => s + entryMs(e, now, f, t), 0);
    const jobMs = mine.filter((e) => e.kind === 'job').reduce((s, e) => s + entryMs(e, now, f, t), 0);
    let flagged = 0;
    let laborSales = 0;
    let partsSales = 0;
    let jobs = 0;
    for (const o of state.orders) {
      if (!o.invoicedAt) continue;
      const at = new Date(o.invoicedAt).getTime();
      if (at < f || at >= t) continue;
      for (const s of o.services) {
        if (s.status === 'declined' || (s.techId || o.techId) !== tech.id) continue;
        jobs += 1;
        flagged += serviceHours(s);
        for (const i of s.items) {
          const amount = i.type === 'labor' ? (Number(i.hours) || 0) * (Number(i.rate) || 0) : i.type === 'part' ? (Number(i.qty) || 0) * (Number(i.price) || 0) : 0;
          if (i.type === 'labor') laborSales += amount;
          if (i.type === 'part') partsSales += amount;
        }
      }
    }
    const shiftH = hours(shiftMs);
    const jobH = hours(jobMs);
    const commission = (laborSales * (tech.laborCommissionPct || 0)) / 100 + (partsSales * (tech.partsCommissionPct || 0)) / 100;
    const base = tech.payType === 'flat' ? flagged * (tech.payRate || 0) : shiftH * (tech.payRate || 0);
    return {
      tech,
      shiftH,
      jobH,
      flagged,
      jobs,
      laborSales,
      partsSales,
      // Efficiency: billed hours ÷ hours actually worked on jobs. Productivity: worked ÷ on the clock.
      efficiency: jobH ? flagged / jobH : 0,
      productivity: shiftH ? jobH / shiftH : 0,
      commission,
      basePay: base,
      totalPay: base + commission,
    };
  });
}
