// shop-email: email from the shop's own address, through the shop's Resend account.
//   status        – keys set, the sending domain and its DNS records, the daily summary settings
//   addDomain     – start verifying the shop's domain with Resend (owner): returns the DNS records
//   verifyDomain  – ask Resend to check the DNS records again (owner)
//   send          – one email to a customer (staff), optionally with PDF attachments
//   test          – a test email to the signed-in person (owner or manager)
//   digest        – the daily summary (pg_cron, with the dispatch secret)
// Delivery, bounces and complaints come back through the email-webhook function.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND = "https://api.resend.com";
const WEBHOOK = `${SUPABASE_URL}/functions/v1/email-webhook`;
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
const secret = async (name: string): Promise<string | null> => (await db("/rest/v1/rpc/shop_secret_get", { method: "POST", body: JSON.stringify({ p_name: name }) })) || null;

async function twoStepOk(req: Request) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/shop_mfa_ok`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: req.headers.get("Authorization") || "", "Content-Type": "application/json" },
    body: "{}",
  }).catch(() => null);
  return Boolean(res?.ok && (await res.json().catch(() => false)) === true);
}

async function resend(key: string, path: string, init: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${RESEND}${path}`, {
    method: init.method || "GET",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.message || data?.error || `Resend error ${res.status}`), { status: res.status === 401 || res.status === 403 ? 412 : 502 });
  return data;
}

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Escapes the text and makes web addresses clickable (trailing punctuation and quotes stay outside the link).
const linkify = (raw: string) => raw.split(/(https?:\/\/[^\s<>"']*[^\s<>"'.,;:!?)\]])/g).map((part, i) => (i % 2 ? `<a href="${esc(part)}" style="color:#1c3b6b">${esc(part)}</a>` : esc(part))).join("");
const domainOf = (from: string) => (from.match(/@([^>\s]+)>?\s*$/)?.[1] || "").toLowerCase();
const emailOk = (s: unknown) => typeof s === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());

/** The shop's message in a clean, branded layout (plain text stays as written). */
function branded(shop: { name?: string; phone?: string; address?: string; email?: string }, bodyText: string, extra = "") {
  const paras = String(bodyText || "").split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${linkify(p).replace(/\n/g, "<br>")}</p>`).join("");
  const footer = [shop.address, shop.phone, shop.email].filter(Boolean).map(esc).join(" · ");
  return `<!doctype html><html><body style="margin:0;background:#f1f3f6;padding:24px 12px;font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18202b">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">
<div style="height:3px;background:linear-gradient(90deg,#1c3b6b,#4d56bf,#7a5cc4,#2f76ba)"></div>
<div style="padding:24px 26px 8px"><div style="font-weight:700;font-size:17px;margin-bottom:16px">${esc(shop.name || "")}</div>${paras}${extra}</div>
<div style="padding:14px 26px 20px;border-top:1px solid #e6e9ee;color:#6b7482;font-size:12.5px">${footer}</div>
</div></body></html>`;
}

const money = (n: unknown) => `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The owner's daily summary, from the numbers the app keeps current. */
function digestHtml(shopName: string, day: string, s: any) {
  const tile = (label: string, value: string, sub = "") => `<td style="padding:10px 12px;border:1px solid #e6e9ee;border-radius:10px;width:33%;vertical-align:top"><div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6b7482">${esc(label)}</div><div style="font-size:20px;font-weight:700;margin-top:2px">${esc(value)}</div>${sub ? `<div style="font-size:12px;color:#6b7482">${esc(sub)}</div>` : ""}</td>`;
  const list = (title: string, items: string[]) => (items?.length ? `<div style="margin-top:18px"><div style="font-weight:600;margin-bottom:6px">${esc(title)}</div><ul style="margin:0;padding-left:18px;color:#3a4350">${items.slice(0, 8).map((i) => `<li style="margin:2px 0">${esc(i)}</li>`).join("")}</ul></div>` : "");
  const t = s.today || {};
  return `<!doctype html><html><body style="margin:0;background:#f1f3f6;padding:24px 12px;font:14.5px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18202b">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden">
<div style="height:3px;background:linear-gradient(90deg,#1c3b6b,#4d56bf,#7a5cc4,#2f76ba)"></div>
<div style="padding:22px 24px">
<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#4d56bf;font-weight:600">${esc(day)}</div>
<div style="font-size:20px;font-weight:700;margin:2px 0 16px">${esc(shopName)} — today</div>
<table role="presentation" style="width:100%;border-collapse:separate;border-spacing:6px"><tr>
${tile("Sales", money(t.sales), `${t.invoiced || 0} invoiced RO${t.invoiced === 1 ? "" : "s"}`)}${tile("Collected", money(t.collected), `${t.payments || 0} payment${t.payments === 1 ? "" : "s"}`)}${tile("Car count", String(t.carCount ?? 0), t.aro ? `ARO ${money(t.aro)}` : "")}
</tr><tr>
${tile("In the shop", String(s.inShop ?? 0), `${s.waitingParts || 0} waiting on parts`)}${tile("Estimates out", money(s.estimatesValue), `${s.estimates || 0} awaiting approval`)}${tile("Receivables", money(s.receivables), `${s.unpaid || 0} unpaid`)}
</tr></table>
${list("Tomorrow’s appointments", s.tomorrow)}
${list("Needs attention", s.attention)}
<p style="margin:18px 0 0;color:#6b7482;font-size:12.5px">Numbers as of ${esc(s.asOf || "")} from AutoShop Pro.</p>
</div></div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("POST only", 405);
  const body = await req.json().catch(() => ({}));

  // ---- Scheduled daily summary (pg_cron presents the dispatch secret).
  if (body.action === "digest") {
    const want = await secret("dispatch_secret");
    if (!want || req.headers.get("x-dispatch-secret") !== want) return fail("Forbidden", 403);
    try {
      const key = await secret("resend_api_key");
      const from = await secret("email_from");
      const d = (await db("/rest/v1/shop_digest?id=eq.1&select=*", { method: "GET" }))?.[0];
      if (!key || !from || !d?.enabled || !d.recipients?.length) return json({ skipped: "not set up" });
      const today = new Date().toLocaleDateString("en-CA", { timeZone: d.tz });
      if (d.last_sent && d.last_sent >= today) return json({ skipped: "already sent" });
      const s = d.snapshot || {};
      const fresh = d.snapshot_day === today;
      const shopName = s.shop || "Your shop";
      const dayLabel = new Date().toLocaleDateString("en-US", { timeZone: d.tz, weekday: "long", month: "long", day: "numeric" });
      const html = fresh
        ? digestHtml(shopName, dayLabel, s)
        : branded({ name: shopName }, `No device has been open in AutoShop Pro today, so there are no new numbers for ${dayLabel}. The summary comes back as soon as the shop's app is used.`);
      await resend(key, "/emails", { method: "POST", body: { from, to: d.recipients, subject: `${shopName} — ${dayLabel}`, html, tags: [{ name: "kind", value: "digest" }] } });
      await db("/rest/v1/shop_digest?id=eq.1", { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ last_sent: today }) });
      return json({ sent: d.recipients.length });
    } catch (e) {
      return fail((e as Error).message || "Couldn’t send the summary", 500);
    }
  }

  const c = claims(req);
  const meta = c?.app_metadata || {};
  if (!meta.autoshop_staff) return fail("Shop staff only", 403);
  if (!(await twoStepOk(req))) return fail("Enter the code from your authenticator app to continue", 401, "mfa_required");
  const role = meta.autoshop_role || "advisor";
  const manager = ["owner", "manager"].includes(role);

  try {
    const key = await secret("resend_api_key");
    const from = (await secret("email_from")) || "";
    const replyTo = (await secret("email_reply_to")) || "";
    const configured = Boolean(key && from);

    if (body.action === "status") {
      let domain = null;
      let error = null;
      if (key && from) {
        try {
          const list = await resend(key, "/domains");
          const want = domainOf(from);
          const found = (list.data || []).find((x: any) => String(x.name).toLowerCase() === want);
          if (found) {
            const full = await resend(key, `/domains/${found.id}`);
            domain = { id: full.id, name: full.name, status: full.status, region: full.region, records: (full.records || []).map((r: any) => ({ record: r.record, type: r.type, name: r.name, value: r.value, priority: r.priority ?? null, ttl: r.ttl, status: r.status })) };
          } else domain = { name: want, status: "not_added", records: [] };
        } catch (e) {
          error = (e as Error).message;
        }
      }
      const webhookSet = Boolean(await secret("resend_webhook_secret"));
      // The scheduled daily summary calls back into this project (shop-phone saves it too).
      if (!(await secret("project_url"))) await db("/rest/v1/rpc/shop_secret_set", { method: "POST", body: JSON.stringify({ p_name: "project_url", p_value: SUPABASE_URL }) }).catch(() => {});
      const digest = manager ? (await db("/rest/v1/shop_digest?id=eq.1&select=enabled,hour,tz,recipients,last_sent,snapshot_at", { method: "GET" }))?.[0] || null : null;
      return json({ configured, keySet: Boolean(key), from: from || null, replyTo: replyTo || null, domain, error, webhook: WEBHOOK, webhookSet, digest });
    }
    if (!key) return fail("Add your Resend API key in Settings → Keys & AI first.", 412, "not_configured");

    if (body.action === "addDomain" || body.action === "verifyDomain") {
      if (role !== "owner") return fail("Only the owner can set up the shop’s email domain", 403);
      if (body.action === "addDomain") {
        const name = String(body.name || domainOf(from)).trim().toLowerCase();
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(name)) return fail("Enter the domain your email address uses, like mainstreetauto.com");
        const d = await resend(key, "/domains", { method: "POST", body: { name } });
        return json({ id: d.id, name: d.name, status: d.status, records: d.records || [] });
      }
      await resend(key, `/domains/${encodeURIComponent(String(body.id))}/verify`, { method: "POST" });
      return json({ ok: true });
    }

    if (!from) return fail("Add the address to send from in Settings → Keys & AI first.", 412, "not_configured");

    if (body.action === "test") {
      if (!manager) return fail("Only the owner or a manager can send a test", 403);
      const to = String(body.to || c?.email || "").trim();
      if (!emailOk(to)) return fail("Which address should the test go to?");
      const r = await resend(key, "/emails", {
        method: "POST",
        body: { from, to: [to], subject: `Test email from ${body.shop || "AutoShop Pro"}`, html: branded({ name: body.shop, phone: body.phone, address: body.address, email: replyTo }, "This is a test from AutoShop Pro. If you can read this, customer emails are working — they’ll come from this address and replies go to your inbox."), ...(replyTo ? { reply_to: replyTo } : {}), tags: [{ name: "kind", value: "test" }] },
      });
      return json({ id: r.id, to });
    }

    if (body.action === "send") {
      const to = String(body.to || "").trim();
      if (!emailOk(to)) return fail("That email address doesn’t look right");
      const subject = String(body.subject || "").replace(/[\r\n]+/g, " ").trim().slice(0, 200);
      const text = String(body.text || "").trim().slice(0, 20000);
      if (!subject || !text) return fail("Add a subject and a message");
      const attachments = (Array.isArray(body.attachments) ? body.attachments : [])
        .slice(0, 5)
        .filter((a: any) => a && typeof a.filename === "string" && typeof a.content === "string")
        .map((a: any) => ({ filename: a.filename.replace(/[^\w.\- ]+/g, "").slice(0, 120) || "attachment.pdf", content: a.content }));
      if (attachments.reduce((t: number, a: any) => t + a.content.length, 0) > 14_000_000) return fail("Attachments are too large to email");
      const shop = body.shop || {};
      const r = await resend(key, "/emails", {
        method: "POST",
        body: {
          from,
          to: [to],
          subject,
          text,
          html: branded({ name: shop.name, phone: shop.phone, address: shop.address, email: replyTo || shop.email }, text),
          ...(replyTo || emailOk(shop.email) ? { reply_to: replyTo || shop.email } : {}),
          ...(attachments.length ? { attachments } : {}),
          tags: [{ name: "kind", value: String(body.kind || "message").replace(/[^\w-]/g, "").slice(0, 40) || "message" }],
        },
      });
      return json({ id: r.id });
    }

    return fail("Unknown action");
  } catch (e) {
    const err = e as Error & { status?: number; code?: string };
    return fail(err.message || "Something went wrong", err.status && err.status < 600 ? err.status : 500, err.code);
  }
});
