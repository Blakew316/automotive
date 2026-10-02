import { launch, APP, ROOT, OUT } from '../support/env.mjs';
const BASE = APP;
const SP = OUT;
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 }, serviceWorkers: 'block' });
await ctx.addInitScript(() => document.addEventListener('click', (e) => { const a = e.target.closest?.('a[href^="sms:"],a[href^="mailto:"]'); if (a) e.preventDefault(); }, true));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|Failed to launch|registered handler/.test(m.text()) && errors.push(`console ${page.url()}: ${m.text()}`));
page.on('response', (r) => r.status() >= 400 && r.request().resourceType() !== 'document' && !r.url().includes('supabase.co') && errors.push(`${r.status()} ${r.url()}`));
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const store = async () => { await page.waitForTimeout(450); await page.waitForFunction(() => window.__autoshop); return page.evaluate(() => window.__autoshop.state()); };

await page.goto(BASE + '/');
await page.waitForTimeout(800);
let s = await store();
const est = s.orders.find((o) => o.status === 'estimate' && o.services.some((x) => x.tires));
ok(est, 'demo estimate with tire quote exists');
const tsvc = est.services.find((x) => x.tires);

// ---- RO: tire options panel, select one, profit meter.
await page.goto(BASE + `/orders/${est.id}`);
await page.getByText('Tire options').waitFor();
await page.getByText('Job profit').waitFor();
await page.screenshot({ path: `${SP}/shots/f2-ro-tires.png`, fullPage: true });
ok(await page.getByText(/GP \d+%/).count() > 0, 'per-job GP shown on services');

// ---- Customer view: choose "best" option, approve all, sign.
await page.goto(BASE + `/orders/${est.id}/report`);
await page.getByText('tap the option you’d like').waitFor();
const best = tsvc.tires.options.find((o) => o.tier === 'best');
await page.getByRole('button', { name: new RegExp(best.model) }).click();
for (const b of await page.getByRole('radio', { name: /Approve/ }).all()) await b.click();
await page.getByLabel('Your name').fill('Wesley Grant');
const pad = page.locator('canvas').first();
const box = await pad.boundingBox();
await page.mouse.move(box.x + 20, box.y + 40);
await page.mouse.down();
await page.mouse.move(box.x + 160, box.y + 70, { steps: 8 });
await page.mouse.move(box.x + 240, box.y + 30, { steps: 8 });
await page.mouse.up();
await page.screenshot({ path: `${SP}/shots/f2-report-tires.png`, fullPage: true });
await page.getByRole('button', { name: /Sign & authorize/ }).click();
await page.getByText(/Thank you/).waitFor();
s = await store();
const svc2 = s.orders.find((o) => o.id === est.id).services.find((x) => x.id === tsvc.id);
ok(svc2.tires.selectedId === best.id, 'customer tire choice saved');
const line = svc2.items.find((i) => i.tireLine);
ok(line && line.description.includes(best.model) && line.qty === 4 && line.price === best.price, `tire line added (${line?.description} × ${line?.qty} @ ${line?.price})`);
ok(svc2.status === 'approved', 'tire service approved');

// ---- Tire log page.
await page.goto(BASE + '/parts?tab=tires');
await page.getByText('Tire registration log').waitFor();
const before = (await store()).orders.flatMap((o) => o.services).filter((x) => x.tires?.registered).length;
await page.locator('[role=switch]').first().click().catch(async () => { await page.getByLabel(/Registered:/).first().click(); });
const after = (await store()).orders.flatMap((o) => o.services).filter((x) => x.tires?.registered).length;
ok(after !== before, `registration toggle updates (${before} → ${after})`);

// ---- Marketing automations.
await page.goto(BASE + '/marketing');
await page.getByText('Today’s follow-ups').waitFor();
await page.screenshot({ path: `${SP}/shots/f2-automations.png`, fullPage: true });
const startBtn = page.getByRole('button', { name: /^Start with/ });
if (await startBtn.count()) {
  await startBtn.click();
  await page.getByRole('button', { name: /Send one by one/ }).click();
  await page.getByRole('link', { name: /^(Text|Email) / }).click();
  await page.keyboard.press('Escape');
  s = await store();
  ok(s.messages.some((m) => m.meta?.automation), 'automation send logged with its recipe');
} else ok(true, 'no automations due (skipped send)');

