// Copy and share that work on iPhone. Safari only lets a page copy or open the share sheet during the
// tap itself, so anything that has to be fetched first is handed over as a promise.

/** Copy text. Pass a promise when the text is still on its way (e.g. a link being created). */
export async function copyText(value) {
  if (typeof value === 'string') return navigator.clipboard.writeText(value);
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      // The clipboard write starts inside the tap and fills in when the text arrives.
      const blob = Promise.resolve(value).then((t) => new Blob([t], { type: 'text/plain' }));
      return await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
    } catch (e) {
      if (e?.name !== 'NotAllowedError' && e?.name !== 'TypeError') throw e;
    }
  }
  return navigator.clipboard.writeText(await value);
}

/** True where the system share sheet exists (iPhone, iPad, Android, Safari on Mac). */
export const canShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/** True where files (a PDF) can go to the share sheet: Save to Files, Print, Mail, Messages, AirDrop. */
export function canShareFiles() {
  if (!canShare() || typeof navigator.canShare !== 'function' || typeof File === 'undefined') return false;
  try {
    return navigator.canShare({ files: [new File(['%PDF'], 'test.pdf', { type: 'application/pdf' })] });
  } catch {
    return false;
  }
}

/**
 * Open the share sheet. Resolves to 'shared', 'cancelled' (closed the sheet), 'blocked' (the browser
 * wanted a fresh tap — e.g. the file took a while to make) or 'failed'. Never throws.
 */
export async function shareSheet(data) {
  try {
    await navigator.share(data);
    return 'shared';
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelled';
    if (e?.name === 'NotAllowedError') return 'blocked';
    return 'failed';
  }
}
