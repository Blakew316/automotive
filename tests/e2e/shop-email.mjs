// Email from the shop's own address: keys, domain verification, a test email, PDF estimates and
// invoices attached from the RO, delivery tracking (delivered, opened, bounced), bulk emails from
// Marketing, PDF downloads and the owner's daily summary.
import { launch, APP, OUT } from '../support/env.mjs';
import { fakeCloud } from '../support/fakecloud.mjs';
const CLOUD = 'https://huwcrbkplpudpsfczbyg.supabase.co';
const browser = await launch();
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const errors = [];
const cloud = fakeCloud();
cloud.addUser('owner@shop.test', 'owner-pass-123', { autoshop_staff: true, autoshop_role: 'owner', autoshop_staff_id: 'staff-owner' }, { name: 'Shop owner' });

const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 }, serviceWorkers: 'block', acceptDownloads: true });
await ctx.route(CLOUD + '/**', (r) => cloud.handle(r));
await ctx.routeWebSocket(/realtime/, (ws) => ws.close());
await ctx.addInitScript(() => document.addEventListener('click', (e) => { const a = e.target.closest?.('a[href^="sms:"],a[href^="mailto:"],a[href^="tel:"]'); if (a) e.preventDefault(); }, true));
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
const pdfOk = (b64) => Buffer.from(b64, 'base64').subarray(0, 5).toString() === '%PDF-';

await page.goto(APP + '/signin');
await page.getByLabel('Email').fill('owner@shop.test');
await page.getByLabel('Password').fill('owner-pass-123');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL(/settings\?tab=cloud/);

// ---- Before setup: emails open in the Mail app, with the PDF to download.
let s = await state();
const est = s.orders.find((o) => o.status === 'estimate' && s.customers.find((c) => c.id === o.customerId)?.email);
await page.goto(APP + `/orders/${est.id}`);
await page.getByRole('button', { name: 'Send' }).click();
await page.getByRole('button', { name: 'Email estimate' }).click();
let dlg = page.getByRole('dialog', { name: /^Message / });
await dlg.getByText('Opens your email app with this message ready to send.').waitFor();
const [dl] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: /Download the estimate PDF/ }).click()]);
ok(/^Estimate-\d+-.+\.pdf$/.test(dl.suggestedFilename()), `PDF to attach by hand: ${dl.suggestedFilename()}`);
await dlg.getByRole('button', { name: 'Cancel' }).click();

// ---- Settings → Messaging: the steps.
await page.goto(APP + '/settings?tab=messaging');
const sec = page.locator('#email');
await sec.getByTestId('email-settings').waitFor();
ok((await sec.getByText('Create a free account at').count()) === 1, 'setup steps shown');

// Keys & AI: API key, sending address, reply-to.
await page.goto(APP + '/settings?tab=keys');
await page.getByText('Email from your address (Resend)').waitFor();
const saveKey = async (label, value) => {
  const input = page.getByLabel(label, { exact: true });
  await input.fill(value);
  await input.locator('xpath=ancestor::form').getByRole('button', { name: 'Save' }).click();
  await until(async () => (await input.inputValue()) === '', `${label} saved`);
};
await saveKey('API key', 're_test_1234567890abcdef');
await saveKey('Send from', 'Main Street Auto <service@mainstreetauto.com>');
await saveKey('Replies go to', 'office@mainstreetauto.com');
ok(cloud.db.secrets.get('resend_api_key').value === 're_test_1234567890abcdef' && cloud.db.secrets.get('email_from').value.includes('service@mainstreetauto.com'), 'Resend key and address saved on the server');
await page.getByText('Main Street Auto <service@mainstreetauto.com>').waitFor();

