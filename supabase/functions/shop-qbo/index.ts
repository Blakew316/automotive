// shop-qbo: QuickBooks Online for the shop's books, through the shop's own Intuit app.
//   status     – keys set, connected company, sandbox or production (owner or manager)
//   authorize  – start connecting: returns Intuit's sign-in address (owner)
//   disconnect – revoke access and forget the tokens (owner)
//   accounts   – the company's chart of accounts, for mapping (owner or manager)
//   post       – post daily sales journals (one journal entry per day, DocNumber SALES-YYYYMMDD);
//                a day that was posted before is updated in place, so posting again is safe
// Tokens live in Vault; this function never returns them.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REDIRECT = `${SUPABASE_URL}/functions/v1/oauth-callback`;
const MINOR = "minorversion=75";
const DAILY_CUSTOMER = "AutoShop Pro daily sales";
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
const save = (name: string, value: string) => rpc("shop_secret_set", { p_name: name, p_value: value });

const stateId = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");

/** A current access token, refreshing it (and saving the rotated refresh token) when needed. */
async function accessToken(): Promise<{ token: string; realm: string; base: string }> {
  const realm = await secret("qbo_realm_id");
  const refresh = await secret("qbo_refresh_token");
  if (!realm || !refresh) throw Object.assign(new Error("QuickBooks isn't connected"), { status: 412 });
  const env = (await secret("qbo_env")) === "production" ? "production" : "sandbox";
  const base = `${env === "production" ? "https://quickbooks.api.intuit.com" : "https://sandbox-quickbooks.api.intuit.com"}/v3/company/${realm}`;
  const cur = await secret("qbo_access_token");
  if (cur && Number(await secret("qbo_access_expires")) > Date.now()) return { token: cur, realm, base };
  const id = await secret("quickbooks_client_id");
  const sec = await secret("quickbooks_client_secret");
  const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${id}:${sec}`)}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw Object.assign(new Error("QuickBooks needs to be connected again (its sign-in expired)."), { status: 412, code: "reconnect" });
  await save("qbo_access_token", data.access_token);
  await save("qbo_access_expires", String(Date.now() + (Number(data.expires_in) || 3600) * 1000 - 60_000));
  if (data.refresh_token && data.refresh_token !== refresh) await save("qbo_refresh_token", data.refresh_token);
  return { token: data.access_token, realm, base };
}

async function qbo(t: { token: string; base: string }, path: string, body?: unknown) {
  const res = await fetch(`${t.base}${path}${path.includes("?") ? "&" : "?"}${MINOR}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${t.token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data?.Fault?.Error?.[0];
    throw Object.assign(new Error(e ? `${e.Message}${e.Detail ? ` — ${e.Detail}` : ""}` : `QuickBooks error ${res.status}`), { status: res.status });
  }
  return data;
}
const query = (t: { token: string; base: string }, q: string) => qbo(t, `/query?query=${encodeURIComponent(q)}`).then((d) => d.QueryResponse || {});
const quote = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

