// Shared shop data across devices, against an in-memory copy of the cloud (fakecloud.mjs).
import { launch, APP, OUT } from '../support/env.mjs';
import { fakeCloud } from '../support/fakecloud.mjs';
const CLOUD = 'https://huwcrbkplpudpsfczbyg.supabase.co';
const SP = OUT;
const browser = await launch();
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const errors = [];
const cloud = fakeCloud();
cloud.addUser('owner@shop.test', 'owner-pass-123', { autoshop_staff: true, autoshop_role: 'owner', autoshop_staff_id: 'staff-owner' }, { name: 'Shop owner' });

async function device(name, viewport = { width: 1360, height: 950 }) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await ctx.route(CLOUD + '/**', (r) => cloud.handle(r));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|WebSocket|realtime|net::ERR/.test(m.text()) && errors.push(`${name} console: ${m.text()}`));
  return { ctx, page, name };
}
const state = (d) => d.page.evaluate(() => window.__autoshop.state());
const ready = (d) => d.page.waitForFunction(() => window.__autoshop);
const kick = (d) => d.page.evaluate(() => window.__autoshop.sync()?.syncAll());
async function until(fn, msg, ms = 15000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('TIMEOUT: ' + msg);
}
async function signIn(d, email, password) {
  await d.page.goto(APP + '/signin');
  await d.page.getByLabel('Email').fill(email);
  await d.page.getByLabel('Password').fill(password);
  await d.page.getByRole('button', { name: 'Sign in' }).click();
}

// ---- Device A (owner, front counter): first device turns on shared data with its data.
const A = await device('A');
await signIn(A, 'owner@shop.test', 'owner-pass-123');
await A.page.waitForURL(/settings\?tab=cloud/);
await A.page.getByRole('button', { name: /Use this device’s data/ }).click();
await A.page.getByRole('button', { name: 'Upload and turn on' }).click();
const sA0 = await state(A);
const localCount = ['orders', 'customers', 'vehicles', 'timeEntries'].reduce((n, k) => n + sA0[k].length, 0);
await until(async () => cloud.live() >= localCount, 'upload finished', 60000);
await until(async () => (await A.page.evaluate(() => window.__autoshop.sync()?.status.pending)) === 0, 'A has nothing pending', 60000);
ok(cloud.live() >= localCount, `first device uploaded the shop (${cloud.live()} records)`);
await A.page.getByText(/^Synced/).first().waitFor();
ok(true, 'sidebar shows Synced');
await A.page.screenshot({ path: `${SP}/shots/sync-a-settings.png`, fullPage: true });

// ---- Owner adds a login for the advisor.
await A.page.goto(APP + '/team?tab=access');
await A.page.getByText('Logins').first().waitFor();
const row = A.page.locator('li', { hasText: 'Jordan Blake' }).filter({ hasText: 'No login' });
await row.getByRole('button', { name: /Add login/ }).click();
await A.page.getByLabel('Their email').fill('jordan@shop.test');
await A.page.getByRole('button', { name: 'Create login' }).click();
await A.page.getByText('Temporary password for Jordan Blake').waitFor();
const temp = await A.page.locator('code').innerText();
ok(temp === 'Temp-Pass-1234', 'temporary password shown once');
await A.page.screenshot({ path: `${SP}/shots/sync-a-logins.png` });
await A.page.getByRole('button', { name: 'Done' }).click();

// ---- Device B (advisor's tablet, starts with demo data): signs in and loads the shop.
const B = await device('B', { width: 1180, height: 820 });
await signIn(B, 'jordan@shop.test', temp);
await B.page.getByText('Choose your password').waitFor();
await B.page.getByLabel('New password').fill('jordans-own-pass');
await B.page.getByRole('button', { name: /Save and continue/ }).click();
await B.page.waitForURL((u) => !u.pathname.endsWith('/signin'), { timeout: 30000 });
await ready(B);
const sB0 = await state(B);
ok(sB0.orders.length === sA0.orders.length && sB0.customers.length === sA0.customers.length, `second device loaded the shop (${sB0.orders.length} ROs)`);
ok([...cloud.db.users.values()].find((u) => u.email === 'jordan@shop.test').password === 'jordans-own-pass', 'advisor chose their own password');
const who = await B.page.getByTitle('Switch user').innerText();
ok(/Jordan Blake/.test(who), 'device switched to the person who signed in');

// ---- An edit on A shows up on B.
const ro = sA0.orders.find((o) => o.status === 'estimate');
await A.page.evaluate((id) => window.__autoshop.update((s) => { s.orders.find((o) => o.id === id).concern = 'Squeal from the front when braking (edited on A)'; }), ro.id);
await until(async () => (await A.page.evaluate(() => window.__autoshop.sync()?.status.pending)) === 0, 'A pushed the edit');
await kick(B);
await until(async () => (await state(B)).orders.find((o) => o.id === ro.id).concern.includes('edited on A'), 'edit reached B');
ok(true, 'edit on one device reaches the other');

