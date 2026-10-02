// iPhone: the staff app on an iPhone 15 Pro (touch, iOS Safari). Tab bar and navigation bar instead of
// the sidebar, no zoom-on-focus fields, nothing wider than the screen, list rows instead of tables,
// sheets that swipe away, action sheets for menus, a full-screen conversation, the right keyboards —
// and the desktop layout left as it was.
import { launch, APP, OUT } from '../support/env.mjs';
const browser = await launch();
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const errors = [];
const IPHONE = {
  viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'block',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
};
const ctx = await browser.newContext(IPHONE);
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|WebSocket|realtime|net::ERR/.test(m.text()) && errors.push(`console: ${m.text()}`));
const go = async (path) => {
  await page.goto(APP + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
};
const tabs = page.locator('nav[aria-label="Tabs"]');
const navbar = page.locator('header.app-navbar');
const shot = (name) => page.screenshot({ path: `${OUT}/shots/iphone-${name}.png` });

// ---- Home Screen app: launch screens, icons, status bar tint, no phone-number guessing.
await go('/');
const head = await page.evaluate(() => ({
  startup: document.querySelectorAll('link[rel="apple-touch-startup-image"]').length,
  icon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
  themes: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => `${m.media}|${m.content}`),
  format: document.querySelector('meta[name="format-detection"]')?.content,
  viewport: document.querySelector('meta[name="viewport"]')?.content,
}));
ok(head.startup >= 50, `launch screens for every iPhone and iPad (${head.startup})`);
ok(/apple-touch-icon\.png$/.test(head.icon || ''), 'Home Screen icon');
ok(head.themes.some((t) => t.includes('light')) && head.themes.some((t) => t.includes('dark')), 'status bar tint per light/dark');
ok(/telephone=no/.test(head.format || '') && /viewport-fit=cover/.test(head.viewport), 'no auto phone links; content under the notch handled by safe areas');
const icon = await page.request.get(APP + '/icons/apple-touch-icon.png');
ok(icon.ok() && (await icon.body()).length > 1000, 'apple-touch-icon is served');
const splash = await page.evaluate(() => document.querySelector('link[rel="apple-touch-startup-image"]').href);
ok((await page.request.get(splash)).ok(), 'launch screen image is served');

// ---- Chrome: tab bar + navigation bar, no sidebar.
ok(await tabs.isVisible(), 'tab bar on iPhone');
ok((await page.locator('aside').first().isVisible()) === false, 'no sidebar on iPhone');
const tabNames = await tabs.getByRole('link').allInnerTexts();
ok(JSON.stringify(tabNames.map((t) => t.trim().split('\n').pop())) === JSON.stringify(['Today', 'Board', 'Orders', 'Messages', 'More']), `tabs: ${tabNames.join(', ')}`);
for (const box of await tabs.getByRole('link').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) ok(box >= 44, `tab is a 44pt target (${box}px)`);
ok((await tabs.getByRole('link', { name: 'Today' }).getAttribute('aria-current')) === 'page', 'Today tab is current');
const pad = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('main-scroll')).paddingBottom));
ok(pad >= 49, 'content scrolls clear of the tab bar');

// ---- Every main screen: nothing wider than the phone, no field under 16px (iOS would zoom).
for (const path of ['/', '/workflow', '/orders', '/orders/new', '/calendar', '/messages', '/customers', '/vehicles', '/parts?tab=inventory', '/team?tab=time', '/accounting', '/reports', '/settings', '/more', '/vin', '/tech']) {
  await go(path);
  const m = await page.evaluate(() => {
    const main = document.getElementById('main-scroll');
    const fields = [...document.querySelectorAll('input:not([type=checkbox],[type=radio],[type=range],[type=file],[type=hidden]), select, textarea')].filter((el) => el.offsetParent);
    return {
      over: Math.max(document.documentElement.scrollWidth - innerWidth, main ? main.scrollWidth - main.clientWidth : 0),
      small: fields.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16).map((el) => el.getAttribute('aria-label') || el.placeholder || el.name || el.id),
    };
  });
  ok(m.over <= 1, `${path}: nothing wider than the screen (${m.over}px)`);
  ok(m.small.length === 0, `${path}: every field ≥16px${m.small.length ? ` — small: ${m.small.join(', ')}` : ''}`);
}

