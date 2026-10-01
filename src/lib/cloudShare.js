// Optional cloud sharing for vehicle reports, photos and video, using Supabase Storage. The site
// itself is static, so links that work on a customer's phone need the files hosted somewhere:
// the shop connects its own Supabase project (Settings → Shop Cloud), signs in as a
// staff user, and published reports live at unguessable URLs in a public bucket.
import { getFile } from './media';

const SESSION_KEY = 'autoshop-pro:cloud-session';
const trim = (u = '') => u.trim().replace(/\/+$/, '');

export function cloudConfig(shop) {
  const c = shop?.cloud || {};
  return c.url && c.key && c.bucket ? { url: trim(c.url), key: c.key.trim(), bucket: c.bucket.trim() } : null;
}

// ---------------------------------------------------------------- Auth (staff sign-in)

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}
function writeSession(s) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Session is a convenience; the user can sign in again.
  }
}
export const cloudSession = () => readSession();
export const signOut = () => writeSession(null);

async function authRequest(cfg, grant, body) {
  const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST',
    headers: { apikey: cfg.key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || `Sign-in failed (${res.status})`);
  const session = { url: cfg.url, email: data.user?.email, access: data.access_token, refresh: data.refresh_token, expires: Date.now() + (data.expires_in || 3600) * 1000 };
  writeSession(session);
  return session;
}

export const signIn = (cfg, email, password) => authRequest(cfg, 'password', { email, password });

async function accessToken(cfg) {
  const s = readSession();
  if (!s || s.url !== cfg.url) throw new Error('Sign in under Settings → Shop Cloud first.');
  if (s.expires - Date.now() > 60_000) return s.access;
  return (await authRequest(cfg, 'refresh_token', { refresh_token: s.refresh })).access;
}

// ---------------------------------------------------------------- Storage

const objectUrl = (cfg, path) => `${cfg.url}/storage/v1/object/${encodeURIComponent(cfg.bucket)}/${path}`;
export const publicBase = (cfg) => `${cfg.url}/storage/v1/object/public/${encodeURIComponent(cfg.bucket)}/ro`;
export const publicSiteBase = (cfg) => `${cfg.url}/storage/v1/object/public/${encodeURIComponent(cfg.bucket)}/site`;

async function upload(cfg, token, path, body, contentType, cacheSeconds = 31536000) {
  const res = await fetch(objectUrl(cfg, path), {
    method: 'POST',
    headers: { apikey: cfg.key, Authorization: `Bearer ${token}`, 'Content-Type': contentType, 'x-upsert': 'true', 'cache-control': `max-age=${cacheSeconds}` },
    body,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data.message || data.error || `Upload failed (${res.status})`;
    throw new Error(/exceeded the maximum allowed size|Payload too large/i.test(msg) ? `${msg} — raise the bucket’s file size limit in Supabase or trim the video.` : msg);
  }
}

async function removePaths(cfg, token, paths) {
  if (!paths.length) return;
  await fetch(`${cfg.url}/storage/v1/object/${encodeURIComponent(cfg.bucket)}`, {
    method: 'DELETE',
    headers: { apikey: cfg.key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: paths }),
  });
}

export function newShareId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const extFor = (m) => (m.kind === 'image' ? 'jpg' : (m.type || '').includes('quicktime') ? 'mov' : (m.type || '').includes('webm') ? 'webm' : 'mp4');

