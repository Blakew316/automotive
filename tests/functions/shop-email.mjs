// Runs supabase/functions/shop-email and email-webhook under Node with Supabase and Resend mocked,
// and webhook requests signed the way Resend (Svix) signs them.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { transformSync } from 'esbuild';

import { OUT as SP } from '../support/env.mjs';
const URL_BASE = 'https://proj.supabase.co';
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };

const WHSEC = `whsec_${Buffer.from('a-32-byte-signing-secret-for-tst').toString('base64')}`;
const today = (tz) => new Date().toLocaleDateString('en-CA', { timeZone: tz });
const world = {
  secrets: new Map([['dispatch_secret', 'disp-123']]),
  resend: [],
  resendDown: false,
  domains: [],
  digest: { id: 1, enabled: false, hour: 18, tz: 'America/Chicago', recipients: [], snapshot: null, snapshot_day: null, snapshot_at: null, last_sent: null },
  events: [],
};
const res = (body, status = 200) => new Response(status === 204 ? null : typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
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
    if (p === '/rest/v1/shop_digest') {
      if (method === 'GET') {
        const cols = url.searchParams.get('select');
        return res([cols === '*' ? world.digest : Object.fromEntries(cols.split(',').map((c) => [c, world.digest[c]]))]);
      }
      if (method === 'PATCH') { Object.assign(world.digest, jbody()); return res('', 204); }
    }
    if (p === '/rest/v1/shop_email_events' && method === 'POST') {
      const r = jbody();
      ok(url.searchParams.get('on_conflict') === 'email_id,kind' && /ignore-duplicates/.test(init.headers.Prefer), 'events upsert, ignoring duplicates');
      if (!world.events.some((e) => e.email_id === r.email_id && e.kind === r.kind)) world.events.push(r);
      return res('', 201);
    }
    throw new Error(`unmocked ${method} ${url}`);
  }
  if (url.origin === 'https://api.resend.com') {
    const body = init.body ? JSON.parse(init.body) : null;
    world.resend.push({ method, path: url.pathname, body });
    if (world.resendDown || init.headers?.Authorization !== 'Bearer re_test_key') return res({ name: 'validation_error', message: 'API key is invalid' }, 401);
    const p = url.pathname;
    if (p === '/domains' && method === 'GET') return res({ data: world.domains.map(({ records, ...d }) => (void records, d)) });
    if (p === '/domains' && method === 'POST') {
      const d = { id: `d_${world.domains.length + 1}`, name: body.name, status: 'not_started', region: 'us-east-1', records: [{ record: 'SPF', type: 'MX', name: 'send', value: 'feedback-smtp.us-east-1.amazonses.com', priority: 10, ttl: 'Auto', status: 'not_started' }, { record: 'DKIM', type: 'TXT', name: 'resend._domainkey', value: 'p=MIGf', ttl: 'Auto', status: 'not_started' }] };
      world.domains.push(d);
      return res(d);
    }
    if (/^\/domains\/[^/]+\/verify$/.test(p)) { const d = world.domains.find((x) => x.id === p.split('/')[2]); d.status = 'pending'; return res({ object: 'domain', id: d.id }); }
    if (/^\/domains\/[^/]+$/.test(p)) return res(world.domains.find((x) => x.id === p.split('/')[2]));
    if (p === '/emails' && method === 'POST') return res({ id: `em_${world.resend.filter((x) => x.path === '/emails').length}` });
    throw new Error(`unmocked resend ${method} ${url}`);
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
const jwt = (meta, extra = {}) => `x.${Buffer.from(JSON.stringify({ app_metadata: meta, email: 'owner@shop.test', ...extra })).toString('base64url')}.y`;
const OWNER = jwt({ autoshop_staff: true, autoshop_role: 'owner' });
const ADVISOR = jwt({ autoshop_staff: true, autoshop_role: 'advisor' });
const MANAGER = jwt({ autoshop_staff: true, autoshop_role: 'manager' }, { email: 'mgr@shop.test' });

const email = await load('shop-email');
const call = async (token, body, headers = {}) => {
  const r = await email(new Request(`${URL_BASE}/functions/v1/shop-email`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: JSON.stringify(body) }));
  return { status: r.status, body: await r.json() };
};

// ---- Who may call it.
ok((await call(jwt({ autoshop_staff: false }), { action: 'status' })).status === 403, 'non-staff refused');
let r = await call(jwt({ autoshop_staff: true, autoshop_role: 'owner', test_mfa: true }), { action: 'status' });
ok(r.status === 401 && r.body.code === 'mfa_required', 'two-step users need the code first');
ok((await call(jwt({ autoshop_staff: true, autoshop_role: 'owner', test_mfa: true }, { aal: 'aal2' }), { action: 'status' })).status === 200, '…and pass with it');