// Domain: add it, see its DNS records, verify.
await page.goto(APP + '/settings?tab=messaging#email');
await sec.getByRole('button', { name: 'Add mainstreetauto.com' }).click();
await sec.getByTestId('dns-records').waitFor();
ok((await sec.getByTestId('dns-records').locator('tbody tr').count()) === 3, 'DNS records to add are listed');
ok((await sec.getByTestId('email-webhook').textContent()).endsWith('/functions/v1/email-webhook'), 'webhook address shown');
await sec.getByRole('button', { name: 'Check DNS records' }).click();
await sec.getByText('Waiting').first().waitFor();
ok((await sec.getByText('Until the domain is verified').count()) === 1, 'not verified yet: emails keep opening in Mail');
cloud.db.email.dnsReady = true;
await sec.getByRole('button', { name: 'Check DNS records' }).click();
await sec.getByText(/Customer emails now come from/).waitFor();
ok((await sec.getByText('Verified').count()) === 3, 'all records verified');
await page.screenshot({ path: `${OUT}/shots/j4-email-settings.png`, fullPage: true });

// Test email.
await sec.getByRole('button', { name: 'Send me a test' }).click();
await page.getByText('Test sent to owner@shop.test').waitFor();
ok(cloud.db.email.tests.length === 1 && cloud.db.email.tests[0].to === 'owner@shop.test', 'test email sent to the signed-in owner');

// Daily summary.
const dg = sec.getByTestId('digest-settings');
await dg.getByRole('switch', { name: 'Daily summary email' }).click();
await until(async () => cloud.db.email.digest.enabled, 'daily summary turned on');
await dg.getByLabel('Send at').selectOption('19');
await until(async () => cloud.db.email.digest.hour === 19, 'summary hour saved');
await dg.getByLabel('To (comma-separated)').fill('owner@shop.test, partner@shop.test');
await dg.getByLabel('To (comma-separated)').blur();
await until(async () => cloud.db.email.digest.recipients.length === 2, 'summary recipients saved');
ok(cloud.db.email.digest.tz.includes('/'), `summary in the shop's time zone (${cloud.db.email.digest.tz})`);
await until(async () => cloud.db.email.snapshot?.today && cloud.db.email.snapshotDay, "today's numbers kept current for the summary", 20000);
ok(typeof cloud.db.email.snapshot.today.sales === 'number' && Array.isArray(cloud.db.email.snapshot.attention), 'summary numbers: sales, in the shop, estimates, attention');

// ---- Email the estimate from the RO: sent from the shop's address with the PDF attached.
await page.goto(APP + `/orders/${est.id}`);
await page.getByRole('button', { name: 'Send' }).click();
await page.getByRole('button', { name: 'Email estimate' }).click();
dlg = page.getByRole('dialog', { name: /^Message / });
await dlg.getByText(/Sends from/).waitFor();
ok((await dlg.getByLabel('Subject').inputValue()).startsWith(`Your estimate — RO #${est.number}`), 'subject names the document and RO');
ok(await dlg.getByRole('checkbox', { name: /Attach the estimate as a PDF/ }).isChecked(), 'estimate PDF attached by default');
await dlg.getByRole('button', { name: 'Send email' }).click();
await page.getByText(/Email sent to .* with the estimate/).waitFor();
const sent = cloud.db.email.sent.at(-1);
const cust = s.customers.find((c) => c.id === est.customerId);
ok(sent.to === cust.email && sent.attachments.length === 1 && /^Estimate-\d+-/.test(sent.attachments[0].filename) && pdfOk(sent.attachments[0].content), 'server email carries a real PDF estimate');
ok(sent.shop.name === s.shop.name && sent.kind === 'estimate', 'shop details and kind sent');
s = await state();
const msg = s.messages.find((m) => m.meta?.emailId === sent.id);
ok(msg && msg.channel === 'email' && msg.meta.status === 'sent' && msg.meta.subject && msg.meta.attachments?.[0] === sent.attachments[0].filename, 'logged to the conversation with subject and attachment');

// Delivery tracking.
cloud.emailEvent(sent.id, 'delivered', { at: new Date().toISOString() });
await until(async () => (await state()).messages.find((m) => m.id === msg.id).meta.status === 'delivered', 'delivered');
cloud.emailEvent(sent.id, 'opened', { at: new Date().toISOString() });
await until(async () => (await state()).messages.find((m) => m.id === msg.id).meta.status === 'opened', 'opened');
await until(async () => cloud.db.emailEvents.length === 0, 'handled events cleared from the server');
await page.goto(APP + `/messages/${cust.id}`);
await page.getByText(/·\s*Opened$/).first().waitFor();
ok((await page.getByText(sent.attachments[0].filename).count()) === 1, 'attachment shown on the message');
await page.screenshot({ path: `${OUT}/shots/j4-thread.png` });

