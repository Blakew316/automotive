// Runs supabase/functions/shop-pay, pay-link and stripe-webhook under Node with Supabase and
// Stripe mocked, and webhook requests signed the way Stripe signs them.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { transformSync } from 'esbuild';

import { OUT as SP } from '../support/env.mjs';
const URL_BASE = 'https://proj.supabase.co';
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };

const world = {
  secrets: new Map([['stripe_secret_key', 'sk_test_abc123']]),
  links: new Map(),
  events: [],
  stripe: [],
  endpoints: [{ id: 'we_old', url: `${URL_BASE}/functions/v1/stripe-webhook` }, { id: 'we_other', url: 'https://elsewhere.example/hook' }],
  sessions: new Map(),
  readers: [],
  intents: new Map(),
};
const res = (body, status = 200) => new Response(status === 204 ? null : typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const parseForm = (b) => Object.fromEntries(new URLSearchParams(String(b || '')));

// The database's two-step check (shop_mfa_ok): a token marked as having an authenticator app
// (test_mfa) passes only once its session used the code (aal2).
const mfaOk = (init) => {
  try {
    const t = String(init.headers?.Authorization || '').replace(/^Bearer /, '');
    const c = JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());
    return c.aal === 'aal2' || !c.app_metadata?.test_mfa;
  } catch {
    return false;
  }
};

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const method = (init.method || 'GET').toUpperCase();
  const jbody = () => (typeof init.body === 'string' ? JSON.parse(init.body) : {});
  if (url.origin === URL_BASE) {
    const p = url.pathname;
    if (p === '/rest/v1/rpc/shop_mfa_ok') return res(JSON.stringify(mfaOk(init)));
    if (p === '/rest/v1/rpc/shop_secret_get') return res(JSON.stringify(world.secrets.get(jbody().p_name) || null));
    if (p === '/rest/v1/rpc/shop_secret_set') { const a = jbody(); world.secrets.set(a.p_name, a.p_value); return res('null'); }
    if (p === '/rest/v1/shop_pay_links') {
      const id = url.searchParams.get('id')?.slice(3);
      const order = url.searchParams.get('order_id')?.slice(3);
      if (method === 'GET') return res(world.links.has(id) ? [world.links.get(id)] : []);
      if (method === 'POST') { const r = jbody(); world.links.set(r.id, { status: 'open', session_id: null, paid_at: null, ...r }); return res('', 201); }
      if (method === 'PATCH') {
        const patch = jbody();
        for (const l of world.links.values()) if ((id && l.id === id) || (order && l.order_id === order && (!url.searchParams.get('status') || l.status === url.searchParams.get('status').slice(3)))) Object.assign(l, patch);
        return res('', 204);
      }
    }
    if (p === '/rest/v1/shop_pay_events' && method === 'POST') {
      const r = jbody();
      if (!world.events.some((e) => e.ref === r.ref)) world.events.push(r);
      return res('', 201);
    }
    throw new Error(`unmocked ${method} ${url}`);
  }
  if (url.origin === 'https://api.stripe.com') {
    const form = parseForm(init.body);
    world.stripe.push({ method, path: url.pathname + url.search, form, headers: init.headers });
    if (init.headers?.Authorization !== 'Bearer sk_test_abc123') return res({ error: { message: 'Invalid API Key provided' } }, 401);
    const p = url.pathname;
    if (p === '/v1/account') return res({ id: 'acct_1', settings: { dashboard: { display_name: 'Main Street Auto' } }, charges_enabled: true, country: 'US' });
    if (p === '/v1/balance') return res({ object: 'balance' });
    if (p === '/v1/webhook_endpoints' && method === 'GET') return res({ data: world.endpoints });
    if (p.startsWith('/v1/webhook_endpoints/') && method === 'DELETE') { world.endpoints = world.endpoints.filter((e) => e.id !== p.split('/').pop()); return res({ deleted: true }); }
    if (p === '/v1/webhook_endpoints' && method === 'POST') { const ep = { id: 'we_new', url: form.url, secret: 'whsec_test_secret' }; world.endpoints.push(ep); return res(ep); }
    if (p === '/v1/checkout/sessions' && method === 'POST') { const id = `cs_test_${world.sessions.size + 1}`; const s = { id, url: `https://checkout.stripe.com/c/pay/${id}`, status: 'open', form }; world.sessions.set(id, s); return res(s); }
    if (p.startsWith('/v1/checkout/sessions/')) { const s = world.sessions.get(p.split('/').pop()); return s ? res(s) : res({ error: { message: 'No such session' } }, 404); }
    // Stripe Terminal (server-driven readers) and the payment intents they process.
    const meta = (f) => Object.fromEntries(Object.entries(f).filter(([k]) => k.startsWith('metadata[')).map(([k, v]) => [k.slice(9, -1), v]));
    const rd = (id) => world.readers.find((x) => x.id === id);
    if (p === '/v1/terminal/readers' && method === 'GET') return res({ data: world.readers });
    if (p === '/v1/terminal/locations' && method === 'POST') return res({ id: 'tml_1', display_name: form.display_name });
    if (p === '/v1/terminal/readers' && method === 'POST') {
      if (form.registration_code === 'bad-code') return res({ error: { code: 'resource_missing', message: 'No such registration code' } }, 400);
      const x = { id: `tmr_${world.readers.length + 1}`, label: form.label, device_type: 'simulated_wisepos_e', serial_number: `simulated-wpe-${world.readers.length + 1}`, status: 'online', location: form.location, action: null };
      world.readers.push(x);
      return res(x);
    }
    let mt;
    if ((mt = p.match(/^\/v1\/terminal\/readers\/([^/]+)$/))) {
      if (method === 'DELETE') { world.readers = world.readers.filter((x) => x.id !== mt[1]); return res({ deleted: true }); }
      return rd(mt[1]) ? res(rd(mt[1])) : res({ error: { message: 'No such reader' } }, 404);
    }
    if ((mt = p.match(/^\/v1\/terminal\/readers\/([^/]+)\/process_payment_intent$/))) {
      const x = rd(mt[1]);
      if (x.status === 'offline') return res({ error: { code: 'terminal_reader_offline', message: 'Reader is offline' } }, 400);
      x.action = { type: 'process_payment_intent', status: 'in_progress', process_payment_intent: { payment_intent: form.payment_intent } };
      return res(x);
    }
    if ((mt = p.match(/^\/v1\/terminal\/readers\/([^/]+)\/cancel_action$/))) { rd(mt[1]).action = null; return res(rd(mt[1])); }
    if ((mt = p.match(/^\/v1\/test_helpers\/terminal\/readers\/([^/]+)\/present_payment_method$/))) {
      const x = rd(mt[1]);
      const pi = world.intents.get(x.action.process_payment_intent.payment_intent);
      if (form['card_present[number]'] === '4000000000000002') {
        x.action = { ...x.action, status: 'failed', failure_code: 'card_declined', failure_message: 'Your card was declined.' };
        Object.assign(pi, { status: 'requires_payment_method', last_payment_error: { message: 'Your card was declined.' } });
      } else {
        x.action = { ...x.action, status: 'succeeded' };
        Object.assign(pi, { status: 'requires_capture', latest_charge: 'ch_term_1' });
      }
      return res(x);
    }
    if (p === '/v1/payment_intents' && method === 'POST') {
      const id = `pi_term_${world.intents.size + 1}`;
      const pi = { id, amount: Number(form.amount), currency: form.currency, capture_method: form.capture_method, payment_method_types: [form['payment_method_types[0]']], description: form.description, metadata: meta(form), status: 'requires_payment_method', livemode: false, latest_charge: null };
      world.intents.set(id, pi);
      return res(pi);
    }
    if ((mt = p.match(/^\/v1\/payment_intents\/([^/]+)(\/capture|\/cancel)?$/)) && world.intents.has(mt[1])) {
      const pi = world.intents.get(mt[1]);
      if (mt[2] === '/capture') {
        if (pi.status !== 'requires_capture') return res({ error: { message: 'This PaymentIntent could not be captured', payment_intent: { status: pi.status } } }, 400);
        Object.assign(pi, { status: 'succeeded', amount_received: pi.amount });
        return res(pi);
      }
      if (mt[2] === '/cancel') {
        if (pi.status === 'succeeded') return res({ error: { message: 'You cannot cancel this PaymentIntent because it has a status of succeeded.', payment_intent: { status: 'succeeded' } } }, 400);
        pi.status = 'canceled';
        return res(pi);
      }
      const expand = url.searchParams.get('expand[]') === 'latest_charge.balance_transaction';
      return res({ ...pi, latest_charge: pi.latest_charge && expand ? { id: pi.latest_charge, payment_method_details: { type: 'card_present', card_present: { brand: 'mastercard', last4: '4444' } }, balance_transaction: { fee: 320 } } : pi.latest_charge });
    }
    if ((mt = p.match(/^\/v1\/webhook_endpoints\/([^/]+)$/)) && method === 'POST') { const ep = world.endpoints.find((e) => e.id === mt[1]); ep.events = Object.entries(form).filter(([k]) => k.startsWith('enabled_events')).map(([, v]) => v); return res(ep); }
    if (p.startsWith('/v1/payment_intents/')) return res({ id: p.split('/').pop(), latest_charge: { id: 'ch_1', payment_method_details: { type: 'card', card: { brand: 'visa', last4: '4242' } }, balance_transaction: { fee: 1448 } } });
    if (p === '/v1/refunds') return res({ id: 're_1', amount: Number(form.amount || 48901), status: 'succeeded' });
    throw new Error(`unmocked stripe ${url}`);
  }
  throw new Error(`unmocked ${url}`);
};

