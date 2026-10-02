// Phase D: self check-in & key drop, front desk, loaners & shuttle, comebacks & no-charge work,
// core returns and the lobby screen.
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
await ctx.addInitScript(() => document.addEventListener('click', (e) => { const a = e.target.closest?.('a[href^="sms:"],a[href^="mailto:"],a[href^="tel:"]'); if (a) e.preventDefault(); }, true));
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|WebSocket|realtime|net::ERR/.test(m.text()) && errors.push(`console ${page.url()}: ${m.text()}`));
const state = async () => { await page.waitForFunction(() => window.__autoshop); return page.evaluate(() => window.__autoshop.state()); };
const sign = async (p, canvas) => {
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await p.mouse.move(box.x + 30, box.y + 60);
  await p.mouse.down();
  await p.mouse.move(box.x + 140, box.y + 90, { steps: 8 });
  await p.mouse.move(box.x + 240, box.y + 40, { steps: 8 });
  await p.mouse.up();
};

await page.goto(APP + '/signin');
await page.getByLabel('Email').fill('owner@shop.test');
await page.getByLabel('Password').fill('owner-pass-123');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL(/settings\?tab=cloud/);
await until(() => cloud.db.public.has('autoshop-media/site/checkin.json'), 'check-in config published');
const pub = JSON.parse(cloud.db.public.get('autoshop-media/site/checkin.json').body.toString());
ok(pub.enabled && pub.inbox?.url && pub.diagLimit === 150 && pub.loaners, 'check-in page config published (with inbox, limit, loaners)');
ok(!/"(customers|orders|vehicles)"|555-0101|@example\.com/.test(JSON.stringify(pub)), 'config has no customer data');

// ---- Front desk page + check-in link/QR.
await page.goto(APP + '/frontdesk');
await page.getByRole('heading', { name: 'Front desk' }).waitFor();
ok(await page.getByText('Loaner 1 — 2022 Toyota Corolla').count() > 0 && await page.getByText(/With .* since/).count() > 0, 'loaner board shows the loaner that is out');
ok(await page.getByText(/Pick up|Drop off/).count() > 0, 'today’s shuttle rides listed');
await page.getByRole('button', { name: 'Self check-in' }).click();
await page.locator('svg[aria-label="Self check-in QR code"]').waitFor();
const link = (await page.locator('span.font-mono').filter({ hasText: '/checkin' }).first().textContent()).trim();
ok(link.includes('/automotive/app/checkin?from='), `check-in link (${link.slice(0, 60)}…)`);
await page.screenshot({ path: `${SP}/shots/d-frontdesk.png`, fullPage: true });
await page.keyboard.press('Escape');

// ---- Customer checks in on their phone (new customer).
const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', isMobile: true, hasTouch: true });
await phoneCtx.route(CLOUD + '/**', (r) => cloud.handle(r));
const cust = await phoneCtx.newPage();
cust.on('pageerror', (e) => errors.push(`checkin pageerror: ${e.message}`));
await cust.goto(link);
await cust.getByRole('heading', { name: 'Check in your vehicle' }).waitFor();
await cust.getByLabel('Your name').fill('Dana Rivers');
await cust.getByLabel('Mobile phone').fill('(217) 555-0199');
await cust.getByLabel('Year, make & model').fill('2017 Subaru Outback');
await cust.getByLabel('License plate').fill('drv 17');
await cust.getByLabel('Mileage (optional)').fill('84,210');
await cust.getByRole('button', { name: 'Brakes' }).click();
await cust.getByLabel('Tell us what’s going on').fill('Brakes, grinding from the front when stopping');
await cust.getByRole('radio', { name: 'In the key drop box' }).click();
await cust.getByLabel('Key tag number (if you used one)').fill('22');
await cust.getByRole('radio', { name: 'I’ll wait' }).click();
ok(await cust.getByRole('button', { name: 'Check in' }).isDisabled(), 'check-in needs a signature and agreement');
await sign(cust, cust.locator('canvas'));
await cust.getByRole('checkbox').check();
await cust.screenshot({ path: `${SP}/shots/d-checkin-form.png`, fullPage: true });
await cust.getByRole('button', { name: 'Check in' }).click();
await cust.getByRole('heading', { name: 'You’re checked in' }).waitFor();
ok(cloud.db.inbox.some((r) => r.kind === 'checkin' && r.payload.name === 'Dana Rivers' && r.payload.signature?.startsWith('data:image/')), 'check-in landed in the shop inbox with the signature');

