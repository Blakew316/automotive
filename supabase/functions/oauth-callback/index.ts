// oauth-callback: where QuickBooks Online and Smartcar send people back after they approve access.
//   ?go=<state>                     – short link texted to a customer: forwards to Smartcar Connect
//   ?code=…&state=…[&realmId=…]     – the return trip: trade the one-time code for tokens and save
//                                     them (QuickBooks → Vault; a car → shop_connected_cars)
// The state value must match one the shop created in the last 30 minutes (QuickBooks) or 7 days
// (a texted car link), and is used once.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SELF = `${SUPABASE_URL}/functions/v1/oauth-callback`;
const SMARTCAR_SCOPES = ["read_vehicle_info", "read_vin", "read_odometer", "read_engine_oil", "read_tires", "read_fuel", "read_battery"];

async function db(path: string, init: RequestInit & { prefer?: string } = {}) {
  const headers: Record<string, string> = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
  if (init.prefer) headers.Prefer = init.prefer;
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Database error ${res.status}`);
  return data;
}
const rpc = (fn: string, args: Record<string, unknown>) => db(`/rest/v1/rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
const secret = async (name: string): Promise<string | null> => (await rpc("shop_secret_get", { p_name: name })) || null;
const save = (name: string, value: string) => rpc("shop_secret_set", { p_name: name, p_value: value });

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function page(title: string, body: string, ok = true) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{margin:0;font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;background:#f1f3f6;color:#18202b;display:grid;place-items:center;min-height:100vh}
main{background:#fff;border-radius:16px;box-shadow:0 1px 3px #0001;padding:32px 28px;max-width:380px;margin:16px;text-align:center}
.i{width:48px;height:48px;border-radius:50%;margin:0 auto 12px;display:grid;place-items:center;font-size:24px;background:${ok ? "#e5f4ea" : "#fbe9e9"};color:${ok ? "#1d7a3e" : "#a12b2b"}}
h1{font-size:20px;margin:0 0 6px}p{margin:0;color:#4b5563}</style></head>
<body><main><div class="i">${ok ? "✓" : "!"}</div><h1>${esc(title)}</h1><p>${esc(body)}</p></main></body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
const redirect = (url: string) => new Response(null, { status: 302, headers: { Location: url } });
const back = (url: string | null, params: Record<string, string>) => {
  if (!url || !/^https?:\/\//.test(url)) return page(params.qbo === "connected" ? "QuickBooks connected" : "Something went wrong", params.message || "You can close this window and go back to AutoShop Pro.", params.qbo === "connected");
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return redirect(u.toString());
};

async function takeState(state: string, maxAgeMs: number) {
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(state)) return null;
  const rows = await db(`/rest/v1/shop_oauth_states?state=eq.${state}&select=*`, { method: "GET" });
  const row = rows?.[0];
  if (!row) return null;
  if (Date.now() - new Date(row.created_at).getTime() > maxAgeMs) {
    await db(`/rest/v1/shop_oauth_states?state=eq.${state}`, { method: "DELETE", prefer: "return=minimal" });
    return null;
  }
  return row;
}
const dropState = (state: string) => db(`/rest/v1/shop_oauth_states?state=eq.${state}`, { method: "DELETE", prefer: "return=minimal" });

async function quickbooks(row: any, code: string, realmId: string) {
  const id = await secret("quickbooks_client_id");
  const sec = await secret("quickbooks_client_secret");
  if (!id || !sec) return back(row.return_url, { qbo: "error", message: "QuickBooks keys are missing" });
  const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${id}:${sec}`)}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: SELF }),
  });
  const data = await res.json().catch(() => ({}));
  await dropState(row.state);
  if (!res.ok || !data.refresh_token) return back(row.return_url, { qbo: "error", message: data.error_description || data.error || "QuickBooks didn't accept the connection" });
  await save("qbo_refresh_token", data.refresh_token);
  await save("qbo_access_token", data.access_token);
  await save("qbo_access_expires", String(Date.now() + (Number(data.expires_in) || 3600) * 1000 - 60_000));
  await save("qbo_realm_id", realmId);
  await save("qbo_env", row.data?.env === "production" ? "production" : "sandbox");
  return back(row.return_url, { qbo: "connected" });
}

async function smartcar(row: any, code: string) {
  const id = await secret("smartcar_client_id");
  const sec = await secret("smartcar_client_secret");
  if (!id || !sec) return page("Couldn’t connect", "The shop hasn’t finished setting up connected cars. Please let them know.", false);
  const res = await fetch("https://auth.smartcar.com/oauth/token", {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${id}:${sec}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: SELF }),
  });
  const tok = await res.json().catch(() => ({}));
  if (!res.ok || !tok.access_token) return page("Couldn’t connect", "Your car’s account didn’t finish connecting. Please try the link again.", false);
  const auth = { Authorization: `Bearer ${tok.access_token}` };
  const list = await fetch("https://api.smartcar.com/v2.0/vehicles", { headers: auth }).then((r) => r.json()).catch(() => ({}));
  const ids: string[] = list.vehicles || [];
  if (!ids.length) return page("No vehicle found", "That account didn’t share a vehicle. Please try the link again and choose your car.", false);
  // More than one car on the account: pick the one whose VIN matches the shop's record.
  const want = String(row.data?.vin || "").toUpperCase();
  let chosen = "";
  let vin = "";
  let firstVin = "";
  for (const sid of ids) {
    const v = await fetch(`https://api.smartcar.com/v2.0/vehicles/${sid}/vin`, { headers: auth }).then((r) => r.json()).catch(() => ({}));
    if (sid === ids[0]) firstVin = v.vin || "";
    if (!want || String(v.vin || "").toUpperCase() === want) {
      chosen = sid;
      vin = v.vin || "";
      break;
    }
  }
  // No VIN match (or the shop has no VIN on file): the first car they shared.
  if (!chosen) {
    chosen = ids[0];
    vin = firstVin;
  }
  const info = await fetch(`https://api.smartcar.com/v2.0/vehicles/${chosen}`, { headers: auth }).then((r) => r.json()).catch(() => ({}));
  await db("/rest/v1/shop_connected_cars?on_conflict=vehicle_id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: JSON.stringify({
      vehicle_id: row.data.vehicleId,
      smartcar_id: chosen,
      vin: vin || null,
      make: info.make || null,
      model: info.model || null,
      year: Number(info.year) || null,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: new Date(Date.now() + (Number(tok.expires_in) || 7200) * 1000 - 60_000).toISOString(),
      connected_at: new Date().toISOString(),
    }),
  });
  await dropState(row.state);
  return page("You’re connected", `${row.data?.shop || "The shop"} can now see your ${row.data?.vehicle || "vehicle"}’s mileage, oil life and tire pressures to keep up with its maintenance. You can disconnect anytime by asking the shop.`);
}