async function load(name) {
  const src = readFileSync(new URL(`../../supabase/functions/${name}/index.ts`, import.meta.url), 'utf8').replace(/^import "jsr:[^"]+";\n/m, '');
  const js = transformSync(src, { loader: 'ts', format: 'esm' }).code;
  let handler;
  globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: URL_BASE, SUPABASE_SERVICE_ROLE_KEY: 'svc' })[k] }, serve: (h) => (handler = h) };
  const file = `${SP}/.fn-${name}-${Date.now()}.mjs`;
  writeFileSync(file, js);
  await import(file);
  return handler;
}
const jwt = (meta, aal) => `x.${Buffer.from(JSON.stringify({ app_metadata: meta, ...(aal ? { aal } : {}) })).toString('base64url')}.y`;
const owner = { autoshop_staff: true, autoshop_role: 'owner' };
const advisor = { autoshop_staff: true, autoshop_role: 'advisor' };

// ---------------------------------------------------------------- shop-pay
const pay = await load('shop-pay');
const callPay = async (action, args = {}, meta = owner) => {
  const r = await pay(new Request(`${URL_BASE}/functions/v1/shop-pay`, { method: 'POST', headers: { Authorization: `Bearer ${jwt(meta)}` }, body: JSON.stringify({ action, ...args }) }));
  return { status: r.status, body: await r.json() };
};
let r = await callPay('status', {}, { autoshop_staff: false });
ok(r.status === 403, 'shop-pay: staff only');
r = await callPay('status');
ok(r.body.configured && r.body.mode === 'test' && !r.body.connected && r.body.account.name === 'Main Street Auto', 'status: test mode, account name, not connected yet');
ok(!JSON.stringify(r.body).includes('sk_test_abc123'), 'the secret key is never returned');
r = await callPay('connect', {}, advisor);
ok(r.status === 403, 'only the owner connects Stripe');
r = await callPay('connect');
ok(r.body.ok && world.secrets.get('stripe_webhook_secret') === 'whsec_test_secret' && world.secrets.get('stripe_webhook_id') === 'we_new', 'connect registers the webhook and saves its signing secret');
const created = world.stripe.find((x) => x.path === '/v1/webhook_endpoints' && x.method === 'POST');
ok(created.form.url === `${URL_BASE}/functions/v1/stripe-webhook` && created.form['enabled_events[0]'] === 'checkout.session.completed', 'endpoint points at stripe-webhook with the payment events');
ok(created.form.description === 'WPI Driveline Shop Management System — online payments', 'endpoint described with the software’s full name');
ok(!world.endpoints.some((e) => e.id === 'we_old') && world.endpoints.some((e) => e.id === 'we_other'), 'an earlier endpoint for this shop is replaced; others are left alone');
r = await callPay('status');
ok(r.body.connected, 'status: connected');

