// Auto diagnosis logic: codes and concerns → search terms, NHTSA complaints/recalls ranked against
// them, shared phrases and failure mileage, and the shop's own past fixes. (Test fixtures below are
// made up in NHTSA's format; they are not real reports.)
import { loadSrc } from '../support/load.mjs';
const D = await loadSrc('src/lib/diagnose.js');
const ok = (c, m) => { if (!c) throw new Error('FAIL ' + m); console.log('ok', m); };

// ---- Codes and concerns.
ok(JSON.stringify(D.parseCodes('codes p0302, P0305 and u0100; P0302 again')) === '["P0302","P0305","U0100"]', 'codes parsed, upper-cased, de-duplicated');
ok(D.parseCodes('PO302 P03O2 X0302').length === 0, 'look-alikes are not codes');
ok(D.detectSymptoms('Rough idle when cold, stumbles on acceleration').includes('misfire'), 'rough idle → misfire');
ok(D.detectSymptoms("Truck won't start in the morning").includes('nostart'), "won't start → no start");
ok(D.detectSymptoms('Shakes at 65 mph').includes('vibration'), 'shakes → vibration');
ok(!D.detectSymptoms('oil change due').includes('trans'), 'unrelated text names no transmission concern');
let st = D.searchTerms({ text: '', codes: ['P0302'] });
ok(st.ids.includes('misfire') && st.terms.includes('p0302') && st.terms.includes('misfire'), 'P0302 → misfire terms and the code itself');
st = D.searchTerms({ text: 'no crank', codes: ['P0335'] });
ok(st.ids.includes('nostart') && st.ids.includes('stall'), 'crank sensor code → no start / stall');
ok(D.searchTerms({ codes: ['C0035'] }).ids.includes('brakes'), 'C0035 → brakes');
ok(D.searchTerms({ codes: ['B0012'] }).ids.includes('airbag'), 'B00xx → airbag');
ok(D.searchTerms({ codes: ['P0730'] }).ids.includes('trans'), 'P07xx → transmission');

// ---- Text helpers.
ok(D.sentenceCase('THE CONTACT OWNS A TRUCK. THE ENGINE STALLED.') === 'The contact owns a truck. The engine stalled.', 'NHTSA capitals read back in sentence case');
ok(D.failureMileage('THE FAILURE MILEAGE WAS 85,000.') === 85000 && D.failureMileage('THE APPROXIMATE FAILURE MILEAGE WAS 7.') === null, 'failure mileage parsed, nonsense ignored');

// ---- Complaints ranked against the concern.
const C = (id, components, summary, extra = {}) => ({ id, components, summary, date: new Date(2024, 0, id), crash: false, fire: false, ...extra });
const complaints = [
  C(1, ['ENGINE'], 'THE CONTACT OWNS A 2018 PICKUP. WHILE DRIVING, THE ENGINE MISFIRED AND THE CHECK ENGINE LIGHT ILLUMINATED. THE DEALER REPLACED THE IGNITION COIL. THE FAILURE MILEAGE WAS 80,000.'),
  C(2, ['ENGINE', 'ELECTRICAL SYSTEM'], 'ENGINE MISFIRE AT IDLE. CODE P0302 STORED. DEALER FOUND A FAILED IGNITION COIL ON CYLINDER 2. THE FAILURE MILEAGE WAS 90,000.'),
  C(3, ['ENGINE'], 'ROUGH IDLE AND MISFIRE WHEN COLD. THE IGNITION COIL AND SPARK PLUGS WERE REPLACED. THE FAILURE MILEAGE WAS 100,000.'),
  C(4, ['SERVICE BRAKES'], 'THE BRAKE PEDAL WENT TO THE FLOOR. THE FAILURE MILEAGE WAS 20,000.'),
  C(5, ['STRUCTURE'], 'THE TAILGATE OPENED WHILE DRIVING.', { crash: true }),
];
st = D.searchTerms({ text: 'Misfire, rough idle', codes: ['P0302'] });
const r = D.rankComplaints(complaints, st);
ok(r.total === 5 && r.matched.length === 3, `3 of 5 complaints match the misfire (${r.matched.length})`);
ok(r.matched[0].id === 2, 'the report naming the code ranks first');
ok(r.components[0].name === 'ENGINE' && r.components[0].n === 3, 'engine is the top system among matches');
ok(r.mileage && r.mileage.median === 90000 && r.mileage.low === 80000 && r.mileage.high === 100000, `failure mileage summarised ${JSON.stringify(r.mileage)}`);
const phrases = D.commonPhrases(r.matched, { exclude: ['2018', 'Pickup'] });
ok(phrases[0]?.phrase === 'ignition coil' && phrases[0].n === 3, `shared phrase found: ${JSON.stringify(phrases.slice(0, 3))}`);
ok(!phrases.some((p) => /contact|dealer|failure mileage/.test(p.phrase)), 'NHTSA boilerplate is never a pattern');
const all = D.rankComplaints(complaints, { ids: [], terms: [] });
ok(all.matched.length === 5 && all.components.length === 4, 'no concern yet: every complaint counts');
ok(D.excerpt(complaints[1].summary, ['p0302']).includes('P0302') || D.excerpt(complaints[1].summary, ['p0302']).toLowerCase().includes('p0302'), 'excerpt keeps the matching words');