// ---- Orders: list rows, tab state, navigation bar back + collapsing title.
await go('/');
await tabs.getByRole('link', { name: 'Orders' }).tap();
await page.waitForURL(/\/orders$/);
await page.getByRole('heading', { level: 1, name: 'Repair Orders' }).waitFor();
ok((await tabs.getByRole('link', { name: 'Orders' }).getAttribute('aria-current')) === 'page', 'Orders tab becomes current');
ok((await page.locator('#main-scroll table').count()) === 0, 'repair orders are list rows, not a table');
await shot('orders');
const firstRow = page.locator('#main-scroll ul li a[href*="/orders/"]').first();
const rowTitle = (await firstRow.locator('span.font-semibold').first().textContent()).trim();
await firstRow.tap();
await page.waitForURL(/\/orders\/[^/]+$/);
const back = navbar.getByRole('button', { name: 'Back to Repair Orders' });
await back.waitFor({ timeout: 5000 });
ok(await back.isVisible(), 'navigation bar shows ‹ Repair Orders');
const h1 = (await page.getByRole('heading', { level: 1 }).textContent()).trim();
ok(h1 === rowTitle, `large title is the vehicle (${h1} / ${rowTitle})`);
const navTitle = navbar.locator('div[aria-hidden]');
ok((await navTitle.evaluate((el) => getComputedStyle(el).opacity)) === '0', 'title not in the bar while the large title shows');
await page.evaluate(() => document.getElementById('main-scroll').scrollTo(0, 400));
await page.waitForTimeout(400);
ok((await navTitle.evaluate((el) => getComputedStyle(el).opacity)) === '1' && (await navTitle.textContent()).trim() === rowTitle, 'title moves into the bar after scrolling');
ok(await navbar.evaluate((el) => /blur/.test(getComputedStyle(el).backdropFilter)), 'bar turns frosted once content scrolls under it');

// Line items: stacked, labelled, nothing cut off.
ok((await page.locator('#main-scroll section table').count()) === 0, 'line items are stacked rows on a phone');
ok((await page.getByLabel('Hours').count()) > 0 && (await page.getByLabel('Labor rate').count()) > 0, 'hours and rate fields on labor lines');
await shot('order-lines');

// Status: progress bar → action sheet.
await page.evaluate(() => document.getElementById('main-scroll').scrollTo(0, 0));
await page.getByRole('button', { name: /^Status: .*Change status$/ }).tap();
const sheet = page.locator('[data-action-sheet]');
ok(await sheet.isVisible(), 'status opens an action sheet');
ok((await sheet.getByRole('button', { name: /^Move to / }).count()) >= 4, 'action sheet lists the other stages');
await shot('action-sheet');
await sheet.getByRole('button', { name: 'Cancel' }).tap();
ok((await sheet.count()) === 0, 'Cancel closes the action sheet');

// Send menu: also an action sheet.
await page.getByRole('button', { name: 'Send' }).first().tap();
ok(await sheet.getByRole('button', { name: /^Text / }).isVisible(), 'Send menu is an action sheet on iPhone');
await sheet.getByRole('button', { name: 'Cancel' }).tap();

// Back to the list.
await back.tap();
await page.waitForURL(/\/orders$/);
ok(true, 'back returns to Repair Orders');