r = await callPay('link', { orderId: 'ro_1', roNumber: 11033, amount: 489.01, title: 'RO #11033 — 2020 Chevrolet Silverado', shopName: 'Main Street Auto', shopPhone: '(512) 555-0100', email: 'dana@example.com', returnBase: 'https://example.github.io/automotive/app/pay' }, advisor);
ok(r.status === 200 && /^[A-Za-z0-9]{12}$/.test(r.body.id) && r.body.url === `https://example.github.io/automotive/app/pay/${r.body.id}`, 'staff create a pay link for the balance');
const link1 = r.body.id;
ok(world.links.get(link1).amount_cents === 48901 && world.links.get(link1).status === 'open', 'link stored with the amount in cents');
r = await callPay('link', { orderId: 'ro_1', roNumber: 11033, amount: 520, title: 'RO #11033', returnBase: 'https://example.github.io/automotive/app/pay' }, advisor);
ok(world.links.get(link1).status === 'void' && world.links.get(r.body.id).status === 'open', 'a new link for the same order voids the old one');
const link2 = r.body.id;
r = await callPay('link', { orderId: 'ro_1', amount: 0.2, returnBase: 'https://x/pay' });
ok(r.status === 400, 'amounts under Stripe’s minimum are refused');

// ---------------------------------------------------------------- pay-link (customer)
const page = await load('pay-link');
const get = async (id) => { const x = await page(new Request(`${URL_BASE}/functions/v1/pay-link?id=${id}`)); return { status: x.status, body: await x.json() }; };
const post = async (id) => { const x = await page(new Request(`${URL_BASE}/functions/v1/pay-link`, { method: 'POST', body: JSON.stringify({ id }) })); return { status: x.status, body: await x.json() }; };
r = await get(link2);
ok(r.body.amount === 520 && r.body.shop === '' && r.body.status === 'open' && r.body.test === true && !('order_id' in r.body) && !('customer_email' in r.body), 'customer sees the amount and status, nothing internal');
r = await get(link1);
ok(r.body.status === 'void', 'old link reports it was replaced');
r = await post(link1);
ok(r.status === 410, 'old link can’t be paid');
r = await post('nope');
ok(r.status === 404, 'unknown link refused');
r = await post(link2);
ok(r.status === 200 && r.body.url.startsWith('https://checkout.stripe.com/'), 'pay starts Stripe Checkout');
const sess = world.stripe.filter((x) => x.path === '/v1/checkout/sessions' && x.method === 'POST').at(-1).form;
ok(sess.mode === 'payment' && sess['line_items[0][price_data][unit_amount]'] === '52000' && sess['metadata[link]'] === link2 && sess['metadata[order]'] === 'ro_1' && sess.success_url.endsWith(`/pay/${link2}?paid=1`) && !('payment_method_types[0]' in sess), 'checkout: amount, metadata, return page, and the shop’s Stripe payment methods');
const before = world.sessions.size;
r = await post(link2);
ok(world.sessions.size === before && r.body.url.endsWith('cs_test_1'), 'opening the link again resumes the same checkout');