// ---- Recalls.
const recalls = [
  { campaign: '24V001000', component: 'SEAT BELTS:FRONT', summary: 'THE SEAT BELT MAY NOT LATCH.' },
  { campaign: '23V002000', component: 'ENGINE AND ENGINE COOLING:ENGINE', summary: 'AN IGNITION COIL MAY FAIL, CAUSING A MISFIRE.' },
];
const rr = D.rankRecalls(recalls, st);
ok(rr[0].campaign === '23V002000' && rr[0].related && !rr[1].related, 'the misfire recall is flagged and comes first');
ok(D.rankRecalls(recalls, { ids: [], terms: [] }).every((x) => !x.related), 'no concern: nothing is flagged as related');
const brake = D.rankRecalls([{ campaign: 'X1', component: 'SERVICE BRAKES, HYDRAULIC:MASTER CYLINDER', summary: 'BRAKE FLUID MAY LEAK FROM THE MASTER CYLINDER.', consequence: 'LOSS OF POWER ASSIST.' }], st);
ok(!brake[0].related, 'a master-cylinder recall is not flagged for a cylinder-2 misfire');
ok(!D.commonPhrases([{ summary: 'CHECK ENGINE LIGHT CAME ON' }, { summary: 'THE CHECK ENGINE LIGHT IS ON' }]).some((p) => p.phrase === 'check engine light'), '"check engine light" is not a pattern');

