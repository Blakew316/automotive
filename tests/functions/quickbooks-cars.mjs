// Runs supabase/functions/shop-qbo, shop-cars and oauth-callback under Node with Supabase, Intuit
// (QuickBooks Online) and Smartcar mocked.
import { readFileSync, writeFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

import { OUT as SP } from '../support/env.mjs';
const URL_BASE = 'https://proj.supabase.co';
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };

const world = {
  secrets: new Map([['quickbooks_client_id', 'qb-id'], ['quickbooks_client_secret', 'qb-secret'], ['smartcar_client_id', 'sc-id'], ['smartcar_client_secret', 'sc-secret']]),
  states: new Map(),
  cars: new Map(),
  je: new Map(), // DocNumber → entry
  customers: [],
  intuit: [],
  smartcar: [],
  refreshCount: 0,
};
const ACCOUNTS = [
  { Id: '1', Name: 'Accounts Receivable (A/R)', AccountType: 'Accounts Receivable' },
  { Id: '2', Name: 'Undeposited Funds', AccountType: 'Other Current Asset', AccountSubType: 'UndepositedFunds' },
  { Id: '3', Name: 'Services', AccountType: 'Income' },
  { Id: '4', Name: 'Sales of Product Income', AccountType: 'Income' },
  { Id: '5', Name: 'Board of Equalization Payable', AccountType: 'Other Current Liability' },
];
const res = (body, status = 200) => new Response(status === 204 ? null : typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const method = (init.method || 'GET').toUpperCase();
  const jbody = () => (typeof init.body === 'string' ? JSON.parse(init.body) : {});
  const form = () => Object.fromEntries(new URLSearchParams(String(init.body || '')));
  if (url.origin === URL_BASE) {
    const p = url.pathname;
    if (p === '/rest/v1/rpc/shop_secret_get') return res(JSON.stringify(world.secrets.get(jbody().p_name) || null));
    if (p === '/rest/v1/rpc/shop_secret_set') { const a = jbody(); world.secrets.set(a.p_name, a.p_value); return res('null'); }
    if (p === '/rest/v1/shop_oauth_states') {
      const st = url.searchParams.get('state')?.slice(3);
      if (method === 'POST') { const r = jbody(); world.states.set(r.state, { created_at: new Date().toISOString(), ...r }); return res('', 201); }
      if (method === 'GET') return res(world.states.has(st) ? [world.states.get(st)] : []);
      if (method === 'DELETE') { world.states.delete(st); return res('', 204); }
    }
    if (p === '/rest/v1/shop_connected_cars') {
      const vid = url.searchParams.get('vehicle_id');
      if (method === 'POST') { const r = jbody(); world.cars.set(r.vehicle_id, { ...(world.cars.get(r.vehicle_id) || {}), ...r }); return res('', 201); }
      if (method === 'GET') {
        if (vid?.startsWith('in.')) { const ids = vid.slice(4, -1).split(',').map((x) => x.replace(/"/g, '')); return res(ids.filter((i) => world.cars.has(i)).map((i) => world.cars.get(i))); }
        return res(world.cars.has(vid.slice(3)) ? [world.cars.get(vid.slice(3))] : []);
      }
      if (method === 'PATCH') { Object.assign(world.cars.get(decodeURIComponent(vid.slice(3))), jbody()); return res('', 204); }
      if (method === 'DELETE') { world.cars.delete(decodeURIComponent(vid.slice(3))); return res('', 204); }
    }
    throw new Error(`unmocked ${method} ${url}`);
  }
  if (url.hostname === 'oauth.platform.intuit.com') {
    const f = form();
    world.intuit.push({ path: url.pathname, form: f, auth: init.headers?.Authorization });
    if (init.headers?.Authorization !== `Basic ${btoa('qb-id:qb-secret')}`) return res({ error: 'invalid_client' }, 401);
    if (f.grant_type === 'authorization_code') return f.code === 'good' && f.redirect_uri === `${URL_BASE}/functions/v1/oauth-callback` ? res({ access_token: 'qa1', refresh_token: 'qr1', expires_in: 3600 }) : res({ error: 'invalid_grant' }, 400);
    if (f.grant_type === 'refresh_token') { world.refreshCount += 1; return res({ access_token: `qa${world.refreshCount + 1}`, refresh_token: `qr${world.refreshCount + 1}`, expires_in: 3600 }); }
  }
  if (url.hostname === 'developer.api.intuit.com') { world.intuit.push({ path: url.pathname, body: jbody() }); return res({}); }
  if (url.hostname === 'sandbox-quickbooks.api.intuit.com' || url.hostname === 'quickbooks.api.intuit.com') {
    world.intuit.push({ path: url.pathname + url.search, method, body: init.body ? jbody() : null, host: url.hostname });
    if (!String(init.headers?.Authorization || '').startsWith('Bearer qa')) return res({ Fault: { Error: [{ Message: 'AuthenticationFailed' }] } }, 401);
    const p = url.pathname.replace(/^\/v3\/company\/[^/]+/, '');
    if (p.startsWith('/companyinfo/')) return res({ CompanyInfo: { CompanyName: 'Sandbox Auto LLC' } });
    if (p === '/query') {
      const q = url.searchParams.get('query');
      if (/from Account/.test(q)) return res({ QueryResponse: { Account: ACCOUNTS } });
      if (/from Customer/.test(q)) return res({ QueryResponse: world.customers.length ? { Customer: world.customers } : {} });
      const m = /DocNumber = '([^']+)'/.exec(q);
      if (m) return res({ QueryResponse: world.je.has(m[1]) ? { JournalEntry: [world.je.get(m[1])] } : {} });
    }
    if (p === '/customer' && method === 'POST') { const c = { Id: '77', ...jbody() }; world.customers.push(c); return res({ Customer: c }); }
    if (p === '/journalentry' && method === 'POST') {
      const b = jbody();
      if (b.Line.some((l) => l.JournalEntryLineDetail.AccountRef.value === '1' && !l.JournalEntryLineDetail.Entity)) return res({ Fault: { Error: [{ Message: 'A/R needs a customer' }] } }, 400);
      const prev = world.je.get(b.DocNumber);
      if (prev && b.SyncToken !== prev.SyncToken) return res({ Fault: { Error: [{ Message: 'Stale Object Error' }] } }, 400);
      const e = { ...b, Id: prev?.Id || String(100 + world.je.size), SyncToken: prev ? String(Number(prev.SyncToken) + 1) : '0' };
      world.je.set(b.DocNumber, e);
      return res({ JournalEntry: e });
    }
    throw new Error(`unmocked qbo ${url}`);
  }
  if (url.hostname === 'auth.smartcar.com') {
    const f = form();
    world.smartcar.push({ path: url.pathname, form: f });
    if (f.grant_type === 'authorization_code') return f.code === 'carcode' ? res({ access_token: 'sca1', refresh_token: 'scr1', expires_in: 7200 }) : res({ error: 'invalid_grant' }, 400);
    if (f.grant_type === 'refresh_token') return res({ access_token: 'sca2', refresh_token: 'scr2', expires_in: 7200 });
  }
  if (url.hostname === 'api.smartcar.com') {
    world.smartcar.push({ path: url.pathname, method, headers: init.headers, body: init.body ? jbody() : null });
    const p = url.pathname;
    if (p === '/v2.0/vehicles') return res({ vehicles: ['sv-other', 'sv-1'] });
    if (p === '/v2.0/vehicles/sv-other/vin') return res({ vin: '1HGCM82633A004352' });
    if (p === '/v2.0/vehicles/sv-1/vin') return res({ vin: '1FTFW1E50JFA12345' });
    if (p === '/v2.0/vehicles/sv-1') return res({ id: 'sv-1', make: 'FORD', model: 'F-150', year: 2018 });
    if (p === '/v2.0/vehicles/sv-1/batch') return res({ responses: [{ path: '/odometer', code: 200, body: { distance: 88120.6 } }, { path: '/engine/oil', code: 200, body: { lifeRemaining: 0.18 } }, { path: '/tires/pressure', code: 200, body: { frontLeft: 34, frontRight: 35, backLeft: 28, backRight: 35 } }, { path: '/fuel', code: 200, body: { percentRemaining: 0.42, range: 160.4 } }, { path: '/battery', code: 501, body: {} }] });
    if (p === '/v2.0/vehicles/sv-1/application' && method === 'DELETE') return res({ status: 'success' });
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
const jwt = (meta) => `x.${Buffer.from(JSON.stringify({ app_metadata: meta })).toString('base64url')}.y`;
const owner = { autoshop_staff: true, autoshop_role: 'owner' };
const advisor = { autoshop_staff: true, autoshop_role: 'advisor' };
const caller = (fn, name) => async (action, args = {}, meta = owner) => {
  const r = await fn(new Request(`${URL_BASE}/functions/v1/${name}`, { method: 'POST', headers: { Authorization: `Bearer ${jwt(meta)}` }, body: JSON.stringify({ action, ...args }) }));
  return { status: r.status, body: await r.json() };
};

const qboFn = await load('shop-qbo');
const cbFn = await load('oauth-callback');
const carsFn = await load('shop-cars');
const qb = caller(qboFn, 'shop-qbo');
const cars = caller(carsFn, 'shop-cars');
const cb = async (qs) => { const r = await cbFn(new Request(`${URL_BASE}/functions/v1/oauth-callback?${qs}`)); return { status: r.status, location: r.headers.get('Location'), text: await r.text() }; };

// ---------------------------------------------------------------- QuickBooks
let r = await qb('status', {}, advisor);
ok(r.status === 403, 'QuickBooks: advisors can’t use it');
r = await qb('status');
ok(r.body.configured && !r.body.connected && r.body.redirectUri === `${URL_BASE}/functions/v1/oauth-callback`, 'status: keys present, not connected, redirect URI to register');
r = await qb('authorize', { returnUrl: 'https://shop.example/app/accounting?tab=export', env: 'sandbox' }, { autoshop_staff: true, autoshop_role: 'manager' });
ok(r.status === 403, 'only the owner connects QuickBooks');
r = await qb('authorize', { returnUrl: 'https://shop.example/app/accounting?tab=export', env: 'sandbox' });
const auth = new URL(r.body.url);
const state = auth.searchParams.get('state');
ok(auth.host === 'appcenter.intuit.com' && auth.searchParams.get('scope') === 'com.intuit.quickbooks.accounting' && auth.searchParams.get('redirect_uri') === `${URL_BASE}/functions/v1/oauth-callback` && world.states.has(state), 'authorize: Intuit sign-in with a one-time state');
let back = await cb(`state=nope1234567890abcdef&code=good&realmId=123`);
ok(back.status === 400 && back.text.includes('expired'), 'unknown state refused');
back = await cb(`state=${state}&code=good&realmId=4620816365`);
ok(back.status === 302 && back.location === 'https://shop.example/app/accounting?tab=export&qbo=connected', 'callback returns to the app, connected');
ok(world.secrets.get('qbo_refresh_token') === 'qr1' && world.secrets.get('qbo_realm_id') === '4620816365' && world.secrets.get('qbo_env') === 'sandbox' && !world.states.has(state), 'tokens and company saved to Vault; state used once');
back = await cb(`state=${state}&code=good&realmId=4620816365`);
ok(back.status === 400, 'a replayed callback is refused');
r = await qb('status');
ok(r.body.connected && r.body.company === 'Sandbox Auto LLC' && r.body.env === 'sandbox', 'status: connected to the sandbox company');
ok(!JSON.stringify(r.body).includes('qr1') && !JSON.stringify(r.body).includes('qa1'), 'tokens never returned');
r = await qb('accounts');
ok(r.body.accounts.length === 5 && r.body.accounts[0].type === 'Accounts Receivable', 'chart of accounts listed for mapping');
const map = { 'Accounts Receivable': { id: '1' }, 'Undeposited Funds': { id: '2' }, 'Labor Income': { id: '3' }, 'Parts Income': { id: '4' }, 'Sales Tax Payable': { id: '5' } };
const day1 = { no: 'SALES-20261001', date: '2026-10-01', lines: [{ account: 'Accounts Receivable', debit: 108.25, credit: 0 }, { account: 'Labor Income', debit: 0, credit: 60 }, { account: 'Parts Income', debit: 0, credit: 40 }, { account: 'Sales Tax Payable', debit: 0, credit: 8.25 }] };
r = await qb('post', { journals: [day1], map }, advisor);
ok(r.status === 403, 'advisors can’t post');
r = await qb('post', { journals: [day1], map });
ok(r.body.results[0].status === 'created' && world.je.get('SALES-20261001').Line.length === 4, 'daily journal posted');
const arLine = world.je.get('SALES-20261001').Line.find((l) => l.JournalEntryLineDetail.AccountRef.value === '1');
ok(arLine.JournalEntryLineDetail.Entity.EntityRef.value === '77' && world.customers[0].DisplayName === 'AutoShop Pro daily sales', 'A/R lines carry the daily-sales customer');
r = await qb('post', { journals: [day1], map });
ok(r.body.results[0].status === 'unchanged', 'posting the same day again changes nothing');
const day1b = { ...day1, lines: [{ account: 'Accounts Receivable', debit: 216.5, credit: 0 }, { account: 'Labor Income', debit: 0, credit: 120 }, { account: 'Parts Income', debit: 0, credit: 80 }, { account: 'Sales Tax Payable', debit: 0, credit: 16.5 }] };
r = await qb('post', { journals: [day1b], map });
ok(r.body.results[0].status === 'updated' && world.je.get('SALES-20261001').SyncToken === '1' && world.je.get('SALES-20261001').Line[0].Amount === 216.5, 'a changed day updates its entry in place');
r = await qb('post', { journals: [{ ...day1, no: 'SALES-20261002', date: '2026-10-02', lines: [{ account: 'Accounts Receivable', debit: 10, credit: 0 }, { account: 'Labor Income', debit: 0, credit: 9.99 }] }], map });
ok(r.body.results[0].status === 'error' && /differ/.test(r.body.results[0].error), 'unbalanced journal refused');
r = await qb('post', { journals: [{ ...day1, no: 'SALES-20261003', date: '2026-10-03', lines: [{ account: 'Tips Payable', debit: 0, credit: 5 }, { account: 'Undeposited Funds', debit: 5, credit: 0 }] }], map });
ok(r.body.results[0].status === 'error' && /Choose a QuickBooks account for “Tips Payable”/.test(r.body.results[0].error), 'unmapped account named in the error');
// Expired access token → refreshed, rotated refresh token saved.
world.secrets.set('qbo_access_expires', '0');
r = await qb('accounts');
ok(r.status === 200 && world.secrets.get('qbo_refresh_token') === 'qr2' && world.secrets.get('qbo_access_token') === 'qa2', 'expired token refreshed and the new refresh token kept');
r = await qb('disconnect');
ok(r.body.ok && !world.secrets.get('qbo_refresh_token') && world.intuit.some((x) => x.path === '/v2/oauth2/tokens/revoke' && x.body.token === 'qr2'), 'disconnect revokes access and clears tokens');

// ---------------------------------------------------------------- Connected cars
r = await cars('status', { vehicleIds: ['veh_1'] }, { autoshop_staff: false });
ok(r.status === 403, 'cars: staff only');
r = await cars('status', { vehicleIds: ['veh_1'] }, advisor);
ok(r.body.configured && r.body.cars.length === 0, 'status: configured, nothing connected yet');
r = await cars('link', { vehicleId: 'veh_1', vin: '1FTFW1E50JFA12345', vehicle: '2018 Ford F-150', shop: 'Main Street Auto', mode: 'simulated' }, advisor);
const go = new URL(r.body.url);
ok(go.pathname === '/functions/v1/oauth-callback' && go.searchParams.get('go'), 'short connect link to text the customer');
back = await cb(`go=${go.searchParams.get('go')}`);
const connect = new URL(back.location);
ok(back.status === 302 && connect.host === 'connect.smartcar.com' && connect.searchParams.get('mode') === 'simulated' && connect.searchParams.get('scope').includes('read_odometer') && connect.searchParams.get('client_id') === 'sc-id', 'link opens Smartcar Connect with read-only scopes');
// The customer backs out first: the texted link still works afterwards.
back = await cb(`state=${connect.searchParams.get('state')}&error=access_denied`);
ok(back.status === 400 && back.text.includes('Not connected') && world.cars.size === 0, 'declining connects nothing');
back = await cb(`go=${go.searchParams.get('go')}`);
ok(back.status === 302 && new URL(back.location).host === 'connect.smartcar.com', 'the same link still opens Smartcar Connect after declining');
back = await cb(`state=${connect.searchParams.get('state')}&code=carcode`);
ok(back.status === 200 && back.text.includes('You’re connected') && back.text.includes('2018 Ford F-150'), 'customer sees a thank-you page');
const car = world.cars.get('veh_1');
ok(car.smartcar_id === 'sv-1' && car.vin === '1FTFW1E50JFA12345' && car.access_token === 'sca1', 'the car matching the VIN is linked (not the other one on the account)');
r = await cars('status', { vehicleIds: ['veh_1', 'veh_2'] }, advisor);
ok(r.body.cars.length === 1 && r.body.cars[0].make === 'FORD' && !('access_token' in r.body.cars[0]) && !JSON.stringify(r.body).includes('sca1'), 'status lists the car, never its tokens');
car.expires_at = new Date(Date.now() - 1000).toISOString();
r = await cars('read', { vehicleId: 'veh_1' }, advisor);
ok(r.body.reading.odometer === 88121 && r.body.reading.oilLife === 18 && r.body.reading.tires.rl === 28 && r.body.reading.fuel.percent === 42 && r.body.reading.battery === null, 'reading: miles, oil life, tire pressures, fuel; unsupported battery left out');
ok(world.cars.get('veh_1').access_token === 'sca2' && world.smartcar.some((x) => x.headers?.['sc-unit-system'] === 'imperial'), 'expired car token refreshed; imperial units');
r = await cars('unlink', { vehicleId: 'veh_1' }, advisor);
ok(r.body.ok && !world.cars.has('veh_1') && world.smartcar.some((x) => x.path === '/v2.0/vehicles/sv-1/application' && x.method === 'DELETE'), 'disconnect removes the car on both sides');
r = await cars('read', { vehicleId: 'veh_1' }, advisor);
ok(r.status === 404, 'disconnected car can’t be read');

console.log('QBO+CARS PASS');
