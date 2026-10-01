// Photos and videos attached to repair orders. Files live in IndexedDB on this device (they are far
// too large for localStorage); the RO itself only stores metadata in `order.media`.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { uid } from './format';

const DB_NAME = 'autoshop-media';
const STORE = 'files';

let dbPromise = null;
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('This browser can’t store photos (IndexedDB unavailable).'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Could not open photo storage'));
    }).catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

const tx = async (mode, fn) => {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out && typeof out === 'object' && 'result' in out ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Storage quota exceeded'));
  });
};

const getLocal = (id) => tx('readonly', (s) => s.get(id)).then((r) => r || null);

// With shared shop data on, photos taken on another device are fetched from the shop's cloud the
// first time they're needed and kept here afterwards.
let remoteFetcher = null;
const fetching = new Map();
// Pictures that came up empty before the cloud was ready get another try when it is.
let fetcherVersion = 0;
const fetcherListeners = new Set();
const subscribeFetcher = (fn) => {
  fetcherListeners.add(fn);
  return () => fetcherListeners.delete(fn);
};
export function setRemoteFetcher(fn) {
  remoteFetcher = fn;
  if (typeof window !== 'undefined') window.__autoshopMediaSource = Boolean(fn);
  fetcherVersion += 1;
  fetcherListeners.forEach((l) => l());
}

/** { blob, thumb } for a media id, or null. `localOnly` skips the cloud. */
export async function getFile(id, { localOnly = false } = {}) {
  const local = await getLocal(id);
  if (local || localOnly || !remoteFetcher) return local;
  if (!fetching.has(id)) {
    fetching.set(
      id,
      remoteFetcher(id)
        .then(async (rec) => {
          if (rec?.blob) await putFile(id, rec).catch(() => {});
          return rec || null;
        })
        .catch(() => null)
        .finally(() => fetching.delete(id)),
    );
  }
  return fetching.get(id);
}
export const putFile = (id, record) => tx('readwrite', (s) => s.put(record, id));
export const removeFiles = (ids = []) => (ids.length ? tx('readwrite', (s) => ids.forEach((id) => s.delete(id))) : Promise.resolve());

// Object URLs are cached per id so lists of thumbnails don't re-read IndexedDB on every render.
const urlCache = new Map();
export async function fileUrl(id, which = 'thumb') {
  const k = `${id}:${which}`;
  if (urlCache.has(k)) return urlCache.get(k);
  const rec = await getFile(id);
  const blob = rec?.[which] || rec?.blob;
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(k, url);
  return url;
}
export function forgetUrls(ids = []) {
  for (const id of ids)
    for (const which of ['thumb', 'blob']) {
      const k = `${id}:${which}`;
      if (urlCache.has(k)) URL.revokeObjectURL(urlCache.get(k));
      urlCache.delete(k);
    }
}

/** React hook: object URL for a stored file (thumbnail by default). */
/**
 * React hook: object URL for a stored file (thumbnail by default). `rev` (e.g. the media record's
 * upload status) retries a file that isn't on this device yet once another device has uploaded it.
 */
export function useMediaUrl(id, which = 'thumb', rev = '') {
  const [state, setState] = useState({ key: null, url: null });
  const source = useSyncExternalStore(subscribeFetcher, () => fetcherVersion, () => 0);
  const key = id ? `${id}:${which}` : null;
  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    fileUrl(id, which).then(
      (url) => alive && setState({ key, url }),
      () => alive && setState({ key, url: null }),
    );
    return () => {
      alive = false;
    };
  }, [key, id, which, rev, source]);
  return state.key === key ? state.url : null;
}

// ---------------------------------------------------------------- Ingest

export const MAX_VIDEO_MB = 300;
const MAX_IMAGE_EDGE = 2400;
const THUMB_EDGE = 480;

const canvasBlob = (canvas, type = 'image/jpeg', quality = 0.85) =>
  new Promise((resolve) => (canvas.convertToBlob ? canvas.convertToBlob({ type, quality }).then(resolve) : canvas.toBlob(resolve, type, quality)));

