// Three-way merge used when two devices change the same record (src/lib/sync/merge.js).
import { merge3, same, mergeCounters } from '../../src/lib/sync/merge.js';
let fails = 0;
const t = (name, got, want) => { const ok = same(got, want); if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : JSON.stringify({ got, want })); };
const base = { id: 'o1', status: 'estimate', concern: 'noise', services: [{ id: 's1', title: 'Brakes', items: [{ id: 'i1', qty: 1 }] }], notes: [] };
// Different fields changed
t('disjoint fields', merge3(base, { ...base, status: 'approved' }, { ...base, concern: 'grinding noise' }), { ...base, status: 'approved', concern: 'grinding noise' });
// Same field both changed → mine wins
t('same field mine wins', merge3(base, { ...base, status: 'approved' }, { ...base, status: 'declined' }).status, 'approved');
// Both added services
const mine = { ...base, services: [...base.services, { id: 's2', title: 'Oil' }] };
const theirs = { ...base, services: [...base.services, { id: 's3', title: 'Tires' }] };
t('both add list items', merge3(base, mine, theirs).services.map((s) => s.id), ['s1', 's3', 's2']);
// They removed s1, I didn't touch it → removed
t('their removal kept', merge3(base, { ...base, concern: 'x' }, { ...base, services: [] }).services, []);
// They removed s1, I edited it → kept
const edited = { ...base, services: [{ ...base.services[0], title: 'Front brakes' }] };
t('edit beats removal', merge3(base, edited, { ...base, services: [] }).services.map((s) => s.title), ['Front brakes']);
// Nested item edits merge
const m2 = { ...base, services: [{ ...base.services[0], items: [{ id: 'i1', qty: 2 }] }] };
const t2 = { ...base, services: [{ ...base.services[0], title: 'Brake job' }] };
t('nested merge', merge3(base, m2, t2).services[0], { id: 's1', title: 'Brake job', items: [{ id: 'i1', qty: 2 }] });
// Unknown base: union, mine wins on clashes
t('no base union', merge3(undefined, { id: 'c', a: 1, b: 2 }, { id: 'c', a: 9, c: 3 }), { id: 'c', a: 1, b: 2, c: 3 });
// Field removed locally (unchanged remotely) stays removed
t('local key removal', merge3({ id: 'x', promisedAt: 't' }, { id: 'x' }, { id: 'x', promisedAt: 't' }), { id: 'x' });
// Empty list on both sides then each adds
t('empty lists both add', merge3({ id: 'o', notes: [] }, { id: 'o', notes: [{ id: 'n1' }] }, { id: 'o', notes: [{ id: 'n2' }] }).notes.map((n) => n.id), ['n2', 'n1']);
// Counters
t('counters max', mergeCounters({ order: 5, po: 3 }, { order: 7, po: 2, x: 1 }), { order: 7, po: 3, x: 1 });
// Identical
t('identical', merge3(base, base, base), base);
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
if (fails) process.exit(1);
