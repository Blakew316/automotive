// Phase C: fleet & business accounts — units & PM, charge to account, A/R aging, batch payments,
// statements, and the fleet portal.
import { launch, APP, OUT } from '../support/env.mjs';
import { fakeCloud } from '../support/fakecloud.mjs';
const CLOUD = 'https://huwcrbkplpudpsfczbyg.supabase.co';
const SP = OUT;
const browser = await launch();
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const errors = [];
const cloud = fakeCloud();
cloud.addUser('owner@shop.test', 'owner-pass-123', { autoshop_staff: true, autoshop_role: 'owner', autoshop_staff_id: 'staff-owner' }, { name: 'Shop owner' });
async function until(fn, msg, ms = 15000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('TIMEOUT: ' + msg);
}

const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 }, serviceWorkers: 'block' });
await ctx.route(CLOUD + '/**', (r) => cloud.handle(r));
await ctx.addInitScript(() => document.addEventListener('click', (e) => { const a = e.target.closest?.('a[href^="sms:"],a[href^="mailto:"]'); if (a) e.preventDefault(); }, true));
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|WebSocket|realtime|net::ERR/.test(m.text()) && errors.push(`console ${page.url()}: ${m.text()}`));
const state = async () => { await page.waitForFunction(() => window.__autoshop); return page.evaluate(() => window.__autoshop.state()); };
const totals = (o) => page.evaluate((id) => { const s = window.__autoshop.state(); const o = s.orders.find((x) => x.id === id); return o; }, o.id);

await page.goto(APP + '/signin');
await page.getByLabel('Email').fill('owner@shop.test');
await page.getByLabel('Password').fill('owner-pass-123');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL(/settings\?tab=cloud/);
let s = await state();
const mitchell = s.customers.find((c) => c.company === 'Mitchell Plumbing Co.');
const okafor = s.customers.find((c) => c.company === 'Okafor Landscaping');
ok(mitchell?.account?.terms === 'net30' && okafor?.account?.terms === 'net15', 'demo has two business accounts');
ok(s.vehicles.filter((v) => v.customerId === mitchell.id && v.unit).length === 5, 'Mitchell has 5 numbered units');

// ---- Fleet & accounts page.
await page.goto(APP + '/accounts');
await page.getByRole('heading', { name: 'Fleet & accounts' }).waitFor();
ok(await page.getByRole('cell', { name: /Mitchell Plumbing Co\./ }).count() > 0 && await page.getByRole('cell', { name: /Okafor Landscaping/ }).count() > 0, 'accounts listed');
await page.screenshot({ path: `${SP}/shots/c-accounts.png`, fullPage: true });
await page.getByRole('tab', { name: 'Receivables' }).click();
await page.getByText('Accounts receivable').waitFor();
ok(await page.getByText(/days past due/).count() > 0, 'receivables show past-due invoices');
await page.screenshot({ path: `${SP}/shots/c-receivables.png`, fullPage: true });

// ---- Account page: units & PM.
await page.goto(APP + `/customers/${mitchell.id}`);
await page.getByText('Mitchell Plumbing Co. · Net 30 account').waitFor();
await page.getByRole('link', { name: 'Unit 12' }).waitFor();
ok(await page.getByText(/mi overdue|days overdue/).count() > 0, 'a unit shows overdue maintenance');
ok(await page.getByText('Credit available').count() > 0 && await page.getByText('Past due').count() > 0, 'account metrics shown');
await page.screenshot({ path: `${SP}/shots/c-account-units.png`, fullPage: true });

// Record a PM done elsewhere.
const unit15 = s.vehicles.find((v) => v.customerId === mitchell.id && v.unit === '15');
const rotationRow = page.getByRole('row').filter({ hasText: 'Unit 15' });
await rotationRow.getByRole('button', { name: /Tire rotation/ }).click();
await page.getByRole('button', { name: 'Record as done' }).click();
s = await state();
const rotPlan = mitchell.account.pmPlans.find((p) => p.label === 'Tire rotation');
ok(s.vehicles.find((v) => v.id === unit15.id).pm?.[rotPlan.id]?.date, 'PM recorded by hand');

