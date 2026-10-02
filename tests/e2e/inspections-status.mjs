// Phase B: live status page, tread/pad gauges, dictation and photo markup.
import { launch, APP, OUT } from '../support/env.mjs';
import { fakeCloud } from '../support/fakecloud.mjs';
const CLOUD = 'https://huwcrbkplpudpsfczbyg.supabase.co';
const SP = OUT;
const browser = await launch();
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const errors = [];
const cloud = fakeCloud();
cloud.addUser('owner@shop.test', 'owner-pass-123', { autoshop_staff: true, autoshop_role: 'owner', autoshop_staff_id: 'staff-owner' }, { name: 'Shop owner' });
async function until(fn, msg, ms = 15000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('TIMEOUT: ' + msg);
}

const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 }, serviceWorkers: 'block' });
await ctx.route(CLOUD + '/**', (r) => cloud.handle(r));
await ctx.addInitScript(() => {
  document.addEventListener('click', (e) => { const a = e.target.closest?.('a[href^="sms:"],a[href^="mailto:"]'); if (a) e.preventDefault(); }, true);
  // Stand-in for the browser's speech recognition: "hears" one phrase.
  window.SpeechRecognition = window.webkitSpeechRecognition = class {
    start() {
      setTimeout(() => {
        const res = [{ transcript: 'front pads at three millimeters' }];
        res.isFinal = true;
        this.onresult?.({ resultIndex: 0, results: [res] });
        this.onend?.();
      }, 150);
    }
    stop() { this.onend?.(); }
    abort() {}
  };
});
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|WebSocket|realtime|net::ERR/.test(m.text()) && errors.push(`console ${page.url()}: ${m.text()}`));
const state = async () => { await page.waitForFunction(() => window.__autoshop); return page.evaluate(() => window.__autoshop.state()); };

// Sign in (staff session is what publishes the status page).
await page.goto(APP + '/signin');
await page.getByLabel('Email').fill('owner@shop.test');
await page.getByLabel('Password').fill('owner-pass-123');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL(/settings\?tab=cloud/);
let s = await state();
const est = s.orders.find((o) => o.status === 'estimate' && s.customers.find((c) => c.id === o.customerId)?.phone);
ok(est, `estimate RO #${est.number} with a customer phone`);

// ---- Live status link: publish + text it.
await page.goto(APP + `/orders/${est.id}`);
await page.getByRole('button', { name: 'Send' }).click();
await page.getByRole('button', { name: 'Live status link…' }).click();
const msg = page.getByLabel('Message', { exact: true });
await msg.waitFor();
const body = await msg.inputValue();
const link = /(https?:\/\/\S+\/track\/\S+)/.exec(body)?.[1];
ok(link && link.includes('/automotive/app/track/') && link.includes('from='), `message carries the status link (${link?.slice(0, 70)}…)`);
s = await state();
const tr = s.orders.find((o) => o.id === est.id).track;
ok(tr?.id && !tr.off && tr.fp, 'order remembers its status page');
const file = () => {
  const f = cloud.db.public.get(`autoshop-media/track/${tr.id}.json`);
  return f ? JSON.parse(f.body.toString()) : null;
};
ok(file()?.status === 'estimate' && file().ro === est.number, 'status page published to the public bucket');
ok(!JSON.stringify(file()).match(/notes|cost|internal/i), 'published file has no internal notes or costs');
await page.keyboard.press('Escape');

