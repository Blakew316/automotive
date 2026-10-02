import { useCallback, useEffect, useMemo, useState } from 'react';
import { UIContext } from './context';

// Appearance: light by default. (The old key saved "system" automatically, so only an explicit dark carries over.)
const THEME_KEY = 'autoshop-pro:appearance';
const OLD_THEME_KEY = 'autoshop-pro:theme';
const USER_KEY = 'autoshop-pro:user';
const SITE_KEY = 'autoshop-pro:location';

function readUser() {
  try {
    return localStorage.getItem(USER_KEY) || null;
  } catch {
    return null;
  }
}

function readSite() {
  try {
    return localStorage.getItem(SITE_KEY) || 'all';
  } catch {
    return 'all';
  }
}

function readTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'light' || t === 'dark' || t === 'system') return t;
    return localStorage.getItem(OLD_THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export default function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [theme, setTheme] = useState(readTheme);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [userId, setUserIdState] = useState(readUser);
  const setUserId = useCallback((id) => {
    setUserIdState(id);
    try {
      if (id) localStorage.setItem(USER_KEY, id);
      else localStorage.removeItem(USER_KEY);
    } catch {
      // Remembered for this session only.
    }
  }, []);

  // Which location this device is working at ('all' to see every location).
  const [siteId, setSiteState] = useState(readSite);
  const setSiteId = useCallback((id) => {
    setSiteState(id || 'all');
    try {
      localStorage.setItem(SITE_KEY, id || 'all');
    } catch {
      // Remembered for this session only.
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    // Browser and status bar tint: one color per scheme, or the chosen appearance for both.
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      const dark = theme === 'dark' || (theme === 'system' && /dark/.test(m.media || ''));
      m.setAttribute('content', dark ? '#0a121e' : '#f2f6fa');
    });
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Theme still applies for this session.
    }
  }, [theme]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (message, { tone = 'default', action } = {}) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t.slice(-2), { id, message, tone, action }]);
      setTimeout(() => dismiss(id), 3600);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({ toasts, toast, dismiss, theme, setTheme, paletteOpen, setPaletteOpen, userId, setUserId, siteId, setSiteId }),
    [toasts, toast, dismiss, theme, paletteOpen, userId, setUserId, siteId, setSiteId],
  );
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}
