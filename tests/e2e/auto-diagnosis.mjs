// Auto diagnosis: from a repair order (concern and codes carried over), any vehicle (in the shop, a
// customer's, a VIN, or year make model), NHTSA recalls and owner reports ranked against the concern,
// the codes explained, the shop's own history, adding the findings to the RO, the AI test plan built
// from the same data, NHTSA being unreachable, and a technician getting there from their phone.
// NHTSA is played by tests/support/nhtsa.mjs (made-up reports in NHTSA's format).
import { launch, APP, OUT } from '../support/env.mjs';
import { fakeCloud } from '../support/fakecloud.mjs';
import { routeNhtsa } from '../support/nhtsa.mjs';
const CLOUD = 'https://huwcrbkplpudpsfczbyg.supabase.co';
const browser = await launch();
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const errors = [];
const cloud = fakeCloud();
cloud.addUser('owner@shop.test', 'owner-pass-123', { autoshop_staff: true, autoshop_role: 'owner', autoshop_staff_id: 'staff-owner' }, { name: 'Shop owner' });
cloud.db.secrets.set('anthropic_api_key', { value: 'sk-ant-api03-TEST', at: new Date().toISOString() });

const calls = [];
let down = false;
const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 }, serviceWorkers: 'block' });
await ctx.route(CLOUD + '/**', (r) => cloud.handle(r));
await ctx.routeWebSocket(/realtime/, (ws) => ws.close());
await routeNhtsa(ctx, { calls, fail: () => down });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|WebSocket|realtime|net::ERR/.test(m.text()) && errors.push(`console: ${m.text()}`));
const state = async () => { await page.waitForFunction(() => window.__autoshop); return page.evaluate(() => window.__autoshop.state()); };
const answer = page.getByTestId('dx-answer');

await page.goto(APP + '/signin');
await page.getByLabel('Email').fill('owner@shop.test');
await page.getByLabel('Password').fill('owner-pass-123');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL(/settings\?tab=cloud/);

// ---- From the repair order: vehicle, concern and codes come along.
let s = await state();
const truck = s.vehicles.find((v) => v.make === 'Ford' && v.model === 'F-150' && v.year === 2018);
const ro = s.orders.find((o) => o.vehicleId === truck.id && o.status === 'in_progress');
await page.goto(APP + `/orders/${ro.id}`);
await page.locator('#main-scroll').getByRole('link', { name: 'Auto diagnosis', exact: true }).click();
await page.waitForURL(/\/diagnose\?order=/);
await page.getByTestId('dx-vehicle').waitFor();
ok((await page.getByTestId('dx-vehicle').textContent()) === '2018 Ford F-150', 'vehicle from the RO');
ok((await page.getByLabel('Concern', { exact: true }).inputValue()) === ro.concern, 'customer concern carried over');
ok((await page.getByLabel('Trouble codes', { exact: true }).inputValue()) === 'P0302 P0305', 'codes written on the RO are picked up');
ok((await page.getByRole('button', { name: 'Misfire / runs rough' }).getAttribute('aria-pressed')) === 'true', 'the concern is recognised as a misfire');

// ---- Quick answer: the recall, the codes and what owners report.
await answer.getByText('Recall 18V000202 may cover this').waitFor();
const a = await answer.textContent();
ok(!/18V000101 may cover/.test(a), 'the brake master-cylinder recall is not pinned on a misfire');
ok(/P0302: Cylinder 2 Misfire Detected/.test(a) && /Most common cause/.test(a), 'code meaning and most common cause');
ok(/3 owner reports to NHTSA describe this — mostly Engine/.test(a) && /typically around 88,000 mi/.test(a), `owner pattern with failure mileage`);
ok(['2017', '2018', '2019'].every((y) => calls.some((c) => c.startsWith('/complaints/complaintsByVehicle') && c.includes(`modelYear=${y}`))), 'owner reports from a year either side');
ok(calls.some((c) => c.startsWith('/recalls/recallsByVehicle') && c.includes('modelYear=2018')), 'recalls for the model year');
ok((await page.getByTestId('dx-phrases').textContent()).includes('ignition coil'), 'the shared phrase owners use: ignition coil');
ok(await page.getByText('3 match this concern').count() === 1 || (await page.getByText(/12 complaints to NHTSA for 2017–2019 Ford F-150 · 3 match this concern/).count()) === 1, 'complaint counts: total and matching');
ok(await page.getByText('May relate', { exact: true }).count() === 1, 'one recall marked as possibly related');
await page.screenshot({ path: `${OUT}/shots/dx-ro.png`, fullPage: true });

