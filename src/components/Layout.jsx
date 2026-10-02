import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { Search, Sun, Moon, Monitor, MoreHorizontal, ChevronLeft, ChevronsUpDown, Lock, CloudDownload, MapPin } from 'lucide-react';
import { AppIcon, Logo } from '../brand/Logo';
import { otherName } from '../brand/artwork';
import { useShop, useUI, useAccess, useSync, useSite } from '../store/hooks';
import { ROLES, homeFor } from '../lib/access';
import SwitchUser from './SwitchUser';
import { Avatar, Spinner } from './ui';
import { useCloudSync } from '../lib/useCloudSync';
import { useTracking } from '../lib/useTracking';
import { useNavBar, useIsCompact } from '../lib/viewport';
import PhoneLine from './PhoneLine';
import PayLine from './PayLine';
import EmailLine from './EmailLine';
import QboAutoSync from './QboAutoSync';
import { syncLabel } from '../lib/sync/labels';
import CommandPalette from './CommandPalette';
import Toasts from './Toasts';
import { NAV, HUE, useNavCounts, tabsFor, matchesPath, navLabel } from './nav';

const THEMES = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'system', icon: Monitor, label: 'System' },
  { value: 'dark', icon: Moon, label: 'Dark' },
];

/** Which location this device is working at (only when the shop has more than one). */
function SiteSwitcher() {
  const site = useSite();
  if (!site.multi) return null;
  return (
    <div className="px-3 pb-2">
      <label className="flex h-9 items-center gap-2 rounded-[8px] border border-sidebar-line bg-sidebar-2 px-2.5 text-sm text-sidebar-ink">
        <MapPin size={14} className="shrink-0 text-sidebar-ink-2" />
        <select className="min-w-0 flex-1 bg-transparent font-medium outline-none" value={site.current} onChange={(e) => site.setCurrent(e.target.value)} aria-label="Location">
          <option value="all">All locations</option>
          {site.sites.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function Sidebar({ onNavigate }) {
  const { state } = useShop();
  const { setPaletteOpen, theme, setTheme } = useUI();
  const { can, user, role } = useAccess();
  const [switching, setSwitching] = useState(false);
  const counts = useNavCounts();
  const nav = NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(i.to)) })).filter((g) => g.items.length);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <div className="flex h-full flex-col border-r border-sidebar-line bg-sidebar text-sidebar-ink">
      <div className="flex h-[76px] items-center gap-3 px-5">
        <Logo className="h-12" />
        {otherName(state.shop.name) && (
          <div className="min-w-0 border-l border-sidebar-line pl-3 text-xs font-medium leading-tight text-sidebar-ink-2">{otherName(state.shop.name)}</div>
        )}
      </div>

      <SiteSwitcher />

      <div className="px-3 pb-2">
        <button
          onClick={() => {
            setPaletteOpen(true);
            onNavigate?.();
          }}
          className="flex h-9 w-full items-center gap-2 rounded-[8px] border border-sidebar-line bg-sidebar-2 px-2.5 text-sm text-sidebar-ink-2 transition-colors hover:border-ink-4 hover:text-sidebar-ink"
        >
          <Search size={14} strokeWidth={2} />
          <span className="flex-1 text-left">Search</span>
          <span className="flex gap-0.5">
            <kbd className="kbd">{isMac ? '⌘' : 'Ctrl'}</kbd>
            <kbd className="kbd">K</kbd>
          </span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {nav.map((group, gi) => (
          <div key={gi} className={gi ? 'mt-5' : 'mt-2'}>
            {gi > 0 && <div className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-sidebar-ink-2">{group.title}</div>}
            <div className="space-y-px">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `group relative flex h-9 items-center gap-2.5 rounded-[8px] px-2.5 text-[14px] font-medium transition-colors ${
                      isActive ? `${HUE[group.hue].active} font-semibold` : 'text-sidebar-ink hover:bg-fill/[0.08]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="bg-accent absolute -left-3 bottom-2 top-2 w-[3px] rounded-r-full" />}
                      <item.icon size={18} strokeWidth={1.9} className={`transition-colors ${isActive ? HUE[group.hue].on : HUE[group.hue].icon}`} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.count && counts[item.count] > 0 &&
                        (item.badge ? (
                          <span className="tabular flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1.5 text-2xs font-semibold text-on-accent">{counts[item.count]}</span>
                        ) : (
                          <span className="tabular text-xs font-medium text-sidebar-ink-2">{counts[item.count]}</span>
                        ))}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-line px-3 py-3">
        <SyncBadge onNavigate={onNavigate} />
        <button onClick={() => setSwitching(true)} className="mb-2.5 flex w-full items-center gap-2.5 rounded-[9px] px-1.5 py-1.5 text-left transition-colors hover:bg-fill/[0.08]" title="Switch user">
          <Avatar name={user.name} size={32} />
          <span className="min-w-0 flex-1 text-[13px] leading-4">
            <span className="block truncate font-semibold text-sidebar-ink">{user.name}</span>
            <span className="block truncate text-xs text-sidebar-ink-2">{ROLES[role]?.label}</span>
          </span>
          <ChevronsUpDown size={14} className="shrink-0 text-sidebar-ink-2" />
        </button>
        <div className="flex rounded-[8px] bg-fill/[0.1] p-[2px]" role="radiogroup" aria-label="Appearance">
          {THEMES.map((t) => (
            <button
              key={t.value}
              role="radio"
              aria-checked={theme === t.value}
              title={t.label}
              onClick={() => setTheme(t.value)}
              className={`flex h-6 flex-1 items-center justify-center rounded-[6px] transition-all ${
                theme === t.value ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.12)]' : 'text-sidebar-ink-2 hover:text-sidebar-ink'
              }`}
            >
              <t.icon size={13} strokeWidth={2} />
            </button>
          ))}
        </div>
      </div>
      {switching && <SwitchUser onClose={() => setSwitching(false)} />}
    </div>
  );
}

/** Prompts that need the signed-in person's attention (temporary password, signed out of a synced shop). */
function AccountNotice() {
  const sync = useSync();
  if (!sync) return null;
  const temp = sync.signedIn && sync.session?.mustChange;
  const out = sync.enabled && sync.status.phase === 'signed-out';
  const code = sync.signedIn && sync.session?.mfa && !sync.staff;
  if (code || sync.twoStepNeeded)
    return (
      <div className="no-print flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-warn/30 bg-warn/[0.08] px-4 py-2 text-sm">
        <span className="text-ink">{code ? 'Enter the code from your authenticator app to keep working with the shop’s data.' : 'The shop now requires two-step sign-in for your role — set it up to keep working with the shop’s data.'}</span>
        <Link to="/signin" className="font-semibold text-accent hover:underline">
          {code ? 'Enter code' : 'Set it up'}
        </Link>
      </div>
    );
  if (!temp && !out) return null;
  return (
    <div className="no-print flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-warn/30 bg-warn/[0.08] px-4 py-2 text-sm">
      <span className="text-ink">{temp ? 'You’re using a temporary password.' : 'You’re signed out — changes on this device are saved and will sync when you sign in.'}</span>
      <Link to="/signin" className="font-semibold text-accent hover:underline">
        {temp ? 'Choose your own' : 'Sign in'}
      </Link>
    </div>
  );
}

/** Shared-data status at the bottom of the sidebar. */
function SyncBadge({ onNavigate }) {
  const sync = useSync();
  if (!sync) return null;
  if (!sync.enabled) {
    if (!(sync.staff && sync.cloudHasData)) return null;
    return (
      <Link to="/settings?tab=cloud#sync" onClick={onNavigate} className="mb-2 flex items-center gap-2 rounded-[8px] bg-accent/[0.09] px-2.5 py-2 text-xs font-semibold text-accent hover:bg-accent/[0.14]">
        <CloudDownload size={14} /> Load the shop’s shared data
      </Link>
    );
  }
  const s = sync.status;
  const warn = ['signed-out', 'not-staff', 'error', 'offline'].includes(s.phase);
  const busy = s.phase === 'syncing' || s.pending > 0;
  return (
    <Link
      to={s.phase === 'signed-out' || (s.phase === 'not-staff' && sync.session?.mfa) ? '/signin' : '/settings?tab=cloud#sync'}
      onClick={onNavigate}
      className="mb-2 flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-xs font-medium text-sidebar-ink-2 transition-colors hover:bg-fill/[0.08] hover:text-sidebar-ink"
      title={s.error || 'Shared shop data'}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${warn ? 'bg-warn' : busy ? 'animate-pulse bg-accent' : 'bg-ok'}`} />
      <span className="min-w-0 flex-1 truncate">{syncLabel(sync)}</span>
      {s.live && !warn && <span className="text-[10px] font-semibold uppercase tracking-wide text-ok">Live</span>}
    </Link>
  );
}

