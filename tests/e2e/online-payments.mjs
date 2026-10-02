// Phase H: online card payments — connect Stripe, pay links on the RO and in messages, the
// customer's pay page, payments recorded by themselves, refunds, status-page pay links, fees.
import { launch, APP, OUT } from '../support/env.mjs';
import { fakeCloud } from '../support/fakecloud.mjs';
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
const watch = (pg) => {
  pg.on('pageerror', (e) => errors.push(`pageerror ${pg.url()}: ${e.message}`));
  pg.on('console', (m) => m.type() === 'error' && !/Failed to load resource|WebSocket|realtime|net::ERR/.test(m.text()) && errors.push(`console ${pg.url()}: ${m.text()}`));
};
watch(page);
const state = async () => { await page.waitForFunction(() => window.__autoshop); return page.evaluate(() => window.__autoshop.state()); };
const poll = () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
const until = async (fn, msg, ms = 10000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await fn()) return true;
    await poll();
    await page.waitForTimeout(250);
  }
  throw new Error('timeout: ' + msg);
};

await page.goto(APP + '/signin');
await page.getByLabel('Email').fill('owner@shop.test');
await page.getByLabel('Password').fill('owner-pass-123');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL(/settings\?tab=cloud/);

// ---- Connect Stripe.
await page.goto(APP + '/settings?tab=payments');
await page.getByText('Online card payments').waitFor();
ok(await page.getByText('Paste the secret key').count() === 1, 'setup steps shown before the Stripe key is added');
cloud.db.pay.configured = true;
await page.reload();
await page.getByRole('button', { name: 'Connect Stripe' }).click();
await page.getByText('Stripe · Main Street Auto · test mode').waitFor();
ok(cloud.db.pay.connected, 'owner connects Stripe');
ok(await page.getByText(/Test mode: no real money moves/).count() === 1, 'test mode explained');
await page.screenshot({ path: `${SP}/shots/h-settings.png`, fullPage: true });

// ---- Pay link from the repair order.
let s = await state();
const ro = s.orders.find((o) => o.status === 'ready' && s.customers.find((c) => c.id === o.customerId)?.phone && o.payments.reduce((t, p) => t + p.amount, 0) === 0);
await page.goto(APP + `/orders/${ro.id}`);
const strip = page.getByTestId('online-pay');
await strip.getByText('Online payment').waitFor();
await strip.getByRole('button', { name: 'Copy pay link' }).click();
await until(async () => cloud.db.links.size === 1, 'pay link created');
const link = [...cloud.db.links.values()][0];
ok(link.orderId === ro.id && link.amount > 0 && link.title.startsWith(`RO #${ro.number}`) && link.url.includes(`/automotive/app/pay/${link.id}?p=huwcrbkplpudpsfczbyg`), 'link for the RO balance, pointing at the pay page');
await strip.getByText(/Pay link for .* ready \(test mode\)/).waitFor();
ok((await page.evaluate(() => navigator.clipboard.readText())) === link.url, 'link copied to the clipboard');

// Payment request message includes it.
await strip.getByRole('button', { name: 'Send link' }).click();
const dlg = page.getByRole('dialog', { name: /^Message / });
ok((await dlg.getByLabel('Message', { exact: true }).inputValue()).includes(link.url), 'payment request text carries the pay link');
await dlg.getByText(/Includes a secure Stripe pay link/).waitFor();
await dlg.getByRole('button', { name: 'Cancel' }).click();

// ---- The customer's pay page.
const cust = await ctx.newPage();
watch(cust);
await cust.goto(link.url);
await cust.getByRole('button', { name: /^Pay \$/ }).waitFor();
ok((await cust.getByText(s.shop.name).count()) > 0 && (await cust.getByText(/Test mode — no real charge/).count()) === 1, 'pay page shows the shop, amount and test-mode note');
await cust.screenshot({ path: `${SP}/shots/h-paypage.png` });
await cust.getByRole('button', { name: /^Pay \$/ }).click();
await cust.waitForURL(/paid=1/);
await cust.getByText('Confirming your payment…').waitFor();
ok(cloud.db.checkouts.includes(link.id), 'pay button starts checkout');
// Stripe confirms: the webhook marks the link paid and records the payment.
link.status = 'paid';
link.paidAt = new Date().toISOString();
cloud.payEvent('payment', 'pi_test_1', { link: link.id, orderId: ro.id, ro: ro.number, amount: link.amount, method: 'Card', type: 'card', brand: 'visa', last4: '4242', fee: 14.48, paymentIntent: 'pi_test_1', charge: 'ch_1', paidAt: link.paidAt, livemode: false });
await cust.getByText('Thank you — you’re all paid').waitFor({ timeout: 15000 });
ok(true, 'customer sees the payment confirmed');