// Existing customer checks in from the lobby tablet (kiosk mode).
const s0 = await state();
const avery = s0.customers.find((c) => c.firstName === 'Avery' && c.lastName === 'Thompson');
const averyCar = s0.vehicles.find((v) => v.customerId === avery.id);
const vehiclesBefore = s0.vehicles.length;
await cust.goto(`${link}&kiosk=1`);
await cust.getByLabel('Your name').fill('Avery Thompson');
await cust.getByLabel('Mobile phone').fill(avery.phone);
await cust.getByLabel('Year, make & model').fill(`${averyCar.year} ${averyCar.make} ${averyCar.model}`);
await cust.getByLabel('Tell us what’s going on').fill('Oil change and a rattle');
await sign(cust, cust.locator('canvas'));
await cust.getByRole('checkbox').check();
await cust.getByRole('button', { name: 'Check in' }).click();
await cust.getByRole('button', { name: 'Check in another vehicle' }).waitFor();
ok(true, 'kiosk offers the next check-in');

// Shop device picks them up from the inbox.
await page.goto(APP + '/frontdesk');
await until(async () => (await state()).orders.filter((o) => o.checkin).length >= 2, 'check-ins turned into repair orders', 20000);
let s = await state();
const dana = s.customers.find((c) => c.firstName === 'Dana' && c.lastName === 'Rivers');
const danaRo = s.orders.find((o) => o.customerId === dana?.id && o.checkin);
const danaCar = s.vehicles.find((v) => v.id === danaRo?.vehicleId);
ok(dana && danaCar?.make === 'Subaru' && danaCar.model === 'Outback' && danaCar.year === 2017 && danaCar.plate === 'DRV 17', 'new customer and vehicle added from the check-in');
ok(danaRo.status === 'estimate' && /grinding/.test(danaRo.concern) && danaRo.mileageIn === 84210 && danaRo.transport === 'waiting', 'RO opened with the concern, mileage and “waiting”');
ok(danaRo.checkin.dropoff === 'dropbox' && danaRo.checkin.keyTag === '22', 'key drop and tag recorded');
ok(danaRo.authorizations?.[0]?.method === 'kiosk' && danaRo.authorizations[0].signature && danaRo.authorizations[0].amount === 150, 'signed diagnosis authorization saved on the RO');
const averyRo = s.orders.find((o) => o.customerId === avery.id && o.checkin);
ok(averyRo && averyRo.vehicleId === averyCar.id && s.vehicles.length === vehiclesBefore + 1, 'returning customer matched to their existing vehicle');
ok(cloud.db.inbox.length === 0, 'inbox cleared after processing');
await page.reload();
await page.getByText('Dana Rivers · 2017 Subaru Outback').waitFor();
ok(await page.locator('nav a[href$="/frontdesk"]').getByText('2').count() > 0, 'front desk badge counts today’s check-ins');
await page.screenshot({ path: `${SP}/shots/d-frontdesk-checkins.png`, fullPage: true });

// ---- Loaner: check out to Dana, then back in.
await page.goto(APP + `/orders/${danaRo.id}`);
await page.getByText('Self check-in ·').waitFor();
await page.getByLabel('Transportation').selectOption('loaner');
await page.getByRole('button', { name: 'Check out a loaner' }).click();
ok(await page.getByRole('option', { name: /Loaner 1/ }).count() === 0, 'a loaner that is out is not offered');
await sign(page, page.locator('[role=dialog] canvas'));
await page.getByRole('button', { name: 'Hand over keys' }).click();
s = await state();
let ln = s.orders.find((o) => o.id === danaRo.id).loaner;
ok(ln?.id === 'loan-2' && ln.outMiles === 33870 && ln.outFuel === 'F' && ln.signature, 'loaner 2 checked out with odometer, fuel and signature');
await page.getByRole('button', { name: 'Check loaner back in' }).click();
await page.getByLabel('Odometer in').fill('33912');
await page.getByLabel('Fuel in').selectOption('3/4');
await page.getByText('42 mi driven').waitFor();
await page.getByRole('button', { name: 'Check in', exact: true }).click();
s = await state();
ln = s.orders.find((o) => o.id === danaRo.id).loaner;
ok(ln.inAt && ln.inMiles === 33912 && s.shop.frontDesk.loaners.find((l) => l.id === 'loan-2').mileage === 33912, 'loaner back in; its odometer remembered');
await page.getByText('came back lower').waitFor();
ok(true, 'low fuel on return flagged');

