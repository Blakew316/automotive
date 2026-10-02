// Phase G: business texting & calling — connect the number, two-way texts with delivery receipts,
// picture messages, new contacts, STOP, the incoming-call screen pop, voicemail and AI receptionist
// calls in the conversation, click-to-call, missed calls on Today, automatic reminders, bulk sends.
import { launch, APP, OUT } from '../support/env.mjs';
import { fakeCloud } from '../support/fakecloud.mjs';
const CLOUD = 'https://huwcrbkplpudpsfczbyg.supabase.co';
const SP = OUT;
const browser = await launch();
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };
const errors = [];
const cloud = fakeCloud();
cloud.addUser('owner@shop.test', 'owner-pass-123', { autoshop_staff: true, autoshop_role: 'owner', autoshop_staff_id: 'staff-owner' }, { name: 'Shop owner' });

const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 }, serviceWorkers: 'block' });
await ctx.route(CLOUD + '/**', (r) => cloud.handle(r));
await ctx.routeWebSocket(/realtime/, (ws) => ws.close());
await ctx.addInitScript(() => document.addEventListener('click', (e) => { const a = e.target.closest?.('a[href^="sms:"],a[href^="mailto:"],a[href^="tel:"]'); if (a) e.preventDefault(); }, true));
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|WebSocket|realtime|net::ERR/.test(m.text()) && errors.push(`console ${page.url()}: ${m.text()}`));
const state = async () => { await page.waitForFunction(() => window.__autoshop); return page.evaluate(() => window.__autoshop.state()); };
const poll = () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
const until = async (fn, msg, ms = 8000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await fn()) return true;
    await poll();
    await page.waitForTimeout(250);
  }
  throw new Error('timeout: ' + msg);
};
const ten = (p) => String(p || '').replace(/\D/g, '').slice(-10);

await page.goto(APP + '/signin');
await page.getByLabel('Email').fill('owner@shop.test');
await page.getByLabel('Password').fill('owner-pass-123');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL(/settings\?tab=cloud/);

// ---- Setup: not configured → steps; configured → connect.
await page.goto(APP + '/settings?tab=messaging');
await page.getByText('Business texting & calls').waitFor();
ok(await page.getByText('Add the Account SID, Auth token and the number in').count() === 1, 'setup steps shown before Twilio keys are added');
cloud.db.phone.configured = true;
await page.reload();
await page.getByRole('button', { name: 'Connect (512) 555-0100' }).click();
await page.getByText(/Connected · \(512\) 555-0100/).waitFor();
ok(cloud.db.phone.connected, 'owner connects the number');
await page.getByLabel('Phone name').fill('Front counter');
await page.getByLabel('Phone number to ring').fill('(512) 555-0111');
await page.getByRole('button', { name: 'Add', exact: true }).click();
await page.getByRole('radio', { name: /Answers every call/ }).check();
await page.getByLabel('What the receptionist should know').fill('Diagnostic fee is $149.');
await page.getByLabel('What the receptionist should know').blur();
let s = await state();
ok(s.shop.phoneLine.forward[0].number === '(512) 555-0111' && s.shop.phoneLine.receptionist === 'always' && s.shop.phoneLine.knowledge === 'Diagnostic fee is $149.', 'ring phones, receptionist mode and knowledge saved');
await until(async () => {
  const f = cloud.db.files.get('phone/profile.json');
  if (!f) return false;
  const pr = JSON.parse(f.body.toString());
  return pr.line.forward[0]?.number === '+15125550111' && pr.line.knowledge === 'Diagnostic fee is $149.' && pr.directory.length > 0 && pr.shop.name === s.shop.name;
}, 'profile published');
const profile = JSON.parse(cloud.db.files.get('phone/profile.json').body.toString());
ok(profile.directory.every((d) => /^\d{10}$/.test(d.p) && !('email' in d)) && profile.directory.some((d) => d.orders.length), 'caller directory: numbers, first names and open ROs only');
await page.screenshot({ path: `${SP}/shots/g-settings.png`, fullPage: true });

