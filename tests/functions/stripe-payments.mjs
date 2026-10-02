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

console.log('STRIPE PASS');