// ---- Status before and after the keys.
r = await call(OWNER, { action: 'status' });
ok(r.status === 200 && !r.body.configured && !r.body.keySet && r.body.domain === null && r.body.webhook === `${URL_BASE}/functions/v1/email-webhook`, 'not set up: says so, with the webhook address');
ok(world.secrets.get('project_url') === URL_BASE, 'project address saved for the scheduled summary');
ok((await call(OWNER, { action: 'send', to: 'a@b.co', subject: 's', text: 't' })).status === 412, 'sending before the key: asks for it');
world.secrets.set('resend_api_key', 're_test_key');
world.secrets.set('email_from', 'Main Street Auto <service@MainStreetAuto.com>');
world.secrets.set('email_reply_to', 'office@mainstreetauto.com');
r = await call(OWNER, { action: 'status' });
ok(r.body.configured && r.body.from.includes('service@') && r.body.replyTo === 'office@mainstreetauto.com' && r.body.domain.status === 'not_added' && r.body.domain.name === 'mainstreetauto.com', 'keys in: domain not added yet (taken from the sending address)');
ok(r.body.digest && r.body.digest.tz === 'America/Chicago' && !('snapshot' in r.body.digest), 'owner sees the summary settings (not the numbers)');
ok((await call(ADVISOR, { action: 'status' })).body.digest === null, 'advisors don’t see the summary settings');

// ---- Domain.
ok((await call(ADVISOR, { action: 'addDomain' })).status === 403, 'only the owner adds the domain');
ok((await call(OWNER, { action: 'addDomain', name: 'not a domain' })).status === 400, 'bad domain refused');
r = await call(OWNER, { action: 'addDomain' });
ok(r.status === 200 && r.body.name === 'mainstreetauto.com' && r.body.records.length === 2, 'domain added with its DNS records');
r = await call(OWNER, { action: 'status' });
ok(r.body.domain.id === 'd_1' && r.body.domain.status === 'not_started' && r.body.domain.records[0].type === 'MX' && r.body.domain.records[0].priority === 10, 'status lists the records to add');
await call(OWNER, { action: 'verifyDomain', id: 'd_1' });
ok(world.resend.at(-1).path === '/domains/d_1/verify' && world.domains[0].status === 'pending', 'verify asks Resend to check the DNS');

// ---- Sending.
ok((await call(ADVISOR, { action: 'send', to: 'not-an-email', subject: 's', text: 't' })).status === 400, 'bad address refused');
ok((await call(ADVISOR, { action: 'send', to: 'x@y.co', subject: '', text: 't' })).status === 400, 'subject required');
const pdf = Buffer.from('%PDF-1.7 test').toString('base64');
r = await call(ADVISOR, { action: 'send', to: 'jane@example.com', subject: 'Your estimate — RO #1042 — Main Street Auto', text: 'Hi Jane,\n\nHere is your estimate <b>today</b>: https://pay.example/x', kind: 'estimate', attachments: [{ filename: 'Estimate-1042-Main/../Street.pdf', content: pdf }], shop: { name: 'Main Street Auto', phone: '(512) 555-0100', address: '1 Main St, Austin, TX 78701', email: 'shop@x.co' } });
let sent = world.resend.at(-1).body;
ok(r.status === 200 && r.body.id, 'advisor sends a customer email');
ok(sent.from === 'Main Street Auto <service@MainStreetAuto.com>' && sent.to[0] === 'jane@example.com' && sent.reply_to === 'office@mainstreetauto.com', 'from the shop’s address, replies to the shop inbox');
ok(sent.text.includes('<b>today</b>') && sent.html.includes('&lt;b&gt;today&lt;/b&gt;') && !sent.html.includes('<b>today'), 'plain text kept; HTML version escaped');
ok(sent.html.includes('<a href="https://pay.example/x"') && sent.html.includes('Main Street Auto') && sent.html.includes('(512) 555-0100'), 'links clickable, shop name and phone in the layout');
ok(sent.attachments.length === 1 && sent.attachments[0].filename === 'Estimate-1042-Main..Street.pdf' && sent.attachments[0].content === pdf, 'PDF attached, filename made safe');
ok(sent.tags[0].name === 'kind' && sent.tags[0].value === 'estimate', 'tagged by kind');
await call(ADVISOR, { action: 'send', to: 'jane@example.com', subject: 'Line one\r\nBcc: x@evil.co', text: 'Pay here: "https://pay.example/a?b=1&c=2".', shop: { name: 'Main Street Auto' } });
sent = world.resend.at(-1).body;
ok(sent.subject === 'Line one Bcc: x@evil.co', 'line breaks removed from the subject');
ok(sent.html.includes('&quot;<a href="https://pay.example/a?b=1&amp;c=2" style="color:#1a6fd6">https://pay.example/a?b=1&amp;c=2</a>&quot;.'), 'links stop before quotes and punctuation, and are escaped');
r = await call(ADVISOR, { action: 'send', to: 'x@y.co', subject: 's', text: 't', attachments: [{ filename: 'big.pdf', content: 'A'.repeat(14_000_001) }] });
ok(r.status === 400 && /too large/.test(r.body.message), 'oversized attachments refused');
world.resendDown = true;
r = await call(ADVISOR, { action: 'send', to: 'x@y.co', subject: 's', text: 't' });
ok(r.status === 412 && /API key is invalid/.test(r.body.message), 'a rejected key comes back as a setup problem');
world.resendDown = false;