// ---- Recorded on the RO by itself.
await until(async () => (await state()).orders.find((o) => o.id === ro.id).payments.some((p) => p.stripe?.pi === 'pi_test_1'), 'payment recorded on the RO');
s = await state();
let o = s.orders.find((x) => x.id === ro.id);
const paid = o.payments.find((p) => p.stripe?.pi === 'pi_test_1');
ok(paid.amount === link.amount && paid.method === 'Card' && paid.ref === 'Visa •••• 4242 · online' && paid.stripe.fee === 14.48, 'payment carries the card, last 4 and Stripe fee');
ok(o.status === 'closed' && o.payLink.status === 'paid', 'RO closes when paid in full');
ok(s.messages.some((m) => m.orderId === ro.id && /^Paid \$.* online — Visa •••• 4242$/.test(m.body)), 'payment shows up in the conversation');
await page.getByText(/Payment received — \$/).waitFor();
ok(!cloud.db.payEvents.length, 'handled payment events are cleared');
cloud.payEvent('payment', 'pi_test_1', { orderId: ro.id, amount: link.amount, paymentIntent: 'pi_test_1' });
await poll();
await page.waitForTimeout(800);
ok((await state()).orders.find((x) => x.id === ro.id).payments.filter((p) => p.stripe?.pi === 'pi_test_1').length === 1, 'a repeated event doesn’t record the payment twice');
await page.screenshot({ path: `${SP}/shots/h-ro.png` });

// ---- Refund part of it.
const row = page.locator('li', { hasText: 'Visa •••• 4242 · online' });
await row.hover();
await row.getByRole('button', { name: 'Refund payment' }).click();
const rd = page.getByRole('dialog', { name: 'Refund online payment' });
await rd.getByLabel('Amount to refund').fill('50');
await rd.getByLabel('Amount to refund').blur();
await rd.getByRole('button', { name: 'Refund $50.00' }).click();
await until(async () => cloud.db.refunds.length === 1, 'refund sent');
ok(cloud.db.refunds[0].paymentIntent === 'pi_test_1' && cloud.db.refunds[0].amount === 50, 'refund of $50 sent to Stripe');
await until(async () => (await state()).orders.find((x) => x.id === ro.id).payments.some((p) => p.amount === -50 && p.stripe?.refund), 'refund recorded');
cloud.payEvent('refund', 'refund:ch_1:5000', { paymentIntent: 'pi_test_1', charge: 'ch_1', refunded: 50, at: new Date().toISOString() });
await poll();
await page.waitForTimeout(800);
o = (await state()).orders.find((x) => x.id === ro.id);
ok(o.payments.filter((p) => p.stripe?.refund).length === 1, 'Stripe’s refund notice doesn’t double the refund');

// ---- Live status page with a balance gets a pay link by itself.
s = await state();
const ro2 = s.orders.find((x) => x.status === 'ready' && x.id !== ro.id);
await page.evaluate((id) => window.__autoshop.update((st) => { const x = st.orders.find((y) => y.id === id); x.track = { id: 'trkTEST1234567890ab', on: true, startedAt: new Date().toISOString() }; }), ro2.id);
await until(async () => [...cloud.db.links.values()].some((l) => l.orderId === ro2.id), 'status page gets a pay link', 15000);
const link2 = [...cloud.db.links.values()].find((l) => l.orderId === ro2.id);
await until(async () => {
  const f = cloud.db.public.get('autoshop-media/track/trkTEST1234567890ab.json');
  return f && JSON.parse(f.body.toString()).payLink === link2.url;
}, 'status page published with the Stripe pay link', 15000);
ok(true, 'status page Pay button uses the Stripe link');

// ---- Fees in the P&L.
await page.goto(APP + '/accounting');
await page.getByRole('tab', { name: 'This month' }).click();
await page.getByText('Card processing (Stripe)').first().waitFor();
ok(true, 'Stripe fees show in the profit & loss');

ok(errors.length === 0, `no page errors${errors.length ? ':\n' + errors.join('\n') : ''}`);
await browser.close();
console.log('PHASE H PASS');