// PM repair order from the unit row: jobs preselected.
const unit12 = s.vehicles.find((v) => v.customerId === mitchell.id && v.unit === '14');
await page.getByRole('row').filter({ hasText: 'Unit 14' }).getByRole('link', { name: 'PM RO' }).click();
await page.waitForURL(/orders\/new/);
ok(new URL(page.url()).searchParams.get('jobs')?.includes('cj-oil'), 'PM RO link carries the due jobs');
await page.getByText('Scheduled maintenance').first().waitFor().catch(() => {});
ok((await page.getByLabel('Customer concern').inputValue()).startsWith('Scheduled maintenance'), 'concern prefilled');
await page.getByRole('button', { name: 'Create estimate' }).click();
await page.waitForURL(/orders\/ro/);
s = await state();
let ro = s.orders.find((o) => o.vehicleId === unit12.id && o.status === 'estimate');
ok(ro && ro.services.some((x) => /oil/i.test(x.title)), `new RO #${ro?.number} has the oil service`);
await page.getByText('Pre-approved up to').waitFor();
ok(await page.getByText('within limit').count() > 0, 'pre-approval limit shown on the estimate');
await page.screenshot({ path: `${SP}/shots/c-ro-account.png`, fullPage: false });

// ---- Charge to account (PO required).
await page.evaluate((id) => window.__autoshop.update((d) => { const o = d.orders.find((x) => x.id === id); o.services.forEach((x) => { x.status = 'approved'; x.done = true; }); o.status = 'ready'; o.invoicedAt = new Date().toISOString(); }), ro.id);
await page.getByRole('button', { name: 'Charge to account' }).first().click();
const chargeBtn = page.getByRole('button', { name: /^Charge \$/ });
ok(await chargeBtn.isDisabled(), 'charge blocked until the PO number is entered');
await page.getByLabel('PO number (required)').fill('PO-9001');
await chargeBtn.click();
s = await state();
ro = s.orders.find((o) => o.id === ro.id);
ok(ro.status === 'closed' && ro.charge?.terms === 'net30' && ro.po === 'PO-9001', 'RO closed and charged on Net 30 with its PO');
const dueDays = Math.round((new Date(ro.charge.dueAt) - new Date(ro.invoicedAt)) / 86400000);
ok(dueDays === 30, `due 30 days after invoice (${dueDays})`);
await page.getByText(/Charged to account · Net 30/).waitFor();
ok(true, 'RO shows it was charged to the account');

// Printed invoice carries PO, unit, terms and due date.
await page.goto(APP + `/orders/${ro.id}/print`);
await page.getByText('PO-9001').waitFor();
ok(await page.getByText(/Net 30 · due/).count() > 0 && await page.getByText(/Unit 14 ·/).count() > 0, 'invoice shows PO, unit, terms and due date');
ok(await page.getByText(/include the PO number on every invoice/).count() > 0, 'account invoice note printed');

