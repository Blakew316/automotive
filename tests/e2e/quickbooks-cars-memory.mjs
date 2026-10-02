// Phase I: labor & parts memory on the RO, QuickBooks Online sync (connect, map, post, re-post,
// daily auto-sync), connected cars (setup, connect link, readings, reminders, expiry, disconnect)
// and the refreshed Integrations page.
import { launch, APP, OUT } from '../support/env.mjs';
import { fakeCloud } from '../support/fakecloud.mjs';
import { loadSrc } from '../support/load.mjs';
const { serviceReminders } = await loadSrc('src/lib/marketing.js');
const CLOUD = 'https://huwcrbkplpudpsfczbyg.supabase.co';
const SP = OUT;
const browser = await launch();
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const errors = [];
const cloud = fakeCloud();
cloud.addUser('owner@shop.test', 'owner-pass-123', { autoshop_staff: true, autoshop_role: 'owner', autoshop_staff_id: 'staff-owner' }, { name: 'Shop owner' });

const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 }, serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] });
await ctx.route(CLOUD + '/**', (r) => cloud.handle(r));
await ctx.routeWebSocket(/realtime/, (ws) => ws.close());
await ctx.addInitScript(() => document.addEventListener('click', (e) => { const a = e.target.closest?.('a[href^="sms:"],a[href^="mailto:"],a[href^="tel:"]'); if (a) e.preventDefault(); }, true));
const page = await ctx.newPage();
page.on('dialog', (d) => d.accept());
page.on('pageerror', (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|WebSocket|realtime|net::ERR/.test(m.text()) && errors.push(`console ${page.url()}: ${m.text()}`));
const state = async () => { await page.waitForFunction(() => window.__autoshop); return page.evaluate(() => window.__autoshop.state()); };
const until = async (fn, msg, ms = 10000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await fn()) return true;
    await page.waitForTimeout(250);
  }
  throw new Error('timeout: ' + msg);
};

await page.goto(APP + '/signin');
await page.getByLabel('Email').fill('owner@shop.test');
await page.getByLabel('Password').fill('owner-pass-123');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL(/settings\?tab=cloud/);

// ================================================================ Labor & parts memory
let s = await state();
const ro = s.orders.find((o) => o.status === 'in_progress');
await page.evaluate((id) => window.__autoshop.update((st) => {
  const o = st.orders.find((x) => x.id === id);
  o.services.push({ id: 'svc_memtest', title: 'Front brake pads & rotors', status: 'approved', techId: o.techId, done: false, items: [{ id: 'itm_memtest', type: 'labor', description: 'Front brakes', hours: 1, rate: 150 }] });
}), ro.id);
await page.goto(APP + `/orders/${ro.id}`);
const hint = page.getByTestId('job-memory').filter({ hasText: /Done \d+×/ }).last();
await hint.waitFor();
const text = await hint.innerText();
ok(/Done \d+× on .*· usually [\d.]+ h/.test(text), `memory hint on the new service: "${text.split('\n')[0]}"`);
const useBtn = hint.getByRole('button', { name: /^Use [\d.]+ h$/ });
const usual = Number((await useBtn.innerText()).match(/[\d.]+/)[0]);
await useBtn.click();
await until(async () => (await state()).orders.find((o) => o.id === ro.id).services.find((x) => x.id === 'svc_memtest').items[0].hours === usual, 'hours applied');
ok(true, `“Use ${usual} h” sets the labor line to the shop’s usual time`);
await hint.getByRole('button', { name: 'Show parts used before' }).click();
const addParts = hint.getByRole('button', { name: /^Add \d+ parts?$/ });
const nParts = Number((await addParts.innerText()).match(/\d+/)[0]);
await addParts.click();
await until(async () => (await state()).orders.find((o) => o.id === ro.id).services.find((x) => x.id === 'svc_memtest').items.filter((i) => i.type === 'part').length === nParts, 'parts added');
const svc = (await state()).orders.find((o) => o.id === ro.id).services.find((x) => x.id === 'svc_memtest');
ok(svc.items.filter((i) => i.type === 'part').every((p) => p.description && p.cost > 0 && p.partStatus === 'needed'), `${nParts} parts added with descriptions, costs, needed status`);
await hint.getByText('Matches past jobs').waitFor();
ok(true, 'hint settles to “Matches past jobs”');
await page.screenshot({ path: `${SP}/shots/i-memory.png` });
await hint.getByRole('button', { name: 'Hide job history' }).click();
await until(async () => (await state()).orders.find((o) => o.id === ro.id).services.find((x) => x.id === 'svc_memtest').memoryHidden === true, 'hidden');
ok(true, 'hint can be hidden for a service');

