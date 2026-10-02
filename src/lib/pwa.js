// Installable app support: service worker registration and the browser's install prompt.
import { useSyncExternalStore } from 'react';

let deferred = null;
const listeners = new Set();
const notify = () => listeners.forEach((l) => l());

export function initPwa() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {});
    });
  }
  if (import.meta.env.PROD) keepCurrent();
}

/** Whether a newer version of the app has been published than the one running in this tab. */
async function outdated() {
  const res = await fetch(`${import.meta.env.BASE_URL}index.html`, { cache: 'no-cache' });
  if (!res.ok) return false;
  const main = (await res.text()).match(/<script type="module"[^>]*\ssrc="([^"]+)"/)?.[1];
  return Boolean(main) && !document.querySelector(`script[type="module"][src="${main}"]`);
}

/**
 * Staff leave the app open all day, and a Home Screen app on iPhone resumes where it was instead of
 * reloading, so a deploy would otherwise wait for someone to close it. Each time the app comes back
 * on screen (and every half hour while it stays open) it checks for a newer version. Coming back on
 * screen it reloads straight into it — nothing has been typed yet; found while someone is working,
 * the reload waits for the next time they come back to it.
 */
function keepCurrent() {
  let pending = false;
  const check = async (resumed) => {
    if (!navigator.onLine) return;
    const stale = pending || (await outdated().catch(() => false));
    if (!stale) return;
    if (resumed) {
      navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
      window.location.reload();
    } else pending = true;
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check(true);
  });
  window.addEventListener('pageshow', (e) => e.persisted && check(true));
  setInterval(() => document.visibilityState === 'visible' && check(false), 30 * 60_000);
}

export const isStandalone = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
export const isIos = () => typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The deferred install prompt (Chrome, Edge, Android), if the browser offered one. */
export function useInstallPrompt() {
  const prompt = useSyncExternalStore(subscribe, () => deferred, () => null);
  return {
    canInstall: Boolean(prompt),
    install: async () => {
      if (!deferred) return 'unavailable';
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      notify();
      return outcome;
    },
  };
}
