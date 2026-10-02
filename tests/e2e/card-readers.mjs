// Stripe card readers at the counter: add a (simulated) reader, send an RO's balance to it, the
// customer taps, and the payment lands on the RO with the card, tip and fee — plus a declined card,
// cancelling, choosing another terminal, and a payment the webhook recorded while nobody watched.
import { launch, APP, OUT } from '../support/env.mjs';
import { fakeCloud } from '../support/fakecloud.mjs';
const CLOUD = 'https://huwcrbkplpudpsfczbyg.supabase.co';
const browser = await launch();
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const errors = [];
const cloud = fakeCloud();
cloud.addUser('owner@shop.test', 'owner-pass-123', { autoshop_staff: true, autoshop_role: 'owner', autoshop_staff_id: 'staff-owner' }, { name: 'Shop owner' });
cloud.db.pay.configured = true;
cloud.db.pay.connected = true;

const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 }, serviceWorkers: 'block' });
await ctx.route(CLOUD + '/**', (r) => cloud.handle(r));
await ctx.routeWebSocket(/realtime/, (ws) => ws.close());
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|WebSocket|realtime|net::ERR/.test(m.text()) && errors.push(`console: ${m.text()}`));
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

// ---- Add a simulated reader in Settings → Payments.
await page.goto(APP + '/settings?tab=payments');
const box = page.getByTestId('card-readers');
await box.waitFor();
await box.getByRole('button', { name: 'Add a simulated reader (test mode)' }).click();
await box.locator('li', { hasText: 'Front counter' }).waitFor();
ok(cloud.db.pay.readers.length === 1 && cloud.db.pay.location === 'tml_1' && cloud.db.pay.locationAddress.line1, 'simulated reader added at the shop’s address');
const boxText = await box.innerText();
ok(/Front counter\s+Simulated reader · simulated-wpe-1\s+Online/.test(boxText), `reader shows online (${boxText.slice(0, 120).replace(/\n/g, ' | ')})`);
await box.getByLabel('Reader pairing code').fill('wrong-code');
await box.getByRole('button', { name: 'Add reader' }).click();
await page.getByText(/didn’t recognize that code/).waitFor();
ok(cloud.db.pay.readers.length === 1, 'a wrong pairing code is explained');
await page.screenshot({ path: `${OUT}/shots/j5-readers.png`, fullPage: true });

// ---- Charge an RO's balance on the reader.
let s = await state();
const ro = s.orders.find((o) => o.status === 'ready' && o.payments.length === 0);
await page.goto(APP + `/orders/${ro.id}`);
await page.getByRole('button', { name: 'Take payment' }).first().click();
let dlg = page.getByRole('dialog', { name: 'Take payment' });
await dlg.getByLabel('Card reader').waitFor();
ok((await dlg.getByLabel('Card reader').inputValue()) === 'tmr_1', 'the counter’s reader is picked');
ok((await dlg.getByLabel('Reference').count()) === 0, 'no reference to type for reader payments');
const custom = dlg.getByLabel('Custom tip');
const hasTip = (await custom.count()) > 0;
if (hasTip) await custom.fill('10');
const send = dlg.getByRole('button', { name: /^Send \$[\d,.]+ to reader$/ });
const label = await send.textContent();
await send.click();
const status = page.getByTestId('reader-status');
await status.getByText('Tap, insert or swipe').waitFor();
ok(cloud.db.pay.intents.size === 1, 'payment sent to the reader');
const pi1 = [...cloud.db.pay.intents.values()][0];
ok(pi1.meta.order === ro.id && pi1.meta.tip === (hasTip ? 10 : 0) && label.includes((pi1.total / 100).toFixed(2)), `amount${hasTip ? ', tip' : ''} and RO sent`);
await page.screenshot({ path: `${OUT}/shots/j5-waiting.png` });
await page.getByRole('button', { name: 'Simulate tap' }).click();
await status.getByText('Approved').waitFor();
await until(async () => (await state()).orders.find((o) => o.id === ro.id).payments.length === 1, 'payment on the RO');
s = await state();
const paid = s.orders.find((o) => o.id === ro.id);
const p = paid.payments[0];
ok(p.stripe.pi === pi1.id && p.amount === pi1.meta.amount && p.tip === pi1.meta.tip && p.ref === 'Visa •••• 4242 · card reader' && p.stripe.reader === 'tmr_1' && p.stripe.fee > 0, 'recorded with amount, tip, card, reader and Stripe fee');
ok(!s.messages.some((m) => m.meta?.payment === pi1.id), 'no “paid online” message for a counter payment');
await dlg.waitFor({ state: 'detached' });
ok(true, 'dialog closes after approval');
ok((await page.getByText('Visa •••• 4242 · card reader').count()) > 0, 'payment listed on the RO');
// The same payment from the webhook later is not added twice.
await poll();
await page.waitForTimeout(800);
ok((await state()).orders.find((o) => o.id === ro.id).payments.length === 1 && cloud.db.payEvents.length === 0, 'recorded once; the server event is cleared');