// ---- A sheet: grabber, 16px fields, the right keyboards, swipe down to close.
await go('/customers');
await page.getByRole('button', { name: 'New customer' }).tap();
const dialog = page.getByRole('dialog', { name: 'New customer' });
await dialog.waitFor();
await page.waitForTimeout(500);
const sheetBox = await dialog.locator('[data-sheet]').boundingBox();
ok(sheetBox.y > 20 && Math.round(sheetBox.y + sheetBox.height) >= 851, 'form opens as a bottom sheet');
const keys = await dialog.evaluate((d) => {
  const by = (label) => [...d.querySelectorAll('label')].find((l) => l.textContent.startsWith(label))?.querySelector('input');
  const f = by('First name');
  const p = by('Mobile phone');
  const e = by('Email');
  return { first: f?.autocapitalize, firstCorrect: f?.getAttribute('autocorrect'), phone: p?.type, email: e?.inputMode, size: parseFloat(getComputedStyle(f).fontSize) };
});
ok(keys.first === 'words' && keys.firstCorrect === 'off', 'names capitalise words, no autocorrect');
ok(keys.phone === 'tel' && keys.email === 'email', 'phone pad and email keyboards');
ok(keys.size >= 16, 'sheet fields are 16px');
await shot('sheet');
await page.evaluate(async () => {
  const sheetEl = document.querySelector('[data-sheet]');
  const grab = sheetEl.firstElementChild;
  const r = grab.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const fire = (type, y) => {
    const t = new Touch({ identifier: 1, target: grab, clientX: x, clientY: y });
    const live = type === 'touchend' ? [] : [t];
    grab.dispatchEvent(new TouchEvent(type, { touches: live, targetTouches: live, changedTouches: [t], bubbles: true, cancelable: true }));
  };
  fire('touchstart', r.top + 2);
  for (let i = 1; i <= 12; i += 1) {
    fire('touchmove', r.top + 2 + i * 30);
    await new Promise((res) => setTimeout(res, 16));
  }
  fire('touchend', r.top + 2 + 360);
});
await dialog.waitFor({ state: 'detached', timeout: 3000 });
ok(true, 'swiping the sheet down closes it');

// ---- Messages: a conversation fills the screen like Messages on iPhone.
await go('/messages');
await page.locator('#main-scroll a[href*="/messages/"]').first().tap();
await page.waitForURL(/\/messages\/.+/);
await page.getByLabel('Message', { exact: true }).waitFor();
ok((await tabs.isVisible()) === false, 'tab bar steps aside in a conversation');
ok(await navbar.getByRole('button', { name: 'Back to Messages' }).isVisible(), 'navigation bar: ‹ Messages');
const composer = page.getByLabel('Message', { exact: true });
ok(await composer.isVisible(), 'composer at the bottom');
const cb = await composer.boundingBox();
ok(cb.y + cb.height > 852 - 80, 'composer sits at the bottom of the screen');
ok(await page.getByRole('button', { name: 'Send' }).isVisible(), 'round send button');
await shot('thread');
await navbar.getByRole('button', { name: 'Back to Messages' }).tap();
await page.waitForURL(/\/messages$/);
ok(await tabs.isVisible(), 'tab bar returns with the inbox');

// ---- More: everything else, iOS Settings style; More stays the current tab inside.
await tabs.getByRole('link', { name: 'More' }).tap();
await page.waitForURL(/\/more$/);
await page.getByRole('heading', { level: 1, name: 'More' }).waitFor();
for (const name of ['Customers', 'Vehicles', 'Parts & Inventory', 'Settings', 'Calendar']) ok(await page.locator('#main-scroll').getByRole('link', { name }).isVisible(), `More lists ${name}`);
ok((await page.locator('#main-scroll').getByRole('link', { name: 'Repair Orders' }).count()) === 0, 'More leaves out what the tabs already have');
await shot('more');
await page.locator('#main-scroll').getByRole('link', { name: 'Customers' }).tap();
await page.waitForURL(/\/customers$/);
await page.getByRole('heading', { level: 1, name: 'Customers' }).waitFor();
ok((await tabs.getByRole('link', { name: 'More' }).getAttribute('aria-current')) === 'page', 'More stays current on pages it holds');
ok((await page.locator('#main-scroll table').count()) === 0, 'customers are list rows');

// ---- Touch-sized controls.
await go('/marketing');
const sw = page.getByRole('switch').first();
await sw.waitFor();
const swb = await sw.boundingBox();
ok(Math.round(swb.width) === 51 && Math.round(swb.height) === 31, `switches are iOS size (${Math.round(swb.width)}×${Math.round(swb.height)})`);
await go('/orders/new');
const btnH = await page.locator('#main-scroll .btn-primary, #main-scroll .btn-secondary').first().evaluate((el) => el.getBoundingClientRect().height);
ok(btnH >= 34, `buttons are thumb-sized (${btnH}px)`);

