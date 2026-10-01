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
