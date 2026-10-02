// Runs supabase/functions/twilio-webhook and shop-phone under Node with Supabase, Twilio and
// Anthropic mocked, and requests signed the way Twilio signs them.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { transformSync } from 'esbuild';

import { OUT as SP } from '../support/env.mjs';
const URL_BASE = 'https://proj.supabase.co';
const SELF = `${URL_BASE}/functions/v1/twilio-webhook`;
const TOKEN = 'twilio-test-token-123';
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok -', m); };

// ---------------------------------------------------------------- Mock world
const world = {
  secrets: new Map(Object.entries({ twilio_account_sid: 'AC1', twilio_auth_token: TOKEN, twilio_phone: '+15125550100', anthropic_api_key: 'sk-ant-x', dispatch_secret: 'disp-secret' })),
  events: new Map(), // `${kind}:${sid}` → {payload, final}
  optouts: new Map(),
  outbox: new Map(),
  inbox: [],
  files: new Map(),
  twilio: [], // {path, form}
  anthropic: [],
  aiReplies: [],
  usage: 0,
  profile: null,
};
const key = (k, s) => `${k}:${s}`;
const res = (body, status = 200, type = 'application/json') => new Response(status === 204 ? null : typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': type } });

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
  const body = init.body;
  const jbody = () => (typeof body === 'string' ? JSON.parse(body) : {});
  if (url.origin === URL_BASE) {
    const p = url.pathname;
    if (p === '/rest/v1/rpc/shop_mfa_ok') return res(JSON.stringify(mfaOk(init)));
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.slice('/rest/v1/rpc/'.length);
      const a = jbody();
      if (fn === 'shop_secret_get') return res(JSON.stringify(world.secrets.get(a.p_name) || null));
      if (fn === 'shop_secret_set') { world.secrets.set(a.p_name, a.p_value); return res('null'); }
      if (fn === 'shop_ai_record') { world.usage += 1; return res('null'); }
      if (fn === 'shop_phone_event_merge') {
        const k = key(a.p_kind, a.p_sid);
        const cur = world.events.get(k) || { payload: {}, final: false };
        cur.payload = { ...cur.payload, ...a.p_patch };
        cur.final = cur.final || a.p_final;
        world.events.set(k, cur);
        return res(cur.payload);
      }
      if (fn === 'shop_outbox_claim') {
        const due = [...world.outbox.values()].filter((r) => r.status === 'pending' && new Date(r.send_at) <= new Date());
        due.forEach((r) => (r.status = 'sending'));
        return res(due.map((r) => ({ ...r })));
      }
      throw new Error('rpc ' + fn);
    }
    if (p === '/rest/v1/shop_phone_events') {
      const kind = url.searchParams.get('kind')?.slice(3);
      const sid = url.searchParams.get('sid')?.slice(3);
      if (method === 'GET') { const e = world.events.get(key(kind, sid)); return res(e ? [{ payload: e.payload }] : []); }
      if (method === 'DELETE') return res('', 204);
    }
    if (p === '/rest/v1/shop_sms_optouts') {
      const phone = url.searchParams.get('phone')?.slice(3);
      if (method === 'GET') return res(phone ? (world.optouts.has(phone) ? [{ phone }] : []) : [...world.optouts.keys()].map((x) => ({ phone: x })));
      if (method === 'POST') { const r = jbody(); world.optouts.set(r.phone, r.source); return res('', 201); }
      if (method === 'DELETE') { world.optouts.delete(phone); return res('', 204); }
    }
    if (p === '/rest/v1/shop_sms_outbox') {
      const k = url.searchParams.get('key')?.slice(3);
      const sidQ = url.searchParams.get('sid')?.slice(3);
      if (method === 'POST') {
        const r = jbody();
        if (world.outbox.has(r.key)) return res([]);
        world.outbox.set(r.key, { status: 'pending', meta: {}, ...r });
        return res([r], 201);
      }
      if (method === 'PATCH') {
        const patch = jbody();
        for (const r of world.outbox.values()) if ((k && r.key === k) || (sidQ && r.sid === sidQ)) Object.assign(r, patch);
        return res('', 204);
      }
      if (method === 'DELETE') return res('', 204);
    }
    if (p === '/rest/v1/shop_inbox' && method === 'POST') { world.inbox.push(jbody()); return res('', 201); }
    if (p === '/rest/v1/shop_ai_usage') return res([{ requests: world.usage }]);
    if (p === '/storage/v1/object/authenticated/autoshop-files/phone/profile.json') return world.profile ? res(world.profile) : res({ error: 'not found' }, 404);
    if (p.startsWith('/storage/v1/object/autoshop-files/')) { world.files.set(p.slice('/storage/v1/object/autoshop-files/'.length), body); return res({ Key: p }); }
    throw new Error(`unmocked ${method} ${url}`);
  }
  if (url.origin === 'https://api.twilio.com') {
    const form = body ? Object.fromEntries(new URLSearchParams(body.toString())) : null;
    world.twilio.push({ path: url.pathname + url.search, form, auth: init.headers?.Authorization });
    if (url.pathname.endsWith('/Messages.json')) {
      if (form.To === '+15125559999') return res({ code: 21211, message: 'Invalid To' }, 400);
      return res({ sid: `SM${world.twilio.length}`, status: 'queued', num_segments: '1' }, 201);
    }
    if (url.pathname.includes('/Recordings/') || url.pathname.includes('/Media/')) return new Response(new Blob(['audio-bytes'], { type: 'audio/mpeg' }));
    if (url.pathname === '/2010-04-01/Accounts/AC1.json') return res({ sid: 'AC1', status: 'active' });
    if (url.pathname === '/2010-04-01/Accounts/AC1/IncomingPhoneNumbers.json') return res({ incoming_phone_numbers: url.searchParams.get('PhoneNumber') === '+15125550100' ? [{ sid: 'PN1', friendly_name: '(512) 555-0100', capabilities: { sms: true, voice: true } }] : [] });
    if (url.pathname === '/2010-04-01/Accounts/AC1/IncomingPhoneNumbers/PN1.json') return res({ sid: 'PN1' });
    if (url.pathname === '/2010-04-01/Accounts/AC1/Calls.json') return res({ sid: 'CAout1' }, 201);
    throw new Error(`unmocked twilio ${url}`);
  }
  if (url.origin === 'https://api.anthropic.com') {
    const b = jbody();
    world.anthropic.push({ body: b, headers: init.headers });
    const next = world.aiReplies.shift();
    if (next instanceof Error) throw next;
    return res({ content: [{ type: 'text', text: typeof next === 'string' ? next : JSON.stringify(next) }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 } });
  }
  throw new Error(`unmocked ${url}`);
};