/** Shown when the current role can't open a page. */
function NoAccess() {
  const { user, role } = useAccess();
  const [switching, setSwitching] = useState(false);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-fill/[0.1] text-ink-3">
        <Lock size={22} />
      </span>
      <h1 className="text-xl font-semibold">This page needs a different role</h1>
      <p className="mt-1 max-w-sm text-sm text-ink-3">
        {user.name} is signed in as {ROLES[role]?.label.toLowerCase()}. Ask the owner for access, or switch to someone who has it.
      </p>
      <div className="mt-5 flex gap-2">
        <Link to={homeFor(role)} className="btn-secondary">Go to my home</Link>
        <button className="btn-primary" onClick={() => setSwitching(true)}>Switch user</button>
      </div>
      {switching && <SwitchUser onClose={() => setSwitching(false)} />}
    </div>
  );
}

/**
 * iPhone and iPad-portrait navigation bar: transparent over the page until it scrolls, then frosted
 * with a hairline. The page's large title moves up into it once it scrolls out of view.
 */
function NavBar() {
  const nav = useNavBar();
  const { setPaletteOpen } = useUI();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [scroll, setScroll] = useState({ edge: false, far: false });
  useEffect(() => {
    const main = document.getElementById('main-scroll');
    if (!main) return undefined;
    let raf = 0;
    const read = () => {
      raf = 0;
      const edge = main.scrollTop > 2;
      const far = main.scrollTop > 56;
      setScroll((s) => (s.edge === edge && s.far === far ? s : { edge, far }));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    main.addEventListener('scroll', onScroll, { passive: true });
    read();
    return () => {
      main.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [pathname]);
  const title = nav.owner ? nav.title : navLabel(pathname);
  const showTitle = nav.owner ? nav.collapsed : scroll.far;
  return (
    <header
      className={`app-navbar no-print absolute inset-x-0 top-0 z-30 select-none pl-[var(--safe-l)] pr-[var(--safe-r)] pt-[var(--safe-t)] transition-[background-color,box-shadow,backdrop-filter] duration-200 lg:hidden ${
        scroll.edge ? 'bar-material shadow-[inset_0_-0.5px_0_rgb(var(--shadow-ring)/0.18)]' : ''
      }`}
    >
      {/* Back · title · search. The title takes the middle once it's showing; a long back label gives way to it. */}
      <div className="grid h-11 grid-cols-[minmax(44px,1fr)_auto_minmax(44px,1fr)] items-center px-1">
        <div className="flex min-w-0 items-center">
          {nav.back ? (
            <button
              onClick={() => (typeof nav.back === 'string' ? navigate(nav.back) : navigate(-1))}
              className="flex h-11 min-w-0 items-center pr-1 text-[17px] text-accent transition-opacity active:opacity-40"
              aria-label={`Back to ${nav.backText}`}
            >
              <ChevronLeft size={28} strokeWidth={2.1} className="-mr-0.5 shrink-0" />
              <span className="truncate">{nav.backText}</span>
            </button>
          ) : (
            <span className="pl-3">
              <AppIcon size={28} />
            </span>
          )}
        </div>
        <div
          aria-hidden={!showTitle}
          className={`min-w-0 truncate text-center text-[17px] font-semibold tracking-[-0.02em] text-ink transition-opacity duration-200 ${
            title && showTitle ? 'max-w-[min(56vw,460px)] px-1 opacity-100' : 'max-w-0 opacity-0'
          }`}
        >
          {title}
        </div>
        <div className="flex items-center justify-end">
          <button onClick={() => setPaletteOpen(true)} className="flex h-11 w-11 items-center justify-center text-accent transition-opacity active:opacity-40" aria-label="Search">
            <Search size={21} strokeWidth={2.1} />
          </button>
        </div>
      </div>
    </header>
  );
}

/**
 * iPhone and iPad-portrait tab bar: the four places this person goes most, plus More for the rest.
 * Tapping the current tab goes back to its first screen, or scrolls to the top if already there.
 */
function TabBar() {
  const { can, role } = useAccess();
  const counts = useNavCounts();
  const { pathname } = useLocation();
  const tabs = tabsFor(role, can);
  const current = tabs.find((t) => matchesPath(t, pathname));
  // More carries the badges of the places it holds (booking requests, today's check-ins).
  const inTabs = new Set(tabs.map((t) => t.to));
  const moreCount = NAV.flatMap((g) => g.items)
    .filter((i) => i.badge && !inTabs.has(i.to) && can(i.to))
    .reduce((n, i) => n + (counts[i.count] || 0), 0);
  const items = [...tabs, { to: '/more', label: 'More', icon: MoreHorizontal, more: true }];
  return (
    <nav
      aria-label="Tabs"
      className="app-tabbar no-print bar-material absolute inset-x-0 bottom-0 z-30 flex select-none pb-[var(--safe-b)] pl-[var(--safe-l)] pr-[var(--safe-r)] shadow-[inset_0_0.5px_0_rgb(var(--shadow-ring)/0.18)] lg:hidden [.kb-open_&]:hidden"
    >
      {items.map((t) => {
        const active = t.more ? !current : current === t;
        const badge = t.more ? moreCount : t.count ? counts[t.count] : 0;
        return (
          <Link
            key={t.to}
            to={t.to}
            aria-current={active ? 'page' : undefined}
            onClick={(e) => {
              if (pathname === t.to) {
                e.preventDefault();
                document.getElementById('main-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className={`flex h-[49px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] pt-0.5 [-webkit-touch-callout:none] ${active ? 'text-accent' : 'text-ink-3'}`}
          >
            <span className="relative">
              <t.icon size={25} strokeWidth={active ? 2.1 : 1.75} />
              {badge > 0 && (
                <span className="tabular absolute -right-3 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bad px-1 text-[11px] font-semibold leading-none text-white ring-2 ring-canvas">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </span>
            <span className="max-w-full truncate px-1 text-[10px] font-medium leading-3 tracking-[0.01em]">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function Layout() {
  const location = useLocation();
  const { can } = useAccess();
  const compact = useIsCompact();
  useCloudSync();
  useTracking();

  useEffect(() => {
    document.getElementById('main-scroll')?.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <PhoneLine>
      <PayLine>
        <EmailLine>
          <div className="app-shell flex h-[var(--app-h,100dvh)] overflow-hidden bg-canvas">
            <aside className="no-print hidden w-[240px] shrink-0 lg:block">
              <Sidebar />
            </aside>

            <div className="relative flex min-w-0 flex-1 flex-col">
              {compact && <NavBar />}
              <main
                id="main-scroll"
                className="relative flex-1 overflow-y-auto overscroll-y-contain pb-[calc(var(--tabbar)+var(--safe-b))] pl-[var(--safe-l)] pr-[var(--safe-r)] pt-[calc(var(--navbar)+var(--safe-t))] [scroll-padding-top:calc(var(--navbar)+var(--safe-t)+12px)] lg:pl-0 lg:pr-0"
              >
                <div aria-hidden="true" className="brand-haze no-print pointer-events-none absolute inset-x-0 top-0 h-[280px]" />
                <AccountNotice />
                <div className="relative mx-auto w-full max-w-[1320px] px-4 pb-16 pt-2 sm:px-6 lg:px-10 lg:pt-9">
                  {can(location.pathname) ? (
                    // Pages load on demand: only this area waits, the sidebar stays put.
                    <Suspense
                      fallback={
                        <div className="flex h-64 items-center justify-center text-ink-3">
                          <Spinner size={20} />
                        </div>
                      }
                    >
                      <Outlet />
                    </Suspense>
                  ) : (
                    <NoAccess />
                  )}
                </div>
              </main>
              {compact && <TabBar />}
            </div>

            <CommandPalette />
            <Toasts />
            <QboAutoSync />
          </div>
        </EmailLine>
      </PayLine>
    </PhoneLine>
  );
}
