// Talks to the shop's Supabase project for shared data: the sync functions in the database
// (push_records, pull_records, shop_manifest, get_records), live updates, change history, backups,
// shop files and the shop-admin server function (team logins).
import { accessToken } from '../cloudShare';

export const FILES_BUCKET = 'autoshop-files';

async function call(cfg, path, { method = 'POST', body, headers = {}, raw = false } = {}) {
  const token = await accessToken(cfg);
  const res = await fetch(`${cfg.url}${path}`, {
    method,
    headers: { apikey: cfg.key, Authorization: `Bearer ${token}`, ...(body !== undefined && !(body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : body instanceof Blob ? body : JSON.stringify(body),
  });
  if (raw) return res;
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data && (data.message || data.error_description || data.error || data.msg)) || `Request failed (${res.status})`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return data;
}

const rpc = (cfg, fn, args) => call(cfg, `/rest/v1/rpc/${fn}`, { body: args });

/** The data API used by the sync engine. */
export function syncApi(cfg) {
  let realtime = null;
  return {
    push: (changes, who, device) => rpc(cfg, 'push_records', { changes, who, from_device: device }),
    pull: (since, maxRows) => rpc(cfg, 'pull_records', { since, max_rows: maxRows }),
    manifest: () => rpc(cfg, 'shop_manifest', {}),
    get: (keys) => rpc(cfg, 'get_records', { keys }),
    count: () => rpc(cfg, 'shop_manifest', {}).then((m) => m.live || 0),
    // Live updates over a websocket; polling covers anything missed while it's down.
    subscribe(onRows, onLive) {
      let alive = true;
      let refresh = null;
      (async () => {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          if (!alive) return;
          const client = createClient(cfg.url, cfg.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
          realtime = client;
          const auth = async () => client.realtime.setAuth(await accessToken(cfg));
          await auth();
          refresh = setInterval(() => auth().catch(() => {}), 4 * 60_000);
          client
            .channel('shop-records')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_records' }, (p) => {
              const r = p.new;
              if (r && r.collection) onRows([{ collection: r.collection, id: r.id, data: r.data, deleted: r.deleted, version: r.version, seq: r.seq, actor: r.actor }]);
            })
            .subscribe((status) => onLive(status === 'SUBSCRIBED'));
        } catch {
          onLive(false);
        }
      })();
      return () => {
        alive = false;
        clearInterval(refresh);
        realtime?.removeAllChannels?.();
        onLive(false);
      };
    },
  };
}

// ---------------------------------------------------------------- History & backups

/** Versions of one record, newest first. */
export function recordHistory(cfg, collection, id, limit = 50) {
  const q = new URLSearchParams({ select: 'version,data,deleted,changed_at,actor,device', collection: `eq.${collection}`, id: `eq.${id}`, order: 'version.desc', limit: String(limit) });
  return call(cfg, `/rest/v1/shop_record_history?${q}`, { method: 'GET' });
}

export const listBackups = (cfg) => call(cfg, `/rest/v1/shop_backups?select=id,created_at,note,records&order=created_at.desc`, { method: 'GET' });
export const getBackup = (cfg, id) => call(cfg, `/rest/v1/shop_backups?select=id,created_at,note,records,data&id=eq.${Number(id)}`, { method: 'GET' }).then((r) => r?.[0] || null);
export const backupNow = (cfg) => rpc(cfg, 'snapshot_shop', { note: 'Backup made by hand' });
export const restoreBackup = (cfg, id) => rpc(cfg, 'restore_backup', { backup_id: Number(id) });

// ---------------------------------------------------------------- Shop files (photos & video)

const filePath = (id, which) => `media/${encodeURIComponent(id)}${which === 'thumb' ? '-thumb' : ''}`;

export async function uploadFile(cfg, id, which, blob) {
  await call(cfg, `/storage/v1/object/${FILES_BUCKET}/${filePath(id, which)}`, {
    body: blob,
    headers: { 'Content-Type': blob.type || 'application/octet-stream', 'x-upsert': 'true', 'cache-control': 'max-age=31536000' },
  });
}

/** A shop file as a Blob, or null if it isn't in the cloud. */
export async function downloadFile(cfg, id, which) {
  const res = await call(cfg, `/storage/v1/object/authenticated/${FILES_BUCKET}/${filePath(id, which)}`, { method: 'GET', raw: true });
  if (res.status === 400 || res.status === 404) return null;
  if (!res.ok) throw Object.assign(new Error(`File download failed (${res.status})`), { status: res.status });
  return res.blob();
}

// ---------------------------------------------------------------- Team logins (shop-admin function)

export const shopAdmin = (cfg, action, args = {}) => call(cfg, '/functions/v1/shop-admin', { body: { action, ...args } });

// ---------------------------------------------------------------- Integration keys & AI (server functions)
export const shopSecrets = (cfg, action, args = {}) => call(cfg, '/functions/v1/shop-secrets', { body: { action, ...args } });
export const shopAi = (cfg, body) => call(cfg, '/functions/v1/shop-ai', { body });

// ---------------------------------------------------------------- Business phone (Twilio through shop-phone)
export const shopPhone = (cfg, action, args = {}) => call(cfg, '/functions/v1/shop-phone', { body: { action, ...args } });