// ================================================================ QuickBooks Online
await page.goto(APP + '/accounting?tab=export');
const card = page.getByTestId('qbo-card');
await card.getByText(/about 10 minutes to set up/).waitFor();
ok((await card.getByTestId('qbo-redirect').innerText()) === `${CLOUD}/functions/v1/oauth-callback`, 'setup steps show the redirect URI to register with Intuit');
ok((await card.getByText(/production-keys questionnaire/).count()) === 1, 'honest note about Intuit production keys');

cloud.db.qbo.configured = true;
cloud.db.qbo.accounts = [
  { id: '1', name: 'Accounts Receivable (A/R)', type: 'Accounts Receivable', subType: 'AccountsReceivable', number: '' },
  { id: '2', name: 'Undeposited Funds', type: 'Other Current Asset', subType: 'UndepositedFunds', number: '' },
  { id: '3', name: 'Labor Income', type: 'Income', subType: 'ServiceFeeIncome', number: '4000' },
  { id: '4', name: 'Parts Sales', type: 'Income', subType: 'SalesOfProductIncome', number: '4100' },
  { id: '5', name: 'Shop Supplies & Fees', type: 'Income', subType: 'OtherPrimaryIncome', number: '4200' },
  { id: '6', name: 'Sublet Income', type: 'Income', subType: 'OtherPrimaryIncome', number: '4300' },
  { id: '7', name: 'Discounts given', type: 'Income', subType: 'DiscountsRefundsGiven', number: '' },
  { id: '8', name: 'Surcharge Income', type: 'Other Income', subType: 'OtherMiscellaneousIncome', number: '' },
  { id: '9', name: 'Sales Tax Payable', type: 'Other Current Liability', subType: 'SalesTaxPayable', number: '' },
  { id: '10', name: 'Tips Payable', type: 'Other Current Liability', subType: 'OtherCurrentLiabilities', number: '' },
  { id: '11', name: 'Merchant Fees', type: 'Expense', subType: 'BankCharges', number: '6100' },
  { id: '12', name: 'Rent Expense', type: 'Expense', subType: 'RentOrLeaseOfBuildings', number: '' },
];
await page.reload();
await card.getByText('Keys saved — connect your company').waitFor();
await card.getByRole('button', { name: 'Connect to QuickBooks' }).click();
await page.waitForURL(/accounting\?tab=export$/);
await page.getByText('QuickBooks connected').first().waitFor();
ok(cloud.db.qbo.authorizes[0].env === 'sandbox' && cloud.db.qbo.authorizes[0].returnUrl.endsWith('/automotive/app/accounting?tab=export'), 'connect starts Intuit sign-in for the sandbox and comes back to this tab');
await card.getByText('Connected · Main Street Auto LLC · sandbox').waitFor();
ok((await card.getByText(/This is a sandbox company/).count()) === 1, 'sandbox explained');

// Mapping opens with suggestions; posting waits until it's saved.
await card.getByText('Account mapping').waitFor();
await card.locator('#qbo-map-Labor-Income').waitFor();
const val = (n) => card.locator(`#qbo-map-${n}`).inputValue();
ok((await val('Accounts-Receivable')) === '1' && (await val('Labor-Income')) === '3' && (await val('Parts-Income')) === '4' && (await val('Sales-Tax-Payable')) === '9' && (await val('Card-Processing-Fees')) === '11' && (await val('Undeposited-Funds')) === '2' && (await val('Tips-Payable')) === '10', 'suggested accounts match by name and type');
ok((await card.getByText('Suggested').count()) >= 8, 'suggestions are marked');
ok(await card.getByRole('button', { name: 'Post to QuickBooks' }).isDisabled(), 'posting waits until the mapping is saved');
await card.locator('#qbo-map-Shop-Fees-Supplies-Income').selectOption('5');
await card.getByRole('button', { name: 'Save mapping' }).click();
await until(async () => Object.keys((await state()).shop.qbo?.map || {}).length >= 10, 'mapping saved');
s = await state();
ok(s.shop.qbo.map['Shop Fees & Supplies Income'].id === '5' && s.shop.qbo.map['Labor Income'].name === 'Labor Income', 'mapping saved on the shop');

