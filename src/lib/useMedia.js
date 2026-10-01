import { useCallback, useState } from 'react';
import { useShop, useUI } from '../store/hooks';
import { ingestFiles } from './media';

/** Store picked/dropped files, attach them to the RO and report anything skipped. */
export function useIngest(order) {
  const { addMedia } = useShop();
  const { toast } = useUI();
  const [busy, setBusy] = useState(0);
  const ingest = useCallback(
    async (fileList, extra = {}) => {
      const files = [...(fileList || [])];
      if (!files.length) return;
      setBusy((n) => n + files.length);
      try {
        const { added, skipped } = await ingestFiles(files, extra);
        if (added.length) {
          addMedia(order.id, added);
          toast(`${added.length} ${added.length === 1 ? 'file' : 'files'} added to RO #${order.number}`, { tone: 'success' });
        }
        if (skipped.length) toast(`Skipped ${skipped.join('; ')}`, { tone: 'error' });
      } catch (e) {
        toast(e.message || 'Could not save the files', { tone: 'error' });
      } finally {
        setBusy((n) => Math.max(0, n - files.length));
      }
    },
    [addMedia, order.id, order.number, toast],
  );
  return { ingest, busy };
}

/** Which photo/video is open in the RO lightbox. */
export function useMediaViewer() {
  const [id, setId] = useState(null);
  const open = useCallback((mid) => setId(mid), []);
  const close = useCallback(() => setId(null), []);
  return { id, open, close, setId };
}
