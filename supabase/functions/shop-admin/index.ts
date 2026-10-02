// shop-admin: AutoShop Pro team logins and housekeeping, run with the project's service role.
//   list    – staff logins (owner or manager)
//   invite  – add a login with a temporary password (owner)
//   update  – change someone's role or linked staff profile (owner)
//   reset   – new temporary password (owner)
//   remove  – revoke a login (owner)
//   prune   – drop change history older than 180 days (any staff; the app calls it once a day)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ROLES = ["owner", "manager", "advisor", "tech"];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (message: string, status = 400, code?: string) => json({ error: message, message, code }, status);

// The platform has already verified the token's signature (verify_jwt); read its claims.
function claims(req: Request): Record<string, any> | null {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  try {
    const p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(p + "=".repeat((4 - (p.length % 4)) % 4)));
  } catch {
    return null;
  }
}

async function admin(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin${path}`, {
    ...init,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.msg || data.message || data.error_description || `Auth error ${res.status}`);
  return data;
}

const allUsers = async () => (await admin("/users?per_page=1000")).users || [];

function tempPassword() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const b = crypto.getRandomValues(new Uint8Array(16));
  return [0, 4, 8, 12].map((i) => Array.from(b.slice(i, i + 4), (x) => abc[x % abc.length]).join("")).join("-");
}

const view = (u: any) => ({
  id: u.id,
  email: u.email,
  name: u.user_metadata?.name || "",
  role: u.app_metadata?.autoshop_role || "advisor",
  staffId: u.app_metadata?.autoshop_staff_id || null,
  active: Boolean(u.app_metadata?.autoshop_staff) && !(u.banned_until && new Date(u.banned_until) > new Date()),
  lastSignIn: u.last_sign_in_at || null,
  mustChange: Boolean(u.user_metadata?.must_change_password),
  twoStep: (u.factors || []).some((f: any) => f.status === "verified"),
});

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
  const c = claims(req);
  const meta = c?.app_metadata || {};
  if (!meta.autoshop_staff) return fail("Shop staff only", 403);
  if (!(await twoStepOk(req))) return fail("Enter the code from your authenticator app to continue", 401, "mfa_required");
  const role = meta.autoshop_role || "advisor";
  const owner = role === "owner";
  const body = await req.json().catch(() => ({}));

  try {
    switch (body.action) {
      case "list": {
        if (!["owner", "manager"].includes(role)) return fail("Only the owner or a manager can see logins", 403);
        const users = (await allUsers()).filter((u: any) => u.app_metadata && "autoshop_staff" in u.app_metadata);
        return json({ users: users.map(view) });
      }
      case "invite": {
        if (!owner) return fail("Only the owner can add logins", 403);
        const email = String(body.email || "").trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Enter a valid email address");
        const newRole = ROLES.includes(body.role) ? body.role : "advisor";
        const password = tempPassword();
        const app_metadata = { autoshop_staff: true, autoshop_role: newRole, autoshop_staff_id: body.staffId || null };
        const user_metadata = { name: String(body.name || "").slice(0, 120), must_change_password: true };
        // An existing account (e.g. one removed earlier) is reactivated with a new temporary password.
        const existing = (await allUsers()).find((u: any) => (u.email || "").toLowerCase() === email);
        const u = existing
          ? await admin(`/users/${existing.id}`, {
              method: "PUT",
              body: JSON.stringify({ password, email_confirm: true, ban_duration: "none", app_metadata: { ...existing.app_metadata, ...app_metadata }, user_metadata: { ...existing.user_metadata, ...user_metadata } }),
            })
          : await admin("/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true, app_metadata, user_metadata }) });
        return json({ user: view(u), password });
      }
      case "update": {
        if (!owner) return fail("Only the owner can change logins", 403);
        const cur = await admin(`/users/${encodeURIComponent(body.userId)}`);
        if (cur.id === c?.sub && body.role && body.role !== "owner") return fail("You can’t remove your own owner role");
        const app_metadata = { ...cur.app_metadata };
        if (body.role && ROLES.includes(body.role)) app_metadata.autoshop_role = body.role;
        if (body.staffId !== undefined) app_metadata.autoshop_staff_id = body.staffId;
        const user_metadata = body.name !== undefined ? { ...cur.user_metadata, name: String(body.name).slice(0, 120) } : cur.user_metadata;
        const u = await admin(`/users/${cur.id}`, { method: "PUT", body: JSON.stringify({ app_metadata, user_metadata }) });
        return json({ user: view(u) });
      }
      case "reset": {
        if (!owner) return fail("Only the owner can reset passwords", 403);
        const cur = await admin(`/users/${encodeURIComponent(body.userId)}`);
        const password = tempPassword();
        const u = await admin(`/users/${cur.id}`, { method: "PUT", body: JSON.stringify({ password, user_metadata: { ...cur.user_metadata, must_change_password: true } }) });
        return json({ user: view(u), password });
      }
      case "resetTwoStep": {
        // Lost phone: remove their authenticator app so they can sign in with their password and set it up again.
        if (!owner) return fail("Only the owner can reset two-step sign-in", 403);
        const cur = await admin(`/users/${encodeURIComponent(body.userId)}`);
        for (const f of cur.factors || []) await admin(`/users/${cur.id}/factors/${f.id}`, { method: "DELETE" });
        return json({ user: view(await admin(`/users/${cur.id}`)) });
      }
      case "remove": {
        if (!owner) return fail("Only the owner can remove logins", 403);
        if (body.userId === c?.sub) return fail("You can’t remove your own login");
        const cur = await admin(`/users/${encodeURIComponent(body.userId)}`);
        const u = await admin(`/users/${cur.id}`, { method: "PUT", body: JSON.stringify({ app_metadata: { ...cur.app_metadata, autoshop_staff: false }, ban_duration: "876000h" }) });
        return json({ user: view(u) });
      }
      case "prune": {
        const cutoff = new Date(Date.now() - 180 * 86400000).toISOString();
        const res = await fetch(`${SUPABASE_URL}/rest/v1/shop_record_history?changed_at=lt.${encodeURIComponent(cutoff)}`, {
          method: "DELETE",
          headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, Prefer: "return=minimal" },
        });
        return json({ ok: res.ok });
      }
      default:
        return fail("Unknown action");
    }
  } catch (e) {
    return fail((e as Error).message || "Request failed", 500);
  }
});