// ---------------------------------------------------------------- stripe-webhook
const hook = await load('stripe-webhook');
const signed = async (event, { secret = 'whsec_test_secret', t = Math.floor(Date.now() / 1000) } = {}) => {
  const raw = JSON.stringify(event);
  const sig = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  const x = await hook(new Request(`${URL_BASE}/functions/v1/stripe-webhook`, { method: 'POST', headers: { 'Stripe-Signature': `t=${t},v1=${sig}` }, body: raw }));
  return x.status;
};
const paid = { type: 'checkout.session.completed', data: { object: { id: 'cs_test_1', payment_status: 'paid', amount_total: 52000, payment_intent: 'pi_123', metadata: { link: link2, order: 'ro_1', ro: '11033' }, customer_details: { email: 'dana@example.com', name: 'Dana Fox' }, created: 1790000000, livemode: false } } };
ok((await signed(paid, { secret: 'whsec_wrong' })) === 400, 'wrongly signed webhook refused');
ok((await signed(paid, { t: Math.floor(Date.now() / 1000) - 3600 })) === 400, 'old (replayed) webhook refused');
ok((await signed(paid)) === 200, 'signed webhook accepted');
const ev = world.events.find((e) => e.ref === 'pi_123');
ok(ev?.kind === 'payment' && ev.payload.amount === 520 && ev.payload.orderId === 'ro_1' && ev.payload.method === 'Card' && ev.payload.brand === 'visa' && ev.payload.last4 === '4242' && ev.payload.fee === 14.48, 'payment recorded with card, last 4 and Stripe fee');
ok(world.links.get(link2).status === 'paid' && world.links.get(link2).payment_intent === 'pi_123', 'pay link marked paid');
await signed(paid);
ok(world.events.filter((e) => e.ref === 'pi_123').length === 1, 'retried webhook doesn’t record the payment twice');
r = await post(link2);
ok(r.status === 409, 'a paid link can’t be paid again');
const pending = { type: 'checkout.session.completed', data: { object: { ...paid.data.object, id: 'cs_ach', payment_status: 'unpaid', payment_intent: 'pi_ach' } } };
await signed(pending);
ok(!world.events.some((e) => e.ref === 'pi_ach'), 'bank payments wait until they clear');
await signed({ type: 'checkout.session.async_payment_succeeded', data: { object: { ...pending.data.object, payment_status: 'paid' } } });
ok(world.events.some((e) => e.ref === 'pi_ach'), 'cleared bank payment recorded');
await signed({ type: 'charge.refunded', data: { object: { id: 'ch_1', payment_intent: 'pi_123', amount_refunded: 10000 } } });
ok(world.events.some((e) => e.kind === 'refund' && e.payload.paymentIntent === 'pi_123' && e.payload.refunded === 100), 'refund recorded (cumulative amount)');