// Customer opens the link on their phone (no shop data on that device).
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', isMobile: true });
await phone.route(CLOUD + '/**', (r) => cloud.handle(r));
const cust = await phone.newPage();
cust.on('pageerror', (e) => errors.push(`customer pageerror: ${e.message}`));
await cust.goto(link);
await cust.getByRole('heading', { name: 'Checked in & inspected' }).waitFor();
ok(await cust.getByText('Work approved').count() > 0 && await cust.getByText('Ready for pickup').count() > 0, 'timeline shows the steps ahead');
await cust.screenshot({ path: `${SP}/shots/b-track-estimate.png`, fullPage: true });
const custKeys = await cust.evaluate(async () => [Object.keys(localStorage), (await indexedDB.databases()).map((d) => d.name)]);
console.log('customer storage', JSON.stringify(custKeys));
ok(!custKeys[0].some((k) => /v2|journal/.test(k)) && !custKeys[1].includes('autoshop-data'), 'customer device stores no shop data');

// Shop moves the RO along — the page follows.
await page.evaluate((id) => window.__autoshop.update((d) => { const o = d.orders.find((x) => x.id === id); o.status = 'in_progress'; }), est.id);
await until(() => file()?.status === 'in_progress', 'republished after status change');
s = await state();
ok(s.orders.find((o) => o.id === est.id).statusLog?.some((e) => e.status === 'in_progress'), 'status change stamped in the log');
await cust.reload();
await cust.getByRole('heading', { name: 'Being worked on' }).waitFor();
ok(true, 'customer page shows the new status after refresh');
await cust.screenshot({ path: `${SP}/shots/b-track-progress.png`, fullPage: true });

// Turn it off.
await page.getByRole('button', { name: 'More', exact: true }).click();
await page.getByRole('button', { name: 'Turn off live status link' }).click();
await until(() => file()?.revoked === true, 'revoked file published');
await cust.reload();
await cust.getByText('This status page has been turned off.').waitFor();
ok(true, 'turned-off link shows a notice');
// A revoked page is not republished by later edits.
await page.evaluate((id) => window.__autoshop.update((d) => { d.orders.find((x) => x.id === id).status = 'ready'; }), est.id);
await page.waitForTimeout(2500);
ok(file()?.revoked === true, 'turned-off page stays off after more changes');

// ---- Gauges: tread + pad measurements.
const ro2 = (await state()).orders.find((o) => o.status !== 'closed' && o.id !== est.id);
await page.goto(APP + `/orders/${ro2.id}?tab=inspection`);
const vals = { 'LF tread (32nds)': '7', 'RF tread (32nds)': '5', 'LR tread (32nds)': '2', 'Front pads (mm)': '3' };
for (const [label, v] of Object.entries(vals)) {
  const input = page.getByLabel(`${label} measurement`);
  await input.fill(v);
  await input.blur();
}
await page.getByText('Tire tread').first().waitFor();
ok(await page.locator('[role=img][aria-label*="replace now"]').count() >= 1, 'gauge flags a worn tire');
ok(await page.locator('[role=img][aria-label*="good"]').count() >= 1, 'gauge shows a good tire');
s = await state();
const insp = s.orders.find((o) => o.id === ro2.id).inspection;
const key = Object.keys(insp).find((k) => insp[k].measure === 2);
ok(key && insp[key].rating === 'now', 'measurement rates the item automatically');
await page.screenshot({ path: `${SP}/shots/b-gauges.png`, fullPage: false });

// ---- Dictation on an inspection note and the RO notes.
await page.getByRole('button', { name: 'Dictate a note for Front pads (mm)' }).click();
await until(async () => {
  const st = await state();
  return Object.values(st.orders.find((o) => o.id === ro2.id).inspection).some((e) => /Front pads at three millimeters/.test(e.note || ''));
}, 'dictated inspection note saved');
ok(true, 'dictated text lands in the inspection note');
await page.goto(APP + `/orders/${ro2.id}?tab=notes`);
await page.getByRole('button', { name: 'Dictate a note' }).click();
await until(async () => /Front pads at three/.test(await page.getByPlaceholder(/Add a note/).inputValue()), 'dictated note text');
ok(true, 'dictated text lands in the note box');