const cents = (n: unknown) => Math.round((Number(n) || 0) * 100);

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
  if (!["owner", "manager"].includes(role)) return fail("Only the owner or a manager can work with QuickBooks", 403);
  const body = await req.json().catch(() => ({}));

  try {
    const configured = Boolean((await secret("quickbooks_client_id")) && (await secret("quickbooks_client_secret")));

    if (body.action === "status") {
      const connected = Boolean((await secret("qbo_realm_id")) && (await secret("qbo_refresh_token")));
      const env = (await secret("qbo_env")) || null;
      let company = null;
      let error = null;
      if (connected) {
        try {
          const t = await accessToken();
          const info = await qbo(t, `/companyinfo/${t.realm}`);
          company = info.CompanyInfo?.CompanyName || null;
        } catch (e) {
          error = (e as Error).message;
        }
      }
      return json({ configured, connected, env, company, error, redirectUri: REDIRECT });
    }
    if (!configured) return fail("Add your Intuit app's Client ID and Client secret in Settings → Keys & AI first.", 412, "not_configured");

    if (body.action === "authorize") {
      if (role !== "owner") return fail("Only the owner can connect QuickBooks", 403);
      const ret = String(body.returnUrl || "");
      if (!/^https?:\/\//.test(ret)) return fail("Missing the address to come back to");
      const state = stateId();
      await db("/rest/v1/shop_oauth_states", { method: "POST", prefer: "return=minimal", body: JSON.stringify({ state, provider: "quickbooks", return_url: ret.slice(0, 500), data: { env: body.env === "production" ? "production" : "sandbox" } }) });
      const u = new URL("https://appcenter.intuit.com/connect/oauth2");
      u.search = new URLSearchParams({ client_id: (await secret("quickbooks_client_id"))!, response_type: "code", scope: "com.intuit.quickbooks.accounting", redirect_uri: REDIRECT, state }).toString();
      return json({ url: u.toString() });
    }

    if (body.action === "disconnect") {
      if (role !== "owner") return fail("Only the owner can disconnect QuickBooks", 403);
      const refresh = await secret("qbo_refresh_token");
      if (refresh) {
        const id = await secret("quickbooks_client_id");
        const sec = await secret("quickbooks_client_secret");
        await fetch("https://developer.api.intuit.com/v2/oauth2/tokens/revoke", { method: "POST", headers: { Authorization: `Basic ${btoa(`${id}:${sec}`)}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ token: refresh }) }).catch(() => {});
      }
      for (const n of ["qbo_refresh_token", "qbo_access_token", "qbo_access_expires", "qbo_realm_id"]) await save(n, "");
      return json({ ok: true });
    }

    const t = await accessToken();

    if (body.action === "accounts") {
      const r = await query(t, "select Id, Name, FullyQualifiedName, AccountType, AccountSubType, AcctNum, Active from Account where Active = true maxresults 1000");
      return json({ accounts: (r.Account || []).map((a: any) => ({ id: a.Id, name: a.FullyQualifiedName || a.Name, type: a.AccountType, subType: a.AccountSubType, number: a.AcctNum || "" })) });
    }

    if (body.action === "post") {
      const map: Record<string, { id: string }> = body.map || {};
      const journals: any[] = Array.isArray(body.journals) ? body.journals.slice(0, 62) : [];
      // Lines on Accounts Receivable need a customer: one for the daily summaries.
      let customerId: string | null = null;
      const needCustomer = async () => {
        if (customerId) return customerId;
        const found = await query(t, `select Id from Customer where DisplayName = '${quote(DAILY_CUSTOMER)}'`);
        customerId = found.Customer?.[0]?.Id || (await qbo(t, "/customer", { DisplayName: DAILY_CUSTOMER, Notes: "Daily sales summaries posted by AutoShop Pro" })).Customer.Id;
        return customerId;
      };
      const accounts = await query(t, "select Id, AccountType from Account maxresults 1000");
      const typeOf = new Map((accounts.Account || []).map((a: any) => [a.Id, a.AccountType]));
      const results = [];
      for (const j of journals) {
        const no = String(j.no || "").slice(0, 21);
        try {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(j.date || "") || !no) throw new Error("Bad journal");
          const lines = [];
          let dr = 0;
          let cr = 0;
          for (const l of j.lines || []) {
            const acct = map[l.account]?.id;
            if (!acct) throw new Error(`Choose a QuickBooks account for “${l.account}”`);
            const d = cents(l.debit);
            const c = cents(l.credit);
            if (!d && !c) continue;
            dr += d;
            cr += c;
            const detail: Record<string, unknown> = { PostingType: d ? "Debit" : "Credit", AccountRef: { value: acct } };
            if (typeOf.get(acct) === "Accounts Receivable") detail.Entity = { Type: "Customer", EntityRef: { value: await needCustomer() } };
            lines.push({ DetailType: "JournalEntryLineDetail", Amount: (d || c) / 100, Description: String(l.account).slice(0, 4000), JournalEntryLineDetail: detail });
          }
          if (dr !== cr) throw new Error(`Debits and credits differ by ${((dr - cr) / 100).toFixed(2)}`);
          if (!lines.length) {
            results.push({ no, status: "empty" });
            continue;
          }
          const entry = { DocNumber: no, TxnDate: j.date, PrivateNote: String(j.memo || "Daily sales summary from AutoShop Pro").slice(0, 4000), Line: lines };
          const existing = (await query(t, `select * from JournalEntry where DocNumber = '${quote(no)}'`)).JournalEntry?.[0];
          if (existing) {
            const same = existing.Line?.length === lines.length && existing.Line.every((x: any, i: number) => cents(x.Amount) === cents(lines[i].Amount) && x.JournalEntryLineDetail?.PostingType === lines[i].JournalEntryLineDetail.PostingType && x.JournalEntryLineDetail?.AccountRef?.value === lines[i].JournalEntryLineDetail.AccountRef.value);
            if (same && existing.TxnDate === j.date) {
              results.push({ no, status: "unchanged", id: existing.Id });
              continue;
            }
            const r = await qbo(t, "/journalentry", { ...entry, Id: existing.Id, SyncToken: existing.SyncToken });
            results.push({ no, status: "updated", id: r.JournalEntry?.Id });
          } else {
            const r = await qbo(t, "/journalentry", entry);
            results.push({ no, status: "created", id: r.JournalEntry?.Id });
          }
        } catch (e) {
          results.push({ no, status: "error", error: (e as Error).message });
        }
      }
      return json({ results });
    }

    return fail("Unknown action");
  } catch (e) {
    const err = e as Error & { status?: number; code?: string };
    return fail(err.message || "Something went wrong", err.status && err.status < 500 ? err.status : 500, err.code);
  }
});
