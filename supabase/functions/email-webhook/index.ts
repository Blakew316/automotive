// email-webhook: Resend tells the shop what happened to each email (delivered, bounced, marked as
// spam, opened, delayed). Requests are signed (Svix): the signature is checked with the shop's
// webhook signing secret, with a five-minute replay window, before anything is recorded.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KINDS: Record<string, string> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.opened": "opened",
  "email.delivery_delayed": "delayed",
};

async function db(path: string, init: RequestInit & { prefer?: string } = {}) {
  const headers: Record<string, string> = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
  if (init.prefer) headers.Prefer = init.prefer;
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Database error ${res.status}`);
  return text ? JSON.parse(text) : null;
}

const b64 = (bytes: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const same = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

async function verified(req: Request, raw: string, signingSecret: string) {
  const id = req.headers.get("svix-id") || "";
  const ts = req.headers.get("svix-timestamp") || "";
  const sigs = (req.headers.get("svix-signature") || "").split(" ").map((s) => s.split(",")[1]).filter(Boolean);
  if (!id || !ts || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", unb64(signingSecret.replace(/^whsec_/, "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const want = b64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${raw}`)));
  return sigs.some((s) => same(s, want));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const raw = await req.text();
  const signing = await db("/rest/v1/rpc/shop_secret_get", { method: "POST", body: JSON.stringify({ p_name: "resend_webhook_secret" }) }).catch(() => null);
  if (!signing || !(await verified(req, raw, signing))) return new Response("Invalid signature", { status: 400 });
  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }
  const kind = KINDS[event?.type];
  const emailId = event?.data?.email_id;
  if (!kind || !emailId) return new Response("ignored", { status: 200 });
  const payload = {
    at: event.created_at || new Date().toISOString(),
    to: Array.isArray(event.data.to) ? event.data.to[0] : event.data.to,
    subject: event.data.subject || null,
    bounce: event.data.bounce ? { type: event.data.bounce.type || null, message: event.data.bounce.message || null } : null,
  };
  await db("/rest/v1/shop_email_events?on_conflict=email_id,kind", {
    method: "POST",
    prefer: "resolution=ignore-duplicates,return=minimal",
    body: JSON.stringify({ email_id: String(emailId).slice(0, 100), kind, payload }),
  });
  return new Response("ok", { status: 200 });
});