// ---- No-charge service and comeback.
await page.evaluate((id) => window.__autoshop.update((d) => { const o = d.orders.find((x) => x.id === id); o.services.push({ id: 'svc-test-brk', title: 'Front brake pads & rotors', status: 'approved', techId: null, done: false, items: [{ id: 'itm-l', type: 'labor', description: 'Replace pads & rotors', hours: 1.5, rate: 140 }, { id: 'itm-p', type: 'part', description: 'Brake pads', qty: 1, cost: 40, price: 85, partNumber: 'BP-1' }] }); }), danaRo.id);
await page.getByRole('button', { name: 'Service options' }).last().click();
await page.getByRole('button', { name: /No charge \(warranty/ }).click();
await page.getByText('The customer isn’t billed').waitFor();
s = await state();
const t1 = await page.evaluate((id) => { const st = window.__autoshop.state(); return st.orders.find((o) => o.id === id); }, danaRo.id);
ok(t1.services.find((x) => x.id === 'svc-test-brk').noCharge === 'warranty', 'service marked no charge (shop warranty)');
ok(await page.getByText('No-charge work').count() > 0, 'totals show the no-charge work separately');
await page.getByRole('button', { name: 'More', exact: true }).click();
await page.getByRole('button', { name: 'Mark as comeback' }).click();
await page.getByRole('dialog').getByText('This vehicle has no earlier repair orders here.').waitFor().catch(() => {});
await page.keyboard.press('Escape');
// Comeback on a vehicle with history (Avery's car).
await page.goto(APP + `/orders/${averyRo.id}`);
await page.getByRole('button', { name: 'More', exact: true }).click();
await page.getByRole('button', { name: 'Mark as comeback' }).click();
await page.getByLabel('What came back').fill('Rattle returned after exhaust repair');
await page.getByRole('button', { name: 'Save' }).click();
await page.getByText(/Comeback/).first().waitFor();
s = await state();
const cb = s.orders.find((o) => o.id === averyRo.id);
ok(cb.comeback?.of && cb.comeback.reason.includes('Rattle'), 'comeback linked to the original RO');
await page.screenshot({ path: `${SP}/shots/d-ro-comeback.png`, fullPage: false });

// Reports → Technicians shows comebacks.
await page.goto(APP + '/reports?tab=techs');
await page.getByText('Comebacks & no-charge work').waitFor();
ok(await page.getByText(/back from #/).count() >= 1, 'comeback report lists comebacks');

// ---- Cores.
await page.goto(APP + '/parts?tab=cores');
await page.getByRole('tab', { name: 'To return' }).waitFor();
const coreRows = await page.locator('tbody tr').count();
ok(coreRows >= 1, `cores to return listed (${coreRows})`);
await page.locator('tbody tr').first().getByRole('combobox').selectOption('returned');
s = await state();
ok(s.orders.some((o) => o.services.some((sv) => sv.items.some((i) => i.core?.status === 'returned' && i.core.returnedAt))), 'core marked returned with the date');
await page.screenshot({ path: `${SP}/shots/d-cores.png`, fullPage: true });

// Core entered on an RO part line.
await page.goto(APP + `/orders/${danaRo.id}`);
await page.getByLabel('Core charge').last().fill('45');
await page.getByLabel('Core charge').last().blur();
s = await state();
ok(s.orders.find((o) => o.id === danaRo.id).services.find((x) => x.id === 'svc-test-brk').items.find((i) => i.id === 'itm-p').core?.amount === 45, 'core charge entered on the part line');

// ---- Lobby screen.
await page.goto(APP + '/lobby');
await page.getByText('Vehicle status').waitFor();
ok(await page.getByText('MainStreet-Guest').count() > 0, 'Wi-Fi shown');
const names = await page.locator('li .text-2xl').allTextContents();
ok(names.length > 0 && names.every((n) => /^\S+( [A-Z]\.)?$/.test(n.trim())), `names shown as first name + last initial (${names.slice(0, 3).join(', ')})`);
ok(await page.locator('svg[aria-label="Check-in QR code"]').count() > 0, 'check-in QR on the lobby screen');
await page.screenshot({ path: `${SP}/shots/d-lobby.png`, fullPage: false });

// Key-drop sign.
await page.goto(APP + '/frontdesk/sign');
await page.getByRole('heading', { name: 'Check in here' }).waitFor();
ok(await page.locator('svg[aria-label="Check-in QR code"]').count() > 0, 'printable key-drop sign with QR');

// ---- Settings → Front desk: add a loaner.
await page.goto(APP + '/settings?tab=frontdesk');
await page.getByRole('button', { name: 'Add loaner' }).click();
await page.getByRole('dialog').getByLabel('Name').fill('Loaner 3 — 2023 Kia Forte');
await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
s = await state();
ok(s.shop.frontDesk.loaners.length === 3, 'loaner added in settings');

ok(errors.length === 0, `no page errors${errors.length ? ':\n' + errors.join('\n') : ''}`);
await browser.close();
console.log('PHASE D PASS');
