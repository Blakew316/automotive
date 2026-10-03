// The sample shop (a fresh device with no saved shop) says what it is and offers a way back to the
// product site: Request a demo, or Start over. Gone once someone signs in or the shop is replaced.
import { launch, APP, ROOT, OUT } from '../support/env.mjs';
import { fakeCloud } from '../support/fakecloud.mjs';
import { readFile } from 'node:fs/promises';
const CLOUD = 'https://huwcrbkplpudpsfczbyg.supabase.co';
const SP = OUT;
const browser = await launch();
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const errors = [];
const cloud = fakeCloud();
cloud.addUser('owner@shop.test', 'owner-pass-123', { autoshop_staff: true, autoshop_role: 'owner', autoshop_staff_id: 'staff-owner' }, { name: 'Shop owner' });

async function device(name, opts = { viewport: { width: 1280, height: 900 } }) {
  const ctx = await browser.newContext({ ...opts, serviceWorkers: 'block' });
  await ctx.route(CLOUD + '/**', (r) => cloud.handle(r));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|WebSocket|realtime|net::ERR/.test(m.text()) && errors.push(`${name} console: ${m.text()}`));
  return { ctx, page };
}
const state = (page) => page.evaluate(() => window.__autoshop.state());
const banner = (page) => page.getByRole('region', { name: 'Sample shop' });
const settle = (page) => page.waitForTimeout(500);

// ---- A fresh device opens the sample shop with the banner.
const A = await device('A');
let page = A.page;
await page.goto(APP + '/');
await page.waitForFunction(() => window.__autoshop);
await banner(page).waitFor();
ok((await state(page)).sample === true, 'fresh device: the sample shop is marked as the sample');
ok(/You’re exploring the sample shop/.test(await banner(page).innerText()), 'banner says you’re exploring the sample shop');
const demo = banner(page).getByRole('link', { name: 'Request a demo' });
ok((await demo.getAttribute('href')) === `${ROOT}demo.html`, 'Request a demo goes to the product site’s demo page');
ok((await banner(page).getByRole('button', { name: 'Start over' }).count()) === 1, 'Start over button');
await page.screenshot({ path: `${SP}/shots/sample-banner-1280.png` });
for (const path of ['/orders', '/settings?tab=website']) {
  await page.goto(APP + path);
  await banner(page).waitFor();
}
ok(true, 'banner shows on every back-office page');
await page.goto(APP + '/book');
await page.getByText('This booking link is incomplete.').waitFor();
ok((await banner(page).count()) === 0, 'never on customer pages');

// ---- Start over asks first, then puts the sample shop back.
await page.goto(APP + '/customers');
await banner(page).waitFor();
await page.evaluate(() => window.__autoshop.update((s) => void (s.shop.name = 'My test edits')));
await banner(page).getByRole('button', { name: 'Start over' }).click();
const dialog = page.getByRole('dialog', { name: 'Start the sample shop over?' });
await dialog.waitFor();
await dialog.getByRole('button', { name: 'Cancel' }).click();
await settle(page);
ok((await state(page)).shop.name === 'My test edits', 'Cancel leaves the shop alone');
await banner(page).getByRole('button', { name: 'Start over' }).click();
await dialog.getByRole('button', { name: 'Start over' }).click();
await page.getByText('Sample shop reloaded').waitFor();
await settle(page);
const reset = await state(page);
ok(reset.shop.name === 'Main Street Auto Service' && reset.sample === true, 'Start over reloads the sample shop (still the sample)');
ok(new URL(page.url()).pathname.replace(/\/$/, '') === new URL(APP).pathname, 'Start over lands on the home screen');
await banner(page).waitFor();
await page.reload();
await page.waitForFunction(() => window.__autoshop);
await banner(page).waitFor();
ok(true, 'banner survives a reload');

// ---- A backup never carries the sample marker.
await page.goto(APP + '/settings?tab=data');
const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export backup/ }).click()]);
const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
ok(backup.version === 2 && backup.orders.length > 0 && !('sample' in backup), 'exported backup has the shop’s data but no sample marker');

// ---- Settings → Data → Start fresh ("Start with an empty shop?") replaces the sample: banner gone for good.
await page.getByRole('button', { name: /Start fresh/ }).click();
await page.getByRole('dialog', { name: 'Start with an empty shop?' }).getByRole('button', { name: 'Erase everything' }).click();
await page.getByText('All customers, vehicles and orders removed').waitFor();
await settle(page);
ok(!(await state(page)).sample, 'an empty shop is not the sample');
ok((await banner(page).count()) === 0, 'banner gone after starting with an empty shop');
await page.reload();
await page.waitForFunction(() => window.__autoshop);
await settle(page);
ok((await banner(page).count()) === 0, 'and stays gone after a reload');

// ---- Restoring a backup is the shop's own data too, even from a file that claims to be the sample.
await page.goto(APP + '/settings?tab=data');
await page.locator('input[type="file"][accept="application/json"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...backup, sample: true })) });
await page.getByRole('dialog', { name: 'Replace the shop’s data with this backup?' }).getByRole('button', { name: 'Replace the data' }).click();
await page.getByText('Backup restored').waitFor();
await settle(page);
const restored = await state(page);
ok(restored.orders.length === backup.orders.length && !restored.sample, 'restored backup: the shop’s data, not marked as the sample');
ok((await banner(page).count()) === 0, 'no banner after restoring a backup');
await A.ctx.close();

// ---- iPhone: the banner fits, and signing in hides it.
const B = await device('B', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
page = B.page;
await page.goto(APP + '/');
await page.waitForFunction(() => window.__autoshop);
await banner(page).waitFor();
const fit = await page.evaluate(() => {
  const b = document.querySelector('section[aria-label="Sample shop"]').getBoundingClientRect();
  return { left: b.left, right: b.right, width: document.documentElement.clientWidth, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
});
ok(fit.left >= 0 && fit.right <= fit.width + 1 && fit.overflow <= 1, `iPhone: banner fits the screen (${Math.round(fit.right - fit.left)}px of ${fit.width})`);
await page.screenshot({ path: `${SP}/shots/sample-banner-390.png` });
await page.goto(APP + '/signin');
await page.getByLabel('Email').fill('owner@shop.test');
await page.getByLabel('Password').fill('owner-pass-123');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL(/settings\?tab=cloud/);
await page.getByText('Signed in as').first().waitFor();
ok((await banner(page).count()) === 0, 'banner hidden once signed in to Shop Cloud');

// ---- Shared data from this device (Start with an empty shop): the shop is the shop's own from now on.
await page.getByRole('button', { name: 'Start with an empty shop' }).click();
await page.getByRole('dialog', { name: 'Start with an empty shop?' }).getByRole('button', { name: 'Empty and turn on' }).click();
await page.getByText(/Shared data is on/).first().waitFor({ timeout: 30000 });
await settle(page);
ok(!(await state(page)).sample, 'turning on shared data clears the sample marker');
const synced = [...cloud.db.records.values()].map((r) => `${r.collection}/${r.id}`);
ok(synced.length > 0 && !synced.some((k) => /sample/.test(k)) && ![...cloud.db.records.values()].some((r) => r.collection === 'meta' && r.data && 'sample' in r.data), `the sample marker never syncs (${synced.length} records)`);
await page.goto(APP + '/settings?tab=cloud');
await page.getByRole('button', { name: 'Sign out' }).first().click();
await page.goto(APP + '/');
await page.waitForFunction(() => window.__autoshop);
await settle(page);
ok((await banner(page).count()) === 0, 'still no banner after signing out');
await B.ctx.close();

await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO PAGE ERRORS');
