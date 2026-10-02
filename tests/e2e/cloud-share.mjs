import { launch, APP } from '../support/env.mjs';
const BASE = APP;
const CLOUD = 'https://demo-shop.supabase.co';
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 }, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const deleted = [];
const uploads = [];
let inboxServed = false;
let rows = [];
await ctx.route(CLOUD + '/**', async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  if (url.pathname === '/rest/v1/shop_inbox' && req.method() === 'GET') {
    const body = inboxServed ? [] : rows;
    inboxServed = true;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  }
  if (url.pathname === '/rest/v1/shop_inbox' && req.method() === 'DELETE') { deleted.push(url.search); return route.fulfill({ status: 204 }); }
  if (url.pathname.startsWith('/storage/v1/object/')) { uploads.push(url.pathname); return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); }
  return route.fulfill({ status: 404, body: '{}' });
});
await page.goto(BASE + '/');
await page.waitForFunction(() => window.__autoshop);
// Configure the shop through the store, then sign in and reload.
const prep = await page.evaluate(async ({ CLOUD }) => {
  let out;
  window.__autoshop.update((s) => {
    s.shop.cloud = { url: CLOUD, key: 'anon-key', bucket: 'shop-media' };
    s.shop.booking.published = new Date().toISOString();
    const o = s.orders.find((x) => x.status === 'estimate' && x.services.filter((v) => v.status === 'pending').length >= 1);
    o.share = { id: 'Abcdefghijklmnop1234', url: 'https://example.invalid/share', publishedAt: new Date().toISOString() };
    out = { orderId: o.id, pending: o.services.filter((v) => v.status === 'pending').map((v) => v.id), customerId: o.customerId };
  });
  window.__autoshop.flush();
  await new Promise((r) => setTimeout(r, 400));
  localStorage.setItem('autoshop-pro:cloud-session', JSON.stringify({ url: CLOUD, email: 'staff@example.com', access: 'tok', refresh: 'r', expires: Date.now() + 3600e3 }));
  return out;
}, { CLOUD });
const decisions = Object.fromEntries(prep.pending.map((id, i) => [id, i === 0 ? 'approved' : 'declined']));
rows = [
  { id: 'r1', created_at: new Date().toISOString(), kind: 'booking', ref: null, payload: { name: 'Cloud Booker', phone: '(217) 555-0166', email: '', vehicle: '2012 Honda Fit', services: ['Tire rotation & pressure check'], start: new Date(Date.now() + 2 * 86400000).toISOString(), duration: 30, notes: 'via cloud' } },
  { id: 'r2', created_at: new Date().toISOString(), kind: 'approval', ref: 'Abcdefghijklmnop1234', payload: { name: 'Signer Person', signature: 'data:image/png;base64,iVBORw0KGgo=', decisions } },
  { id: 'r3', created_at: new Date().toISOString(), kind: 'message', ref: 'Abcdefghijklmnop1234', payload: { text: 'Can you also check the wipers?' } },
  { id: 'r4', created_at: new Date().toISOString(), kind: 'message', ref: 'unknown-share-id-xyz', payload: { text: 'orphan' } },
];
await page.goto(BASE + '/');
await page.waitForFunction(() => window.__autoshop);
await page.waitForTimeout(2500);
const s = await page.evaluate(() => window.__autoshop.state());
ok(s.bookingRequests.some((b) => b.name === 'Cloud Booker' && b.remoteId === 'r1' && b.status === 'new'), 'cloud booking request pulled in');
const o = s.orders.find((x) => x.id === prep.orderId);
ok(o.services.find((v) => v.id === prep.pending[0]).status === 'approved', 'online approval applied');
if (prep.pending[1]) ok(o.services.find((v) => v.id === prep.pending[1]).status === 'declined', 'online decline applied');
const auth = o.authorizations.at(-1);
ok(auth.method === 'online' && auth.by === 'Signer Person' && auth.signature?.startsWith('data:image/png'), 'authorization logged with signature');
ok(s.messages.some((m) => m.customerId === prep.customerId && m.channel === 'portal' && m.body === 'Can you also check the wipers?' && !m.read), 'portal message arrives unread');
ok(!s.messages.some((m) => m.body === 'orphan'), 'unknown share ignored');
ok(deleted.length === 1 && ['r1', 'r2', 'r3', 'r4'].every((id) => deleted[0].includes(id)), 'inbox cleared after processing');
// Unread badge in nav.
const badge = await page.locator('nav a[href$="/messages"]').innerText();
ok(/\d/.test(badge), `messages nav shows unread badge (${badge.replace(/\n/g, ' ')})`);
// Accepting the booking changes busy times → booking page republished.
await page.goto(BASE + '/calendar');
await page.getByRole('button', { name: 'Confirm' }).first().click();
await page.getByRole('button', { name: 'Book it' }).click();
await page.keyboard.press('Escape');
await page.waitForTimeout(5500);
ok(uploads.some((p) => p.endsWith('/site/booking.json')), `booking page republished (${uploads.length} uploads)`);
await browser.close();
console.log(errors.length ? 'ERRORS: ' + errors.join('\n') : 'NO PAGE ERRORS');