// Refund from the app.
r = await callPay('refund', { paymentIntent: 'pi_123', amount: 100 }, advisor);
ok(r.status === 403, 'advisors can’t refund');
r = await callPay('refund', { paymentIntent: 'pi_123', amount: 100, nonce: 'x1' });
const rf = world.stripe.filter((x) => x.path === '/v1/refunds').at(-1);
ok(r.body.id === 're_1' && rf.form.payment_intent === 'pi_123' && rf.form.amount === '10000' && rf.headers['Idempotency-Key'], 'owner refunds part of a payment (idempotent)');

// ---------------------------------------------------------------- Card readers (Stripe Terminal)
r = await callPay('status');
ok(Array.isArray(r.body.terminal.readers) && r.body.terminal.readers.length === 0 && r.body.terminal.location === null, 'status: no card readers yet');
ok((await callPay('registerReader', { code: 'simulated-wpe' }, advisor)).status === 403, 'only the owner adds readers');
r = await callPay('registerReader', { code: 'simulated-wpe', label: 'Front counter', shopName: 'Main Street Auto', address: { line1: '', city: 'Austin' } });
ok(r.status === 400 && /street address/.test(r.body.message), 'a reader needs the shop’s address (Stripe location)');
const address = { line1: '1 Main St', city: 'Austin', state: 'TX', postal: '78701', country: 'US' };
r = await callPay('registerReader', { code: 'simulated-wpe', label: 'Front counter', shopName: 'Main Street Auto', address });
const locForm = world.stripe.find((x) => x.path === '/v1/terminal/locations').form;
ok(r.status === 200 && r.body.reader.id === 'tmr_1' && r.body.reader.label === 'Front counter' && r.body.reader.simulated, 'simulated reader added');
ok(locForm.display_name === 'Main Street Auto' && locForm['address[line1]'] === '1 Main St' && locForm['address[postal_code]'] === '78701' && world.secrets.get('stripe_terminal_location') === 'tml_1', 'Terminal location made from the shop address and remembered');
ok(world.stripe.filter((x) => x.path === '/v1/terminal/readers' && x.method === 'POST').at(-1).form.location === 'tml_1', 'reader registered at that location');
ok(world.endpoints.find((e) => e.id === 'we_new').events.includes('payment_intent.amount_capturable_updated'), 'webhook now also hears about reader payments');
r = await callPay('registerReader', { code: 'bad-code', label: 'Bay 2', address });
ok(r.status === 400 && /didn’t recognize/.test(r.body.message) && world.stripe.filter((x) => x.path === '/v1/terminal/locations').length === 1, 'a wrong pairing code is explained; the location isn’t made twice');
r = await callPay('status');
ok(r.body.terminal.readers.length === 1 && r.body.terminal.readers[0].status === 'online', 'status lists the reader');

