// iPhone viewport helpers: the area left above the on-screen keyboard, phone-size detection, and
// the page title the navigation bar shows once the large title scrolls away.
import { useEffect, useSyncExternalStore } from 'react';

const isTextField = (el) => Boolean(el?.matches?.('input:not([type=checkbox],[type=radio],[type=range],[type=button],[type=submit]), textarea, select, [contenteditable="true"]'));

/**
 * Keeps --vv-top / --vv-height (the visible part of the screen above the keyboard) and html.kb-open
 * current, so sheets sit above the keyboard and the tab bar steps aside while you type.
 */
export function initViewport() {
  if (typeof window === 'undefined') return;
  // iOS only applies :active while something listens for touches.
  document.addEventListener('touchstart', () => {}, { passive: true });
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  let raf = 0;
  const update = () => {
    raf = 0;
    root.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
    root.style.setProperty('--vv-height', `${Math.round(vv.height)}px`);
    const kb = vv.scale < 1.05 && window.innerHeight - vv.height > 120 && isTextField(document.activeElement);
    root.classList.toggle('kb-open', kb);
    // While the keyboard is up the staff app shrinks to the space above it (instead of iOS sliding the
    // whole page up and hiding the top bar), and the field being typed in is scrolled into view.
    root.style.setProperty('--app-h', kb ? `${Math.round(vv.height)}px` : '100dvh');
    if (kb && document.querySelector('.app-shell') && (window.scrollY > 0 || vv.offsetTop > 0)) {
      window.scrollTo(0, 0);
      const el = document.activeElement;
      requestAnimationFrame(() => el?.scrollIntoView?.({ block: 'nearest' }));
    }
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  vv.addEventListener('resize', schedule);
  vv.addEventListener('scroll', schedule);
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', () => setTimeout(schedule, 60));
  update();
}

function mediaStore(query) {
  const get = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.(query).matches);
  const subscribe = (cb) => {
    const m = window.matchMedia?.(query);
    m?.addEventListener('change', cb);
    return () => m?.removeEventListener('change', cb);
  };
  return () => useSyncExternalStore(subscribe, get, () => false);
}

/** Phone-width screens, where menus become action sheets and dialogs become sheets. */
export const useIsPhone = mediaStore('(max-width: 639px)');
/** Below the sidebar breakpoint (phones, iPad portrait): navigation bar and tab bar. */
export const useIsCompact = mediaStore('(max-width: 1023px)');

// ---- Navigation bar title (phones and tablets) ----
let bar = { title: null, back: null, backText: null, collapsed: false, owner: null };
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

/** The current page's title and back link, set by PageHeader. */
export function setNavBar(owner, next) {
  if (next === null) {
    if (bar.owner !== owner) return;
    bar = { title: null, back: null, backText: null, collapsed: false, owner: null };
  } else {
    if (bar.owner === owner && Object.keys(next).every((k) => bar[k] === next[k])) return;
    bar = { ...bar, ...next, owner };
  }
  emit();
}

export const useNavBar = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => bar,
    () => bar,
  );

/** For a page without a PageHeader (e.g. a full-screen conversation): its title and back link. */
export function useNavBarTitle(owner, title, back, backText, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    setNavBar(owner, { title, back, backText, collapsed: true });
    return () => setNavBar(owner, null);
  }, [owner, title, back, backText, active]);
}