function drawScaled(source, w, h, edge) {
  const scale = Math.min(1, edge / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  canvas.getContext('2d').drawImage(source, 0, 0, cw, ch);
  return { canvas, width: cw, height: ch };
}

async function loadImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fall through to <img> decoding (older Safari).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function processImage(file) {
  let img;
  try {
    img = await loadImage(file);
  } catch {
    // Formats the browser can't decode (e.g. HEIC outside Safari) are kept as-is without a preview.
    return { blob: file, thumb: null, width: null, height: null, type: file.type || 'image/heic', note: 'No preview — this browser can’t display the file type.' };
  }
  const w = img.width || img.naturalWidth;
  const h = img.height || img.naturalHeight;
  const full = drawScaled(img, w, h, MAX_IMAGE_EDGE);
  const thumb = drawScaled(img, w, h, THUMB_EDGE);
  img.close?.();
  // Always re-encode: keeps uploads small and strips EXIF metadata (GPS location, device) before
  // photos are shown to customers.
  return {
    blob: await canvasBlob(full.canvas, 'image/jpeg', 0.85),
    thumb: await canvasBlob(thumb.canvas, 'image/jpeg', 0.78),
    width: full.width,
    height: full.height,
    type: 'image/jpeg',
  };
}

function processVideo(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    let settled = false;
    const done = async (thumb) => {
      if (settled) return;
      settled = true;
      const meta = { blob: file, thumb, width: video.videoWidth || null, height: video.videoHeight || null, duration: Number.isFinite(video.duration) ? video.duration : null, type: file.type || 'video/mp4' };
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    const timer = setTimeout(() => done(null), 8000);
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 2) / 3);
    };
    video.onseeked = async () => {
      clearTimeout(timer);
      try {
        const { canvas } = drawScaled(video, video.videoWidth, video.videoHeight, THUMB_EDGE);
        done(await canvasBlob(canvas, 'image/jpeg', 0.78));
      } catch {
        done(null);
      }
    };
    video.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
  });
}

/**
 * Turn picked/dropped files into stored media. Returns metadata records for `order.media`
 * plus a list of files that were skipped and why.
 */
export async function ingestFiles(files, extra = {}) {
  // Ask the browser not to evict stored media under storage pressure.
  navigator.storage?.persist?.().catch(() => {});
  const added = [];
  const skipped = [];
  for (const file of files) {
    const isVideo = /^video\//.test(file.type) || /\.(mov|mp4|m4v|webm)$/i.test(file.name);
    const isImage = /^image\//.test(file.type) || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(file.name);
    if (!isVideo && !isImage) {
      skipped.push(`${file.name}: not a photo or video`);
      continue;
    }
    if (isVideo && file.size > MAX_VIDEO_MB * 1024 * 1024) {
      skipped.push(`${file.name}: videos are limited to ${MAX_VIDEO_MB} MB`);
      continue;
    }
    try {
      const p = isVideo ? await processVideo(file) : await processImage(file);
      const id = uid('med');
      await putFile(id, { blob: p.blob, thumb: p.thumb });
      added.push({
        id,
        kind: isVideo ? 'video' : 'image',
        name: file.name,
        type: p.type,
        size: p.blob.size,
        width: p.width,
        height: p.height,
        duration: p.duration ?? null,
        hasThumb: Boolean(p.thumb),
        caption: '',
        serviceId: null,
        inspectionKey: null,
        customer: true,
        createdAt: new Date().toISOString(),
        ...extra,
      });
    } catch (e) {
      skipped.push(`${file.name}: ${e?.name === 'QuotaExceededError' ? 'device storage is full' : e?.message || 'could not be saved'}`);
    }
  }
  // Shared shop data uploads new files to the cloud in the background.
  if (added.length && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('autoshop:media'));
  return { added, skipped };
}

export const formatBytes = (n = 0) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);
export const formatDuration = (s) => (s == null ? '' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);

/** Storage used/available on this device, when the browser reports it. */
export async function storageEstimate() {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { used: e.usage || 0, quota: e.quota || 0 } : null;
  } catch {
    return null;
  }
}
