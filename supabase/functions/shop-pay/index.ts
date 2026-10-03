// shop-pay: online payments for shop staff, through the shop's own Stripe account.
//   status  – is Stripe set up, test or live, the account's name, webhook connected (any staff)
//   connect – check the secret key and register the stripe-webhook endpoint in the shop's Stripe
//             account, saving its signing secret to Vault (owner)
//   link    – create a pay link for a repair order's balance (any staff)
//   refund  – refund an online payment, in full or in part (owner or manager)
// Card readers at the counter (Stripe Terminal, server-driven):
//   registerReader / removeReader – add a Stripe smart reader by its pairing code, or remove it (owner)
//   readerCharge  – send an amount for a repair order to a reader (any staff)
//   readerCheck   – has the customer's card been approved? Captures and records it when it has
//   readerCancel  – stop waiting and clear the reader's screen
//   readerSimulate – test mode only: act as a customer tapping a test card
// The Stripe secret key lives in Vault (Settings → Keys & AI); this function never returns it.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK = `${SUPABASE_URL}/functions/v1/stripe-webhook`;
const STRIPE = "https://api.stripe.com/v1";
const EVENTS = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "charge.refunded", "payment_intent.amount_capturable_updated", "payment_intent.succeeded"];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (message: string, status = 400, code?: string) => json({ error: message, message, code }, status);

function claims(req: Request): Record<string, any> | null {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  try {
    const p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(p + "=".repeat((4 - (p.length % 4)) % 4)));
  } catch {
    return null;
  }
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