// ---- The shop's own history.
const state = {
  vehicles: [
    { id: 'v1', make: 'Ford', model: 'F-150' },
    { id: 'v2', make: 'Ford', model: 'F-150' },
    { id: 'v3', make: 'Ford', model: 'Escape' },
    { id: 'v4', make: 'Honda', model: 'Civic' },
  ],
  orders: [
    { id: 'o1', number: 101, vehicleId: 'v1', status: 'closed', createdAt: '2026-01-01', concern: 'Check engine light, misfire', notes: [], services: [{ title: 'Replace ignition coil (cyl 2)', status: 'approved', done: true, cause: 'P0302 — coil 2 open secondary', correction: 'Replaced coil', items: [{ type: 'labor', hours: 0.8 }] }] },
    { id: 'o2', number: 102, vehicleId: 'v2', status: 'closed', createdAt: '2026-03-01', concern: 'Rough idle', notes: [], services: [{ title: 'Replace ignition coil', status: 'approved', done: true, cause: 'Misfire cyl 5', items: [{ type: 'labor', hours: 1.2 }] }, { title: 'Oil change', status: 'approved', done: true, items: [] }] },
    { id: 'o3', number: 103, vehicleId: 'v3', status: 'closed', createdAt: '2026-02-01', concern: 'Misfire', notes: [], services: [{ title: 'Spark plugs', status: 'approved', done: true, items: [] }] },
    { id: 'o4', number: 104, vehicleId: 'v4', status: 'closed', createdAt: '2026-02-01', concern: 'Misfire', notes: [], services: [{ title: 'Replace ignition coil', status: 'approved', done: true, items: [] }] },
    { id: 'o5', number: 105, vehicleId: 'v1', status: 'estimate', createdAt: '2026-04-01', concern: 'Misfire', notes: [], services: [{ title: 'Replace ignition coil', status: 'declined', items: [] }] },
    { id: 'o6', number: 106, vehicleId: 'v2', status: 'closed', createdAt: '2025-12-01', concern: 'Check engine light on', notes: [], services: [{ title: 'Check engine light diagnosis', status: 'approved', done: true, cause: 'P0302 stored, coil 2 failed', items: [{ type: 'labor', hours: 1 }] }, { title: 'Replace ignition coil', status: 'approved', done: true, items: [{ type: 'labor', hours: 1 }] }] },
  ],
};
const sf = D.shopFixes(state, { vehicle: { make: 'FORD', model: 'F150' }, ...st, codes: ['P0302'], excludeOrderId: 'o9' });
ok(sf.fixes[0]?.title.startsWith('Replace ignition coil') && sf.fixes[0].n === 3 && sf.fixes[0].sameModel === 3, `coil fixes on the same model grouped first ${JSON.stringify(sf.fixes.map((f) => [f.title, f.n]))}`);
ok(!sf.fixes.some((f) => /diagnosis/i.test(f.title)), 'the diagnosis line is not credited as the fix — the repair on that visit is');
ok(sf.fixes[0].hours === 1 && sf.fixes[0].last.number === 102, 'average hours and the latest RO');
ok(sf.fixes.some((f) => f.title === 'Spark plugs' && f.sameModel === 0), 'same make, other model still counts (lower)');
ok(!sf.fixes.some((f) => /oil change/i.test(f.title)), 'routine work is never a fix');
ok(!sf.fixes.some((f) => f.last?.id === 'o4'), 'other makes are left out');
ok(!sf.fixes.some((f) => f.last?.id === 'o5'), 'declined work is not a fix');
ok(sf.common[0]?.n === 3 && sf.orders === 4 && !sf.common.some((c) => /diagnosis/i.test(c.title)), 'common repairs on this model (no diagnosis lines) and order count');
ok(D.shopFixes(state, { vehicle: { make: 'Ford', model: 'F-150' }, terms: [], codes: [] }).fixes.length === 0, 'no concern: no fixes claimed');
// A visit that only says "Check engine light diagnosis" next to an unrelated job proves nothing.
const vague = { vehicles: state.vehicles, orders: [{ id: 'z1', number: 900, vehicleId: 'v1', status: 'closed', createdAt: '2026-01-01', concern: '', notes: [], services: [{ title: 'Check engine light diagnosis', status: 'approved', done: true, items: [] }, { title: 'Timing belt & water pump kit', status: 'approved', done: true, items: [] }, { title: 'Transmission fluid exchange', status: 'approved', done: true, items: [] }] }] };
ok(D.shopFixes(vague, { vehicle: { make: 'Ford', model: 'F-150' }, ...D.searchTerms({ text: 'check engine light, rough idle', codes: ['P0302'] }), codes: ['P0302'] }).fixes.length === 0, 'unrelated repairs on a vague CEL visit are not credited');

// ---- Quick answer and AI context.
const codes = D.codeInfo(['P0302', 'P1ABC']);
ok(codes[0].known && codes[0].description && !codes[1].known, 'code info: known generic code, unknown manufacturer code');
const qa = D.quickAnswer({ codes, recalls: rr, complaints: { ...r, phrases }, fixes: sf.fixes, vehicleLabel: '2018 Ford F-150', concern: true });
ok(qa[0].kind === 'recall' && qa.some((x) => x.kind === 'shop') && qa.some((x) => x.kind === 'owners'), `quick answer: recall first, then shop fix and owner pattern (${qa.map((x) => x.kind).join(', ')})`);
const ctx = D.diagnosisContext({ vehicleLabel: '2018 Ford F-150', mileage: 92000, concern: 'Misfire', codes, recalls: rr, complaints: { ...r, phrases }, fixes: sf.fixes, years: '2017–2019' });
ok(/P0302/.test(ctx) && /23V002000/.test(ctx) && /ignition coil \(3\)/.test(ctx) && /manufacturer-specific/.test(ctx) && ctx.length < 16000, 'AI context carries the codes, recall, owner pattern and shop fixes');
console.log('DIAGNOSE UNIT PASS');
