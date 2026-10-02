import { loadSrc } from '../support/load.mjs';
const { payPeriod, overtimeSplit, hoursByDay } = await loadSrc('src/lib/payroll.js');
const ok = (c, m) => { if (!c) throw new Error('FAIL ' + m); console.log('ok', m); };
const d = (s) => new Date(s + 'T12:00:00');
const fmt = ([a, b]) => `${a.toDateString()} → ${b.toDateString()}`;
let p = payPeriod({ period: 'weekly', anchor: '2026-01-05' }, d('2026-10-01'));
ok(p[0].getDay() === 1 && p[0].getDate() === 28 && p[0].getMonth() === 8, 'weekly: Mon Sep 28 – ' + fmt(p));
p = payPeriod({ period: 'biweekly', anchor: '2026-01-05' }, d('2026-10-01'));
ok((p[1] - p[0]) / 864e5 === 14 && ((p[0] - new Date(2026, 0, 5)) / 864e5) % 14 === 0, 'biweekly aligned to anchor: ' + fmt(p));
p = payPeriod({ period: 'biweekly', anchor: '2026-01-05' }, d('2026-10-01'), -1);
ok((p[1] - p[0]) / 864e5 === 14, 'previous biweekly: ' + fmt(p));
p = payPeriod({ period: 'semimonthly' }, d('2026-10-01'));
ok(p[0].getDate() === 1 && p[1].getDate() === 16, 'semimonthly first half: ' + fmt(p));
p = payPeriod({ period: 'semimonthly' }, d('2026-10-01'), -1);
ok(p[0].getMonth() === 8 && p[0].getDate() === 16 && p[1].getMonth() === 9 && p[1].getDate() === 1, 'previous semimonthly = Sep 16–30: ' + fmt(p));
p = payPeriod({ period: 'semimonthly' }, d('2026-01-03'), -1);
ok(p[0].getFullYear() === 2025 && p[0].getMonth() === 11 && p[0].getDate() === 16, 'semimonthly across year: ' + fmt(p));
p = payPeriod({ period: 'monthly' }, d('2026-10-01'), -1);
ok(p[0].getMonth() === 8 && p[1].getMonth() === 9, 'monthly previous: ' + fmt(p));
// Overtime: 5 × 10h days Mon–Fri = 50h → 40 reg / 10 OT weekly.
const days = new Map(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'].map((k) => [k, 10]));
let r = overtimeSplit(days, { overtimeWeekly: 40, weekStart: 1 });
ok(r.regular === 40 && r.overtime === 10, `weekly OT ${JSON.stringify(r)}`);
r = overtimeSplit(days, { overtimeWeekly: 40, overtimeDaily: 8, weekStart: 1 });
ok(r.regular === 40 && r.overtime === 10, `daily+weekly OT doesn't double count ${JSON.stringify(r)}`);
const six = new Map([...days, ['2026-10-03', 8]]);
r = overtimeSplit(six, { overtimeWeekly: 40, overtimeDaily: 8, weekStart: 1 });
ok(r.regular === 40 && r.overtime === 18, `daily 2h×5 + weekly 8h on Saturday ${JSON.stringify(r)}`);
// Two weeks: 45 + 30.
const two = new Map([...days, ['2026-10-05', 10], ['2026-10-06', 10], ['2026-10-07', 10]]);
r = overtimeSplit(two, { overtimeWeekly: 40, weekStart: 1 });
ok(r.regular === 70 && r.overtime === 10, `OT per workweek ${JSON.stringify(r)}`);
// Overnight shift split across days.
const st = { timeEntries: [{ techId: 't', kind: 'shift', start: new Date(2026, 8, 29, 20).toISOString(), end: new Date(2026, 8, 30, 4).toISOString() }] };
const by = hoursByDay(st, 't', new Date(2026, 8, 28), new Date(2026, 9, 5));
ok(by.get('2026-09-29') === 4 && by.get('2026-09-30') === 4, 'overnight shift split by day ' + JSON.stringify([...by]));
console.log('PAYROLL UNIT PASS');