// ---- Batch payment: one check across several invoices.
await page.goto(APP + `/customers/${mitchell.id}`);
await page.getByRole('button', { name: /Invoices & payments/ }).click();
await page.getByText('Payments · last 90 days').waitFor();
ok(await page.getByText(/Check #20417/).count() > 0, 'earlier batch check listed once');
await page.screenshot({ path: `${SP}/shots/c-account-invoices.png`, fullPage: true });
s = await state();
const before = s.orders.filter((o) => o.customerId === mitchell.id && ['ready', 'closed'].includes(o.status));
await page.getByRole('button', { name: 'Receive payment' }).click();
await page.getByLabel('Check number').fill('20588');
await page.getByRole('button', { name: 'Record payment' }).click();
s = await state();
const paid = s.orders.filter((o) => o.customerId === mitchell.id && o.payments.some((p) => p.ref === '20588'));
ok(paid.length >= 3, `check applied to ${paid.length} invoices`);
ok(new Set(paid.flatMap((o) => o.payments.filter((p) => p.ref === '20588').map((p) => p.batchId))).size === 1, 'one batch id ties them together');
const stillOpen = await page.evaluate((cid) => {
  const st = window.__autoshop.state();
  return st.orders.filter((o) => o.customerId === cid && ['ready', 'closed'].includes(o.status)).length;
}, mitchell.id);
ok(stillOpen === before.length, 'invoices stay closed after being paid');
await page.getByText('Nothing owed').first().waitFor();
ok(true, 'account balance cleared');

// ---- Statement.
await page.goto(APP + `/customers/${okafor.id}/statement`);
await page.getByText('Statement', { exact: true }).waitFor();
ok(await page.getByText('Amount due').count() > 0 && await page.getByText('Open invoices').count() > 0, 'statement prints open invoices and amount due');
await page.screenshot({ path: `${SP}/shots/c-statement.png`, fullPage: true });

// ---- Vehicle page shows fleet maintenance.
await page.goto(APP + `/vehicles/${unit12.id}`);
await page.getByText('Fleet maintenance').waitFor();
ok(await page.getByRole('heading', { name: /Unit 14/ }).count() > 0, 'vehicle page titled with the unit number');

// ---- Fleet portal.
await page.goto(APP + `/customers/${okafor.id}`);
await page.getByRole('button', { name: 'Create portal link' }).click();
await page.getByText('Fleet portal is live').waitFor();
s = await state();
const portal = s.customers.find((c) => c.id === okafor.id).account.portal;
const file = () => {
  const f = cloud.db.public.get(`autoshop-media/fleet/${portal.id}.json`);
  return f ? JSON.parse(f.body.toString()) : null;
};
ok(file()?.company === 'Okafor Landscaping' && file().units.length === 2, 'portal published with both units');
ok(file().balance > 0 && file().invoices.length >= 1, 'portal shows the open invoice');
ok(!/cost|margin|notes|gp/i.test(JSON.stringify(file()).replace(/"Oil & filter service"/g, '')), 'portal file has no costs or notes');
const url = await page.locator('span.font-mono').filter({ hasText: '/fleet/' }).first().textContent();
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', isMobile: true });
await phone.route(CLOUD + '/**', (r) => cloud.handle(r));
const fm = await phone.newPage();
fm.on('pageerror', (e) => errors.push(`portal pageerror: ${e.message}`));
await fm.goto(url);
await fm.getByRole('heading', { name: 'Okafor Landscaping' }).waitFor();
ok(await fm.getByText('Unit T-1').count() > 0 && await fm.getByText('Unit T-2').count() > 0, 'fleet manager sees the units');
await fm.screenshot({ path: `${SP}/shots/c-portal.png`, fullPage: true });

// Payment comes in → portal updates.
await page.getByRole('button', { name: /Invoices & payments/ }).click();
await page.getByRole('button', { name: 'Receive payment' }).click();
await page.getByRole('button', { name: 'Record payment' }).click();
await until(() => file()?.balance === 0, 'portal republished after payment');
await fm.reload();
await fm.getByText('Nothing owed — thank you!').waitFor();
ok(true, 'portal shows the account paid up');
await page.getByRole('button', { name: 'Turn off' }).click();
await until(() => file()?.revoked === true, 'portal revoked');
await fm.reload();
await fm.getByText(/has been turned off/).waitFor();
ok(true, 'turned-off portal shows a notice');

// ---- New business account from the accounts page; tax exempt flows to new ROs.
await page.goto(APP + '/accounts');
await page.getByRole('button', { name: 'Business account' }).first().click();
const pick = s.customers.find((c) => !c.account && c.firstName === 'Grace');
await page.getByPlaceholder(/Search/).first().fill('Grace');
await page.getByRole('button', { name: /Grace Holloway/ }).first().click();
await page.getByLabel('Company name').fill('Holloway Catering');
await page.getByRole('switch', { name: 'Tax exempt' }).click();
await page.getByLabel('Exemption certificate / tax ID').fill('IL-E-99812');
await page.getByRole('button', { name: 'Create account' }).click();
await page.waitForURL(new RegExp(`customers/${pick.id}`));
s = await state();
const grace = s.customers.find((c) => c.id === pick.id);
ok(grace.account?.taxExempt && grace.company === 'Holloway Catering', 'new account created with tax exemption');
await page.getByRole('button', { name: /Add oil, rotation/ }).click();
s = await state();
ok(s.customers.find((c) => c.id === pick.id).account.pmPlans.length === 3, 'common PM plans added');
const newRo = await page.evaluate((cid) => {
  const st = window.__autoshop.state();
  const v = st.vehicles.find((x) => x.customerId === cid);
  return window.__autoshop.update((d) => d) && v?.id;
}, pick.id);
await page.goto(APP + `/orders/new?customer=${pick.id}&vehicle=${newRo}`);
await page.getByRole('button', { name: 'Create estimate' }).click();
await page.waitForURL(/orders\/ro/);
s = await state();
const graceRo = s.orders.filter((o) => o.customerId === pick.id).sort((a, b) => b.number - a.number)[0];
ok(graceRo.taxExempt === true, 'new RO for a tax-exempt account starts tax exempt');

ok(errors.length === 0, `no page errors${errors.length ? ':\n' + errors.join('\n') : ''}`);
await browser.close();
console.log('PHASE C PASS');
