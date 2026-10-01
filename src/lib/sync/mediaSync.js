// Photos and videos follow the shop's data: files taken on this device are uploaded to the shop's
// private file store, and files from other devices are downloaded when first opened.
import { getFile, setRemoteFetcher } from '../media';
import { uploadFile, downloadFile } from './api';

const MAX_BYTES = 50 * 1024 * 1024; // Supabase free plan per-file limit

export function startMediaSync({ cfg, getState, update }) {
  let stopped = false;
  let running = false;

  setRemoteFetcher(async (id) => {
    const blob = await downloadFile(cfg, id, 'full');
    if (!blob) return null;
    const thumb = await downloadFile(cfg, id, 'thumb').catch(() => null);
    return { blob, thumb };
  });

  const mark = (orderId, mediaId, cloud) =>
    update((s) => {
      const m = s.orders.find((o) => o.id === orderId)?.media?.find((x) => x.id === mediaId);
      if (m) m.cloud = cloud;
    });

  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      const todo = [];
      for (const o of getState().orders) for (const m of o.media || []) if (!m.cloud) todo.push([o.id, m]);
      for (const [orderId, m] of todo) {
        if (stopped) break;
        const rec = await getFile(m.id, { localOnly: true });
        // Not on this device: the device that took it uploads it.
        if (!rec?.blob) continue;
        if (rec.blob.size > MAX_BYTES) {
          mark(orderId, m.id, 'too-large');
          continue;
        }
        await uploadFile(cfg, m.id, 'full', rec.blob);
        if (rec.thumb) await uploadFile(cfg, m.id, 'thumb', rec.thumb);
        mark(orderId, m.id, 'ok');
      }
    } catch {
      // Offline or signed out: try again on the next round.
    } finally {
      running = false;
    }
  };

  const onAdded = () => setTimeout(tick, 500);
  window.addEventListener('autoshop:media', onAdded);
  const timer = setInterval(tick, 30_000);
  setTimeout(tick, 2_000);
  return {
    kick: tick,
    stop() {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener('autoshop:media', onAdded);
      setRemoteFetcher(null);
    },
  };
}
