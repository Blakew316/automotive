// pay-link: the customer's side of a pay link (/app/pay/<id>), no sign-in.
//   GET  ?id=…  – what the link is for: shop, repair order, amount, and whether it's been paid
//   POST {id}   – start (or resume) Stripe Checkout for it and return Checkout's address
// Links are random 12-character ids made by shop staff (shop-pay → link). Nothing about the
// customer is returned beyond what the shop put on the link.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE = "https://api.stripe.com/v1";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const fail = (message: string, status = 400) => json({ error: message, message }, status);

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

async function getLink(id: string) {
  if (!/^[A-Za-z0-9]{8,24}$/.test(id)) return null;
  const rows = await db(`/rest/v1/shop_pay_links?id=eq.${id}&select=*`, { method: "GET" });
  return rows?.[0] || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (req.method === "GET") {
      const link = await getLink(new URL(req.url).searchParams.get("id") || "");
      if (!link) return fail("This payment link isn’t valid. Please contact the shop.", 404);
      const key = await secret("stripe_secret_key");
      return json({
        shop: link.shop_name,
        phone: link.shop_phone,
        title: link.title,
        ro: link.ro_number,
        amount: link.amount_cents / 100,
        currency: link.currency,
        status: link.status,
        paidAt: link.paid_at,
        test: Boolean(key && key.includes("_test_")),
        ready: Boolean(key),
      });
    }
    if (req.method !== "POST") return fail("GET or POST only", 405);
    const body = await req.json().catch(() => ({}));
    const link = await getLink(String(body.id || ""));
    if (!link) return fail("This payment link isn’t valid. Please contact the shop.", 404);
    if (link.status === "paid") return fail("This invoice has already been paid — thank you!", 409);
    if (link.status === "void") return fail("This payment link has been replaced. Please use the newest link from the shop, or call them.", 410);
    const key = await secret("stripe_secret_key");
    if (!key) return fail("Online payment isn’t available right now. Please contact the shop.", 503);
    const auth = { Authorization: `Bearer ${key}` };

    // Resume a checkout that's still open rather than starting a second one.
    if (link.session_id) {
      const cur = await fetch(`${STRIPE}/checkout/sessions/${link.session_id}`, { headers: auth }).then((r) => r.json()).catch(() => null);
      if (cur?.status === "open" && cur.url) return json({ url: cur.url });
      if (cur?.status === "complete") return fail("This invoice has already been paid — thank you!", 409);
    }

    const name = link.title || (link.ro_number ? `Repair order #${link.ro_number}` : "Invoice");
    const meta = { link: link.id, order: link.order_id, ro: link.ro_number ?? "" };
    const res = await fetch(`${STRIPE}/checkout/sessions`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `link-${link.id}-${Math.floor(Date.now() / 60_000)}` },
      body: form({
        mode: "payment",
        submit_type: "pay",
        line_items: [{ quantity: 1, price_data: { currency: link.currency, unit_amount: link.amount_cents, product_data: { name, description: link.shop_name || undefined } } }],
        customer_email: link.customer_email || undefined,
        success_url: `${link.return_url}${link.return_url.includes("?") ? "&" : "?"}paid=1`,
        cancel_url: link.return_url,
        expires_at: Math.floor(Date.now() / 1000) + 23 * 3600,
        metadata: meta,
        payment_intent_data: { description: `${link.shop_name ? `${link.shop_name} — ` : ""}${name}`.slice(0, 1000), metadata: meta, receipt_email: link.customer_email || undefined },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return fail(data?.error?.message || "Online payment isn’t available right now. Please contact the shop.", 502);
    await db(`/rest/v1/shop_pay_links?id=eq.${link.id}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ session_id: data.id }) });
    return json({ url: data.url });
  } catch (e) {
    return fail((e as Error).message || "Something went wrong", 500);
  }
});
