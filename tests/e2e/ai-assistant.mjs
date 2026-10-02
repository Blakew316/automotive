// Phase F: integration keys (stored server-side, never shown again) and the AI assistant on repair
// orders, messages and customers.
import { launch, APP, OUT } from '../support/env.mjs';
import { fakeCloud } from '../support/fakecloud.mjs';
const CLOUD = 'https://huwcrbkplpudpsfczbyg.supabase.co';
const SP = OUT;
const browser = await launch();
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const errors = [];
const cloud = fakeCloud();
cloud.addUser('owner@shop.test', 'owner-pass-123', { autoshop_staff: true, autoshop_role: 'owner', autoshop_staff_id: 'staff-owner' }, { name: 'Shop owner' });
const KEY = 'sk-ant-api03-TESTKEY-ZZZZ-9876';

const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 }, serviceWorkers: 'block' });
await ctx.route(CLOUD + '/**', (r) => cloud.handle(r));
await ctx.addInitScript(() => document.addEventListener('click', (e) => { const a = e.target.closest?.('a[href^="sms:"],a[href^="mailto:"]'); if (a) e.preventDefault(); }, true));
const page = await ctx.newPage();
const bodies = [];
page.on('response', async (r) => { if (r.url().includes('/functions/v1/')) bodies.push(await r.text().catch(() => '')); });
page.on('pageerror', (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|WebSocket|realtime|net::ERR/.test(m.text()) && errors.push(`console ${page.url()}: ${m.text()}`));
const state = async () => { await page.waitForFunction(() => window.__autoshop); return page.evaluate(() => window.__autoshop.state()); };

await page.goto(APP + '/signin');
await page.getByLabel('Email').fill('owner@shop.test');
await page.getByLabel('Password').fill('owner-pass-123');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL(/settings\?tab=cloud/);

// ---- Assistant before setup → points the owner to the keys screen.
let s = await state();
const ro = s.orders.find((o) => o.status === 'in_progress' && o.services.length && o.concern) || s.orders.find((o) => o.status === 'in_progress');
await page.goto(APP + `/orders/${ro.id}`);
await page.getByRole('button', { name: 'Assistant' }).click();
await page.getByRole('button', { name: /Explain the estimate/ }).click();
await page.getByText(/isn’t set up yet/).waitFor();
ok(await page.getByRole('link', { name: 'Set it up' }).count() === 1, 'not set up yet → owner gets a link to set it up');
await page.getByRole('link', { name: 'Set it up' }).click();
await page.waitForURL(/settings\?tab=keys/);

// ---- Keys & AI settings.
await page.getByText('Add an Anthropic API key below to turn it on').waitFor();
await page.getByLabel('Anthropic API key', { exact: true }).fill(KEY);
await page.getByLabel('Anthropic API key', { exact: true }).press('Enter');
await page.getByText('Set · ••••9876').waitFor();
ok(cloud.db.secrets.get('anthropic_api_key')?.value === KEY, 'key saved on the server');
ok(!bodies.some((b) => b.includes(KEY)), 'the key never came back from the server');
ok((await page.getByLabel('Anthropic API key', { exact: true }).inputValue()) === '', 'the field clears after saving');
ok(!(await page.content()).includes(KEY), 'the key is nowhere on the page');
await page.getByLabel('Model').selectOption('claude-haiku-4-5');
await page.waitForTimeout(400);
ok(cloud.db.secrets.get('ai_model')?.value === 'claude-haiku-4-5', 'model choice saved');
await page.getByLabel('Monthly limit (requests)').fill('250');
await page.getByLabel('Monthly limit (requests)').blur();
await page.waitForTimeout(400);
ok(cloud.db.secrets.get('ai_monthly_cap')?.value === '250', 'monthly limit saved');
await page.getByText(/On · 0 requests this month/).waitFor();
await page.getByLabel('Account SID', { exact: true }).fill('AC123');
await page.getByLabel('Account SID', { exact: true }).press('Enter');
await page.waitForTimeout(400);
ok(cloud.db.secrets.get('twilio_account_sid')?.value === 'AC123', 'other integration keys can be stored ahead of time');
await page.screenshot({ path: `${SP}/shots/f-keys.png`, fullPage: true });

// ---- RO assistant: explain → use in a message.
await page.goto(APP + `/orders/${ro.id}`);
await page.getByRole('button', { name: 'Assistant' }).click();
await page.getByRole('button', { name: /Explain the estimate/ }).click();
await page.getByTestId('ai-result').waitFor();
const call = cloud.db.aiCalls.at(-1);
const cust = s.customers.find((c) => c.id === ro.customerId);
ok(call.task === 'explain' && call.context.includes(`Repair order #${ro.number}`) && call.shop === s.shop.name, 'RO details sent with the task');
ok(!call.context.includes(cust.email) && !call.context.includes(cust.phone), 'customer email and phone are not sent');
await page.screenshot({ path: `${SP}/shots/f-assistant.png` });
await page.getByRole('button', { name: 'Use in a message' }).click();
ok((await page.getByLabel('Message', { exact: true }).inputValue()).includes('Needs attention now'), 'answer opens in the message composer');
await page.keyboard.press('Escape');

// Cause & correction → added to the service.
await page.getByRole('button', { name: 'Assistant' }).click();
await page.getByRole('radio', { name: 'Cause & correction' }).click();
const svc = ro.services.find((x) => x.status !== 'declined');
await page.getByRole('dialog', { name: 'AI assistant' }).locator('select').selectOption(svc.id);
await page.getByRole('button', { name: /Write cause & correction/ }).click();
await page.getByRole('button', { name: 'Add to the service' }).click();
s = await state();
const updated = s.orders.find((o) => o.id === ro.id).services.find((x) => x.id === svc.id);
ok(/Front pads worn/.test(updated.cause) && /Replaced front pads/.test(updated.correction), 'cause & correction written onto the service');
ok(cloud.db.aiCalls.at(-1).context.includes(svc.title) && !cloud.db.aiCalls.at(-1).context.includes('Services:\n- ' + ro.services.find((x) => x.id !== svc.id)?.title), 'only the chosen service is sent for cause & correction');

// Diagnose → save as note; ask a question.
await page.getByRole('button', { name: 'Assistant' }).click();
await page.getByRole('radio', { name: 'Diagnostic ideas' }).click();
await page.getByRole('button', { name: /Diagnostic ideas for the tech/ }).click();
await page.getByRole('button', { name: 'Save as note' }).click();
s = await state();
ok(s.orders.find((o) => o.id === ro.id).notes[0].text.startsWith('Diagnostic ideas (AI draft)'), 'diagnostic ideas saved as an internal note');
await page.getByRole('radio', { name: 'Ask', exact: true }).click();
await page.getByLabel('Your question').fill('What should I check first?');
await page.getByRole('button', { name: 'Ask anything' }).click();
await page.getByText('Answer: based on the data').waitFor();
ok(cloud.db.aiCalls.at(-1).prompt === 'What should I check first?', 'question sent with the RO');
await page.getByRole('button', { name: 'Close assistant' }).click();

// ---- Messages: suggest a reply.
const thread = s.messages.find((m) => m.dir === 'in')?.customerId;
await page.goto(APP + `/messages/${thread}`);
await page.getByRole('button', { name: 'Suggest reply' }).click();
await page.getByRole('button', { name: /Suggest a reply/ }).click();
await page.getByRole('button', { name: 'Use in a message' }).click();
ok((await page.getByLabel('Message', { exact: true }).first().inputValue()).includes('ready by 4 PM'), 'suggested reply fills the reply box');
ok(cloud.db.aiCalls.at(-1).task === 'reply' && /Customer \(/.test(cloud.db.aiCalls.at(-1).context), 'conversation sent for the reply');

// ---- Customer summary.
await page.goto(APP + `/customers/${thread}`);
await page.getByRole('button', { name: 'More', exact: true }).click();
await page.getByRole('button', { name: 'Summarize with AI' }).click();
await page.getByRole('button', { name: /Summarize this customer/ }).click();
await page.getByText('Loyal customer since 2024').waitFor();
ok(cloud.db.aiCalls.at(-1).context.startsWith('Customer:'), 'customer history sent for the summary');
await page.getByRole('button', { name: 'Close assistant' }).click();

// ---- Removing the key turns it off again.
await page.goto(APP + '/settings?tab=keys');
await page.getByRole('button', { name: 'Remove Anthropic API key' }).click();
await page.getByText('Add an Anthropic API key below to turn it on').waitFor();
ok(!cloud.db.secrets.get('anthropic_api_key')?.value, 'key removed');

ok(errors.length === 0, `no page errors${errors.length ? ':\n' + errors.join('\n') : ''}`);
await browser.close();
console.log('PHASE F PASS');