// Customer report shows the tires & brakes diagram.
await page.goto(APP + `/orders/${ro2.id}/report`);
await page.getByText('Tire tread').first().waitFor();
ok(await page.getByText('Brake pads').count() > 0, 'customer report shows tires & brakes at a glance');
await page.screenshot({ path: `${SP}/shots/b-report-gauges.png`, fullPage: true });

// ---- Photo markup.
await page.goto(APP + `/orders/${ro2.id}?tab=media`);
const before = (await state()).orders.find((o) => o.id === ro2.id).media?.length || 0;
// A sample "photo", drawn in the browser so the suite needs no image files.
const photo = await page.evaluate(() => {
  const c = Object.assign(document.createElement('canvas'), { width: 1200, height: 900 });
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 1200, 900);
  grad.addColorStop(0, '#5b6470');
  grad.addColorStop(1, '#22272e');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1200, 900);
  g.fillStyle = '#9aa1a9';
  g.beginPath();
  g.arc(600, 450, 300, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3a3f46';
  g.fillRect(420, 360, 360, 180);
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
});
await page.locator('input[type=file]').first().setInputFiles({ name: 'brake-pads.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(photo, 'base64') });
await until(async () => ((await state()).orders.find((o) => o.id === ro2.id).media?.length || 0) > before, 'photo added');
s = await state();
const orig = s.orders.find((o) => o.id === ro2.id).media.at(-1);
await page.getByRole('button', { name: 'brake-pads.jpg' }).first().click();
await page.getByRole('button', { name: 'Mark up photo' }).click();
const canvas = page.getByTestId('markup-canvas');
await canvas.waitFor();
await page.waitForTimeout(300);
const box = await canvas.boundingBox();
await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.6, { steps: 10 });
await page.mouse.up();
await page.getByRole('radio', { name: 'Circle' }).click();
await page.getByRole('radio', { name: 'Yellow' }).click();
await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.8, { steps: 6 });
await page.mouse.up();
// Undo removes the last mark; draw it again.
await page.getByRole('button', { name: 'Undo' }).click();
await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.8, { steps: 6 });
await page.mouse.up();
await page.getByRole('radio', { name: 'Label' }).click();
await page.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.88);
await page.getByLabel('Label text').fill('2 mm left');
await page.keyboard.press('Enter');
await page.screenshot({ path: `${SP}/shots/b-markup.png` });
await page.getByRole('button', { name: 'Save photo' }).click();
await page.getByText(/customer sees the marked-up photo/).waitFor();
s = await state();
const media = s.orders.find((o) => o.id === ro2.id).media;
const marked = media.find((m) => m.markupOf === orig.id);
ok(marked && marked.kind === 'image' && marked.customer, 'marked-up copy saved and shown to the customer');
ok(media.find((m) => m.id === orig.id).customer === false, 'original kept, hidden from the customer');
ok(media.indexOf(marked) === media.findIndex((m) => m.id === orig.id) + 1, 'copy sits right after the original');
const stored = await page.evaluate(async (id) => {
  const db = await new Promise((r) => { const q = indexedDB.open('autoshop-media'); q.onsuccess = () => r(q.result); });
  const names = [...db.objectStoreNames];
  const rec = await new Promise((r) => { const q = db.transaction(names[0]).objectStore(names[0]).get(id); q.onsuccess = () => r(q.result); });
  return rec ? { full: rec.blob?.size, thumb: rec.thumb?.size, type: rec.blob?.type } : null;
}, marked.id);
ok(stored?.full > 5000 && stored.thumb > 500 && stored.type === 'image/jpeg', `marked-up file stored (${stored?.full} bytes)`);
await page.getByRole('button', { name: 'View the original photo' }).waitFor();
ok(true, 'viewer links back to the original');
await page.screenshot({ path: `${SP}/shots/b-markup-saved.png` });

ok(errors.length === 0, `no page errors${errors.length ? ':\n' + errors.join('\n') : ''}`);
await browser.close();
console.log('PHASE B PASS');
