// stripe-webhook: Stripe tells the shop when a pay link or a card-reader payment is paid (or
// refunded). Every request is checked against its Stripe-Signature with the endpoint's signing
// secret (saved in Vault when the owner connected Stripe). Payments are recorded in shop_pay_events
// for the shop's devices to add to the repair order, with the card brand, last 4 and Stripe's fee
// for the books.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE = "https://api.stripe.com/v1";
const TOLERANCE = 300;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function db(path: string, init: RequestInit & { prefer?: string } = {}) {
  const headers: Record<string, string> = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
  if (init.prefer) headers.Prefer = init.prefer;
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Database error ${res.status}`);
  return data;
}
const secret = async (name: string): Promise<string | null> => (await db("/rest/v1/rpc/shop_secret_get", { method: "POST", body: JSON.stringify({ p_name: name }) })) || null;

async function hmacHex(key: string, data: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)));
  return Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
}
const same = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

async function verified(header: string, raw: string): Promise<boolean> {
  const whsec = await secret("stripe_webhook_secret");
  if (!whsec || !header) return false;
  const t = /(?:^|,)t=(\d+)/.exec(header)?.[1];
  const sigs = [...header.matchAll(/(?:^|,)v1=([0-9a-f]+)/g)].map((m) => m[1]);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > TOLERANCE) return false;
  const expected = await hmacHex(whsec, `${t}.${raw}`);
  return sigs.some((s) => same(s, expected));
}

// Stripe payment method → the shop's payment methods.
const METHOD: Record<string, string> = { card: "Card", link: "Card", us_bank_account: "ACH", affirm: "Financing", klarna: "Financing", afterpay_clearpay: "Financing", cashapp: "Card" };

async function record(session: any) {
  const key = await secret("stripe_secret_key");
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!pi) return;
  let charge: any = null;
  if (key) {
    const r = await fetch(`${STRIPE}/payment_intents/${pi}?expand[]=latest_charge.balance_transaction`, { headers: { Authorization: `Bearer ${key}` } });
    if (r.ok) charge = (await r.json()).latest_charge || null;
  }
  const details = charge?.payment_method_details || {};
  const type = details.type || "card";
  const fee = charge?.balance_transaction?.fee;
  const m = session.metadata || {};
  const payload = {
    link: m.link || null,
    orderId: m.order || null,
    ro: m.ro ? Number(m.ro) : null,
    amount: (session.amount_total || 0) / 100,
    method: METHOD[type] || "Card",
    type,
    brand: details.card?.brand || details[type]?.brand || null,
    last4: details.card?.last4 || details.us_bank_account?.last4 || null,
    fee: typeof fee === "number" ? fee / 100 : null,
    paymentIntent: pi,
    charge: charge?.id || null,
    email: session.customer_details?.email || null,
    name: session.customer_details?.name || null,
    at: new Date((session.created || Date.now() / 1000) * 1000).toISOString(),
    paidAt: new Date().toISOString(),
    livemode: Boolean(session.livemode),
  };
  await db("/rest/v1/shop_pay_events?on_conflict=ref", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: JSON.stringify({ kind: "payment", ref: pi, payload }) });
  if (m.link) await db(`/rest/v1/shop_pay_links?id=eq.${encodeURIComponent(m.link)}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ status: "paid", paid_at: payload.paidAt, payment_intent: pi }) });
}

/**
 * A card-reader payment (Stripe Terminal): capture it once the card is approved, then record it like
 * any other payment, with the tip and surcharge the counter entered. shop-pay does the same when the
 * counter's screen sees the approval first; the payment intent id keeps it from being recorded twice.
 */
async function recordIntent(pi: any) {
  const key = await secret("stripe_secret_key");
  if (!key || pi?.metadata?.source !== "terminal") return;
  const auth = { Authorization: `Bearer ${key}` };
  if (pi.status === "requires_capture") {
    const r = await fetch(`${STRIPE}/payment_intents/${pi.id}/capture`, { method: "POST", headers: auth });
    if (!r.ok && r.status !== 400) throw new Error(`Capture failed (${r.status})`);
  }
  const r = await fetch(`${STRIPE}/payment_intents/${pi.id}?expand[]=latest_charge.balance_transaction`, { headers: auth });
  if (!r.ok) return;
  const full = await r.json();
  if (full.status !== "succeeded") return;
  await db("/rest/v1/shop_pay_events?on_conflict=ref", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: JSON.stringify({ kind: "payment", ref: full.id, payload: terminalPayload(full) }) });
}

/** What the RO records for a reader payment (shared with shop-pay). */
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

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const raw = await req.text();
  if (!(await verified(req.headers.get("Stripe-Signature") || "", raw))) return new Response("Invalid signature", { status: 400 });
  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  try {
    const o = event.data?.object || {};
    if ((event.type === "checkout.session.completed" && o.payment_status === "paid") || event.type === "checkout.session.async_payment_succeeded") await record(o);
    if (event.type === "payment_intent.amount_capturable_updated" || event.type === "payment_intent.succeeded") await recordIntent(o);
    if (event.type === "charge.refunded" && o.payment_intent) {
      // Cumulative: devices record the difference from what they already have.
      const ref = `refund:${o.id}:${o.amount_refunded}`;
      await db("/rest/v1/shop_pay_events?on_conflict=ref", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: JSON.stringify({ kind: "refund", ref, payload: { paymentIntent: o.payment_intent, charge: o.id, refunded: (o.amount_refunded || 0) / 100, at: new Date().toISOString() } }) });
    }
    return json({ received: true });
  } catch (e) {
    // A 500 makes Stripe retry later.
    return json({ error: (e as Error).message }, 500);
  }
});