/** Texts, delivery receipts and calls the phone server recorded, oldest first. */
export const phoneEvents = (cfg) => call(cfg, '/rest/v1/shop_phone_events?select=id,kind,sid,payload,final,created_at&order=id.asc&limit=200', { method: 'GET' });
export const clearPhoneEvents = (cfg, ids) => (ids.length ? call(cfg, `/rest/v1/shop_phone_events?id=in.(${ids.map(Number).join(',')})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }) : null);

/** Live phone events (a call ringing, a text arriving); polling covers anything missed. */
export const subscribePhoneEvents = (cfg, onRow, onLive) => subscribeTable(cfg, 'shop_phone_events', onRow, onLive);

/** New and changed rows in one table, live over Realtime (for staff, as RLS allows). */
export function subscribeTable(cfg, table, onRow, onLive) {
  let alive = true;
  let client = null;
  let refresh = null;
  (async () => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      if (!alive) return;
      client = createClient(cfg.url, cfg.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      const auth = async () => client.realtime.setAuth(await accessToken(cfg));
      await auth();
      refresh = setInterval(() => auth().catch(() => {}), 4 * 60_000);
      client
        .channel(`live-${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (p) => p.new?.id && onRow(p.new))
        .subscribe((status) => onLive(status === 'SUBSCRIBED'));
    } catch {
      onLive(false);
    }
  })();
  return () => {
    alive = false;
    clearInterval(refresh);
    client?.removeAllChannels?.();
    onLive(false);
  };
}

/** Appointment texts the server sends on its own (idempotent by key). */
export const scheduleTexts = (cfg, items) => rpc(cfg, 'shop_outbox_schedule', { items });
export const cancelTexts = (cfg, keys) => rpc(cfg, 'shop_outbox_cancel', { keys });
export const scheduledTexts = (cfg) => call(cfg, '/rest/v1/shop_sms_outbox?select=key,to_phone,send_at,status,error,meta&key=like.appt-*&order=send_at.asc&limit=500', { method: 'GET' });

/** A private shop file by its storage path (texted photos, voicemail). */
export async function downloadPath(cfg, path) {
  const res = await call(cfg, `/storage/v1/object/authenticated/${FILES_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`, { method: 'GET', raw: true });
  if (!res.ok) throw Object.assign(new Error(`File download failed (${res.status})`), { status: res.status });
  return res.blob();
}

/** Save a small private JSON file (e.g. phone/profile.json for the phone server). */
export const uploadPrivateJson = (cfg, path, data) =>
  call(cfg, `/storage/v1/object/${FILES_BUCKET}/${path}`, { body: new Blob([JSON.stringify(data)], { type: 'application/json' }), headers: { 'Content-Type': 'application/json', 'x-upsert': 'true', 'cache-control': 'no-cache' } });

// ---------------------------------------------------------------- Online payments (Stripe through shop-pay)
export const shopPay = (cfg, action, args = {}) => call(cfg, '/functions/v1/shop-pay', { body: { action, ...args } });
export const payEvents = (cfg) => call(cfg, '/rest/v1/shop_pay_events?select=id,kind,ref,payload,created_at&order=id.asc&limit=200', { method: 'GET' });
export const clearPayEvents = (cfg, ids) => (ids.length ? call(cfg, `/rest/v1/shop_pay_events?id=in.(${ids.map(Number).join(',')})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }) : null);

// ---------------------------------------------------------------- QuickBooks Online (shop-qbo) and connected cars (shop-cars)
export const shopQbo = (cfg, action, args = {}) => call(cfg, '/functions/v1/shop-qbo', { body: { action, ...args } });
export const shopCars = (cfg, action, args = {}) => call(cfg, '/functions/v1/shop-cars', { body: { action, ...args } });

// ---------------------------------------------------------------- Two-step sign-in policy
/** Roles that must use two-step sign-in. */
export const mfaPolicy = (cfg) => rpc(cfg, 'shop_mfa_policy', {}).then((r) => r || []);
export const setMfaPolicy = (cfg, roles) => rpc(cfg, 'shop_mfa_policy_set', { roles });
/** Whether this session meets the shop's two-step rules (false: enter a code, or set one up). */
export const mfaOk = (cfg) => rpc(cfg, 'shop_mfa_ok', {});

// ---------------------------------------------------------------- Email from the shop's address (shop-email)
export const shopEmail = (cfg, action, args = {}) => call(cfg, '/functions/v1/shop-email', { body: { action, ...args } });
export const emailEvents = (cfg) => call(cfg, '/rest/v1/shop_email_events?select=id,email_id,kind,payload,created_at&order=id.asc&limit=200', { method: 'GET' });
export const clearEmailEvents = (cfg, ids) => (ids.length ? call(cfg, `/rest/v1/shop_email_events?id=in.(${ids.map(Number).join(',')})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }) : null);
/** Owner or manager: the daily summary email's on/off, hour (shop time), time zone and recipients. */
export const digestSave = (cfg, { enabled, hour, tz, recipients }) => rpc(cfg, 'shop_digest_save', { p_enabled: enabled, p_hour: hour, p_tz: tz, p_recipients: recipients });
/** Today's numbers for the summary (kept current by an owner or manager device). */
export const digestSnapshot = (cfg, day, data) => rpc(cfg, 'shop_digest_snapshot', { p_day: day, p_data: data });