// ---- Both edit the same RO while offline: both edits survive.
cloud.db.offline = true;
await A.page.evaluate((id) => window.__autoshop.update((s) => { s.orders.find((o) => o.id === id).promisedAt = '2026-10-03T17:00:00.000Z'; }), ro.id);
await B.page.evaluate((id) => window.__autoshop.update((s) => { s.orders.find((o) => o.id === id).notes.unshift({ id: 'note-from-b', at: new Date().toISOString(), text: 'Customer will wait in the lobby', internal: true }); }), ro.id);
// Both make a new repair order offline → same number.
const newRo = (tag) => window.__autoshop.update((s) => {
  s.counters.order += 1;
  s.orders.push({ id: `ro-off-${tag}`, number: s.counters.order, status: 'estimate', customerId: s.customers[0].id, vehicleId: null, techId: null, advisor: '', concern: `offline ${tag}`, mileageIn: null, mileageOut: null, services: [], inspection: {}, notes: [], payments: [], discount: { type: 'amt', value: 0 }, createdAt: new Date(Date.now() + (tag === 'A' ? 0 : 1000)).toISOString(), updatedAt: new Date().toISOString(), promisedAt: null, authorizedAt: null, invoicedAt: null, closedAt: null, authorizations: [] });
});
await A.page.evaluate(newRo, 'A');
await B.page.evaluate(newRo, 'B');
await kick(A).catch(() => {});
await kick(B).catch(() => {});
await B.page.getByText(/Sync problem|Offline/).first().waitFor({ timeout: 10000 }).catch(() => {});
const pendingB = await B.page.evaluate(() => window.__autoshop.sync()?.status.pending);
ok(pendingB >= 2, `offline edits wait on the device (${pendingB} pending)`);
// B reloads while offline: pending edits survive.
await B.page.reload();
await ready(B);
ok((await state(B)).orders.some((o) => o.id === 'ro-off-B'), 'offline edits survive a reload');
cloud.db.offline = false;
await kick(A);
await kick(B);
await kick(A);
const dump = async () => {
  const a = (await state(A)).orders.find((o) => o.id === ro.id);
  const b = (await state(B)).orders.find((o) => o.id === ro.id);
  const c = [...cloud.db.records.values()].find((r) => r.id === ro.id);
  const mb = await B.page.evaluate((id) => { const e = window.__autoshop.sync(); const k = 'orders/' + id; return e && { status: e.status, pending: e.meta.pending[k], base: e.meta.bases[k] && { promisedAt: e.meta.bases[k].promisedAt, notes: e.meta.bases[k].notes.map((n) => n.id) }, version: e.meta.versions[k], started: e.started }; }, ro.id);
  const ma = await A.page.evaluate((id) => { const e = window.__autoshop.sync(); const k = 'orders/' + id; return e && { status: e.status, pending: e.meta.pending[k], version: e.meta.versions[k] }; }, ro.id);
  console.log(JSON.stringify({ A: { p: a.promisedAt, n: a.notes.map((x) => x.id), meta: ma }, B: { p: b.promisedAt, n: b.notes.map((x) => x.id), meta: mb }, cloud: { v: c.version, p: c.data.promisedAt, n: c.data.notes.map((x) => x.id) } }, null, 1));
};
await until(async () => {
  const a = (await state(A)).orders.find((o) => o.id === ro.id);
  const b = (await state(B)).orders.find((o) => o.id === ro.id);
  return a.promisedAt === '2026-10-03T17:00:00.000Z' && b.promisedAt === a.promisedAt && a.notes.some((n) => n.id === 'note-from-b') && b.notes.some((n) => n.id === 'note-from-b');
}, 'concurrent edits merged on both devices', 30000).catch(async (e) => { await dump(); throw e; });
ok(true, 'concurrent edits to the same RO are merged, not lost');
await until(async () => {
  for (const d of [A, B]) {
    const s = await state(d);
    const a = s.orders.find((o) => o.id === 'ro-off-A');
    const b = s.orders.find((o) => o.id === 'ro-off-B');
    if (!a || !b || a.number === b.number) return false;
  }
  const na = (await state(A)).orders.find((o) => o.id === 'ro-off-B').number;
  const nb = (await state(B)).orders.find((o) => o.id === 'ro-off-B').number;
  return na === nb;
}, 'RO number clash resolved the same way on both', 30000);
const fa = (await state(A)).orders.filter((o) => o.id.startsWith('ro-off-')).map((o) => `${o.id}#${o.number}`).sort();
ok(true, `offline RO numbers made unique (${fa.join(', ')})`);

