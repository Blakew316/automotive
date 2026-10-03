// Public website at /automotive/ (the WPI Driveline Shop Management System marketing site), staff app at
// /automotive/app/: brand and header, every page at five widths, no app prefetch, the demo form → inbox →
// app, Reduce Motion / no-JS / Pause, and routing (old shop-site pages, old app links, unknown pages).
import { launch, ROOT, OUT } from '../support/env.mjs';
const APP = ROOT + 'app';
const CLOUD = 'https://huwcrbkplpudpsfczbyg.supabase.co';
const PRODUCT = 'WPI Driveline Shop Management System';
const SP = OUT;
const browser = await launch();
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const errors = [];
const watch = (p, tag) => {
  p.on('pageerror', (e) => errors.push(`${tag} pageerror ${p.url()}: ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && !/Failed to load resource|registered handler|Failed to launch/.test(m.text()) && errors.push(`${tag} console ${p.url()}: ${m.text()}`));
};
const path = (u) => new URL(u).pathname;

// Every page in the sitemap, plus privacy and the not-found page.
const sitemap = await (await fetch(ROOT + 'sitemap.xml')).text();
const PAGES = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+\/automotive\/?/, ''));
PAGES.push('privacy.html', 'not-found.html');
ok(PAGES.length >= 20 && PAGES.includes('') && PAGES.includes('demo.html') && PAGES.includes('features/inspections.html'), `sitemap lists the site (${PAGES.length} pages with privacy and 404)`);

// ---- Brand and header: full name, logo with its live tagline, Sign in.
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
const page = await ctx.newPage();
watch(page, 'site');
await page.goto(ROOT, { waitUntil: 'networkidle' });
ok((await page.title()).includes(PRODUCT), `root title carries the full name ("${await page.title()}")`);
const home = page.getByRole('link', { name: `${PRODUCT} home` }).first();
ok(await home.locator('svg.brand-logo').isVisible(), 'header logo is visible in the home link');
const brandText = (await home.textContent()).replace(/\s+/g, ' ');
ok(/Shop Management/.test(brandText) && /System/.test(brandText) && (await home.locator('.brand-tagline').isVisible()), `header tagline is live text ("${brandText.trim()}")`);
const signin = page.getByRole('link', { name: 'Sign in', exact: true }).first();
ok(new URL(await signin.getAttribute('href'), page.url()).href === ROOT + 'app/signin', 'first Sign in link goes to the app sign-in');
await page.screenshot({ path: `${SP}/shots/s-home.png` });
await page.goto(ROOT + 'features/ai.html', { waitUntil: 'load' });
const signinDeep = page.getByRole('link', { name: 'Sign in', exact: true }).first();
ok(new URL(await signinDeep.getAttribute('href'), page.url()).href === ROOT + 'app/signin', 'Sign in from a feature page also goes to the app sign-in');

// ---- Hovering the header, hero and CTA links never fetches the app (prerender or prefetch would boot it).
{
  const hctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const appHits = [];
  hctx.on('request', (r) => { if (path(r.url()).startsWith('/automotive/app/')) appHits.push(r.url()); });
  const hp = await hctx.newPage();
  watch(hp, 'hover');
  await hp.goto(ROOT, { waitUntil: 'networkidle' });
  let hovered = 0;
  for (const sel of ['.site-header a', '#hero a', '.cta-road a']) {
    const links = hp.locator(sel);
    const n = await links.count();
    for (let i = 0; i < n; i++) {
      const a = links.nth(i);
      if (!(await a.isVisible())) continue;
      await a.scrollIntoViewIfNeeded();
      await a.hover();
      await hp.waitForTimeout(250);
      hovered++;
    }
  }
  // The mega menu holds a "Try the sample shop" link too.
  await hp.evaluate(() => scrollTo(0, 0));
  await hp.locator('.site-header .nav-link[data-nav="features"]').hover();
  const megaApp = hp.locator('#mega-features a[href$="app/"]');
  if (await megaApp.isVisible()) { await megaApp.hover(); hovered++; }
  await hp.waitForTimeout(1200);
  ok(hovered >= 6 && appHits.length === 0, `hovering ${hovered} header, hero and CTA links fetched nothing under /automotive/app/ (${appHits.join(', ') || 'none'})`);
  await hctx.close();
}

// ---- Every page at 320, 390, 1080, 1100 and 1280: one h1, no sideways scroll, header actions on one row.
for (const width of [320, 390, 1080, 1100, 1280]) {
  const wctx = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
  const wp = await wctx.newPage();
  watch(wp, `w${width}`);
  const bad = [];
  for (const p of PAGES) {
    await wp.goto(ROOT + p, { waitUntil: 'load' });
    const r = await wp.evaluate(() => {
      const acts = [...document.querySelectorAll('.site-header .header-actions > *')].filter((e) => e.getClientRects().length);
      const boxes = acts.map((e) => e.getBoundingClientRect());
      const minH = Math.min(...boxes.map((b) => b.height));
      const tops = boxes.map((b) => b.top + b.height / 2);
      return {
        h1: document.querySelectorAll('h1').length,
        over: document.documentElement.scrollWidth - window.innerWidth,
        acts: acts.length,
        oneRow: acts.length > 0 && Math.max(...tops) - Math.min(...tops) < minH / 2,
      };
    });
    if (r.h1 !== 1 || r.over > 2 || !r.oneRow) bad.push(`${p || 'index'} (h1 ${r.h1}, overflow ${r.over}px, ${r.acts} actions${r.oneRow ? '' : ' wrapped'})`);
  }
  ok(bad.length === 0, `${width}px: all ${PAGES.length} pages have one h1, no sideways scroll and the header actions on one row${bad.length ? ': ' + bad.join('; ') : ''}`);
  if (width === 390) await wp.goto(ROOT, { waitUntil: 'networkidle' }).then(() => wp.screenshot({ path: `${SP}/shots/s-home-390.png` }));
  await wctx.close();
}
{
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const mp = await mctx.newPage();
  await mp.goto(ROOT, { waitUntil: 'load' });
  const brand = mp.getByRole('link', { name: `${PRODUCT} home` }).first();
  ok((await brand.locator('svg.brand-logo').isVisible()) && /Shop Management/.test(await brand.textContent()), 'iPhone: header logo and tagline are visible');
  await mctx.close();
}

// ---- The demo form: a demo request and a question post to the Shop Cloud inbox (mocked).
const sent = [];
const cctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
await cctx.route(CLOUD + '/rest/v1/shop_inbox', (r) => {
  sent.push({ headers: r.request().headers(), body: r.request().postDataJSON() });
  r.fulfill({ status: 201, body: '' });
});
const cp = await cctx.newPage();
watch(cp, 'demo');
const SHOP = 'Lakeside Auto Care';
await cp.goto(ROOT + 'demo.html', { waitUntil: 'networkidle' });
ok((await cp.locator('#d-topic').inputValue()) === 'Demo request', 'the topic defaults to a demo request');
await cp.locator('#d-company').fill(SHOP);
await cp.locator('#d-system').selectOption({ label: 'Another system' });
await cp.getByRole('button', { name: 'Next: What to see' }).click();
await cp.locator('label.choice', { hasText: 'Inspections & approvals' }).click();
await cp.getByRole('button', { name: 'Next: Contact' }).click();
await cp.locator('#d-name').fill('Morgan Reyes');
await cp.locator('#d-email').fill('morgan@lakeside.test');
await cp.locator('label.choice:has(input[name="contact_method"][value="Email"])').click();
await cp.getByRole('button', { name: 'Next: Review' }).click();
await cp.getByText(SHOP).first().waitFor();
await cp.screenshot({ path: `${SP}/shots/s-demo-review.png`, fullPage: true });
await cp.getByRole('button', { name: 'Send request' }).click();
await cp.locator('#demo-success').waitFor({ state: 'visible' });
ok(/Request received/.test(await cp.locator('#demo-success').innerText()), 'demo request: the success panel shows');
ok(await cp.locator('#demo-success').getByRole('link', { name: 'Try the sample shop while you wait' }).isVisible(), 'success offers the sample shop');
const demoReq = sent.find((x) => x.body.payload?.form === 'demo');
ok(demoReq && demoReq.body.kind === 'message' && demoReq.body.ref === null, 'demo request posts a message row to the inbox');
ok(demoReq.headers.prefer === 'return=minimal' && demoReq.headers.apikey.startsWith('eyJ') && demoReq.headers.authorization === `Bearer ${demoReq.headers.apikey}`, 'with the anon key and Prefer: return=minimal');
const dp = demoReq.body.payload;
ok(dp.source === 'website' && dp.form === 'demo' && dp.company === SHOP && dp.name === 'Morgan Reyes' && dp.email === 'morgan@lakeside.test', 'payload carries the shop, name and email');
ok(dp.text.startsWith('Demo request') && dp.text.includes('Interested in: Inspections & approvals') && dp.text.includes('Current system: Another system') && dp.text.includes('Contact by: Email') && dp.text.length <= 2000, `payload text lists the answers (${JSON.stringify(dp.text)})`);
await cp.screenshot({ path: `${SP}/shots/s-demo-success.png` });

// A question skips "What to see".
await cp.goto(ROOT + 'demo.html?topic=question', { waitUntil: 'networkidle' });
ok((await cp.locator('#d-topic').inputValue()) === 'Question', '?topic=question picks Question');
ok((await cp.locator('#d-message').isVisible()) && !(await cp.locator('#d-role').isVisible()) && !(await cp.locator('input[name="bays"]').first().isVisible()), 'question: the message shows in step 1, without role or bays');
ok((await cp.locator('[data-shift-total]').innerText()).trim() === '3', 'question: three steps');
await cp.locator('#d-message').fill('Can I bring my customer list over from another system?');
await cp.getByRole('button', { name: 'Next: Contact' }).click();
await cp.locator('#d-name').waitFor({ state: 'visible' });
ok((await cp.locator('.shift-step[data-go="3"]').getAttribute('aria-current')) === 'step' && (await cp.locator('.shift-step[data-go="2"]').isDisabled()), 'question: Next lands on Contact, with What to see skipped');
await cp.locator('#d-name').fill('Riley Chen');
await cp.locator('#d-email').fill('riley@chenmotors.test');
await cp.getByRole('button', { name: 'Next: Review' }).click();
await cp.getByRole('button', { name: 'Send request' }).click();
await cp.locator('#demo-success').waitFor({ state: 'visible' });
const qReq = sent.find((x) => x.body.payload?.form === 'demo' && x.body.payload.text.startsWith('Question'));
ok(qReq && qReq.body.payload.text.includes('customer list') && !qReq.body.payload.text.includes('Interested in'), 'question: payload text starts with Question and carries the message');

// Inbox down, no form endpoint, no email address: a friendly try-again, nothing lost, no mailto.
await cctx.unroute(CLOUD + '/rest/v1/shop_inbox');
await cctx.route(CLOUD + '/rest/v1/shop_inbox', (r) => r.fulfill({ status: 500, body: '{}' }));
await cp.goto(ROOT + 'demo.html', { waitUntil: 'networkidle' });
ok((await cp.locator('meta[name="form-endpoint"]').getAttribute('content')) === '', 'no form endpoint is configured');
await cp.locator('#d-company').fill(SHOP);
await cp.getByRole('button', { name: 'Next: What to see' }).click();
await cp.getByRole('button', { name: 'Next: Contact' }).click();
await cp.locator('#d-name').fill('Morgan Reyes');
await cp.locator('#d-email').fill('morgan@lakeside.test');
await cp.getByRole('button', { name: 'Next: Review' }).click();
await cp.getByRole('button', { name: 'Send request' }).click();
await cp.getByText('We couldn’t send that online.').waitFor();
const errBox = cp.locator('[data-form-error]');
ok(/Please try again in a few minutes\. Your answers are still here\./.test(await errBox.innerText()), 'inbox down: try again, answers kept');
ok((await cp.locator('a[href^="mailto:"]').count()) === 0 && (await cp.locator('#demo-success').isHidden()), 'no mailto link without a business email, and no false success');
ok((await cp.locator('#d-name').inputValue()) === 'Morgan Reyes' && (await cp.locator('#d-company').inputValue()) === SHOP, 'nothing typed is lost');
await cp.screenshot({ path: `${SP}/shots/s-demo-error.png` });
await cctx.close();

// ---- Reduce Motion: end states, no loops, nothing changing.
{
  const rctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const rp = await rctx.newPage();
  watch(rp, 'reduce');
  const seqState = () => rp.evaluate(() => [...document.querySelectorAll('[data-seq]')].map((f) => ({ n: Number(f.dataset.seq), step: f.dataset.step, reached: f.dataset.reached })));
  const infinite = () => rp.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations === Infinity).map((a) => a.animationName || a.id || 'animation'));
  for (const p of ['', 'features/inspections.html']) {
    await rp.goto(ROOT + p, { waitUntil: 'networkidle' });
    const hiddenReveals = await rp.evaluate(() => [...document.querySelectorAll('[data-reveal]')].filter((e) => Number(getComputedStyle(e).opacity) < 0.99).length);
    const reveals = await rp.locator('[data-reveal]').count();
    ok(reveals > 0 && hiddenReveals === 0, `${p || 'home'}: Reduce Motion shows every reveal (${reveals})`);
    const s1 = await seqState();
    ok(s1.length > 0 && s1.every((s) => Number(s.step) === s.n - 1), `${p || 'home'}: every Mock player rests on its last step (${s1.map((s) => `${s.step}/${s.n - 1}`).join(', ')})`);
    await rp.waitForTimeout(3000);
    ok(JSON.stringify(await seqState()) === JSON.stringify(s1), `${p || 'home'}: no Mock player step changes in 3s`);
    const loops = await infinite();
    ok(loops.length === 0, `${p || 'home'}: no running infinite animation (${loops.join(', ') || 'none'})`);
  }
  await rp.goto(ROOT, { waitUntil: 'networkidle' });
  await rp.locator('.cta-road').scrollIntoViewIfNeeded();
  const car = await rp.evaluate(() => {
    const road = document.querySelector('.cta-road .road').getBoundingClientRect();
    const c = document.querySelector('.cta-road .road-car').getBoundingClientRect();
    return (c.left + c.width / 2 - road.left) / road.width;
  });
  ok(car > 0.35 && car < 0.65, `CTA car parks mid-road (${Math.round(car * 100)}%)`);
  const paid = await rp.evaluate(() => Number(getComputedStyle(document.querySelector('.cta-road .road-status-paid')).opacity));
  ok(paid > 0.99, 'CTA road shows Paid');
  const tick = await rp.evaluate(() => {
    const [g1, g2] = document.querySelectorAll('.ticker .ticker-group');
    const item = g1.querySelector('.ticker-item').getBoundingClientRect().height;
    return { h: g1.getBoundingClientRect().height, item, second: getComputedStyle(g2).display };
  });
  ok(tick.h > tick.item * 1.5 && tick.second === 'none', `ticker wraps as a static list (${Math.round(tick.h)}px tall, second copy ${tick.second})`);
  await rp.screenshot({ path: `${SP}/shots/s-home-reduced.png`, fullPage: true });
  await rctx.close();
}

// ---- No JavaScript: the markup ships end states. Every example tag, stamp and reveal shows, and so does every
// part of a Mock player's final step that the Reduce Motion end state shows (scan lines, flashes and rings
// that end invisible by design are left out that way). Entrance animations are run to their end first.
{
  const FINAL = () => {
    const eff = (e) => { let o = 1; for (let n = e; n && n.nodeType === 1; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o; };
    const finals = [...document.querySelectorAll('[data-seq] [data-at]')].map((e, i) => ({ e, i })).filter(({ e }) => e.dataset.at === String(Number(e.closest('[data-seq]').dataset.seq) - 1));
    return { eff, finals };
  };
  const shown = {};
  const rctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const rp = await rctx.newPage();
  for (const p of PAGES) {
    await rp.goto(ROOT + p, { waitUntil: 'load' });
    shown[p] = await rp.evaluate((src) => {
      const { eff, finals } = eval(src)();
      return finals.filter(({ e }) => e.getClientRects().length && eff(e) > 0).map(({ i }) => i);
    }, `(${FINAL})`);
  }
  await rctx.close();
  const nctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, javaScriptEnabled: false, serviceWorkers: 'block' });
  const np = await nctx.newPage();
  const bad = [];
  let seen = 0;
  for (const p of PAGES) {
    await np.goto(ROOT + p, { waitUntil: 'load' });
    const r = await np.evaluate(({ src, want }) => {
      document.getAnimations().forEach((a) => { const t = a.effect && a.effect.getComputedTiming(); if (t && t.iterations !== Infinity) a.finish(); });
      const { eff, finals } = eval(src)();
      const els = [...document.querySelectorAll('.mock-tag, .stamp, [data-reveal]')];
      finals.forEach(({ e, i }) => want.includes(i) && els.push(e));
      return { n: els.length, hidden: els.filter((e) => eff(e) <= 0).map((e) => e.className.baseVal ?? e.className).slice(0, 5) };
    }, { src: `(${FINAL})`, want: shown[p] || [] });
    seen += r.n;
    if (r.hidden.length) bad.push(`${p || 'index'}: ${r.hidden.join(', ')}`);
  }
  ok(seen > 50 && bad.length === 0, `no JS: ${seen} example tags, stamps, final steps and reveals are visible on every page${bad.length ? ': ' + bad.join('; ') : ''}`);
  await nctx.close();
}

// ---- Pause toggle: everything stops and stays stopped; the choice persists.
{
  const pctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const pp = await pctx.newPage();
  watch(pp, 'pause');
  const steps = () => pp.evaluate(() => [...document.querySelectorAll('[data-seq]')].map((f) => f.dataset.step).join(','));
  const running = () => pp.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').map((a) => a.animationName || a.transitionProperty || 'script'));
  for (const p of ['', 'features/inspections.html']) {
    await pp.goto(ROOT + p, { waitUntil: 'networkidle' });
    await pp.locator('[data-seq]').first().scrollIntoViewIfNeeded();
    await pp.waitForTimeout(1500);
    const toggle = pp.locator('.site-footer .motion-toggle');
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    ok((await toggle.getAttribute('aria-pressed')) === 'true' && /Play animations/.test(await toggle.innerText()), `${p || 'home'}: Pause toggle pressed`);
    await pp.waitForTimeout(300);
    const s1 = await steps();
    const r1 = await running();
    ok(r1.length === 0, `${p || 'home'}: paused, nothing is animating (${r1.join(', ') || 'none'})`);
    await pp.evaluate(() => scrollTo(0, 0));
    await pp.waitForTimeout(3000);
    const r2 = await running();
    ok((await steps()) === s1 && r2.length === 0, `${p || 'home'}: no Mock player step change or animation in 3s while paused (${r2.join(', ') || 'none'})`);
    ok((await pp.evaluate(() => localStorage.getItem('wpi-site:motion'))) === 'paused', `${p || 'home'}: the choice is saved as wpi-site:motion`);
    await pp.reload({ waitUntil: 'networkidle' });
    ok(await pp.evaluate(() => document.documentElement.classList.contains('motion-paused')), `${p || 'home'}: still paused after a reload`);
    const again = pp.locator('.site-footer .motion-toggle');
    await again.scrollIntoViewIfNeeded();
    await again.click();
    ok((await again.getAttribute('aria-pressed')) === 'false' && (await pp.evaluate(() => localStorage.getItem('wpi-site:motion'))) === null, `${p || 'home'}: Play turns motion back on`);
  }
  await pctx.close();
}

// ---- Routing: old shop-site pages, old app links, the app itself, unknown pages.
const forwards = [
  ['services/brakes.html', 'features.html'],
  ['services', 'features.html'],
  ['appointment.html', 'demo.html'],
  ['contact', 'demo.html'],
  ['fleet.html', 'features/fleet.html'],
];
for (const [from, to] of forwards) {
  await page.goto(ROOT + from);
  await page.waitForURL(ROOT + to);
  await page.locator('h1').first().waitFor();
  ok(true, `/automotive/${from} forwards to ${to}`);
}
await page.goto(ROOT + 'integrations');
await page.waitForURL(/\/automotive\/app\/integrations$/);
ok(true, '/automotive/integrations forwards to /automotive/app/integrations');
await page.goto(APP + '/', { waitUntil: 'networkidle' });
await page.getByText(/Good (morning|afternoon|evening)/).waitFor();
ok(true, 'app loads at /app/');
await page.goto(ROOT + 'orders');
await page.waitForURL(/\/automotive\/app\/orders$/);
await page.getByRole('heading', { name: 'Repair Orders' }).first().waitFor();
ok(true, 'old /orders link forwards to /app/orders');
await page.waitForFunction(() => window.__autoshop);
const s0 = await page.evaluate(() => window.__autoshop.state());
const anyOrder = s0.orders[0];
await page.goto(APP + `/orders/${anyOrder.id}`);
await page.getByText(`#${anyOrder.number}`).first().waitFor();
ok(true, 'deep link into the app loads directly');
await page.goto(ROOT + 'site?c=abc');
await page.waitForURL(ROOT);
ok(true, 'old built-in /site link forwards to the website');
await page.goto(ROOT + 'no-such-page');
await page.waitForURL(/not-found\.html$/);
await page.locator('h1').waitFor();
ok(true, 'unknown pages show the website not-found page');

// ---- The staff app picks website rows up from the inbox: the demo form's rows (as posted above), and
// booking, contact and fleet rows from a shop's own website (injected directly; this site no longer sends them).
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256' })}.${b64({ role: 'authenticated', app_metadata: { autoshop_staff: true }, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const day = new Date(Date.now() + 3 * 86400000);
day.setHours(8, 0, 0, 0);
const at = new Date().toISOString();
const rows = [
  { id: 'w1', created_at: at, kind: 'message', ref: null, payload: dp },
  { id: 'w2', created_at: at, kind: 'message', ref: null, payload: qReq.body.payload },
  { id: 'w3', created_at: at, kind: 'booking', ref: null, payload: { source: 'website', name: 'Dana Webber', phone: '(217) 555-0177', email: 'dana@example.com', vehicle: '2017 Ford Escape', services: ['Brakes'], window: 'Morning', start: day.toISOString(), duration: 60, notes: 'Grinding noise when stopping.\nWill drop it off.\nConfirm by text.' } },
  { id: 'w4', created_at: at, kind: 'message', ref: null, payload: { source: 'website', form: 'contact', name: 'Sam Ortiz', phone: '(312) 555-0161', email: 'sam@example.com', company: '', text: 'Topic: A question\nDo you work on diesel trucks?' } },
  { id: 'w5', created_at: at, kind: 'message', ref: null, payload: { source: 'website', form: 'fleet', name: 'Pat Lane', phone: '(312) 555-0102', email: '', company: 'Lane Landscaping', text: 'Company: Lane Landscaping\nFleet size: 6–15\nNeed PM on 8 trucks.' } },
];
let served = false;
const deleted = [];
await ctx.route(CLOUD + '/**', async (r) => {
  const req = r.request();
  const u = new URL(req.url());
  if (u.pathname === '/rest/v1/shop_inbox' && req.method() === 'GET') { const body = served ? [] : rows; served = true; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }); }
  if (u.pathname === '/rest/v1/shop_inbox' && req.method() === 'DELETE') { deleted.push(u.search); return r.fulfill({ status: 204 }); }
  if (u.pathname.startsWith('/storage/v1/object/')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  return r.fulfill({ status: 404, body: '{}' });
});
await page.goto(APP + '/manifest.webmanifest');
await page.evaluate(({ CLOUD, jwt }) => {
  localStorage.setItem('autoshop-pro:cloud-session', JSON.stringify({ url: CLOUD, email: 'owner@shop.test', access: jwt, refresh: 'r', expires: Date.now() + 3600e3 }));
}, { CLOUD, jwt });
await page.goto(APP + '/calendar');
await page.getByText('Dana Webber').waitFor({ timeout: 10000 });
await page.waitForFunction(() => window.__autoshop.state().messages.some((m) => m.meta?.remoteId === 'w1'));
const st = await page.evaluate(() => window.__autoshop.state());
const lead = st.customers.find((c) => c.company === SHOP && c.email === 'morgan@lakeside.test');
ok(lead && lead.tags.includes('Website') && lead.tags.includes('Demo request') && !lead.textOptIn && lead.notes === 'Requested a demo through the website', `demo request adds the shop as a contact tagged Website + Demo request (${lead && lead.tags.join(', ')})`);
const lm = st.messages.find((m) => m.customerId === lead.id && m.channel === 'web');
ok(lm && !lm.read && lm.body.startsWith('Demo request') && lm.body.includes('Interested in: Inspections & approvals'), 'demo request is an unread website message starting "Demo request"');
const asker = st.customers.find((c) => c.email === 'riley@chenmotors.test');
ok(asker && asker.tags.includes('Website') && asker.tags.includes('Website question') && !asker.tags.includes('Demo request'), 'a question is tagged Website question');
ok(st.messages.some((m) => m.customerId === asker.id && m.body.startsWith('Question')), 'the question lands in Messages');
const br = st.bookingRequests.find((b) => b.remoteId === 'w3');
ok(br && br.source === 'website' && br.window === 'Morning' && br.vehicle === '2017 Ford Escape', 'a website booking row lands in Calendar requests');
await page.getByText(/morning \(preferred\)/).first().waitFor();
await page.getByText(/from your website/).first().waitFor();
ok(true, 'request shows preferred day + time of day and the website source');
await page.screenshot({ path: `${SP}/shots/s-calendar.png` });
const sam = st.customers.find((c) => c.firstName === 'Sam' && c.lastName === 'Ortiz');
ok(sam && sam.tags.includes('Website') && !sam.tags.includes('Website question') && !sam.textOptIn, 'a shop-site contact row adds a customer (no text opt-in)');
const m1 = st.messages.find((m) => m.customerId === sam.id && m.channel === 'web');
ok(m1 && !m1.read && m1.body.includes('diesel'), 'contact message is unread in Messages');
const pat = st.customers.find((c) => c.firstName === 'Pat');
ok(pat && pat.company === 'Lane Landscaping' && st.messages.some((m) => m.customerId === pat.id && m.body.startsWith('Fleet inquiry')), 'fleet inquiry logged with company');
ok(deleted.length === 1 && rows.every((r) => deleted[0].includes(r.id)), 'inbox cleared');
await page.goto(APP + `/messages/${lead.id}`);
await page.getByText(/Interested in: Inspections & approvals/).first().waitFor();
await page.getByText('From your website').first().waitFor();
ok(true, 'the demo request thread shows the website channel');
await page.screenshot({ path: `${SP}/shots/s-messages.png` });

ok(errors.length === 0, errors.length ? 'page errors:\n' + errors.join('\n') : 'no page errors on the website or app');
await browser.close();