ok((await callPay('readerCharge', { readerId: 'tmr_1', orderId: 'ro_9', roNumber: 11040, amount: 0.2 }, advisor)).status === 400, 'charges under $0.50 refused');
r = await callPay('readerCharge', { readerId: 'tmr_1', orderId: 'ro_9', roNumber: 11040, amount: 100, tip: 10, surcharge: 3.3, shopName: 'Main Street Auto' }, advisor);
const pi1 = r.body.paymentIntent;
const made = world.intents.get(pi1);
ok(r.status === 200 && r.body.test === true && made.amount === 11330 && made.capture_method === 'manual' && made.payment_method_types[0] === 'card_present', 'staff send the amount (with tip and surcharge) to the reader');
ok(made.metadata.source === 'terminal' && made.metadata.order === 'ro_9' && made.metadata.amount === '100.00' && made.metadata.tip === '10.00' && made.metadata.reader === 'tmr_1' && made.description.startsWith('RO #11040'), 'payment tagged with the RO, the split and the reader');
ok(world.readers[0].action.process_payment_intent.payment_intent === pi1, 'reader is showing the payment');
ok((await callPay('readerCheck', { readerId: 'tmr_1', paymentIntent: pi1 }, advisor)).body.status === 'waiting', 'waiting for the card');
ok((await callPay('readerSimulate', { readerId: 'tmr_1' }, advisor)).body.ok, 'test mode: simulate a tap');
r = await callPay('readerCheck', { readerId: 'tmr_1', paymentIntent: pi1 }, advisor);
ok(r.body.status === 'succeeded' && world.intents.get(pi1).status === 'succeeded', 'approved card captured');
const p1 = r.body.payment;
ok(p1.source === 'terminal' && p1.orderId === 'ro_9' && p1.amount === 100 && p1.tip === 10 && p1.surcharge === 3.3 && p1.brand === 'mastercard' && p1.last4 === '4444' && p1.fee === 3.2 && p1.reader === 'tmr_1', 'payment for the RO: amount, tip, surcharge, card and fee');
ok(world.events.filter((e) => e.ref === pi1).length === 1, 'recorded for every device');
await callPay('readerCheck', { readerId: 'tmr_1', paymentIntent: pi1 }, advisor);
ok(world.events.filter((e) => e.ref === pi1).length === 1, 'checking again doesn’t record it twice');

// Declined, cancelled, offline.
const pi2 = (await callPay('readerCharge', { readerId: 'tmr_1', orderId: 'ro_9', roNumber: 11040, amount: 50 }, advisor)).body.paymentIntent;
await callPay('readerSimulate', { readerId: 'tmr_1', decline: true }, advisor);
r = await callPay('readerCheck', { readerId: 'tmr_1', paymentIntent: pi2 }, advisor);
ok(r.body.status === 'failed' && r.body.message === 'Your card was declined.' && world.intents.get(pi2).status === 'canceled', 'declined card: says so and releases the attempt');
const pi3 = (await callPay('readerCharge', { readerId: 'tmr_1', orderId: 'ro_9', roNumber: 11040, amount: 50 }, advisor)).body.paymentIntent;
r = await callPay('readerCancel', { readerId: 'tmr_1', paymentIntent: pi3 }, advisor);
ok(r.body.status === 'canceled' && world.readers[0].action === null, 'cancel clears the reader and the payment');
world.readers[0].status = 'offline';
r = await callPay('readerCharge', { readerId: 'tmr_1', orderId: 'ro_9', roNumber: 11040, amount: 50 }, advisor);
ok(r.status === 409 && /offline/.test(r.body.message) && [...world.intents.values()].at(-1).status === 'canceled', 'offline reader: explained, nothing left pending');
world.readers[0].status = 'online';

// The webhook captures and records a reader payment if no screen is watching.
const pi4 = (await callPay('readerCharge', { readerId: 'tmr_1', orderId: 'ro_10', roNumber: 11041, amount: 75, tip: 5 }, advisor)).body.paymentIntent;
await callPay('readerSimulate', { readerId: 'tmr_1' }, advisor);
ok((await signed({ type: 'payment_intent.amount_capturable_updated', data: { object: world.intents.get(pi4) } })) === 200, 'webhook accepts the approval');
const e4 = world.events.find((e) => e.ref === pi4);
ok(world.intents.get(pi4).status === 'succeeded' && e4?.payload.amount === 75 && e4.payload.tip === 5 && e4.payload.source === 'terminal', 'webhook captures it and records it for the RO');
const count = world.events.length;
await signed({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_checkout_x', status: 'succeeded', metadata: { link: 'abc' } } } });
ok(world.events.length === count, 'online (Checkout) payments aren’t recorded twice through payment intents');
ok((await callPay('removeReader', { readerId: 'tmr_1' }, advisor)).status === 403 && (await callPay('removeReader', { readerId: 'tmr_1' })).body.ok && world.readers.length === 0, 'owner removes a reader');
world.secrets.set('stripe_secret_key', 'sk_live_abc');
ok((await callPay('readerSimulate', { readerId: 'tmr_1' })).status === 400, 'no simulated taps on a live account');
world.secrets.set('stripe_secret_key', 'sk_test_abc123');

console.log('STRIPE PASS');
