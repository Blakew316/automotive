// shop-secrets: the owner's integration keys, kept in Supabase Vault through the service role.
//   list – which keys are set (with the last 4 characters) — owner or manager
//   set  – save a key or setting (owner)
//   clear – remove a key's value (owner)
// Values are never returned to the app.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
// Keys the app knows about. Settings (ai_*) aren't secret, but only the owner may change them.
const NAMES = [
  "anthropic_api_key", "ai_model", "ai_monthly_cap",
  "twilio_account_sid", "twilio_auth_token", "twilio_phone",
  "stripe_secret_key", "stripe_webhook_secret",
  "quickbooks_client_id", "quickbooks_client_secret",
  "smartcar_client_id", "smartcar_client_secret",
];
const SETTINGS = new Set(["ai_model", "ai_monthly_cap", "twilio_phone"]);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (message: string, status = 400) => json({ error: message, message }, status);

function claims(req: Request): Record<string, any> | null {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  try {
    const p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(p + "=".repeat((4 - (p.length % 4)) % 4)));
  } catch {
    return null;
  }
}

async function rpc(fn: string, args: Record<string, unknown> = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `Database error ${res.status}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("POST only", 405);
  const meta = claims(req)?.app_metadata || {};
  if (!meta.autoshop_staff) return fail("Shop staff only", 403);
  const role = meta.autoshop_role || "advisor";
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "list") {
      if (!["owner", "manager"].includes(role)) return fail("Only the owner or a manager can see integration keys", 403);
      const rows = (await rpc("shop_secret_list")) || [];
      const keys = rows
        .filter((r: any) => NAMES.includes(r.name) && r.is_set)
        .map((r: any) => ({ name: r.name, set: true, hint: SETTINGS.has(r.name) ? null : r.hint, updatedAt: r.updated_at }));
      // Settings come back with their values so the screen can show them; secrets never do.
      const settings: Record<string, string> = {};
      for (const name of SETTINGS) {
        if (keys.some((k: any) => k.name === name)) settings[name] = (await rpc("shop_secret_get", { p_name: name })) || "";
      }
      return json({ keys, settings });
    }
    if (body.action === "set" || body.action === "clear") {
      if (role !== "owner") return fail("Only the owner can change integration keys", 403);
      const name = String(body.name || "");
      if (!NAMES.includes(name)) return fail("Unknown key");
      const value = body.action === "clear" ? "" : String(body.value ?? "").trim();
      if (body.action === "set" && !value) return fail("Enter a value");
      if (value.length > 4000) return fail("That value is too long");
      await rpc("shop_secret_set", { p_name: name, p_value: value });
      return json({ ok: true });
    }
    return fail("Unknown action");
  } catch (e) {
    return fail((e as Error).message || "Something went wrong", 500);
  }
});