/** Stripe's form encoding, including nested keys (a[b][c]=…) and arrays (a[0]=…). */
function form(obj: Record<string, unknown>, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === "object" ? form(x as Record<string, unknown>, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(x))));
    else if (typeof v === "object") form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe(key: string, path: string, init: { method?: string; body?: Record<string, unknown>; idempotency?: string } = {}) {
  const res = await fetch(`${STRIPE}${path}`, {
    method: init.method || (init.body ? "POST" : "GET"),
    headers: { Authorization: `Bearer ${key}`, ...(init.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}), ...(init.idempotency ? { "Idempotency-Key": init.idempotency } : {}) },
    body: init.body ? form(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function stripeMessage(data: any, status: number) {
  const e = data?.error || {};
  if (status === 401) return "Stripe didn't accept the secret key — check it in Settings → Keys & AI.";
  if (status === 403) return "This Stripe key doesn't have permission for that. Use a secret key, or give the restricted key write access to Checkout Sessions, Payment Intents, Refunds, Terminal and Webhook Endpoints.";
  return e.message || `Stripe error ${status}`;
}

/** A reader as the app shows it. */
const readerView = (r: any) => ({ id: r.id, label: r.label || r.serial_number || "Card reader", type: r.device_type || "", status: r.status || "offline", serial: r.serial_number || "", simulated: String(r.device_type || "").startsWith("simulated") || String(r.serial_number || "").startsWith("simulated") });

/** What the RO records for a reader payment (the same as stripe-webhook records). */
function terminalPayload(pi: any) {
  const charge = pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  const card = charge?.payment_method_details?.card_present || charge?.payment_method_details?.interac_present || {};
  const fee = charge?.balance_transaction?.fee;
  const m = pi.metadata || {};
  return {
    source: "terminal",
    orderId: m.order || null,
    ro: m.ro ? Number(m.ro) : null,
    amount: Number(m.amount) || (pi.amount_received || pi.amount || 0) / 100,
    tip: Number(m.tip) || 0,
    surcharge: Number(m.surcharge) || 0,
    method: "Card",
    type: "card_present",
    brand: card.brand || null,
    last4: card.last4 || null,
    fee: typeof fee === "number" ? fee / 100 : null,
    paymentIntent: pi.id,
    charge: charge?.id || null,
    reader: m.reader || null,
    paidAt: new Date().toISOString(),
    livemode: Boolean(pi.livemode),
  };
}

const newId = () => {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => abc[b % abc.length]).join("");
};

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
    const key = await secret("stripe_secret_key");
    if (body.action === "status") {
      if (!key) return json({ configured: false, connected: false, webhook: WEBHOOK });
      const hook = await secret("stripe_webhook_id");
      const acct = await stripe(key, "/account");
      const list = await stripe(key, "/terminal/readers?limit=100");
      return json({
        configured: true,
        mode: key.includes("_test_") ? "test" : "live",
        connected: Boolean(hook && (await secret("stripe_webhook_secret"))),
        account: acct.ok ? { name: acct.data.settings?.dashboard?.display_name || acct.data.business_profile?.name || "", chargesEnabled: acct.data.charges_enabled !== false, country: acct.data.country || "" } : null,
        webhook: WEBHOOK,
        terminal: { readers: list.ok ? (list.data.data || []).map(readerView) : [], location: await secret("stripe_terminal_location") },
      });
    }
    if (!key) return fail("Add your Stripe secret key in Settings → Keys & AI first.", 412, "not_configured");

    if (body.action === "connect") {
      if (role !== "owner") return fail("Only the owner can connect Stripe", 403);
      const check = await stripe(key, "/balance");
      if (!check.ok) return fail(stripeMessage(check.data, check.status), 400, "auth");
      // Replace any earlier endpoint for this shop (its signing secret can't be read back).
      const list = await stripe(key, "/webhook_endpoints?limit=100");
      for (const ep of list.data?.data || []) if (ep.url === WEBHOOK) await stripe(key, `/webhook_endpoints/${ep.id}`, { method: "DELETE" });
      const ep = await stripe(key, "/webhook_endpoints", { body: { url: WEBHOOK, enabled_events: EVENTS, description: "WPI Driveline Shop Management System — online payments" } });
      if (!ep.ok) return fail(stripeMessage(ep.data, ep.status));
      await rpc("shop_secret_set", { p_name: "stripe_webhook_secret", p_value: ep.data.secret });
      await rpc("shop_secret_set", { p_name: "stripe_webhook_id", p_value: ep.data.id });
      return json({ ok: true, mode: key.includes("_test_") ? "test" : "live" });
    }

    if (body.action === "link") {
      const cents = Math.round(Number(body.amount) * 100);
      if (!body.orderId || !Number.isFinite(cents) || cents < 50) return fail("There's no balance to collect online (Stripe's minimum is $0.50).");
      if (cents > 99_999_999) return fail("That amount is too large for one online payment.");
      const ret = String(body.returnBase || "");
      if (!/^https?:\/\//.test(ret)) return fail("Missing the app address for the payment page");
      // One open link per repair order: an older one (for a different amount) stops working.
      await db(`/rest/v1/shop_pay_links?order_id=eq.${encodeURIComponent(body.orderId)}&status=eq.open`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ status: "void" }) });
      const id = newId();
      const row = {
        id,
        order_id: String(body.orderId).slice(0, 80),
        ro_number: Number(body.roNumber) || null,
        amount_cents: cents,
        currency: "usd",
        title: String(body.title || "").slice(0, 160),
        shop_name: String(body.shopName || "").slice(0, 120),
        shop_phone: String(body.shopPhone || "").slice(0, 40),
        customer_email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(body.email || "")) ? String(body.email) : null,
        // The customer's page, e.g. …/app/pay/<id>?p=<project> (which Shop Cloud the link is in).
        return_url: `${ret.replace(/\/+$/, "")}/${id}${body.returnQuery ? `?${String(body.returnQuery).replace(/[^\w=&.-]/g, "").slice(0, 80)}` : ""}`,
      };
      await db("/rest/v1/shop_pay_links", { method: "POST", prefer: "return=minimal", body: JSON.stringify(row) });
      return json({ id, url: row.return_url, amount: cents / 100, mode: key.includes("_test_") ? "test" : "live" });
    }

    // ---------------------------------------------------------------- Card readers
    if (body.action === "registerReader") {
      if (role !== "owner") return fail("Only the owner can add card readers", 403);
      const code = String(body.code || "").trim();
      if (!code) return fail("Enter the pairing code shown on the reader");
      // Readers belong to a Terminal location: the shop's address, made once.
      let location = await secret("stripe_terminal_location");
      if (!location) {
        const a = body.address || {};
        if (!a.line1 || !a.city || !a.state || !a.postal) return fail("Add the shop's street address, city, state and ZIP in Settings → General first — Stripe needs it for card readers.");
        const loc = await stripe(key, "/terminal/locations", { body: { display_name: String(body.shopName || "Shop").slice(0, 100), address: { line1: String(a.line1).slice(0, 200), city: String(a.city).slice(0, 100), state: String(a.state).slice(0, 50), postal_code: String(a.postal).slice(0, 20), country: String(a.country || "US").slice(0, 2) } } });
        if (!loc.ok) return fail(stripeMessage(loc.data, loc.status));
        location = loc.data.id as string;
        await rpc("shop_secret_set", { p_name: "stripe_terminal_location", p_value: location });
      }
      const r = await stripe(key, "/terminal/readers", { body: { registration_code: code, label: String(body.label || "Front counter").slice(0, 100), location } });
      if (!r.ok) return fail(r.data?.error?.code === "resource_missing" || /registration/i.test(r.data?.error?.message || "") ? "Stripe didn’t recognize that code — check the reader’s screen for a new one." : stripeMessage(r.data, r.status));
      // The webhook also needs to hear about reader payments (endpoints connected before readers existed).
      const hook = await secret("stripe_webhook_id");
      if (hook) await stripe(key, `/webhook_endpoints/${hook}`, { body: { enabled_events: EVENTS } });
      return json({ reader: readerView(r.data) });
    }
    if (body.action === "removeReader") {
      if (role !== "owner") return fail("Only the owner can remove card readers", 403);
      const r = await stripe(key, `/terminal/readers/${encodeURIComponent(String(body.readerId || ""))}`, { method: "DELETE" });
      if (!r.ok && r.status !== 404) return fail(stripeMessage(r.data, r.status));
      return json({ ok: true });
    }
    if (body.action === "readerCharge") {
      const readerId = String(body.readerId || "");
      const amount = Math.round(Number(body.amount) * 100);
      const tip = Math.max(0, Math.round(Number(body.tip || 0) * 100));
      const surcharge = Math.max(0, Math.round(Number(body.surcharge || 0) * 100));
      const total = amount + tip + surcharge;
      if (!readerId || !body.orderId) return fail("Choose a reader");
      if (!Number.isFinite(total) || amount <= 0 || total < 50) return fail("Card payments start at $0.50.");
      if (total > 99_999_999) return fail("That amount is too large for one card payment.");
      const pi = await stripe(key, "/payment_intents", {
        body: {
          amount: total,
          currency: "usd",
          payment_method_types: ["card_present"],
          capture_method: "manual",
          description: `RO #${Number(body.roNumber) || ""}${body.shopName ? ` — ${String(body.shopName).slice(0, 80)}` : ""}`,
          metadata: { source: "terminal", order: String(body.orderId).slice(0, 80), ro: String(Number(body.roNumber) || ""), amount: (amount / 100).toFixed(2), tip: (tip / 100).toFixed(2), surcharge: (surcharge / 100).toFixed(2), reader: readerId, by: String(body.by || "").slice(0, 80) },
        },
        idempotency: body.nonce ? `reader-${readerId}-${String(body.nonce).slice(0, 60)}` : undefined,
      });
      if (!pi.ok) return fail(stripeMessage(pi.data, pi.status));
      const go = await stripe(key, `/terminal/readers/${encodeURIComponent(readerId)}/process_payment_intent`, { body: { payment_intent: pi.data.id } });
      if (!go.ok) {
        await stripe(key, `/payment_intents/${pi.data.id}/cancel`, { body: {} });
        const code = go.data?.error?.code;
        return fail(code === "terminal_reader_offline" ? "The reader is offline — check it’s on and connected to Wi-Fi." : code === "terminal_reader_busy" ? "The reader is busy with another payment — finish or cancel it first." : stripeMessage(go.data, go.status), 409);
      }
      return json({ paymentIntent: pi.data.id, test: key.includes("_test_") });
    }
    if (body.action === "readerCheck" || body.action === "readerCancel") {
      const readerId = encodeURIComponent(String(body.readerId || ""));
      const id = String(body.paymentIntent || "");
      if (!/^pi_/.test(id)) return fail("Which payment?");
      if (body.action === "readerCancel") {
        await stripe(key, `/terminal/readers/${readerId}/cancel_action`, { body: {} });
        const c = await stripe(key, `/payment_intents/${id}/cancel`, { body: {} });
        // Too late to cancel: it went through, so it still lands on the RO.
        return json({ ok: c.ok, status: c.ok ? "canceled" : c.data?.error?.payment_intent?.status || "unknown" });
      }
      let pi = await stripe(key, `/payment_intents/${id}`);
      if (!pi.ok) return fail(stripeMessage(pi.data, pi.status));
      if (pi.data.status === "requires_capture") {
        const cap = await stripe(key, `/payment_intents/${id}/capture`, { body: {}, idempotency: `capture-${id}` });
        if (!cap.ok && cap.data?.error?.payment_intent?.status !== "succeeded") return fail(stripeMessage(cap.data, cap.status));
        pi = await stripe(key, `/payment_intents/${id}`);
      }
      if (pi.data.status === "succeeded") {
        const full = await stripe(key, `/payment_intents/${id}?expand[]=latest_charge.balance_transaction`);
        const payload = terminalPayload(full.ok ? full.data : pi.data);
        await db("/rest/v1/shop_pay_events?on_conflict=ref", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: JSON.stringify({ kind: "payment", ref: id, payload }) });
        return json({ status: "succeeded", payment: payload });
      }
      if (pi.data.status === "canceled") return json({ status: "failed", message: "The payment was canceled." });
      const rd = await stripe(key, `/terminal/readers/${readerId}`);
      const action = rd.ok ? rd.data.action : null;
      if (action?.status === "failed" || (pi.data.status === "requires_payment_method" && pi.data.last_payment_error)) {
        // Declined: release this attempt so "Try again" starts clean.
        await stripe(key, `/payment_intents/${id}/cancel`, { body: {} });
        return json({ status: "failed", message: action?.failure_message || pi.data.last_payment_error?.message || "The card was declined." });
      }
      if (rd.ok && rd.data.status === "offline") return json({ status: "waiting", offline: true });
      return json({ status: "waiting" });
    }
    if (body.action === "readerSimulate") {
      if (!key.includes("_test_")) return fail("Simulating a tap only works in test mode", 400);
      const r = await stripe(key, `/test_helpers/terminal/readers/${encodeURIComponent(String(body.readerId || ""))}/present_payment_method`, { body: body.decline ? { card_present: { number: "4000000000000002" } } : {} });
      if (!r.ok) return fail(stripeMessage(r.data, r.status));
      return json({ ok: true });
    }

    if (body.action === "refund") {
      if (!["owner", "manager"].includes(role)) return fail("Only the owner or a manager can refund", 403);
      const pi = String(body.paymentIntent || "");
      if (!/^pi_/.test(pi)) return fail("That payment wasn't made online");
      const cents = body.amount ? Math.round(Number(body.amount) * 100) : undefined;
      const r = await stripe(key, "/refunds", { body: { payment_intent: pi, amount: cents, reason: "requested_by_customer", metadata: { by: String(body.by || "").slice(0, 80) } }, idempotency: `refund-${pi}-${cents ?? "all"}-${body.nonce || ""}` });
      if (!r.ok) return fail(stripeMessage(r.data, r.status));
      return json({ id: r.data.id, amount: (r.data.amount || 0) / 100, status: r.data.status });
    }

    return fail("Unknown action");
  } catch (e) {
    return fail((e as Error).message || "Something went wrong", 500);
  }
});
