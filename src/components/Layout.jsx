import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import {
  LayoutGrid, SquareKanban, ClipboardList, CalendarDays, Users, Car, ScanLine, Package,
  BookOpen, ChartColumn, Settings, Search, Menu as MenuIcon, Sun, Moon, Monitor, Wrench, X, Database,
  MessageSquare, Megaphone, Timer, UsersRound, Landmark, Blocks, ChevronsUpDown, Lock, CloudDownload, Building2, ConciergeBell, MapPin,
} from 'lucide-react';
import { useShop, useUI, useAccess, useSync, useSite, useScopedShop } from '../store/hooks';
import { ROLES, homeFor } from '../lib/access';
import SwitchUser from './SwitchUser';
import { Avatar, Spinner } from './ui';
import { OPEN_STATUSES, WIP_STATUSES } from '../lib/workflow';
import { useCloudSync } from '../lib/useCloudSync';
import { useTracking } from '../lib/useTracking';
import PhoneLine from './PhoneLine';
import PayLine from './PayLine';
import EmailLine from './EmailLine';
import QboAutoSync from './QboAutoSync';
import { syncLabel } from '../lib/sync/labels';
import CommandPalette from './CommandPalette';
import Toasts from './Toasts';

function useNavCounts() {
  const { state } = useScopedShop();
  const open = state.orders.filter((o) => OPEN_STATUSES.includes(o.status));
  return {
    workflow: open.filter((o) => WIP_STATUSES.includes(o.status)).length,
    orders: open.length,
    lowStock: state.inventory.filter((p) => Number(p.qty) <= Number(p.min)).length,
    unread: state.messages.filter((m) => m.dir === 'in' && !m.read).length,
    requests: state.bookingRequests.filter((b) => b.status === 'new').length,
    checkins: state.orders.filter((o) => o.checkin && o.status === 'estimate' && new Date(o.checkin.at).toDateString() === new Date().toDateString()).length,
  };
}

// Each section of the sidebar wears one of the website's foil hues on its icons.
const HUE = {
  navy: { icon: 'text-accent/75 group-hover:text-accent', active: 'bg-accent/[0.09] text-ink', on: 'text-accent' },
  lilac: { icon: 'text-hue-lilac/75 group-hover:text-hue-lilac', active: 'bg-hue-lilac/[0.1] text-ink', on: 'text-hue-lilac' },
  azure: { icon: 'text-hue-azure/75 group-hover:text-hue-azure', active: 'bg-hue-azure/[0.1] text-ink', on: 'text-hue-azure' },
  teal: { icon: 'text-hue-teal/75 group-hover:text-hue-teal', active: 'bg-hue-teal/[0.1] text-ink', on: 'text-hue-teal' },
};