// ---- Add the findings to the RO.
await page.getByRole('button', { name: `Add to RO #${ro.number}` }).click();
s = await state();
let note = s.orders.find((o) => o.id === ro.id).notes[0];
ok(note.internal && note.text.startsWith('Auto diagnosis — 2018 Ford F-150 · P0302, P0305') && note.text.includes('Recall 18V000202'), 'findings saved as an internal RO note');

// ---- A different concern re-ranks everything.
await page.getByLabel('Concern', { exact: true }).fill('');
await page.getByLabel('Trouble codes', { exact: true }).fill('');
await page.getByRole('button', { name: 'Brakes: noise, pedal, ABS' }).click();
await answer.getByText('Recall 18V000101 may cover this').waitFor();
ok(!(await answer.textContent()).includes('18V000202 may cover'), 'the misfire recall drops away for a brake concern');
await page.getByText(/2 owner reports? to NHTSA describe this/).waitFor();
ok((await page.getByTestId('dx-phrases').textContent()).includes('master cylinder'), 'brake reports share "master cylinder"');

// ---- AI test plan from the same data, saved to the RO.
await page.getByRole('button', { name: 'AI test plan' }).click();
await page.getByRole('button', { name: 'Diagnostic ideas for the tech' }).click();
await page.getByTestId('ai-result').waitFor();
const call = cloud.db.aiCalls.at(-1);
ok(call.task === 'diagnose' && call.context.includes('Vehicle: 2018 Ford F-150') && call.context.includes('18V000101') && call.context.includes('Owner complaints filed with NHTSA (2017–2019)'), 'the assistant gets the vehicle, recalls and owner reports');
ok(/Brakes: noise, pedal, ABS/.test(call.context), 'and the concern chosen');
await page.getByRole('button', { name: 'Save as note' }).click();
s = await state();
ok(s.orders.find((o) => o.id === ro.id).notes[0].text.startsWith('AI test plan — 2018 Ford F-150'), 'AI plan saved to the RO notes');
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Close assistant' }).click().catch(() => {});

// ---- Any vehicle by year make model.
await page.getByRole('button', { name: 'Change' }).click();
await page.getByPlaceholder('RO #, plate, VIN, customer, or year make model').fill('2015 honda civic');
await page.getByRole('button', { name: '2015', exact: true }).first().click();
await page.getByTestId('dx-vehicle').waitFor();
ok((await page.getByTestId('dx-vehicle').textContent()) === '2015 Honda Civic', 'year make model from the vehicle database');
ok(/year=2015&make=Honda&model=Civic/.test(page.url()), 'the link remembers the vehicle');
await answer.getByText('No recalls or owner-report patterns on file for this vehicle.').waitFor();
ok(calls.some((c) => c.includes('make=Honda') && c.includes('modelYear=2015')), 'NHTSA asked about the Civic');

// ---- By VIN (decoded on the device).
await page.getByRole('button', { name: 'Change' }).click();
await page.getByPlaceholder('RO #, plate, VIN, customer, or year make model').fill('1HGCV1F55LA104233');
await page.getByRole('button', { name: /Decode VIN/ }).click();
await page.waitForFunction(() => document.querySelector('[data-testid="dx-vehicle"]')?.textContent === '2020 Honda Accord', null, { timeout: 15000 });
ok(/vin=1HGCV1F55LA104233/.test(page.url()), 'VIN decoded to 2020 Honda Accord');