// Post this month.
await page.getByRole('tab', { name: 'Last month' }).click();
await card.getByText(/Post daily sales for/).waitFor();
const daysText = await card.getByText(/\d+ days? with sales or payments/).innerText();
const days = Number(daysText.match(/\d+/)[0]);
ok(days > 3, `${days} days to post last month`);
await card.getByRole('button', { name: 'Post to QuickBooks' }).click();
await card.getByTestId('qbo-results').waitFor();
await until(async () => cloud.db.qbo.entries.size === days, 'all days posted');
ok((await card.getByTestId('qbo-results').getByText('Posted').count()) === days && (await card.getByTestId('qbo-results').getByText('Didn’t post').count()) === 0, 'every day posts as one balanced journal entry');
const entry = [...cloud.db.qbo.entries.values()][0].journal;
ok(/^SALES-\d{8}$/.test([...cloud.db.qbo.entries.keys()][0]) && entry.lines.some((l) => l.account === 'Undeposited Funds'), 'entries numbered SALES-YYYYMMDD with deposits to Undeposited Funds');
await page.getByText(new RegExp(`^${days} new$`)).first().waitFor();
await card.getByRole('button', { name: 'Post to QuickBooks' }).click();
await until(async () => (await card.getByTestId('qbo-results').getByText('Up to date').count()) === days, 're-post up to date');
ok(cloud.db.qbo.entries.size === days, 'posting again changes nothing and makes no duplicates');
// A change to a day already posted updates that entry.
s = await state();
const paid = s.orders.filter((o) => (o.payments || []).some((p) => cloud.db.qbo.entries.has(`SALES-${p.at.slice(0, 10).replace(/-/g, '')}`)));
await page.evaluate((id) => window.__autoshop.update((st) => { const o = st.orders.find((x) => x.id === id); o.payments[0].tip = (Number(o.payments[0].tip) || 0) + 5; }), paid[0].id);
await card.getByRole('button', { name: 'Post to QuickBooks' }).click();
await until(async () => (await card.getByTestId('qbo-results').getByText('Updated').count()) >= 1, 'changed day updated');
ok(cloud.db.qbo.entries.size === days, 'a changed day is updated in place');
await page.screenshot({ path: `${SP}/shots/i-qbo.png`, fullPage: true });

// Daily auto-sync.
await card.getByRole('switch', { name: 'Post automatically every day' }).click();
await until(async () => (await state()).shop.qbo.auto === true, 'auto on');
const postsBefore = cloud.db.qbo.posts.length;
await page.reload();
await until(async () => Boolean((await state()).shop.qbo.lastAuto), 'auto-sync ran', 35000);
s = await state();
ok(s.shop.qbo.lastAuto.ok && cloud.db.qbo.posts.length === postsBefore + 1 && cloud.db.qbo.posts.at(-1).journals.every((j) => j.date < new Date().toISOString().slice(0, 10) || true), `auto-sync posted the last week through yesterday: ${s.shop.qbo.lastAuto.summary}`);
const lastWeek = cloud.db.qbo.posts.at(-1).journals.map((j) => j.date);
const today = new Date();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
ok(lastWeek.every((d) => d < iso(today) && d >= iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7))), 'auto-sync covers 7 days and skips today');
await card.getByTestId('qbo-last').waitFor();
ok((await card.getByTestId('qbo-last').innerText()).includes('Last run'), 'last auto run shown');
await page.reload();
await page.waitForTimeout(22000);
ok(cloud.db.qbo.posts.length === postsBefore + 1, 'auto-sync runs once a day');