// ---- Declined, then cancelled, then another terminal.
const ro2 = s.orders.find((o) => o.status === 'ready' && o.payments.length === 0 && o.id !== ro.id);
await page.goto(APP + `/orders/${ro2.id}`);
await page.getByRole('button', { name: 'Take payment' }).first().click();
dlg = page.getByRole('dialog', { name: 'Take payment' });
await dlg.getByRole('button', { name: /to reader$/ }).click();
await status.getByText('Tap, insert or swipe').waitFor();
[...cloud.db.pay.intents.values()].at(-1).status = 'declined';
await status.getByText('Not approved').waitFor();
ok((await status.getByText('Your card was declined.').count()) === 1, 'a declined card is shown');
await page.getByRole('button', { name: 'Try again' }).click();
await status.getByText('Tap, insert or swipe').waitFor();
ok(cloud.db.pay.intents.size === 3, 'try again sends a fresh payment');
await page.getByRole('dialog', { name: 'Card reader' }).getByRole('button', { name: 'Cancel' }).click();
await dlg.getByLabel('Card reader').waitFor();
ok([...cloud.db.pay.intents.values()].at(-1).status === 'canceled', 'cancel stops the reader and returns to the form');
await dlg.getByLabel('Card reader').selectOption('none');
ok((await dlg.getByRole('button', { name: /^Charge \$/ }).count()) === 1 && (await dlg.getByLabel('Reference').count()) === 1, 'another terminal: recorded by hand with a reference');
await dlg.getByRole('button', { name: 'Cancel' }).click();
await page.getByRole('button', { name: 'Take payment' }).first().click();
ok((await page.getByRole('dialog', { name: 'Take payment' }).getByLabel('Card reader').inputValue()) === 'none', 'the counter’s choice is remembered');
await page.getByRole('dialog', { name: 'Take payment' }).getByLabel('Card reader').selectOption('tmr_1');
await page.getByRole('dialog', { name: 'Take payment' }).getByRole('button', { name: 'Cancel' }).click();

// ---- Approved while nobody was watching: the webhook's record lands on the RO.
cloud.payEvent('payment', 'pi_term_webhook', { source: 'terminal', orderId: ro2.id, ro: ro2.number, amount: 25, tip: 0, surcharge: 0, method: 'Card', type: 'card_present', brand: 'mastercard', last4: '4444', fee: 0.75, paymentIntent: 'pi_term_webhook', reader: 'tmr_1', paidAt: new Date().toISOString() });
await until(async () => (await state()).orders.find((o) => o.id === ro2.id).payments.some((x) => x.stripe?.pi === 'pi_term_webhook'), 'webhook payment recorded');
ok((await state()).orders.find((o) => o.id === ro2.id).payments.find((x) => x.stripe?.pi === 'pi_term_webhook').ref === 'Mastercard •••• 4444 · card reader', 'reader payment from the webhook recorded on the RO');

ok(errors.length === 0, `no page errors${errors.length ? ':\n' + errors.join('\n') : ''}`);
await browser.close();
console.log('J5 CARD READERS PASS');
