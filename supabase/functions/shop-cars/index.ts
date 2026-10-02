// shop-cars: connected cars through Smartcar, with the vehicle owner's consent.
//   status {vehicleIds} – which of these vehicles are connected, with their latest reading
//   link   {vehicleId}  – a short link to text the customer; it opens Smartcar Connect, where they
//                         sign in to their car's app and approve read-only access
//   read   {vehicleId}  – read odometer, oil life, tire pressures, fuel and battery now
//   unlink {vehicleId}  – disconnect the car and forget its tokens
// Tokens never leave the server; the app only sees readings.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CALLBACK = `${SUPABASE_URL}/functions/v1/oauth-callback`;
const API = "https://api.smartcar.com/v2.0";
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
const stateId = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, "0")).join("");
const safeId = (v: unknown) => String(v || "").replace(/[^\w-]/g, "").slice(0, 80);
const view = (r: any) => ({ vehicleId: r.vehicle_id, vin: r.vin, make: r.make, model: r.model, year: r.year, reading: r.reading, readAt: r.read_at, connectedAt: r.connected_at });

async function token(row: any) {
  if (new Date(row.expires_at).getTime() > Date.now()) return row.access_token;
  const id = await secret("smartcar_client_id");
  const sec = await secret("smartcar_client_secret");
  const res = await fetch("https://auth.smartcar.com/oauth/token", {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${id}:${sec}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: row.refresh_token }),
  });
  const t = await res.json().catch(() => ({}));
  if (!res.ok || !t.access_token) throw Object.assign(new Error("The car’s connection expired — send the customer a new connect link."), { status: 409, code: "expired" });
  await db(`/rest/v1/shop_connected_cars?vehicle_id=eq.${encodeURIComponent(row.vehicle_id)}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: JSON.stringify({ access_token: t.access_token, refresh_token: t.refresh_token || row.refresh_token, expires_at: new Date(Date.now() + (Number(t.expires_in) || 7200) * 1000 - 60_000).toISOString() }),
  });
  return t.access_token;
}

/** One batch read; anything this car's maker doesn't share is simply left out. */
async function read(row: any) {
  const access = await token(row);
  const res = await fetch(`${API}/vehicles/${row.smartcar_id}/batch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json", "sc-unit-system": "imperial" },
    body: JSON.stringify({ requests: [{ path: "/odometer" }, { path: "/engine/oil" }, { path: "/tires/pressure" }, { path: "/fuel" }, { path: "/battery" }] }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw Object.assign(new Error("The customer disconnected this car from their account."), { status: 409, code: "revoked" });
  if (!res.ok) throw new Error(data?.description || data?.message || `Smartcar error ${res.status}`);
  const by: Record<string, any> = {};
  for (const r of data.responses || []) if (r.code === 200) by[r.path] = r.body;
  const pct = (x: unknown) => (typeof x === "number" ? Math.round(x * 100) : null);
  const reading = {
    odometer: typeof by["/odometer"]?.distance === "number" ? Math.round(by["/odometer"].distance) : null,
    oilLife: pct(by["/engine/oil"]?.lifeRemaining),
    tires: by["/tires/pressure"] ? { fl: by["/tires/pressure"].frontLeft, fr: by["/tires/pressure"].frontRight, rl: by["/tires/pressure"].backLeft, rr: by["/tires/pressure"].backRight } : null,
    fuel: by["/fuel"] ? { percent: pct(by["/fuel"].percentRemaining), range: by["/fuel"].range != null ? Math.round(by["/fuel"].range) : null } : null,
    battery: by["/battery"] ? { percent: pct(by["/battery"].percentRemaining), range: by["/battery"].range != null ? Math.round(by["/battery"].range) : null } : null,
  };
  const at = new Date().toISOString();
  await db(`/rest/v1/shop_connected_cars?vehicle_id=eq.${encodeURIComponent(row.vehicle_id)}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ reading, read_at: at }) });
  return { ...view(row), reading, readAt: at };
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
  const body = await req.json().catch(() => ({}));
  try {
    const configured = Boolean((await secret("smartcar_client_id")) && (await secret("smartcar_client_secret")));
    if (body.action === "status") {
      const ids = (Array.isArray(body.vehicleIds) ? body.vehicleIds : []).map(safeId).filter(Boolean).slice(0, 200);
      const rows = ids.length ? await db(`/rest/v1/shop_connected_cars?vehicle_id=in.(${ids.map((x) => `"${x}"`).join(",")})&select=vehicle_id,vin,make,model,year,reading,read_at,connected_at`, { method: "GET" }) : [];
      return json({ configured, redirectUri: CALLBACK, cars: (rows || []).map(view) });
    }
    if (!configured) return fail("Add your Smartcar Client ID and Client secret in Settings → Keys & AI first.", 412, "not_configured");
    const vehicleId = safeId(body.vehicleId);
    if (!vehicleId) return fail("Which vehicle?");

    if (body.action === "link") {
      const state = stateId();
      await db("/rest/v1/shop_oauth_states", {
        method: "POST",
        prefer: "return=minimal",
        body: JSON.stringify({ state, provider: "smartcar", data: { vehicleId, vin: String(body.vin || "").slice(0, 17), vehicle: String(body.vehicle || "").slice(0, 80), shop: String(body.shop || "").slice(0, 80), mode: body.mode === "simulated" ? "simulated" : "live" } }),
      });
      return json({ url: `${CALLBACK}?go=${state}`, expiresIn: 7 * 86400 });
    }

    const rows = await db(`/rest/v1/shop_connected_cars?vehicle_id=eq.${encodeURIComponent(vehicleId)}&select=*`, { method: "GET" });
    const row = rows?.[0];
    if (!row) return fail("This vehicle isn’t connected.", 404, "not_connected");

    if (body.action === "read") return json(await read(row));

    if (body.action === "unlink") {
      try {
        const access = await token(row);
        await fetch(`${API}/vehicles/${row.smartcar_id}/application`, { method: "DELETE", headers: { Authorization: `Bearer ${access}` } });
      } catch {
        // Already disconnected on Smartcar's side.
      }
      await db(`/rest/v1/shop_connected_cars?vehicle_id=eq.${encodeURIComponent(vehicleId)}`, { method: "DELETE", prefer: "return=minimal" });
      return json({ ok: true });
    }
    return fail("Unknown action");
  } catch (e) {
    const err = e as Error & { status?: number; code?: string };
    return fail(err.message || "Something went wrong", err.status && err.status < 500 ? err.status : 500, err.code);
  }
});