// ================================================================ Connected cars
s = await state();
const before = new Set(serviceReminders(s).map((r) => r.vehicle.id));
const openV = new Set(s.orders.filter((o) => !o.invoicedAt && o.status !== 'closed').map((o) => o.vehicleId));
const OIL = /oil/i;
const v = s.vehicles.find((x) => {
  const c = s.customers.find((y) => y.id === x.customerId);
  return c?.phone && !openV.has(x.id) && !before.has(x.id) && s.orders.some((o) => o.vehicleId === x.id && o.invoicedAt && o.services.some((sv) => sv.status !== 'declined' && OIL.test(sv.title)));
});
ok(v, 'a vehicle with a recent oil change that isn’t due yet');
await page.goto(APP + `/vehicles/${v.id}`);
const car = page.getByTestId('connected-car');
await car.getByRole('link', { name: 'Set up connected cars' }).click();
await page.waitForURL(/settings\?tab=general#connected-cars/);
const sec = page.locator('#connected-cars');
await sec.getByTestId('cars-redirect').waitFor();
ok((await sec.getByTestId('cars-redirect').innerText()) === `${CLOUD}/functions/v1/oauth-callback`, 'Smartcar setup shows the redirect URI');
ok((await sec.getByText(/paid service beyond its free developer tier/).count()) === 1, 'honest note about Smartcar cost and coverage');
await sec.getByRole('tab', { name: 'Simulated (testing)' }).click();
await until(async () => (await state()).shop.cars?.mode === 'simulated', 'mode saved');
ok(true, 'simulated mode saved on the shop');

cloud.db.cars.configured = true;
await page.goto(APP + `/vehicles/${v.id}`);
await car.getByRole('button', { name: 'Send connect link' }).click();
const dlg = page.getByRole('dialog', { name: /^Message / });
await dlg.waitFor();
const msg = await dlg.getByLabel('Message', { exact: true }).inputValue();
ok(cloud.db.cars.links.length === 1 && cloud.db.cars.links[0].vehicleId === v.id && cloud.db.cars.links[0].mode === 'simulated' && cloud.db.cars.links[0].vin === (v.vin || ''), 'link made for this vehicle in simulated mode');
ok(msg.includes('oauth-callback?go=') && /read-only/.test(msg) && msg.includes(s.shop.name), 'connect text explains it and carries the link');
await dlg.getByRole('button', { name: 'Cancel' }).click();
ok((await car.getByText(/Simulated mode: the link connects one of Smartcar’s test cars/).count()) === 1, 'simulated mode flagged on the card');

// The customer connects; opening the page reads the car.
const odo = (Number(v.mileage) || 0) + 1234;
cloud.db.cars.connected.set(v.id, { vehicleId: v.id, vin: v.vin, make: v.make, model: v.model, year: v.year, connectedAt: new Date().toISOString(), reading: null, readAt: null });
cloud.db.cars.nextReading = { odometer: odo, oilLife: 12, tires: { fl: 35.2, fr: 34.6, rl: 26.1, rr: 35 }, fuel: { percent: 58, range: 212 }, battery: null };
await page.reload();
await car.getByTestId('car-readings').waitFor();
ok(cloud.db.cars.reads === 1, 'connected car is read when its page opens');
ok((await car.getByText('Oil life 12% — due for an oil change').count()) === 1 && (await car.getByText(/Low tire pressure: rear left 26 psi/).count()) === 1, 'oil life and low tire flagged');
ok((await car.getByText(`${odo.toLocaleString('en-US')} mi`).count()) === 1 && (await car.getByText('212 mi range').count()) === 1, 'odometer and fuel range shown');
await until(async () => (await state()).vehicles.find((x) => x.id === v.id).mileage === odo, 'mileage updated');
s = await state();
ok(s.vehicles.find((x) => x.id === v.id).connected?.reading?.oilLife === 12, 'vehicle record keeps the reading for every device');
await page.screenshot({ path: `${SP}/shots/i-car.png` });
const due = serviceReminders(s).find((r) => r.vehicle.id === v.id);
ok(due && due.due === 'oil' && due.estMiles >= odo && due.measured, 'oil-change reminder comes due from the car’s own oil life');
await page.goto(APP + '/marketing?tab=due');
await page.getByText('Car says oil change due').first().waitFor();
ok((await page.getByText(/oil life 12%/).count()) >= 1, 'Marketing shows the measured mileage and oil life');

// Read again; then an expired connection.
await page.goto(APP + `/vehicles/${v.id}`);
await car.getByTestId('car-readings').waitFor();
cloud.db.cars.nextReading = { ...cloud.db.cars.nextReading, oilLife: 64 };
await car.getByRole('button', { name: 'Read the car now' }).click();
await page.getByText('Readings updated').first().waitFor();
await until(async () => (await state()).vehicles.find((x) => x.id === v.id).connected.reading.oilLife === 64, 'second read saved');
ok(cloud.db.cars.reads === 2, 'Read now reads the car again');
cloud.db.cars.failRead = 'The car’s connection expired — send the customer a new connect link.';
await car.getByRole('button', { name: 'Read the car now' }).click();
await car.getByRole('button', { name: 'Send a new connect link' }).waitFor();
ok(true, 'expired connection explained with a one-tap new link');
cloud.db.cars.failRead = null;

// Disconnect.
await car.getByRole('button', { name: 'Disconnect car' }).click();
await car.getByRole('button', { name: 'Send connect link' }).waitFor();
await until(async () => (await state()).vehicles.find((x) => x.id === v.id).connected === null, 'disconnected');
ok(!cloud.db.cars.connected.has(v.id), 'disconnect forgets the car on the server and the vehicle');

// ================================================================ Integrations and keys
await page.goto(APP + '/integrations');
const chip = (name) => page.locator('section.card', { hasText: name }).locator('.chip');
await page.getByText('Business texting & calls').waitFor();
await until(async () => (await chip('QuickBooks Online').innerText()) === 'Sandbox', 'qbo status');
ok((await chip('Connected cars').innerText()) === 'Simulated', 'connected cars status');
ok((await chip('AI assistant').innerText()) === 'On' && (await chip('Online card payments').innerText()) === 'Not set up' && (await chip('Business texting & calls').innerText()) === 'Not set up', 'live statuses for AI, Stripe and the phone line');
await page.screenshot({ path: `${SP}/shots/i-integrations.png`, fullPage: true });
await page.goto(APP + '/settings?tab=keys');
await page.getByText('Integration keys').waitFor();
ok((await page.getByText('Used when this integration is turned on').count()) === 0, 'QuickBooks and Smartcar keys are live, not “coming later”');

ok(errors.length === 0, `no page errors${errors.length ? ':\n' + errors.join('\n') : ''}`);
await browser.close();
console.log('PHASE I PASS');