// ---- Test email.
ok((await call(ADVISOR, { action: 'test' })).status === 403, 'only owners and managers send tests');
r = await call(MANAGER, { action: 'test', shop: 'Main Street Auto' });
ok(r.status === 200 && r.body.to === 'mgr@shop.test' && world.resend.at(-1).body.to[0] === 'mgr@shop.test', 'test goes to the signed-in manager');

// ---- Daily summary (pg_cron).
ok((await call(null, { action: 'digest' }, { 'x-dispatch-secret': 'wrong' })).status === 403, 'summary needs the dispatch secret');
r = await call(null, { action: 'digest' }, { 'x-dispatch-secret': 'disp-123' });
ok(r.body.skipped === 'not set up', 'summary off: nothing sent');
Object.assign(world.digest, { enabled: true, recipients: ['owner@shop.test', 'partner@shop.test'], snapshot_day: today('America/Chicago'), snapshot: { shop: 'Main Street Auto', asOf: '5:40 PM', today: { sales: 4210.5, invoiced: 7, carCount: 7, aro: 601.5, collected: 3980, payments: 6 }, inShop: 9, waitingParts: 2, estimates: 4, estimatesValue: 5120, receivables: 1830.25, unpaid: 3, tomorrow: ['8:00 AM — Jane Cooper · 2019 Honda CR-V · Oil change'], attention: ['2 ROs past the promised time'] } });
const before = world.resend.length;
r = await call(null, { action: 'digest' }, { 'x-dispatch-secret': 'disp-123' });
sent = world.resend.at(-1).body;
ok(r.body.sent === 2 && world.resend.length === before + 1 && sent.to.length === 2 && sent.subject.startsWith('Main Street Auto — '), 'summary emailed to both recipients');
ok(sent.html.includes('$4,210.50') && sent.html.includes('ARO $601.50') && sent.html.includes('Jane Cooper') && sent.html.includes('2 ROs past the promised time') && sent.html.includes('$1,830.25'), 'summary has sales, ARO, receivables, tomorrow and attention items');
ok(world.digest.last_sent === today('America/Chicago'), 'marked sent for today');
ok((await call(null, { action: 'digest' }, { 'x-dispatch-secret': 'disp-123' })).body.skipped === 'already sent', 'never twice in a day');
Object.assign(world.digest, { last_sent: null, snapshot_day: '2000-01-01' });
await call(null, { action: 'digest' }, { 'x-dispatch-secret': 'disp-123' });
ok(/No device has been open/.test(world.resend.at(-1).body.html), 'stale numbers: says so instead of sending old figures');

// ---- Delivery webhook (Svix signatures).
const hook = await load('email-webhook');
world.secrets.set('resend_webhook_secret', WHSEC);
const sign = (id, ts, raw, secret = WHSEC) => `v1,${createHmac('sha256', Buffer.from(secret.replace(/^whsec_/, ''), 'base64')).update(`${id}.${ts}.${raw}`).digest('base64')}`;
const post = async (event, { id = `msg_${Math.random()}`, ts = Math.floor(Date.now() / 1000), sig } = {}) => {
  const raw = JSON.stringify(event);
  const r2 = await hook(new Request(`${URL_BASE}/functions/v1/email-webhook`, { method: 'POST', headers: { 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': sig ?? `v1,bogus ${sign(id, ts, raw)}` }, body: raw }));
  return r2.status;
};
const delivered = { type: 'email.delivered', created_at: '2026-10-02T15:00:00Z', data: { email_id: 'em_1', to: ['jane@example.com'], subject: 'Your estimate' } };
ok((await post(delivered, { sig: '' })) === 400, 'unsigned requests refused');
ok((await post(delivered, { sig: 'v1,AAAA' })) === 400, 'bad signature refused');
ok((await post(delivered, { ts: Math.floor(Date.now() / 1000) - 600 })) === 400, 'replayed (old) requests refused');
ok(world.events.length === 0, 'nothing recorded from bad requests');
ok((await post(delivered)) === 200 && world.events[0].email_id === 'em_1' && world.events[0].kind === 'delivered' && world.events[0].payload.to === 'jane@example.com', 'delivered recorded (any of several signatures may match)');
await post(delivered);
ok(world.events.length === 1, 'duplicate deliveries recorded once');
await post({ type: 'email.bounced', data: { email_id: 'em_1', to: ['jane@example.com'], bounce: { type: 'Permanent', message: 'Mailbox does not exist' } } });
ok(world.events[1].kind === 'bounced' && world.events[1].payload.bounce.message === 'Mailbox does not exist', 'bounce recorded with the reason');
ok((await post({ type: 'email.sent', data: { email_id: 'em_1' } })) === 200 && world.events.length === 2, 'other event types ignored');

console.log('SHOP EMAIL FUNCTIONS PASS');
