import { launch, APP, OUT } from '../support/env.mjs';
import fs from 'node:fs';
const BASE = APP;
const SP = OUT;
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 }, serviceWorkers: 'block', acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|Failed to launch|scheme does not have a registered handler/.test(m.text()) && errors.push(`console ${page.url()}: ${m.text()}`));
// Don't follow sms:/mailto: links (React handlers still run).
await ctx.addInitScript(() => document.addEventListener('click', (e) => { const a = e.target.closest?.('a[href^="sms:"],a[href^="mailto:"]'); if (a) e.preventDefault(); }, true));
page.on('response', (r) => r.status() >= 400 && r.request().resourceType() !== 'document' && !r.url().includes('supabase.co') && errors.push(`${r.status()} ${r.url()}`));
const ok = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('ok -', msg); };
const store = async () => { await page.waitForTimeout(450); await page.waitForFunction(() => window.__autoshop); return page.evaluate(() => window.__autoshop.state()); };

await page.goto(BASE + '/');
await page.waitForTimeout(800);

// ---- Booking: get the link from settings, book as a customer in a fresh context.
await page.goto(BASE + '/settings?tab=booking');
const link = await page.getByLabel('Booking link').inputValue();
ok(link.includes('/automotive/app/book?'), 'booking link generated');
const cctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await cctx.addInitScript(() => document.addEventListener('click', (e) => { const a = e.target.closest?.('a[href^="sms:"],a[href^="mailto:"]'); if (a) e.preventDefault(); }, true));
const cp = await cctx.newPage();
cp.on('pageerror', (e) => errors.push(`customer pageerror: ${e.message}`));
await cp.goto(link);
await cp.getByRole('button', { name: /Full synthetic oil/ }).click();
await cp.getByRole('button', { name: 'Choose a time' }).click();
const slotBtn = cp.locator('.grid button').first();
await slotBtn.click();
await cp.getByRole('button', { name: 'Continue' }).click();
await cp.getByLabel('Full name').fill('Test Customer');
await cp.getByLabel('Mobile phone').fill('(217) 555-0199');
await cp.getByLabel('Vehicle').fill('2015 Mazda CX-5');
// Shop Cloud is on by default: the request goes straight into the shop's Supabase inbox.
const sent = [];
await cctx.route('https://huwcrbkplpudpsfczbyg.supabase.co/rest/v1/shop_inbox', (r) => {
  sent.push({ headers: r.request().headers(), body: r.request().postDataJSON() });
  r.fulfill({ status: 201, body: '' });
});
await cp.getByRole('button', { name: /Request appointment/ }).click();
await cp.getByText('Request sent').waitFor();
ok(sent.length === 1 && sent[0].body.kind === 'booking' && sent[0].body.payload.name === 'Test Customer' && sent[0].body.payload.vehicle.includes('Mazda'), 'booking request posted to the cloud inbox');
ok(sent[0].headers.prefer === 'return=minimal' && sent[0].headers.apikey?.startsWith('eyJ'), 'inbox insert uses anon key without reading back');
ok(true, 'customer sees confirmation');
await cp.screenshot({ path: `${SP}/shots/f-book.png` });
await cctx.close();

// ---- Calendar: confirm an online request.
await page.goto(BASE + '/calendar');
await page.getByText('2 booking requests').waitFor();
await page.getByRole('button', { name: 'Confirm' }).first().click();
await page.getByRole('button', { name: 'Book it' }).click();
await page.getByRole('heading', { name: /Message Rachel Kim/ }).waitFor();
ok(true, 'confirmation compose opens after accepting');
await page.getByRole('button', { name: 'Cancel' }).click();
let s = await store();
ok(s.customers.some((c) => c.firstName === 'Rachel' && c.lastName === 'Kim'), 'new customer created from booking');
ok(s.appointments.some((a) => a.source === 'online'), 'online appointment added');
ok(s.vehicles.some((v) => v.make === 'Subaru' && v.model === 'Forester'), 'vehicle parsed from booking');
await page.getByText('1 booking request').waitFor();

// ---- Marketing: send queue.
await page.goto(BASE + '/marketing?tab=due');
await page.getByRole('button', { name: /Send to all/ }).click();
await page.getByRole('button', { name: /Send one by one/ }).click();
const textBtn = page.getByRole('link', { name: /^Text / });
await textBtn.click();
await page.getByText(/1 sent/).waitFor();
await page.getByRole('button', { name: 'Skip' }).click();
await page.getByRole('link', { name: /^Text / }).click();
await page.getByText(/2 sent/).waitFor();
await page.keyboard.press('Escape');
s = await store();
ok(s.campaigns.length === 1 && s.campaigns[0].count === 2, 'campaign logged with 2 sends');
ok(s.messages.filter((m) => m.meta?.template === 'service').length === 2, 'reminders logged to threads');
await page.getByText(/Contacted/).first().waitFor();
ok(true, 'contacted badge shows');
await page.goto(BASE + '/marketing?tab=campaigns');
const [dl] = await Promise.all([page.waitForEvent('download'), (async () => { await page.getByRole('button', { name: /Review & send/ }).click(); await page.getByRole('button', { name: /Export list/ }).click(); })()]);
const csv = fs.readFileSync(await dl.path(), 'utf8');
ok(csv.startsWith('"First name","Last name","Phone"') && csv.split('\n').length > 3, 'campaign list export');
await page.keyboard.press('Escape');

