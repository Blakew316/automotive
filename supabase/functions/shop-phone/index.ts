// shop-phone: the business line for shop staff, through the shop's own Twilio account.
//   status  – is texting/calling set up, which number, opted-out numbers (any staff)
//   connect – check the Twilio keys and point the number's texts and calls at twilio-webhook (owner)
//   send    – text a customer from the business number (any staff)
//   call    – click-to-call: ring the staff member's phone, then connect the customer with the
//             shop's number as caller ID (any staff)
// Twilio keys live in Vault (Settings → Keys & AI); this function never returns them.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK = `${SUPABASE_URL}/functions/v1/twilio-webhook`;
const TWILIO = "https://api.twilio.com/2010-04-01";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (message: string, status = 400, code?: string) => json({ error: message, message, code }, status);
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function claims(req: Request): Record<string, any> | null {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  try {
    const p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(p + "=".repeat((4 - (p.length % 4)) % 4)));
  } catch {
    return null;
  }
}

function e164(p: unknown): string {
  const raw = String(p || "").trim();
  const d = raw.replace(/\D/g, "");
  if (raw.startsWith("+") && d.length >= 8 && d.length <= 15) return `+${d}`;
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d[0] === "1") return `+${d}`;
  return "";
}

async function db(path: string, init: RequestInit & { prefer?: string } = {}) {
  const headers: Record<string, string> = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
  if (init.prefer) headers.Prefer = init.prefer;
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Database error ${res.status}`);
  return data;
}
const rpc = (fn: string, args: Record<string, unknown> = {}) => db(`/rest/v1/rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
const secret = async (name: string): Promise<string | null> => (await rpc("shop_secret_get", { p_name: name })) || null;

async function keys() {
  const [sid, token, phone] = await Promise.all([secret("twilio_account_sid"), secret("twilio_auth_token"), secret("twilio_phone")]);
  return { sid, token, phone: e164(phone), auth: sid && token ? `Basic ${btoa(`${sid}:${token}`)}` : "" };
}

async function twilio(k: { sid: string | null; auth: string }, path: string, init: { method?: string; form?: Record<string, string> } = {}) {
  const res = await fetch(`${TWILIO}/Accounts/${k.sid}${path}`, {
    method: init.method || (init.form ? "POST" : "GET"),
    headers: { Authorization: k.auth, ...(init.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: init.form ? new URLSearchParams(init.form) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** Twilio error → something a service advisor can act on. */
function twilioMessage(data: any, status: number): { message: string; code?: string } {
  const code = Number(data?.code) || 0;
  if (status === 401 || code === 20003) return { message: "Twilio didn't accept the Account SID and Auth token — check them in Settings → Keys & AI.", code: "auth" };
  if (code === 21610) return { message: "This customer replied STOP, so texts to them are blocked until they reply START.", code: "opted_out" };
  if (code === 21211 || code === 21614 || code === 21217) return { message: "That number can't receive texts — check it's a mobile number.", code: "bad_number" };
  if (code === 21408 || code === 21612) return { message: "Twilio can't send texts to that number from your business line (check Geo permissions in Twilio).", code: "blocked" };
  if (code === 21606 || code === 21659) return { message: "Your business number can't send texts — check it's text-enabled in Twilio.", code: "from_number" };
  if (code === 30034 || code === 30032) return { message: "Carriers are blocking texts from your number until it's registered (A2P 10DLC or toll-free verification in Twilio).", code: "unregistered" };
  return { message: data?.message || `Twilio error ${status}` };
}

/**
 * Two-step sign-in: someone who uses an authenticator app (or whose role must) has to have entered
 * its code this session. The database decides, from the caller's own token.
 */
async function twoStepOk(req: Request) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/shop_mfa_ok`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: req.headers.get("Authorization") || "", "Content-Type": "application/json" },
    body: "{}",
  }).catch(() => null);
  return Boolean(res?.ok && (await res.json().catch(() => false)) === true);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("POST only", 405);
  const meta = claims(req)?.app_metadata || {};
  if (!meta.autoshop_staff) return fail("Shop staff only", 403);
  if (!(await twoStepOk(req))) return fail("Enter the code from your authenticator app to continue", 401, "mfa_required");
  const role = meta.autoshop_role || "advisor";
  const body = await req.json().catch(() => ({}));

  try {
    const k = await keys();
    const configured = Boolean(k.sid && k.token && k.phone);

    if (body.action === "status") {
      const connected = await secret("twilio_connected").then((v) => (v ? JSON.parse(v) : null)).catch(() => null);
      const optOuts = await db("/rest/v1/shop_sms_optouts?select=phone,opted_out_at&order=opted_out_at.desc&limit=2000", { method: "GET" }).catch(() => []);
      return json({
        configured,
        phone: k.phone || null,
        connected: Boolean(configured && connected && connected.phone === k.phone),
        connectedAt: connected?.at || null,
        webhook: WEBHOOK,
        aiReady: Boolean(await secret("anthropic_api_key")),
        optOuts: (optOuts || []).map((r: any) => r.phone),
      });
    }

    if (!configured) return fail("Add your Twilio Account SID, Auth token and business phone number in Settings → Keys & AI first.", 412, "not_configured");

    if (body.action === "connect") {
      if (role !== "owner") return fail("Only the owner can connect the business number", 403);
      const acct = await twilio(k, ".json");
      if (!acct.ok) return fail(twilioMessage(acct.data, acct.status).message, 400, "auth");
      const found = await twilio(k, `/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(k.phone)}`);
      const number = found.data?.incoming_phone_numbers?.[0];
      if (!found.ok || !number) return fail(`${k.phone} isn't a number in this Twilio account — buy or port it in Twilio first, then save it in Keys & AI.`, 400, "no_number");
      const set = await twilio(k, `/IncomingPhoneNumbers/${number.sid}.json`, {
        form: {
          SmsUrl: `${WEBHOOK}?t=sms`,
          SmsMethod: "POST",
          VoiceUrl: `${WEBHOOK}?t=voice`,
          VoiceMethod: "POST",
          StatusCallback: `${WEBHOOK}?t=callstatus`,
          StatusCallbackMethod: "POST",
        },
      });
      if (!set.ok) return fail(twilioMessage(set.data, set.status).message);
      const at = new Date().toISOString();
      await rpc("shop_secret_set", { p_name: "project_url", p_value: SUPABASE_URL });
      await rpc("shop_secret_set", { p_name: "twilio_connected", p_value: JSON.stringify({ phone: k.phone, pn: number.sid, at }) });
      return json({ ok: true, phone: k.phone, friendlyName: number.friendly_name, sms: number.capabilities?.sms !== false, voice: number.capabilities?.voice !== false, connectedAt: at });
    }

    if (body.action === "send") {
      const to = e164(body.to);
      const text = String(body.body || "").trim();
      if (!to) return fail("That isn't a phone number we can text", 400, "bad_number");
      if (!text) return fail("Write a message first");
      if (text.length > 1600) return fail("That message is too long for a text (1,600 characters max)");
      const out = await db(`/rest/v1/shop_sms_optouts?phone=eq.${encodeURIComponent(to)}&select=phone`, { method: "GET" });
      if (out?.length) return fail("This customer replied STOP, so texts to them are blocked until they reply START.", 409, "opted_out");
      const r = await twilio(k, "/Messages.json", { form: { To: to, From: k.phone, Body: text, StatusCallback: `${WEBHOOK}?t=status` } });
      if (!r.ok) {
        const m = twilioMessage(r.data, r.status);
        if (m.code === "opted_out") await db("/rest/v1/shop_sms_optouts?on_conflict=phone", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: JSON.stringify({ phone: to, source: "carrier" }) }).catch(() => {});
        return fail(m.message, r.status >= 500 ? 502 : 400, m.code);
      }
      return json({ sid: r.data.sid, status: r.data.status, to, from: k.phone, segments: Number(r.data.num_segments) || 1 });
    }

    if (body.action === "call") {
      const to = e164(body.to);
      const ring = e164(body.ring);
      if (!to) return fail("That isn't a phone number we can call", 400, "bad_number");
      if (!ring) return fail("Choose the phone to ring first", 400, "no_ring");
      const who = String(body.name || "the customer").replace(/[^\p{L}\p{N} .,'&-]/gu, "").slice(0, 60);
      const twiml = `<Response><Say voice="Polly.Joanna-Neural">Connecting you to ${esc(who)}.</Say><Dial callerId="${esc(k.phone)}" answerOnBridge="true" timeout="30"><Number>${esc(to)}</Number></Dial></Response>`;
      const r = await twilio(k, "/Calls.json", { form: { To: ring, From: k.phone, Twiml: twiml } });
      if (!r.ok) return fail(twilioMessage(r.data, r.status).message, r.status >= 500 ? 502 : 400);
      return json({ sid: r.data.sid, ring, to });
    }

    return fail("Unknown action");
  } catch (e) {
    return fail((e as Error).message || "Something went wrong", 500);
  }
});