// ---- Two-way texting in Messages.
const ro = s.orders.find((o) => o.status === 'in_progress' && s.customers.find((c) => c.id === o.customerId)?.phone);
const cust = s.customers.find((c) => c.id === ro.customerId);
await page.goto(APP + `/messages/${cust.id}`);
await page.getByLabel('Message', { exact: true }).fill('Your truck will be ready at 4.');
await page.getByRole('button', { name: 'Send', exact: true }).click();
await until(async () => cloud.db.sms.some((m) => m.body === 'Your truck will be ready at 4.' && ten(m.to) === ten(cust.phone)), 'text sent through the line');
const sid = cloud.db.sms.at(-1).sid;
await page.getByText('Your truck will be ready at 4.', { exact: true }).waitFor();
ok((await page.getByLabel('Message', { exact: true }).inputValue()) === '', 'reply box clears after sending');
cloud.phoneEvent('sms_status', sid, { status: 'delivered', to: cust.phone });
await until(async () => (await page.getByText('Delivered').count()) > 0, 'delivery receipt shown');
ok(!cloud.db.phoneEvents.some((e) => e.sid === sid), 'handled events are cleared from the server');

// Incoming picture message.
cloud.db.files.set('phone/mms/SMin1-0.jpeg', { type: 'image/jpeg', body: Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64') });
cloud.phoneEvent('sms_in', 'SMin1', { from: `+1${ten(cust.phone)}`, body: 'Here is the noise I mean', media: [{ path: 'phone/mms/SMin1-0.jpeg', type: 'image/jpeg', size: 100 }], at: new Date().toISOString() });
await until(async () => (await page.getByText('Here is the noise I mean', { exact: true }).count()) > 0, 'incoming text appears in the thread');
await until(async () => (await page.locator('img[alt="Picture from the customer"][src^="blob:"]').count()) === 1, 'texted photo loads from private storage');
s = await state();
const newest = s.orders.filter((o) => o.customerId === cust.id && o.status !== 'closed').sort((a, b) => b.number - a.number)[0];
ok(s.messages.find((m) => m.id === 'msg_tw_SMin1')?.orderId === newest.id, 'incoming text linked to the customer’s newest open repair order');

// Someone new texts the shop.
cloud.phoneEvent('sms_in', 'SMin2', { from: '+15125550177', body: 'Do you do alignments?', media: [], at: new Date().toISOString() });
await until(async () => (await state()).customers.some((c) => c.id === 'cus_ph_5125550177'), 'new texter becomes a contact');
s = await state();
const newbie = s.customers.find((c) => c.id === 'cus_ph_5125550177');
ok(newbie.tags.includes('New contact') && newbie.phone === '(512) 555-0177', 'new contact has the number and a tag');

// STOP.
cloud.db.phone.optOuts.push('+15125550177');
cloud.phoneEvent('sms_in', 'SMin3', { from: '+15125550177', body: 'STOP', optOut: 'stop', media: [], at: new Date().toISOString() });
await until(async () => (await state()).customers.find((c) => c.id === 'cus_ph_5125550177').textOptIn === false, 'STOP turns texts off for the contact');
await page.goto(APP + '/messages/cus_ph_5125550177');
await page.getByText(/replied STOP — texts are blocked/).waitFor();
await page.getByLabel('Message', { exact: true }).fill('hello?');
ok(await page.getByRole('button', { name: 'Send', exact: true }).isDisabled(), 'can’t text someone who replied STOP');

// ---- Incoming call: screen pop, then voicemail.
await page.goto(APP + '/');
cloud.phoneEvent('call', 'CA9', { from: `+1${ten(cust.phone)}`, to: '+15125550100', direction: 'in', status: 'ringing', startedAt: new Date().toISOString() }, false);
await until(async () => (await page.getByRole('alertdialog', { name: `Incoming call from ${[cust.firstName, cust.lastName].filter(Boolean).join(' ') || cust.company}` }).count()) === 1, 'screen pop shows who is calling');
const pop = page.getByRole('alertdialog');
ok((await pop.getByRole('link', { name: `RO #${newest.number}` }).count()) === 1, 'screen pop links the open repair order');
await page.screenshot({ path: `${SP}/shots/g-pop.png` });
cloud.db.files.set('phone/voicemail/CA9.mp3', { type: 'audio/mpeg', body: Buffer.from('ID3') });
cloud.phoneEvent('call', 'CA9', { status: 'missed', voicemailPath: 'phone/voicemail/CA9.mp3', voicemailSeconds: 14, voicemailText: 'Call me back about the brakes', textedBack: true, seconds: 30, endedAt: new Date().toISOString() }, true);
await until(async () => (await page.getByRole('alertdialog').count()) === 0, 'screen pop closes when the call ends');
await until(async () => (await page.getByText('1 missed call to return').count()) === 1, 'Today shows the missed call to return');
await page.goto(APP + `/messages/${cust.id}`);
const card = page.getByTestId('call-entry').last();
await card.getByText('Voicemail').waitFor();
ok((await card.getByText('“Call me back about the brakes”').count()) === 1 && (await card.getByText('Missed-call text sent').count()) === 1, 'voicemail transcript and missed-call text shown');
await until(async () => (await card.locator('audio[src^="blob:"]').count()) === 1, 'voicemail plays from private storage');
await page.screenshot({ path: `${SP}/shots/g-thread.png` });
await page.goto(APP + '/messages');
ok((await page.getByRole('tab', { name: /Call back/ }).textContent()).includes('1'), 'Messages shows one customer to call back');

// ---- AI receptionist call with an appointment request.
const other = s.customers.find((c) => c.phone && c.id !== cust.id && !c.id.startsWith('cus_ph_'));
cloud.phoneEvent('call', 'CA10', {
  from: `+1${ten(other.phone)}`, direction: 'in', status: 'receptionist', receptionist: true, startedAt: new Date().toISOString(),
  turns: [{ who: 'assistant', text: 'Thanks for calling. How can I help?' }, { who: 'caller', text: 'I need brakes looked at Tuesday morning.' }, { who: 'assistant', text: 'I have a request for Tuesday morning. The shop will text to confirm.' }, { who: 'caller', text: 'Thanks, bye.' }],
  summary: 'Asked for a brake inspection Tuesday morning; request sent to the calendar.', message: '', appointment: { name: other.firstName, vehicle: '2017 Honda Civic', service: 'brake inspection', date: '2026-10-06', window: 'Morning' }, seconds: 75,
}, true);
cloud.db.inbox.push({ id: 'inb-phone-1', kind: 'booking', ref: null, created_at: new Date().toISOString(), payload: { source: 'phone', name: other.firstName, phone: other.phone, vehicle: '2017 Honda Civic', services: ['brake inspection'], start: '2026-10-06T13:00:00.000Z', window: 'Morning', duration: 60, notes: 'Requested by phone with the AI receptionist' } });
await page.goto(APP + `/messages/${other.id}`);
await until(async () => (await page.getByText('AI receptionist took the call').count()) === 1, 'receptionist call filed in the conversation');
await page.getByTestId('call-entry').getByText('Asked for a brake inspection Tuesday morning; request sent to the calendar.').waitFor();
await page.getByRole('button', { name: 'Show conversation (4)' }).click();
ok((await page.getByText('I need brakes looked at Tuesday morning.').count()) === 1, 'full call transcript available');
await page.goto(APP + '/calendar');
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await page.getByText(/by phone \(AI receptionist\)/).waitFor({ timeout: 70000 });
ok(true, 'phone appointment request waits in Calendar → Requests');

// ---- Click-to-call from the customer page.
await page.goto(APP + `/customers/${cust.id}`);
await page.getByRole('button', { name: `Call ${[cust.firstName, cust.lastName].filter(Boolean).join(' ') || cust.company}` }).first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${SP}/shots/g-calldlg.png` });
const dlg = page.getByRole('dialog', { name: /^Call / });
ok(await dlg.getByRole('radio', { name: /Front counter/ }).isChecked(), 'ring phone defaults to the first listed phone');
await dlg.getByRole('button', { name: 'Call', exact: true }).click();
await until(async () => cloud.db.dials.length === 1, 'call placed');
ok(cloud.db.dials[0].ring === '+15125550111' && ten(cloud.db.dials[0].to) === ten(cust.phone), 'rings the counter phone, then the customer');
s = await state();
ok(s.messages.some((m) => m.channel === 'call' && m.dir === 'out' && m.customerId === cust.id), 'outgoing call logged');
await page.goto(APP + '/');
await poll();
await page.waitForTimeout(300);
ok((await page.getByText(/missed call.* to return/).count()) === 0, 'calling back clears the missed call');

// ---- Template composer sends through the line.
await page.goto(APP + `/messages/${cust.id}`);
await page.getByRole('button', { name: 'Status update' }).click();
const compose = page.getByRole('dialog', { name: /^Message / });
await compose.getByLabel('Message').fill('Quick update: brakes are done.');
await compose.getByRole('button', { name: 'Send text' }).click();
await page.getByText('Text sent from (512) 555-0100').waitFor();
ok(cloud.db.sms.at(-1).body === 'Quick update: brakes are done.', 'template composer sends from the business number');

// ---- Automatic appointment reminders.
await page.goto(APP + '/marketing?tab=auto');
await page.getByRole('switch', { name: 'Send day-before reminder automatically' }).click();
s = await state();
ok(s.shop.phoneLine.autoReminder === true, 'automatic reminders turned on from Marketing');
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(15, 0, 0, 0);
await page.evaluate(({ start, customerId }) => window.__autoshop.update((st) => { st.appointments.push({ id: 'apt-test-1', customerId, vehicleId: null, start, duration: 60, title: 'Oil change', status: 'scheduled', notes: '', createdAt: new Date().toISOString() }); }), { start: tomorrow.toISOString(), customerId: cust.id });
await until(async () => [...cloud.db.outbox.values()].some((r) => r.key.startsWith('appt-reminder:apt-test-1:') && r.status === 'pending'), 'reminder queued on the server', 10000);
const q = [...cloud.db.outbox.values()].find((r) => r.key.startsWith('appt-reminder:apt-test-1:'));
const at = new Date(q.send_at);
ok(at.getHours() === 10 || at <= new Date(Date.now() + 60_000), 'reminder scheduled for 10 AM the day before');
ok(ten(q.to_phone) === ten(cust.phone) && q.body.includes(cust.firstName || 'there'), 'reminder addressed and personalized');
await page.evaluate(() => window.__autoshop.update((st) => { st.appointments = st.appointments.filter((a) => a.id !== 'apt-test-1'); }));
await until(async () => cloud.db.outbox.get(q.key).status === 'cancelled', 'removing the appointment cancels its reminder', 10000);
// Sent by the server → shows up in the conversation.
cloud.phoneEvent('sms_out', 'SMauto1', { to: `+1${ten(cust.phone)}`, body: 'Reminder: see you tomorrow at 3 PM', automation: 'reminder', template: 'appt', appointmentId: 'apt-x', key: 'appt-reminder:apt-x:2026-10-02', at: new Date().toISOString() });
await page.goto(APP + `/messages/${cust.id}`);
await until(async () => (await page.getByText('Automatic reminder').count()) > 0, 'server-sent reminder filed as an automatic text');

// ---- Bulk follow-ups go out in one pass.
const before = cloud.db.sms.length;
await page.goto(APP + '/marketing?tab=auto');
const card2 = page.locator('section.card', { hasText: 'Service due reminder' });
if (await card2.getByRole('button', { name: 'Send' }).isEnabled()) {
  await card2.getByRole('button', { name: 'Send' }).click();
  const qd = page.getByRole('dialog');
  const btn = qd.getByRole('button', { name: /^Send \d+ texts?$/ });
  const n = Number((await btn.textContent()).match(/\d+/)[0]);
  await btn.click();
  await qd.getByRole('button', { name: 'Done' }).waitFor();
  ok(cloud.db.sms.length - before === n, `follow-up batch sent in one pass (${n})`);
  await qd.getByRole('button', { name: 'Done' }).click();
} else ok(true, 'no service reminders due (batch send skipped)');

ok(errors.length === 0, `no page errors${errors.length ? ':\n' + errors.join('\n') : ''}`);
await browser.close();
console.log('PHASE G PASS');
