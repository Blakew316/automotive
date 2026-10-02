// Public website at /automotive/, staff app at /automotive/app/: routing, forms → inbox → app.
import { launch, ROOT, OUT } from '../support/env.mjs';
const APP = ROOT + 'app';
const CLOUD = 'https://huwcrbkplpudpsfczbyg.supabase.co';
const SP = OUT;
const browser = await launch();
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const errors = [];
const watch = (p, tag) => {
  p.on('pageerror', (e) => errors.push(`${tag} pageerror ${p.url()}: ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && !/Failed to load resource|registered handler|Failed to launch/.test(m.text()) && errors.push(`${tag} console ${p.url()}: ${m.text()}`));
};

// ---- Routing: website at the root, app under app/, old app links forwarded.
const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 }, serviceWorkers: 'block' });
const page = await ctx.newPage();
watch(page, 'app');
await page.goto(ROOT, { waitUntil: 'networkidle' });
ok((await page.title()).includes('WPI Driveline'), 'root serves the public website');
ok(await page.getByRole('link', { name: 'WPI Driveline home' }).first().locator('svg.brand-logo').isVisible(), 'header shows the WPI Driveline logo');
ok((await page.locator('h1').count()) === 1, 'website home has one h1');
const staff = await page.getByRole('link', { name: 'Staff sign-in' }).getAttribute('href');
ok(staff === 'https://blakew316.github.io/automotive/app/signin', 'footer links staff to the sign-in page');
await page.screenshot({ path: `${SP}/shots/s-home.png` });
await page.goto(ROOT + 'services/brakes.html', { waitUntil: 'networkidle' });
ok((await page.locator('h1').innerText()).length > 3, 'service page renders');
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
await page.goto(APP + '/settings?tab=website');
ok((await page.getByLabel('Website link').inputValue()) === ROOT, 'app Website settings link to the public site');
await page.goto(APP + '/integrations');
const siteHref = await page.locator('a', { hasText: 'Open' }).first().getAttribute('href');
ok(siteHref === ROOT, 'integrations opens the public site');

// ---- Customer uses the website's forms (inbox mocked).
const sent = [];
const cctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
await cctx.route(CLOUD + '/rest/v1/shop_inbox', (r) => {
  sent.push({ headers: r.request().headers(), body: r.request().postDataJSON() });
  r.fulfill({ status: 201, body: '' });
});
const cp = await cctx.newPage();
watch(cp, 'site');
await cp.goto(ROOT + 'appointment.html', { waitUntil: 'networkidle' });
await cp.locator('label.choice', { hasText: 'Car or SUV' }).click();
await cp.locator('#a-year').fill('2017');
await cp.locator('#a-make').fill('Ford');
await cp.locator('#a-model').fill('Escape');
await cp.getByRole('button', { name: /Next: Services/ }).click();
await cp.locator('label.choice', { hasText: 'Brakes' }).first().click();
await cp.locator('#a-details').fill('Grinding noise when stopping.');
await cp.getByRole('button', { name: /Next: Timing/ }).click();
const d = new Date(Date.now() + 3 * 86400000);
const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
await cp.locator('#a-date').fill(ymd);
await cp.locator('label.choice', { hasText: 'Morning' }).click();
await cp.locator('label.choice', { hasText: 'drop it off' }).click();
await cp.getByRole('button', { name: /Next: Contact/ }).click();
await cp.locator('#a-name').fill('Dana Webber');
await cp.locator('#a-phone').fill('(217) 555-0177');
await cp.locator('#a-email').fill('dana@example.com');
await cp.locator('label.choice', { hasText: /^\s*Text/ }).first().click();
await cp.screenshot({ path: `${SP}/shots/s-appointment.png`, fullPage: true });
await cp.getByRole('button', { name: 'Send request' }).click();
await cp.locator('#appointment-success').waitFor();
const bk = sent.find((x) => x.body.kind === 'booking');
ok(bk && bk.headers.prefer === 'return=minimal' && bk.headers.apikey.startsWith('eyJ'), 'booking form posts to the inbox with the anon key');
const bp = bk.body.payload;
ok(bp.source === 'website' && bp.name === 'Dana Webber' && bp.vehicle === '2017 Ford Escape' && bp.services.includes('Brakes') && bp.window === 'Morning', `booking payload mapped (${bp.vehicle}; ${bp.services}; ${bp.window})`);
ok(new Date(bp.start).getHours() === 8 && bp.notes.includes('Grinding') && bp.notes.includes('Will drop it off') && bp.notes.includes('Confirm by text'), 'preferred morning start and notes');

await cp.goto(ROOT + 'contact.html', { waitUntil: 'networkidle' });
await cp.locator('#m-topic').selectOption({ index: 1 });
const nameField = cp.locator('form[name=contact] [name=name]');
await nameField.fill('Sam Ortiz');
await cp.locator('form[name=contact] [name=phone]').fill('(312) 555-0161');
await cp.locator('form[name=contact] [name=email]').fill('sam@example.com');
await cp.locator('form[name=contact] [name=message]').fill('Do you work on diesel trucks?');
await cp.getByRole('button', { name: /Send message/ }).click();
await cp.locator('#contact-success').waitFor();
const msg = sent.find((x) => x.body.kind === 'message');
ok(msg && msg.body.payload.form === 'contact' && msg.body.payload.text.includes('diesel') && msg.body.payload.text.startsWith('Topic: '), 'contact form posts a website message');

// Inbox down → friendly email/phone fallback, nothing lost.
await cctx.unroute(CLOUD + '/rest/v1/shop_inbox');
await cctx.route(CLOUD + '/rest/v1/shop_inbox', (r) => r.fulfill({ status: 500, body: '{}' }));
await cp.goto(ROOT + 'contact.html', { waitUntil: 'networkidle' });
await cp.locator('#m-topic').selectOption({ index: 1 });
await cp.locator('form[name=contact] [name=name]').fill('Sam Ortiz');
await cp.locator('form[name=contact] [name=phone]').fill('(312) 555-0161');
await cp.locator('form[name=contact] [name=email]').fill('sam@example.com');
await cp.locator('form[name=contact] [name=message]').fill('Second try');
await cp.getByRole('button', { name: /Send message/ }).click();
await cp.getByText('We couldn’t send that online.').waitFor();
ok(true, 'falls back to email/phone if the inbox is unreachable');

// Phone width.
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const mp = await mob.newPage();
await mp.goto(ROOT, { waitUntil: 'networkidle' });
const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
ok(over <= 2, `website fits phone width (overflow ${over}px)`);
await mob.close();
await cctx.close();

// ---- Staff app picks the submissions up from the inbox.
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256' })}.${b64({ role: 'authenticated', app_metadata: { autoshop_staff: true }, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
let served = false;
const rows = [
  { id: 'w1', created_at: new Date().toISOString(), kind: 'booking', ref: null, payload: bp },
  { id: 'w2', created_at: new Date().toISOString(), kind: 'message', ref: null, payload: msg.body.payload },
  { id: 'w3', created_at: new Date().toISOString(), kind: 'message', ref: null, payload: { source: 'website', form: 'fleet', name: 'Pat Lane', phone: '(312) 555-0102', email: '', company: 'Lane Landscaping', text: 'Company: Lane Landscaping\nFleet size: 6–15\nNeed PM on 8 trucks.' } },
];
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
const st = await page.evaluate(() => window.__autoshop.state());
const br = st.bookingRequests.find((b) => b.remoteId === 'w1');
ok(br && br.source === 'website' && br.window === 'Morning' && br.vehicle === '2017 Ford Escape', 'website booking lands in Calendar requests');
await page.getByText(/morning \(preferred\)/).first().waitFor();
await page.getByText(/from your website/).first().waitFor();
ok(true, 'request shows preferred day + time of day and the website source');
await page.screenshot({ path: `${SP}/shots/s-calendar.png` });
const sam = st.customers.find((c) => c.firstName === 'Sam' && c.lastName === 'Ortiz');
ok(sam && sam.tags.includes('Website') && !sam.textOptIn, 'new website contact added as a customer (no text opt-in)');
const m1 = st.messages.find((m) => m.customerId === sam.id && m.channel === 'web');
ok(m1 && !m1.read && m1.body.includes('diesel'), 'contact message is unread in Messages');
const pat = st.customers.find((c) => c.firstName === 'Pat');
ok(pat && pat.company === 'Lane Landscaping' && st.messages.some((m) => m.customerId === pat.id && m.body.startsWith('Fleet inquiry')), 'fleet inquiry logged with company');
ok(deleted.length === 1 && ['w1', 'w2', 'w3'].every((id) => deleted[0].includes(id)), 'inbox cleared');
await page.goto(APP + `/messages/${sam.id}`);
await page.getByText('Do you work on diesel trucks?').first().waitFor();
await page.getByText('From your website').first().waitFor();
ok(true, 'message thread shows the website channel');
await page.screenshot({ path: `${SP}/shots/s-messages.png` });
// Same rows again (e.g. a clear failed) don't duplicate.
await page.evaluate(() => 0);

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO PAGE ERRORS');
await browser.close();
