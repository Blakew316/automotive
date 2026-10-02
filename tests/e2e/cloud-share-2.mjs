// Built-in AutoShop Pro cloud: works out of the box, staff sign-in, auto-publish, non-staff warning, password change.
import { launch, APP, ROOT } from '../support/env.mjs';
const BASE = APP;
const CLOUD = 'https://huwcrbkplpudpsfczbyg.supabase.co';
const browser = await launch();
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (meta) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', role: 'authenticated', app_metadata: meta, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const errors = [];

async function run(staff) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const log = { uploads: [], auth: [], pw: [] };
  await ctx.route(CLOUD + '/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname === '/auth/v1/token') {
      log.auth.push({ apikey: req.headers().apikey, body: req.postDataJSON() });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: jwt(staff ? { provider: 'email', autoshop_staff: true } : { provider: 'email' }), refresh_token: 'r', expires_in: 3600, user: { email: 'owner@shop.test' } }) });
    }
    if (url.pathname === '/auth/v1/user' && req.method() === 'PUT') { log.pw.push(req.postDataJSON()); return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); }
    if (url.pathname === '/rest/v1/shop_inbox') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (url.pathname.startsWith('/storage/v1/object/')) { log.uploads.push(url.pathname); return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); }
    return route.fulfill({ status: 404, body: '{}' });
  });
  await page.goto(BASE + '/settings?tab=cloud');
  await page.getByText('Connected to the WPI Driveline cloud').waitFor();
  await page.waitForFunction(() => window.__autoshop);
const s0 = await page.evaluate(() => window.__autoshop.state());
  ok(s0.shop.cloud.url === CLOUD && s0.shop.cloud.bucket === 'autoshop-media', 'fresh install is preconfigured for the AutoShop Pro project');
  ok(!s0.shop.booking.published, 'booking not yet published before sign-in');
  await page.getByLabel('Staff email').fill('owner@shop.test');
  await page.getByLabel('Password').fill('correct horse battery');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByText('Signed in as').waitFor();
  ok(log.auth.length === 1 && log.auth[0].apikey.startsWith('eyJ') && log.auth[0].body.email === 'owner@shop.test', 'sign-in hits the project with the anon key');
  if (staff) {
    await page.waitForTimeout(1500);
    const s1 = await page.evaluate(() => window.__autoshop.state());
    ok(log.uploads.some((p) => p.endsWith('/autoshop-media/site/booking.json')), 'booking page + website auto-published to the autoshop-media bucket');
    ok(Boolean(s1.shop.booking.published), 'booking marked published');
    ok(!(await page.getByText('isn’t marked as shop staff').count()), 'no staff warning for staff account');
    await page.getByRole('button', { name: 'Change password' }).click();
    await page.getByLabel('New password').fill('a-new-long-password');
    await page.getByRole('button', { name: 'Save password' }).click();
    await page.getByText('Password changed').waitFor();
    ok(log.pw.length === 1 && log.pw[0].password === 'a-new-long-password', 'password change sent to Supabase Auth');
    // Integrations shows the live state.
    await page.goto(BASE + '/integrations');
    await page.getByText('Connected', { exact: true }).first().waitFor({ timeout: 5000 });
    ok(true, 'integrations shows Shop Cloud connected');
    const site = await page.locator('a', { hasText: 'Open' }).first().getAttribute('href');
    ok(site === ROOT, 'shop website opens the public site');
  } else {
    await page.getByText('isn’t marked as shop staff').first().waitFor();
    ok(true, 'non-staff account warned');
    await page.waitForTimeout(1200);
    ok(!log.uploads.length, 'nothing published for a non-staff account');
  }
  await ctx.close();
}
await run(true);
await run(false);
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO PAGE ERRORS');
await browser.close();