// ---- Photos follow the RO to the other device.
const tiny = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
await A.page.evaluate(async ({ id, tiny }) => {
  const bytes = Uint8Array.from(atob(tiny), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'image/png' });
  await new Promise((resolve, reject) => {
    const req = indexedDB.open('autoshop-media', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files');
    req.onsuccess = () => {
      const t = req.result.transaction('files', 'readwrite');
      t.objectStore('files').put({ blob, thumb: blob }, 'med-sync-test');
      t.oncomplete = resolve;
      t.onerror = reject;
    };
  });
  window.__autoshop.update((s) => {
    const o = s.orders.find((x) => x.id === id);
    o.media = [...(o.media || []), { id: 'med-sync-test', kind: 'image', name: 'brake.png', type: 'image/png', size: blob.size, hasThumb: true, caption: 'Front pads at 2 mm', customer: true, createdAt: new Date().toISOString() }];
  });
  window.dispatchEvent(new CustomEvent('autoshop:media'));
}, { id: ro.id, tiny });
await until(async () => cloud.db.files.has('media/med-sync-test') && cloud.db.files.has('media/med-sync-test-thumb'), 'photo uploaded', 20000);
await until(async () => (await state(A)).orders.find((o) => o.id === ro.id).media?.find((m) => m.id === 'med-sync-test')?.cloud === 'ok', 'photo marked uploaded');
ok(true, 'photo uploaded to the shop’s private files');
await kick(A);
await kick(B);
await until(async () => (await state(B)).orders.find((o) => o.id === ro.id).media?.some((m) => m.id === 'med-sync-test'), 'photo record reached B');
await B.page.goto(`${APP}/orders/${ro.id}?tab=media`);
await B.page.locator('img[src^="blob:"]').first().waitFor({ timeout: 15000 }).catch(async (e) => {
  console.log('file calls:', cloud.db.calls.filter((c) => c.includes('autoshop-files')).slice(-10));
  console.log('B media:', JSON.stringify((await state(B)).orders.find((o) => o.id === ro.id).media));
  console.log('B sync:', await B.page.evaluate(() => { const e = window.__autoshop.sync(); return e && { started: e.started, phase: e.status.phase, source: window.__autoshopMediaSource }; }));
  await B.page.screenshot({ path: `${SP}/shots/sync-media-fail.png` });
  throw e;
});
ok(true, 'other device downloads and shows the photo');

// ---- Change history.
await B.page.getByRole('button', { name: 'More' }).click();
await B.page.getByRole('button', { name: 'Change history' }).click();
await B.page.getByRole('dialog').getByText(/Promised time changed|Notes: added/).first().waitFor();
const hist = await B.page.getByRole('dialog').innerText();
ok(/Shop owner|Jordan Blake/.test(hist), 'history names who made each change');
await B.page.screenshot({ path: `${SP}/shots/sync-history.png` });
await B.page.keyboard.press('Escape');

// ---- Backups (owner).
await A.page.goto(APP + '/settings?tab=data');
await A.page.getByText('Cloud backups').waitFor();
await A.page.getByRole('button', { name: /Back up now/ }).click();
await A.page.getByText(/Backup made by hand/).waitFor();
const dl = A.page.waitForEvent('download');
await A.page.getByRole('button', { name: 'Download' }).first().click();
const file = await dl;
ok(/wpi-driveline-cloud-backup-/.test(file.suggestedFilename()), 'cloud backup downloads as a backup file');
ok((await A.page.getByRole('button', { name: /Reload the sample shop/ }).count()) === 0, 'demo reset hidden on a shared shop');
await A.page.screenshot({ path: `${SP}/shots/sync-backups.png`, fullPage: true });

// ---- Signed out: edits wait, then sync after signing back in.
await B.page.evaluate(() => localStorage.removeItem('autoshop-pro:cloud-session'));
await B.page.reload();
await ready(B);
await B.page.getByText('You’re signed out').waitFor();
await B.page.evaluate((id) => window.__autoshop.update((s) => { s.orders.find((o) => o.id === id).concern += ' [while signed out]'; }), ro.id);
ok((await B.page.evaluate(() => window.__autoshop.sync()?.status.pending)) >= 1, 'edits wait while signed out');
await signIn(B, 'jordan@shop.test', 'jordans-own-pass');
await B.page.waitForURL((u) => !u.pathname.endsWith('/signin'), { timeout: 30000 });
await until(async () => [...cloud.db.records.values()].find((r) => r.id === ro.id)?.data?.concern.includes('[while signed out]'), 'signed-out edit pushed after sign-in', 20000);
ok(true, 'signed-out edits sync after signing back in');

// ---- Removed login can't sync.
await A.page.goto(APP + '/team?tab=access');
await A.page.locator('li', { hasText: 'Jordan Blake' }).getByRole('button', { name: /Remove/ }).click();
await A.page.getByText('Jordan Blake can no longer sign in').waitFor();
ok([...cloud.db.users.values()].find((u) => u.email === 'jordan@shop.test').banned, 'owner removed the advisor’s login');

console.log('cloud calls:', cloud.db.calls.length);
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO PAGE ERRORS');
await browser.close();