// ---- Goals: edit target.
await page.goto(BASE + '/reports?tab=goals');
await page.getByRole('button', { name: /Edit targets/ }).click();
const aro = page.getByLabel('Average repair order ($)');
await aro.fill('700');
await aro.blur();
await page.getByRole('button', { name: 'Save' }).click();
s = await store();
ok(s.shop.goals.aro === 700, 'ARO target saved');
await page.getByRole('slider').first().fill('25');
await page.getByText('Added profit / year').waitFor();

// ---- Your website & booking button: the shop's own site (none by default) and the booking link to put on it.
await page.goto(BASE + '/settings?tab=website');
const web = page.locator('#website');
await web.getByRole('heading', { name: 'Your website & booking button' }).waitFor();
ok((await web.getByLabel('Website address', { exact: true }).inputValue()) === '', 'no website address by default (never the product site)');
ok((await web.getByRole('link', { name: 'Open' }).count()) === 0, 'no Open button until the shop has a website');
const bookLink = await web.getByLabel('Booking link', { exact: true }).inputValue();
ok(bookLink.startsWith(`${ROOT}app/book?`), `booking link opens the app's booking page (${bookLink.slice(0, 48)}…)`);
ok((await web.getByRole('button', { name: 'Copy booking link' }).count()) === 1, 'booking link has a copy button');
ok((await web.getByLabel('Book online button code').inputValue()) === `<a href="${bookLink}">Book online</a>`, 'ready-to-paste Book online button code');
ok(!(await web.innerText()).match(/published (together )?with|website\/|sync\.mjs|appointment\.html/i), 'no old shop-website wording or repo instructions');
const addr = web.getByLabel('Website address', { exact: true });
await addr.fill('www.mainstreetauto.example');
await addr.press('Enter');
await web.getByRole('link', { name: 'Open' }).waitFor();
ok((await web.getByRole('link', { name: 'Open' }).getAttribute('href')) === 'https://www.mainstreetauto.example', 'own website saved with https and opens from Settings');
ok((await store()).shop.website.url === 'https://www.mainstreetauto.example', 'website address stored on the shop');

// ---- Roles: set a PIN for the advisor, switch to them, check access.
await page.goto(BASE + '/team?tab=access');
await page.getByText('Staff & access').first().waitFor();
await page.getByRole('button', { name: /Set PIN/ }).nth(1).click();
await page.getByLabel('4-digit PIN').fill('1234');
await page.getByRole('button', { name: 'Save PIN' }).click();
await page.getByTitle('Switch user').click();
await page.getByRole('dialog').getByRole('button', { name: /Jordan Blake/ }).click();
for (const d of '1239') await page.getByRole('button', { name: d, exact: true }).click();
await page.getByText('Wrong PIN').waitFor();
for (const d of '1234') await page.getByRole('button', { name: d, exact: true }).click();
await page.waitForTimeout(400);
ok(await page.locator('nav a[href$="/accounting"]').count() === 0, 'advisor nav hides accounting');
await page.goto(BASE + '/accounting');
await page.getByText('This page needs a different role').waitFor();
ok(true, 'advisor blocked from accounting');
await page.goto(BASE + '/orders');
ok(await page.getByText('This page needs a different role').count() === 0, 'advisor can open repair orders');
// Switch to a tech: lands on tech clock.
await page.getByTitle('Switch user').click();
await page.getByRole('dialog').getByRole('button', { name: /Kim Park/ }).click();
await page.waitForURL(/\/tech$/);
await page.waitForTimeout(400);
console.log('footer:', (await page.getByTitle('Switch user').innerText()).split('\n').join(' | '), 'nav:', (await page.locator('nav').first().innerText()).split('\n').join(' · ').slice(0, 300));
ok(await page.locator('nav a[href$="/customers"]').count() === 0, 'tech nav is trimmed to tech tools');
await page.screenshot({ path: `${SP}/shots/f2-tech-role.png` });
// Back to owner.
await page.getByTitle('Switch user').click();
await page.getByRole('dialog').getByRole('button', { name: /Shop owner/ }).click();
await page.waitForTimeout(300);
ok(await page.locator('nav a[href$="/accounting"]').count() === 1, 'owner sees everything again');

await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO PAGE ERRORS');