// ---------------------------------------------------------------- Load a function
async function load(name, env = {}) {
  let src = readFileSync(new URL(`../../supabase/functions/${name}/index.ts`, import.meta.url), 'utf8').replace(/^import "jsr:[^"]+";\n/m, '');
  const js = transformSync(src, { loader: 'ts', format: 'esm' }).code;
  let handler;
  globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: URL_BASE, SUPABASE_SERVICE_ROLE_KEY: 'svc', ...env })[k] }, serve: (h) => (handler = h) };
  const file = `${SP}/.fn-${name}-${Date.now()}.mjs`;
  writeFileSync(file, js);
  await import(file);
  return handler;
}

const sign = (url, params) => createHmac('sha1', TOKEN).update(url + Object.keys(params).sort().map((k) => k + params[k]).join('')).digest('base64');
let webhook;
async function twilioPost(t, params, { badSig = false } = {}) {
  const url = `${SELF}?t=${t}`;
  const all = { AccountSid: 'AC1', ...params };
  const req = new Request(`http://internal:9999/twilio-webhook?t=${t}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': badSig ? 'nope' : sign(url, all) },
    body: new URLSearchParams(all),
  });
  const r = await webhook(req);
  return { status: r.status, text: await r.text() };
}

webhook = await load('twilio-webhook');

// Profile: open Mon–Fri 7:30–17:30 in Chicago; receptionist when nobody answers.
const openAll = { 0: ['00:00', '23:59'], 1: ['00:00', '23:59'], 2: ['00:00', '23:59'], 3: ['00:00', '23:59'], 4: ['00:00', '23:59'], 5: ['00:00', '23:59'], 6: ['00:00', '23:59'] };
const closedAll = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
world.profile = {
  v: 1,
  timezone: 'America/Chicago',
  hours: openAll,
  shop: { name: 'Main Street Auto', phone: '(512) 555-0100', address: '100 Main St', city: 'Austin', state: 'TX', zip: '78701', bookingLink: 'https://example.com/book' },
  services: ['Oil change', 'Brakes'],
  line: { forward: [{ number: '(512) 555-0111', label: 'Front counter' }], ringSeconds: 20, receptionist: 'missed', voice: 'Polly.Matthew-Neural', allowStatus: true, allowBooking: true, textBack: true, textBackBody: 'Sorry we missed your call! Reply here.', afterHoursReply: true, afterHoursBody: 'We are closed, we will reply when we open.' },
  directory: [{ p: '5125550142', first: 'Dana', orders: [{ vehicle: '2018 Ford F-150', status: 'being worked on', promised: 'today 4 PM', ready: false }] }],
};

// ---- Signatures
let r = await twilioPost('sms', { From: '+15125550142', To: '+15125550100', Body: 'hi', MessageSid: 'SMa', NumMedia: '0' }, { badSig: true });
ok(r.status === 403, 'unsigned / wrongly signed requests are refused');
r = await twilioPost('sms', { From: '+15125550142', To: '+15125550100', Body: 'Is my truck ready?', MessageSid: 'SMa', NumMedia: '0' });
ok(r.status === 200 && r.text.includes('<Response/>'), 'signed text accepted');
ok(world.events.get('sms_in:SMa')?.payload.body === 'Is my truck ready?', 'incoming text recorded for the devices');

// ---- MMS + STOP / START
r = await twilioPost('sms', { From: '+15125550142', To: '+15125550100', Body: '', MessageSid: 'SMb', NumMedia: '1', MediaUrl0: 'https://api.twilio.com/2010-04-01/Accounts/AC1/Messages/SMb/Media/ME1', MediaContentType0: 'image/jpeg' });
ok(world.events.get('sms_in:SMb').payload.media[0].path === 'phone/mms/SMb-0.jpeg' && world.files.has('phone/mms/SMb-0.jpeg'), 'picture message copied into private storage');
await twilioPost('sms', { From: '+15125550142', To: '+15125550100', Body: 'Stop', MessageSid: 'SMc', NumMedia: '0' });
ok(world.optouts.has('+15125550142') && world.events.get('sms_in:SMc').payload.optOut === 'stop', 'STOP opts the number out');
await twilioPost('sms', { From: '+15125550142', To: '+15125550100', Body: 'START', MessageSid: 'SMd', NumMedia: '0' });
ok(!world.optouts.has('+15125550142'), 'START opts back in');

// ---- After-hours auto-reply, once a day
world.profile.hours = closedAll;
webhook = await load("twilio-webhook");
const before = world.twilio.filter((x) => x.path.endsWith('/Messages.json')).length;
await twilioPost('sms', { From: '+15125550177', To: '+15125550100', Body: 'Are you open Saturday?', MessageSid: 'SMe', NumMedia: '0' });
await twilioPost('sms', { From: '+15125550177', To: '+15125550100', Body: 'Hello?', MessageSid: 'SMf', NumMedia: '0' });
const sent = world.twilio.filter((x) => x.path.endsWith('/Messages.json')).slice(before);
ok(sent.length === 1 && sent[0].form.Body.startsWith('We are closed') && sent[0].form.StatusCallback === `${SELF}?t=status`, 'after hours: one auto-reply per number per day');
ok([...world.events.keys()].some((k) => k.startsWith('sms_out:') && world.events.get(k).payload.automation === 'afterhours'), 'auto-reply logged for the conversation');

// ---- Delivery receipts
await twilioPost('status', { MessageSid: 'SM9', MessageStatus: 'sent', To: '+15125550142' });
ok(!world.events.has('sms_status:SM9'), 'interim statuses are ignored');
await twilioPost('status', { MessageSid: 'SM9', MessageStatus: 'undelivered', ErrorCode: '30006', To: '+15125550142' });
ok(world.events.get('sms_status:SM9').payload.status === 'undelivered', 'failed delivery recorded');

// ---- Closed: voicemail (receptionist mode "missed" covers after hours too, but AI off here)
world.profile.line.receptionist = 'off';
webhook = await load("twilio-webhook");
r = await twilioPost('voice', { CallSid: 'CA1', From: '+15125550142', To: '+15125550100', CallStatus: 'ringing' });
ok(/We're closed right now/.test(r.text) && r.text.includes('<Record') && r.text.includes('Polly.Matthew-Neural'), 'closed + receptionist off → closed greeting and voicemail');
await twilioPost('rec', { CallSid: 'CA1', RecordingUrl: 'https://api.twilio.com/2010-04-01/Accounts/AC1/Recordings/RE1', RecordingDuration: '14', RecordingStatus: 'completed' });
ok(world.events.get('call:CA1').payload.voicemailPath === 'phone/voicemail/CA1.mp3' && world.files.has('phone/voicemail/CA1.mp3'), 'voicemail copied into private storage');
await twilioPost('callstatus', { CallSid: 'CA1', CallStatus: 'completed', CallDuration: '30', From: '+15125550142' });
let ev = world.events.get('call:CA1');
ok(ev.final && ev.payload.status === 'missed' && ev.payload.textedBack === true, 'call filed as missed and the caller got the missed-call text');
await twilioPost('vmtext', { CallSid: 'CA1', TranscriptionStatus: 'completed', TranscriptionText: 'Hi this is Dana, call me back' });
ok(world.events.get('call:CA1').payload.voicemailText === 'Hi this is Dana, call me back', 'voicemail transcript added');

// ---- Open: ring the staff phones; answered
world.profile.hours = openAll;
world.profile.line.receptionist = 'missed';
webhook = await load("twilio-webhook");
r = await twilioPost('voice', { CallSid: 'CA2', From: '+15125550142', To: '+15125550100' });
ok(r.text.includes('<Dial timeout="20"') && r.text.includes('<Number>+15125550111</Number>') && r.text.includes('t=dial&amp;via=ring'), 'open → rings the shop phones');
ok(world.events.get('call:CA2').payload.status === 'ringing' && !world.events.get('call:CA2').final, 'ringing call visible for the screen pop');
r = await twilioPost('dial', { CallSid: 'CA2', DialCallStatus: 'completed', DialCallDuration: '95' });
await twilioPost('callstatus', { CallSid: 'CA2', CallStatus: 'completed', CallDuration: '100', From: '+15125550142' });
ev = world.events.get('call:CA2');
ok(ev.payload.status === 'answered' && ev.payload.talkSeconds === 95 && !ev.payload.textedBack, 'answered call filed, no missed-call text');

// ---- Open, nobody answers → AI receptionist
r = await twilioPost('voice', { CallSid: 'CA3', From: '+15125550142', To: '+15125550100' });
// Twilio posts to the Dial action URL we gave it, including via=ring.
{
  const url = `${SELF}?t=dial&via=ring`;
  const params = { AccountSid: 'AC1', CallSid: 'CA3', DialCallStatus: 'no-answer', From: '+15125550142' };
  const req = new Request('http://internal/twilio-webhook?t=dial&via=ring', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': sign(url, params) }, body: new URLSearchParams(params) });
  r = { text: await (await webhook(req)).text() };
}
ok(r.text.includes('<Gather input="speech"') && /Thanks for calling Main Street Auto, Dana/.test(r.text), 'nobody answered → the receptionist greets the known caller by name');
world.aiReplies.push({ say: 'Your 2018 F-150 is being worked on and we promised it for today at 4 PM. Anything else?', next: 'listen', caller_name: 'Dana', message_for_staff: '', appointment: null, send_text: 'none' });
r = await twilioPost('ai', { CallSid: 'CA3', From: '+15125550142', SpeechResult: 'Is my truck ready yet?' });
const call = world.anthropic.at(-1);
ok(call.body.model === 'claude-haiku-4-5' && call.body.output_config.format.type === 'json_schema' && !call.body.fallbacks, 'receptionist uses Haiku 4.5 with a structured reply');
ok(/Dana/.test(call.body.system) && /2018 Ford F-150 — being worked on/.test(call.body.system) && call.body.messages[0].content.includes('Caller: Is my truck ready yet?'), 'caller record and transcript go to the model');
ok(r.text.includes('promised it for today at 4 PM') && r.text.includes('<Gather'), 'answer spoken, then listens');
world.aiReplies.push({ say: 'Great, I have a request for Tuesday morning for an oil change. The shop will text to confirm. Anything else?', next: 'listen', caller_name: 'Dana', message_for_staff: '', appointment: { name: 'Dana Fox', vehicle: '2018 Ford F-150', service: 'oil change', date: '2026-10-06', time_of_day: 'Morning' }, send_text: 'booking_link' });
r = await twilioPost('ai', { CallSid: 'CA3', From: '+15125550142', SpeechResult: 'Yes book an oil change Tuesday morning and text me the link' });
ok(world.inbox.length === 1 && world.inbox[0].kind === 'booking' && world.inbox[0].payload.source === 'phone' && world.inbox[0].payload.start === '2026-10-06T13:00:00.000Z', 'appointment request lands in the booking inbox at 8 AM shop time');
ok(world.twilio.at(-1).form?.Body?.includes('https://example.com/book'), 'booking link texted to the caller');
world.aiReplies.push({ say: 'Thanks Dana, goodbye!', next: 'end', caller_name: 'Dana', message_for_staff: 'Dana asked about F-150; booked oil change request', appointment: null, send_text: 'none' });
r = await twilioPost('ai', { CallSid: 'CA3', From: '+15125550142', SpeechResult: 'That is all thanks' });
ok(r.text.includes('<Hangup/>'), 'ends the call when the caller is done');
world.aiReplies.push('Dana called about her F-150 and requested an oil change Tuesday morning.');
await twilioPost('callstatus', { CallSid: 'CA3', CallStatus: 'completed', CallDuration: '80', From: '+15125550142' });
ev = world.events.get('call:CA3');
ok(ev.final && ev.payload.status === 'receptionist' && ev.payload.summary.startsWith('Dana called') && !ev.payload.textedBack && ev.payload.appointment.window === 'Morning', 'call summarized, no missed-call text after the receptionist took it');
ok(ev.payload.turns.length === 7, 'full transcript kept');

// ---- Silence and AI failure
r = await twilioPost('voice', { CallSid: 'CA4', From: '+15125550123', To: '+15125550100' });
world.profile.line.forward = [];
webhook = await load("twilio-webhook");
r = await twilioPost('voice', { CallSid: 'CA5', From: '+15125550123', To: '+15125550100' });
ok(r.text.includes('<Gather') && !/, Dana/.test(r.text), 'no phones to ring → receptionist answers (unknown caller)');
r = await twilioPost('ai', { CallSid: 'CA5', From: '+15125550123', SpeechResult: '' });
ok(r.text.includes("didn't catch that"), 'silence → asks again');
world.aiReplies.push(new Error('timeout'));
r = await twilioPost('ai', { CallSid: 'CA5', From: '+15125550123', SpeechResult: 'hello?' });
ok(r.text.includes('<Record') && r.text.includes('trouble on my end'), 'AI failure → falls back to voicemail, caller never left in silence');

// ---- Scheduled texts
const past = new Date(Date.now() - 60_000).toISOString();
world.outbox.set('appt-reminder:a1:2026-10-02', { key: 'appt-reminder:a1:2026-10-02', to_phone: '+15125550142', body: 'Reminder: tomorrow 9 AM', send_at: past, status: 'pending', meta: { automation: 'reminder', customerId: 'c1' } });
world.outbox.set('appt-reminder:a2:2026-10-02', { key: 'appt-reminder:a2:2026-10-02', to_phone: '+15125550188', body: 'Reminder 2', send_at: new Date(Date.now() - 8 * 3600_000).toISOString(), status: 'pending', meta: {} });
world.optouts.set('+15125550199', 'reply');
world.outbox.set('appt-reminder:a3:2026-10-02', { key: 'appt-reminder:a3:2026-10-02', to_phone: '+15125550199', body: 'Reminder 3', send_at: past, status: 'pending', meta: {} });
let d = await webhook(new Request(`${SELF}?t=dispatch`, { method: 'POST', headers: { 'x-dispatch-secret': 'wrong' }, body: '{}' }));
ok(d.status === 403, 'dispatcher needs the Vault secret');
d = await webhook(new Request(`${SELF}?t=dispatch`, { method: 'POST', headers: { 'x-dispatch-secret': 'disp-secret' }, body: '{}' }));
const dj = await d.json();
const hourCt = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
if (hourCt >= 8 && hourCt < 21) {
  ok(dj.sent === 1 && world.outbox.get('appt-reminder:a1:2026-10-02').status === 'sent', 'due reminder sent');
  ok([...world.events.values()].some((e) => e.payload.key === 'appt-reminder:a1:2026-10-02'), 'sent reminder logged for the conversation');
  ok(world.outbox.get('appt-reminder:a3:2026-10-02').status === 'skipped', 'opted-out number skipped');
} else {
  ok(world.outbox.get('appt-reminder:a1:2026-10-02').status === 'pending', 'quiet hours: reminder moved to 8 AM');
}
ok(world.outbox.get('appt-reminder:a2:2026-10-02').status === 'skipped', 'hours-late reminder skipped');

// ---------------------------------------------------------------- shop-phone
const phoneFn = await load('shop-phone');
const jwt = (meta, aal) => `x.${Buffer.from(JSON.stringify({ app_metadata: meta, ...(aal ? { aal } : {}) })).toString('base64url')}.y`;
const call2 = async (action, args = {}, meta = { autoshop_staff: true, autoshop_role: 'owner' }) => {
  const r = await phoneFn(new Request(`${URL_BASE}/functions/v1/shop-phone`, { method: 'POST', headers: { Authorization: `Bearer ${jwt(meta)}` }, body: JSON.stringify({ action, ...args }) }));
  return { status: r.status, body: await r.json() };
};
let s = await call2('status', {}, { autoshop_staff: false });
ok(s.status === 403, 'shop-phone: staff only');
s = await call2('status');
ok(s.body.configured && !s.body.connected && s.body.phone === '+15125550100' && s.body.optOuts.includes('+15125550199'), 'status: keys present, not connected yet, opt-outs listed');
s = await call2('connect', {}, { autoshop_staff: true, autoshop_role: 'advisor' });
ok(s.status === 403, 'only the owner connects the number');
s = await call2('connect');
const upd = world.twilio.find((x) => x.path.endsWith('/IncomingPhoneNumbers/PN1.json'));
ok(s.body.ok && upd.form.SmsUrl === `${URL_BASE}/functions/v1/twilio-webhook?t=sms` && upd.form.VoiceUrl.endsWith('?t=voice') && upd.form.StatusCallback.endsWith('?t=callstatus'), 'connect points the number at the webhook');
ok(world.secrets.get('project_url') === URL_BASE && JSON.parse(world.secrets.get('twilio_connected')).pn === 'PN1', 'connect saves the project URL for the dispatcher');
s = await call2('status');
ok(s.body.connected, 'status: connected');
s = await call2('send', { to: '(512) 555-0142', body: 'Your truck is ready' }, { autoshop_staff: true, autoshop_role: 'advisor' });
ok(s.status === 200 && s.body.sid && world.twilio.at(-1).form.To === '+15125550142' && world.twilio.at(-1).form.From === '+15125550100', 'staff can text from the business number');
s = await call2('send', { to: '+15125550199', body: 'hi' });
ok(s.status === 409 && s.body.code === 'opted_out', 'opted-out numbers are blocked');
s = await call2('send', { to: '+15125559999', body: 'hi' });
ok(s.status === 400 && s.body.code === 'bad_number', 'Twilio errors become plain-English messages');
s = await call2('call', { to: '512-555-0142', ring: '512-555-0111', name: 'Dana Fox' });
const c = world.twilio.at(-1);
ok(s.body.sid && c.form.To === '+15125550111' && c.form.Twiml.includes('<Number>+15125550142</Number>') && c.form.Twiml.includes('callerId="+15125550100"'), 'click-to-call rings the staff phone, then the customer, from the business number');

console.log('WEBHOOK PASS');
// ---------------------------------------------------------------- shop-ai request shape
const aiFn = await load('shop-ai');
world.aiReplies.push('Here is the explanation.');
let a = await aiFn(new Request(`${URL_BASE}/functions/v1/shop-ai`, { method: 'POST', headers: { Authorization: `Bearer ${jwt({ autoshop_staff: true, autoshop_role: 'advisor' })}` }, body: JSON.stringify({ task: 'explain', context: 'RO #1', shop: 'Main Street Auto' }) }));
let req = world.anthropic.at(-1);
ok(a.status === 200 && req.body.model === 'claude-opus-5-5' && req.body.fallbacks === 'default' && req.headers['anthropic-beta'] === 'server-side-fallback-2026-07-01' && req.body.output_config.effort === 'low' && req.body.max_tokens === 16000 && !req.body.thinking, 'assistant: Opus 5.5 by default, low effort, server-side fallback');
world.secrets.set('ai_model', 'claude-haiku-4-5-20251001');
world.aiReplies.push('ok');
a = await aiFn(new Request(`${URL_BASE}/functions/v1/shop-ai`, { method: 'POST', headers: { Authorization: `Bearer ${jwt({ autoshop_staff: true })}` }, body: JSON.stringify({ task: 'diagnose', context: 'RO #1' }) }));
req = world.anthropic.at(-1);
ok(req.body.model === 'claude-haiku-4-5' && !req.body.fallbacks && !req.body.output_config && !req.headers['anthropic-beta'], 'assistant: a saved Haiku choice maps to the current id, no effort/fallback');
console.log('AI PASS');