Deno.serve(async (req) => {
  const q = new URL(req.url).searchParams;
  try {
    // Short link → Smartcar Connect.
    const go = q.get("go");
    if (go) {
      const row = await takeState(go, 7 * 86_400_000);
      if (!row || row.provider !== "smartcar") return page("Link expired", "This link has expired. Please ask the shop for a new one.", false);
      const id = await secret("smartcar_client_id");
      if (!id) return page("Not available", "The shop hasn’t finished setting up connected cars.", false);
      const u = new URL("https://connect.smartcar.com/oauth/authorize");
      u.search = new URLSearchParams({ response_type: "code", client_id: id, redirect_uri: SELF, scope: SMARTCAR_SCOPES.join(" "), mode: row.data?.mode === "simulated" ? "simulated" : "live", state: row.state }).toString();
      return redirect(u.toString());
    }

    const state = q.get("state") || "";
    const row = await takeState(state, 7 * 86_400_000);
    if (!row) return page("Link expired", "This sign-in link has expired or was already used. Please start again.", false);
    if (q.get("error")) {
      if (row.provider === "quickbooks") {
        await dropState(state);
        return back(row.return_url, { qbo: "error", message: q.get("error_description") || "Access wasn’t granted" });
      }
      // The texted link stays good, so the customer can change their mind.
      return page("Not connected", "No problem — your car wasn’t connected. You can use the link again anytime this week.", false);
    }
    const code = q.get("code") || "";
    if (!code) return page("Something went wrong", "The sign-in didn’t finish. Please start again.", false);
    if (row.provider === "quickbooks") {
      if (Date.now() - new Date(row.created_at).getTime() > 30 * 60_000) return back(row.return_url, { qbo: "error", message: "That took too long — please connect again" });
      return await quickbooks(row, code, q.get("realmId") || "");
    }
    return await smartcar(row, code);
  } catch (e) {
    return page("Something went wrong", (e as Error).message || "Please try again.", false);
  }
});