// ---- NHTSA unreachable: say so, keep codes working, retry.
down = true;
await page.getByRole('button', { name: 'Change' }).click();
const camry = s.vehicles.find((v) => v.model === 'Camry');
await page.getByPlaceholder('RO #, plate, VIN, customer, or year make model').fill(camry.plate || 'Camry');
await page.locator('ul button', { hasText: 'Camry' }).first().click();
await answer.getByText(/Couldn’t reach NHTSA/).waitFor();
await page.getByLabel('Trouble codes', { exact: true }).fill('P0420');
await page.getByText('Catalyst System Efficiency Below Threshold (Bank 1)').first().waitFor();
ok(true, 'NHTSA down: said plainly, codes still explained');
down = false;
await answer.getByRole('button', { name: 'Retry' }).click();
await page.waitForFunction(() => !document.querySelector('[data-testid="dx-answer"]')?.textContent.includes('Couldn’t reach NHTSA'), null, { timeout: 10000 });
ok(true, 'retry recovers');

// ---- Other ways in: search and the vehicle page.
await page.goto(APP + '/');
await page.keyboard.press('Control+k');
await page.getByRole('dialog', { name: 'Search' }).locator('input').fill('diagnos');
await page.getByRole('button', { name: /Auto diagnosis/ }).first().click();
await page.waitForURL(/\/diagnose$/);
await page.getByText('Pick the vehicle to start').waitFor();
ok(true, 'search → Auto diagnosis, ready for a vehicle');
await page.goto(APP + `/vehicles/${truck.id}`);
await page.getByRole('link', { name: 'Diagnose' }).click();
await page.waitForURL(/\/diagnose\?vehicle=/);
await page.getByTestId('dx-vehicle').waitFor();
ok((await page.getByTestId('dx-vehicle').textContent()) === '2018 Ford F-150', 'vehicle page → Diagnose');
await ctx.close();

// ---- A technician on a phone: Diagnose is a tab, the tech view links to it, and it fits.
const tech = s.technicians[0];
const phone = await browser.newContext({
  viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'block',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
});
await phone.addInitScript((id) => { localStorage.setItem('autoshop-pro:user', `staff-${id}`); localStorage.setItem('autoshop-pro:tech', id); }, tech.id);
await routeNhtsa(phone);
const pp = await phone.newPage();
pp.on('pageerror', (e) => errors.push(`phone pageerror: ${e.message}`));
await pp.goto(APP + '/tech', { waitUntil: 'networkidle' });
const tabs = pp.locator('nav[aria-label="Tabs"]');
ok((await tabs.getByRole('link').allInnerTexts()).map((t) => t.trim()).join(',') === 'Clock,Board,Orders,Diagnose,More', 'technician tabs: Clock, Board, Orders, Diagnose, More');
await tabs.getByRole('link', { name: 'Diagnose' }).tap();
await pp.waitForURL(/\/diagnose$/);
await pp.getByText('Pick the vehicle to start').waitFor();
await pp.goto(APP + `/diagnose?order=${ro.id}`, { waitUntil: 'networkidle' });
await pp.getByTestId('dx-answer').getByText('Recall 18V000202 may cover this').waitFor();
const fit = await pp.evaluate(() => {
  const main = document.getElementById('main-scroll');
  const small = [...document.querySelectorAll('input, textarea, select')].filter((el) => el.offsetParent && parseFloat(getComputedStyle(el).fontSize) < 16).length;
  return { over: main.scrollWidth - main.clientWidth, small };
});
ok(fit.over <= 1 && fit.small === 0, `fits the phone, no zoom-on-focus fields (${JSON.stringify(fit)})`);
await pp.screenshot({ path: `${OUT}/shots/dx-phone.png` });
await phone.close();

ok(errors.length === 0, `no page errors${errors.length ? ':\n' + errors.join('\n') : ''}`);
await browser.close();
console.log('AUTO DIAGNOSIS PASS');
