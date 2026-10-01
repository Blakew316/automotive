// QuickBooks Online sync: the daily sales journals (lib/accounting) posted straight to the shop's
// QuickBooks company through the shop-qbo server function. Each day is one journal entry numbered
// SALES-YYYYMMDD; posting a day again updates that entry, so re-posting is always safe.
import { salesJournals, JOURNAL_ACCOUNTS } from './accounting';
import { shopQbo } from './sync/api';
import { addDays, startOfDay, isoDate } from './format';

export const QBO_ENVS = [
  { value: 'sandbox', label: 'Sandbox (test company)' },
  { value: 'production', label: 'My real company' },
];

/** How many days back the daily auto-sync re-posts (late payments and edits land in older days). */
export const AUTO_DAYS = 7;

/** Auto-sync covers the last week through yesterday — today isn't finished yet. */
export function autoRange(now = new Date()) {
  const to = startOfDay(now);
  return [addDays(to, -AUTO_DAYS), to];
}

/** Journal accounts these entries use that have no QuickBooks account chosen yet. */
export function unmappedAccounts(journals, map = {}) {
  const used = new Set(journals.flatMap((j) => j.lines.map((l) => l.account)));
  return JOURNAL_ACCOUNTS.map((a) => a.name).filter((n) => used.has(n) && !map[n]?.id);
}

/** Post journals in batches; returns every day's result plus counts. */
export async function postJournals(cfg, journals, map) {
  const results = [];
  for (let i = 0; i < journals.length; i += 31) {
    const r = await shopQbo(cfg, 'post', { journals: journals.slice(i, i + 31), map });
    results.push(...(r.results || []));
  }
  return { results, ...countResults(results) };
}

export function countResults(results) {
  const n = (s) => results.filter((r) => r.status === s).length;
  return { created: n('created'), updated: n('updated'), unchanged: n('unchanged'), errors: n('error') };
}

/** One line for a sync: "3 new, 1 updated, 2 already up to date". */
export function resultLine(c) {
  const parts = [];
  if (c.created) parts.push(`${c.created} new`);
  if (c.updated) parts.push(`${c.updated} updated`);
  if (c.unchanged) parts.push(`${c.unchanged} already up to date`);
  if (c.errors) parts.push(`${c.errors} couldn’t post`);
  return parts.join(', ') || 'Nothing to post';
}

/** The days to post for a range, skipping days with no sales or payments. */
export const journalsFor = (state, from, to) => salesJournals(state, from, to).filter((j) => j.lines.length);

/** What auto-sync would post today, or why it can't. */
export function autoPlan(state, now = new Date()) {
  const [from, to] = autoRange(now);
  const journals = journalsFor(state, from, to);
  return { from, to, journals, missing: unmappedAccounts(journals, state.shop.qbo?.map), day: isoDate(now) };
}