// A bounce flags the address and a later "delivered" doesn't hide it.
const other = s.orders.find((o) => ['ready', 'closed'].includes(o.status) && o.customerId !== cust.id && s.customers.find((c) => c.id === o.customerId)?.email);
const otherCust = s.customers.find((c) => c.id === other.customerId);
await page.goto(APP + `/orders/${other.id}`);
await page.getByRole('button', { name: 'Send' }).click();
await page.getByRole('button', { name: /^Email (invoice|receipt)/ }).click();
dlg = page.getByRole('dialog', { name: /^Message / });
ok(await dlg.getByRole('checkbox', { name: /Attach the (invoice|receipt) as a PDF/ }).isChecked(), 'invoice PDF attached by default');
await dlg.getByRole('button', { name: 'Send email' }).click();
await page.getByText(/Email sent to/).waitFor();
const sent2 = cloud.db.email.sent.at(-1);
ok(/^(Invoice|Receipt)-\d+-/.test(sent2.attachments[0].filename) && pdfOk(sent2.attachments[0].content), `invoice PDF attached (${sent2.attachments[0].filename})`);
cloud.emailEvent(sent2.id, 'bounced', { at: new Date().toISOString(), bounce: { type: 'Permanent', message: 'Mailbox does not exist' } });
await until(async () => (await state()).customers.find((c) => c.id === otherCust.id).emailProblem === 'bounced', 'bounce flags the customer');
cloud.emailEvent(sent2.id, 'delivered', {});
await page.waitForTimeout(600);
await poll();
await page.waitForTimeout(600);
ok((await state()).messages.find((m) => m.meta?.emailId === sent2.id).meta.status === 'bounced', 'a later event does not hide the bounce');
await page.goto(APP + `/customers/${otherCust.id}`);
await page.getByText('Bounced', { exact: true }).waitFor();
ok(true, 'customer page shows the bounced address');

// ---- A campaign by email goes out from the shop's address in one pass (the bounced address is left out).
await page.goto(APP + '/marketing?tab=campaigns');
await page.getByRole('tab', { name: 'Email' }).click();
await page.getByRole('button', { name: 'Review & send' }).click();
const qd = page.getByRole('dialog');
const go = qd.getByRole('button', { name: /^Send \d+ emails?$/ });
await go.waitFor();
ok((await qd.getByLabel('Subject').count()) === 1, 'campaign opens on email, as chosen in the form');
const before = cloud.db.email.sent.length;
const n = Number((await go.textContent()).match(/\d+/)[0]);
await go.click();
await qd.getByRole('button', { name: 'Done' }).waitFor();
const batch = cloud.db.email.sent.slice(before);
ok(n > 1 && batch.length === n && batch.every((e) => e.to !== otherCust.email && e.kind === 'campaign' && !e.text.includes('{first}')), `campaign emails personalized and sent from the shop's address (${n}), bounced address skipped`);
await qd.getByRole('button', { name: 'Done' }).click();

// ---- Download PDF from the print view.
await page.goto(APP + `/orders/${other.id}/print`);
const [dl2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PDF' }).click()]);
ok(/^(Invoice|Receipt)-\d+-.+\.pdf$/.test(dl2.suggestedFilename()), `print view downloads the PDF (${dl2.suggestedFilename()})`);

// ---- Integrations shows email as on.
await page.goto(APP + '/integrations');
await page.locator('section.card', { hasText: 'Email from your address' }).getByText('On', { exact: true }).waitFor();
ok(true, 'Integrations lists email from your address as on');

ok(errors.length === 0, `no page errors${errors.length ? ':\n' + errors.join('\n') : ''}`);
await browser.close();
console.log('J4 EMAIL PASS');