// ---- Accounting.
await page.goto(BASE + '/accounting');
await page.getByRole('button', { name: 'Add expense' }).click();
await page.getByLabel('Vendor / payee').fill('Test Tool Co');
await page.getByLabel('Amount').fill('123.45');
await page.getByRole('button', { name: 'Save' }).click();
s = await store();
ok(s.expenses.some((e) => e.vendor === 'Test Tool Co' && e.amount === 123.45), 'expense saved');
await page.getByRole('tab', { name: 'Last month' }).click();
const netSales = await page.locator('text=Net sales').locator('..').innerText();
ok(!/\$0\b/.test(netSales.split('\n')[1]), `last month has sales (${netSales.replace(/\n/g, ' | ')})`);
await page.screenshot({ path: `${SP}/shots/f-accounting.png`, fullPage: true });
await page.getByRole('button', { name: /QuickBooks & exports/ }).click();
const [dl2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).first().click()]);
const inv = fs.readFileSync(await dl2.path(), 'utf8');
ok(inv.startsWith('"InvoiceNo","Customer","InvoiceDate"') && inv.split('\n').length > 10, `invoice export (${inv.split('\n').length - 1} lines)`);
const [dl3] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).nth(3).click()]);
const jr = fs.readFileSync(await dl3.path(), 'utf8').trim().split('\n').slice(1).map((l) => l.split('","').map((x) => x.replace(/"/g, '')));
const byJ = {};
for (const r of jr) byJ[r[0]] = (byJ[r[0]] || 0) + (parseFloat(r[3]) || 0) - (parseFloat(r[4]) || 0);
ok(Object.values(byJ).every((v) => Math.abs(v) < 0.02), `daily journal entries balance (${Object.keys(byJ).length} days)`);
await page.getByRole('button', { name: /Sales tax/ }).click();
await page.getByText('Sales tax summary').waitFor();

// ---- Import.
await page.goto(BASE + '/import');
await page.getByRole('button', { name: /Paste from a spreadsheet/ }).click();
await page.getByLabel('Pasted rows').fill('Customer Name\tCell Phone\tEmail\tYear\tMake\tModel\tVIN\nDoe, Jane\t217-555-0177\tjane@example.com\t2014\tTOYOTA\tCOROLLA\t\nAvery Thompson\t(217) 555-0101\t\t2012\tFord\tFocus\t\nDoe, Jane\t217-555-0177\t\t2019\tKia\tSoul\t');
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByText('New customers').waitFor();
const counts = await page.locator('.tabular.text-2xl').allInnerTexts();
ok(counts.join(',') === '1,3,1', `import preview counts new=1 vehicles=3 existing=1 (${counts})`);
await page.getByRole('button', { name: /Import customers & vehicles/ }).click();
await page.getByRole('heading', { name: 'Import complete' }).waitFor();
s = await store();
const jane = s.customers.find((c) => c.firstName === 'Jane' && c.lastName === 'Doe');
ok(jane && s.vehicles.filter((v) => v.customerId === jane.id).length === 2, 'imported Jane with 2 vehicles');
ok(s.vehicles.some((v) => v.make === 'Toyota' && v.model === 'Corolla'), 'uppercase names normalized');

// ---- Tech view: clock in, start job, stop.
await page.goto(BASE + '/tech');
await page.getByRole('button', { name: /Kim Park/ }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${SP}/shots/f-tech.png`, fullPage: true });
const clockIn = page.getByRole('button', { name: /Clock in/ });
if (await clockIn.count()) await clockIn.first().click();
await page.waitForTimeout(200);
const start = page.getByRole('button', { name: 'Start', exact: true });
ok((await start.count()) > 0, `tech has jobs to start (${await start.count()})`);
await start.first().click();
await page.waitForTimeout(300);
s = await store();
ok(s.timeEntries.some((e) => e.techId === 't4' && e.kind === 'job' && !e.end), 'job timer running for Kim');
await page.screenshot({ path: `${SP}/shots/f-tech-running.png`, fullPage: true });

// ---- Purchase order receive.
await page.goto(BASE + '/parts?tab=orders');
await page.waitForTimeout(300);
await page.screenshot({ path: `${SP}/shots/f-po.png`, fullPage: true });

// ---- Reports tabs.
for (const t of ['techs', 'estimates', 'customers']) {
  await page.goto(BASE + '/reports?tab=' + t);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SP}/shots/f-reports-${t}.png`, fullPage: true });
}
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO PAGE ERRORS');