// Workflow: stages snap like pages; cards aren't draggable (long-press would fight scrolling).
await go('/workflow');
const snap = await page.evaluate(() => {
  const s = [...document.querySelectorAll('#main-scroll div')].find((d) => getComputedStyle(d).scrollSnapType.includes('x'));
  return { snap: s ? getComputedStyle(s).scrollSnapType : '', drag: document.querySelector('article[draggable="true"]') !== null };
});
ok(/x mandatory/.test(snap.snap), 'board stages snap as you swipe');
ok(!snap.drag, 'board cards are not draggable on iPhone');
ok(/Swipe between stages/.test(await page.locator('header p').first().textContent()), 'board explains swiping, not dragging');

// Hover-only controls are simply shown on touch.
await go('/settings');
const hidden = await page.evaluate(() => [...document.querySelectorAll('.hover-reveal')].filter((el) => el.offsetParent && getComputedStyle(el).opacity === '0').length);
ok(hidden === 0, 'no controls hidden behind hover on iPhone');

// Search: drops from the top with Cancel.
await go('/orders');
await navbar.getByRole('button', { name: 'Search' }).tap();
const search = page.getByRole('dialog', { name: 'Search' });
await search.waitFor();
ok(await search.getByRole('button', { name: 'Cancel' }).isVisible(), 'search has Cancel');
const sf = await search.locator('input').evaluate((el) => [parseFloat(getComputedStyle(el).fontSize), el.getAttribute('autocorrect'), el.enterKeyHint]);
ok(sf[0] >= 16 && sf[1] === 'off' && sf[2] === 'go', `search field: no zoom, no autocorrect, Go key (${sf.join(', ')})`);
await search.getByRole('button', { name: 'Cancel' }).tap();
ok((await search.count()) === 0, 'Cancel closes search');
await ctx.close();

// ---- Reduce Motion: sheets appear without sliding.
const calm = await browser.newContext({ ...IPHONE, reducedMotion: 'reduce' });
const cp = await calm.newPage();
await cp.goto(APP + '/customers', { waitUntil: 'networkidle' });
await cp.getByRole('button', { name: 'New customer' }).tap();
const dur = await cp.locator('[data-sheet]').evaluate((el) => parseFloat(getComputedStyle(el).animationDuration));
ok(dur <= 0.01, `Reduce Motion: no sheet animation (${dur}s)`);
await calm.close();

// ---- Desktop unchanged: sidebar, dropdown menus, in-page back button, tables.
const desk = await browser.newContext({ viewport: { width: 1360, height: 950 }, serviceWorkers: 'block' });
const dp = await desk.newPage();
dp.on('pageerror', (e) => errors.push(`desktop pageerror: ${e.message}`));
await dp.goto(APP + '/orders', { waitUntil: 'networkidle' });
ok((await dp.locator('nav[aria-label="Tabs"]').isVisible()) === false && (await dp.locator('aside').first().isVisible()), 'desktop: sidebar, no tab bar');
ok((await dp.locator('#main-scroll table').count()) === 1, 'desktop: repair orders table');
await dp.locator('#main-scroll tbody tr').first().click();
await dp.waitForURL(/\/orders\/[^/]+$/);
await dp.locator('#main-scroll').getByRole('button', { name: 'Repair Orders' }).waitFor();
ok(await dp.locator('#main-scroll').getByRole('button', { name: 'Repair Orders' }).isVisible(), 'desktop: back button in the page');
await dp.getByRole('button', { name: 'Send' }).first().click();
ok((await dp.locator('[data-action-sheet]').count()) === 0 && (await dp.getByRole('button', { name: /^Text / }).isVisible()), 'desktop: Send is a dropdown');
await desk.close();

ok(errors.length === 0, `no page errors${errors.length ? ':\n' + errors.join('\n') : ''}`);
await browser.close();
console.log('IPHONE PASS');