/** Customer link for a published report. */
export function shareLink(cfg, shareId) {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`;
  return `${base}share/${shareId}?from=${encodeURIComponent(publicBase(cfg))}`;
}

/**
 * Upload the report snapshot plus every customer-visible file not yet uploaded.
 * Returns the updated share record for `order.share`.
 */
export async function publishReport(cfg, report, share, onProgress = () => {}) {
  const token = await accessToken(cfg);
  const id = share?.id || newShareId();
  const folder = `ro/${id}`;
  const uploaded = new Set(share?.uploaded || []);
  const todo = report.media.filter((m) => !uploaded.has(m.id));
  let done = 0;
  for (const m of todo) {
    onProgress({ done, total: todo.length, name: m.caption || m.id });
    const rec = await getFile(m.id);
    if (!rec?.blob) throw new Error('A photo or video is missing from this device — it may have been deleted.');
    await upload(cfg, token, `${folder}/${m.id}.${extFor(m)}`, rec.blob, m.type || (m.kind === 'image' ? 'image/jpeg' : 'video/mp4'));
    if (rec.thumb) await upload(cfg, token, `${folder}/${m.id}-thumb.jpg`, rec.thumb, 'image/jpeg');
    uploaded.add(m.id);
    done += 1;
  }
  onProgress({ done, total: todo.length, name: 'report' });
  const remote = {
    ...report,
    // Lets the customer approve work or send a message back through the shop's inbox table.
    inbox: { url: cfg.url, key: cfg.key },
    media: report.media.map((m) => ({ ...m, file: `${m.id}.${extFor(m)}`, thumbFile: m.hasThumb ? `${m.id}-thumb.jpg` : null })),
  };
  // Short cache so updates to the report reach customers quickly.
  await upload(cfg, token, `${folder}/report.json`, new Blob([JSON.stringify(remote)], { type: 'application/json' }), 'application/json', 60);
  // Files for media that were since hidden or deleted are removed from the bucket.
  const keep = new Set(report.media.map((m) => m.id));
  const stale = [...uploaded].filter((mid) => !keep.has(mid));
  if (stale.length) {
    await removePaths(cfg, token, stale.flatMap((mid) => [`${folder}/${mid}.jpg`, `${folder}/${mid}.mp4`, `${folder}/${mid}.mov`, `${folder}/${mid}.webm`, `${folder}/${mid}-thumb.jpg`])).catch(() => {});
    stale.forEach((mid) => uploaded.delete(mid));
  }
  return { id, uploaded: [...uploaded], publishedAt: new Date().toISOString(), url: shareLink(cfg, id), revoked: false };
}

/** Turn a link off: the report is replaced with a notice and the files are deleted. */
export async function revokeReport(cfg, share) {
  const token = await accessToken(cfg);
  const folder = `ro/${share.id}`;
  await upload(cfg, token, `${folder}/report.json`, new Blob([JSON.stringify({ v: 1, revoked: true })], { type: 'application/json' }), 'application/json', 60);
  await removePaths(cfg, token, (share.uploaded || []).flatMap((mid) => [`${folder}/${mid}.jpg`, `${folder}/${mid}.mp4`, `${folder}/${mid}.mov`, `${folder}/${mid}.webm`, `${folder}/${mid}-thumb.jpg`])).catch(() => {});
  return { ...share, revoked: true, uploaded: [] };
}

/** Publish the online-booking configuration (hours, services, busy times) for the public page. */
export async function publishBooking(cfg, config) {
  const token = await accessToken(cfg);
  await upload(cfg, token, 'site/booking.json', new Blob([JSON.stringify(config)], { type: 'application/json' }), 'application/json', 60);
}

// ---------------------------------------------------------------- Shop inbox (Supabase table)
// Customers (anonymous) can only insert; signed-in staff read and clear. See the SQL in Settings.

const restHeaders = (key, token) => ({ apikey: key, Authorization: `Bearer ${token || key}`, 'Content-Type': 'application/json' });

/** Customer side: drop a booking request, approval or message into the shop's inbox. */
export async function submitToInbox(inbox, kind, ref, payload) {
  const res = await fetch(`${trim(inbox.url)}/rest/v1/shop_inbox`, {
    method: 'POST',
    headers: { ...restHeaders(inbox.key), Prefer: 'return=minimal' },
    body: JSON.stringify({ kind, ref: ref || null, payload }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Couldn’t send (${res.status})`);
  }
}

/** Shop side: everything waiting in the inbox, oldest first. */
export async function fetchInbox(cfg) {
  const token = await accessToken(cfg);
  const res = await fetch(`${cfg.url}/rest/v1/shop_inbox?select=*&order=created_at.asc&limit=200`, { headers: restHeaders(cfg.key, token) });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(res.status === 404 || /relation .* does not exist/i.test(data.message || '') ? 'The shop_inbox table is missing — run the setup SQL in Settings → Shop Cloud.' : data.message || `Inbox unavailable (${res.status})`);
  }
  return res.json();
}

export async function clearInbox(cfg, ids) {
  if (!ids.length) return;
  const token = await accessToken(cfg);
  await fetch(`${cfg.url}/rest/v1/shop_inbox?id=in.(${ids.map((x) => encodeURIComponent(x)).join(',')})`, { method: 'DELETE', headers: restHeaders(cfg.key, token) });
}

/** Upload, read back and delete a small file to prove the setup works. */
export async function testConnection(cfg) {
  const token = await accessToken(cfg);
  const path = `ro/_check/${newShareId()}.json`;
  await upload(cfg, token, path, new Blob(['{"ok":true}'], { type: 'application/json' }), 'application/json', 0);
  const res = await fetch(`${publicBase(cfg)}/${path.slice(3)}`, { cache: 'no-store' });
  await removePaths(cfg, token, [path]).catch(() => {});
  if (!res.ok) throw new Error('Uploaded, but the file isn’t publicly readable — make the bucket public.');
  return true;
}

// ---------------------------------------------------------------- Viewer side

/**
 * Where a share link's files live. Only Supabase Storage public URLs are accepted, so a crafted
 * link can't make this site display a report from an arbitrary server.
 */
export function parseShareSource(from, folder = 'ro') {
  try {
    const u = new URL(from);
    if (u.protocol !== 'https:') return null;
    if (!/\.supabase\.(co|in)$/i.test(u.hostname)) return null;
    const path = u.pathname.replace(/\/+$/, '');
    if (!new RegExp(`^/storage/v1/object/public/[^/]+/${folder}$`).test(path)) return null;
    return `${u.origin}${path}`;
  } catch {
    return null;
  }
}

export async function fetchSharedReport(source, shareId) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(shareId)) throw new Error('This link is incomplete.');
  const res = await fetch(`${source}/${shareId}/report.json`, { cache: 'no-cache' });
  if (res.status === 400 || res.status === 404) throw new Error('This report link wasn’t found. It may have been removed.');
  if (!res.ok) throw new Error(`Couldn’t load the report (${res.status}).`);
  const report = await res.json();
  if (report.revoked) throw new Error('The shop has turned this link off.');
  return report;
}