const NAV = [
  {
    hue: 'navy',
    items: [
      { to: '/', label: 'Today', icon: LayoutGrid, end: true },
      { to: '/workflow', label: 'Workflow', icon: SquareKanban, count: 'workflow' },
      { to: '/orders', label: 'Repair Orders', icon: ClipboardList, count: 'orders' },
      { to: '/calendar', label: 'Calendar', icon: CalendarDays, count: 'requests', badge: true },
      { to: '/frontdesk', label: 'Front Desk', icon: ConciergeBell, count: 'checkins', badge: true },
      { to: '/messages', label: 'Messages', icon: MessageSquare, count: 'unread', badge: true },
    ],
  },
  {
    title: 'Customers',
    hue: 'lilac',
    items: [
      { to: '/customers', label: 'Customers', icon: Users },
      { to: '/accounts', label: 'Fleet & Accounts', icon: Building2 },
      { to: '/vehicles', label: 'Vehicles', icon: Car },
      { to: '/marketing', label: 'Marketing', icon: Megaphone },
    ],
  },
  {
    title: 'Technical',
    hue: 'azure',
    items: [
      { to: '/tech', label: 'Tech Time Clock', icon: Timer },
      { to: '/catalog', label: 'Vehicle Database', icon: Database },
      { to: '/vin', label: 'VIN Decoder', icon: ScanLine },
      { to: '/parts', label: 'Parts & Inventory', icon: Package, count: 'lowStock' },
      { to: '/library', label: 'Service Library', icon: BookOpen },
    ],
  },
  {
    title: 'Business',
    hue: 'teal',
    items: [
      { to: '/team', label: 'Team', icon: UsersRound },
      { to: '/reports', label: 'Reports', icon: ChartColumn },
      { to: '/accounting', label: 'Accounting', icon: Landmark },
      { to: '/integrations', label: 'Integrations', icon: Blocks },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

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
      <div className="flex h-16 items-center gap-3 px-4">
        <Logo size={32} />
        <div className="min-w-0 leading-tight">
          <div className="text-md font-semibold tracking-tight text-sidebar-ink">AutoShop Pro</div>
          <div className="truncate text-xs font-medium text-sidebar-ink-2">{state.shop.name}</div>
        </div>
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
            {group.title && <div className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-sidebar-ink-2">{group.title}</div>}
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
                      {isActive && <span className="bg-foil-ink absolute -left-3 bottom-2 top-2 w-[3px] rounded-r-full" />}
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

/** App mark: a wrench on a small navy tile. */
export function Logo({ size = 28 }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[9px] bg-accent text-on-accent shadow-[0_1px_3px_rgb(var(--hue-indigo)/0.35)]"
      style={{ width: size, height: size, backgroundImage: 'linear-gradient(135deg, rgb(var(--accent)) 30%, rgb(var(--hue-indigo)) 75%, rgb(var(--hue-lilac)) 115%)' }}
    >
      <Wrench size={Math.round(size * 0.52)} strokeWidth={2.2} />
    </span>
  );
}

export default function Layout() {
  const { navOpen, setNavOpen, setPaletteOpen } = useUI();
  const location = useLocation();
  const { can } = useAccess();
  useCloudSync();
  useTracking();

  useEffect(() => {
    document.getElementById('main-scroll')?.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <PhoneLine>
      <PayLine>
        <EmailLine>
          <div className="flex h-[100dvh] overflow-hidden bg-canvas">
            <aside className="no-print hidden w-[240px] shrink-0 lg:block">
              <Sidebar />
            </aside>

            {navOpen && (
              <div className="no-print fixed inset-0 z-50 lg:hidden">
                <div className="absolute inset-0 animate-fade-in bg-black/25" onClick={() => setNavOpen(false)} />
                <aside className="relative h-full w-[272px] animate-slide-in bg-sidebar shadow-sheet">
                  <button onClick={() => setNavOpen(false)} className="btn-icon btn absolute right-2 top-4 rounded-full text-sidebar-ink-2 hover:bg-fill/10 hover:text-sidebar-ink" aria-label="Close menu">
                    <X size={17} />
                  </button>
                  <Sidebar onNavigate={() => setNavOpen(false)} />
                </aside>
              </div>
            )}

            <div className="flex min-w-0 flex-1 flex-col">
              <header className="no-print glass sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-line/80 bg-canvas/80 px-3 lg:hidden">
                <button onClick={() => setNavOpen(true)} className="btn-ghost btn-icon" aria-label="Open menu">
                  <MenuIcon size={19} />
                </button>
                <div className="flex flex-1 items-center gap-2">
                  <Logo size={24} />
                  <span className="text-md font-semibold">AutoShop Pro</span>
                </div>
                <button onClick={() => setPaletteOpen(true)} className="btn-ghost btn-icon" aria-label="Search">
                  <Search size={18} />
                </button>
              </header>
              <main id="main-scroll" className="relative flex-1 overflow-y-auto">
                <div aria-hidden="true" className="foil-haze no-print pointer-events-none absolute inset-x-0 top-0 h-[280px]" />
                <AccountNotice />
                <div className="relative mx-auto w-full max-w-[1320px] px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-9">
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
