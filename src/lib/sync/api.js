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
