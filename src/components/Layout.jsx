import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import {
  LayoutGrid, SquareKanban, ClipboardList, CalendarDays, Users, Car, ScanLine, Package,
  BookOpen, ChartColumn, Settings, Search, Menu as MenuIcon, Sun, Moon, Monitor, Wrench, X, Database,
  MessageSquare, Megaphone, Timer, UsersRound, Landmark, Blocks, ChevronsUpDown, Lock,
} from 'lucide-react';
import { useShop, useUI, useAccess } from '../store/hooks';
import { ROLES, homeFor } from '../lib/access';
import SwitchUser from './SwitchUser';
import { OPEN_STATUSES, WIP_STATUSES } from '../lib/workflow';
import { useCloudSync } from '../lib/useCloudSync';
import CommandPalette from './CommandPalette';
import Toasts from './Toasts';

function useNavCounts() {
  const { state } = useShop();
  const open = state.orders.filter((o) => OPEN_STATUSES.includes(o.status));
  return {
    workflow: open.filter((o) => WIP_STATUSES.includes(o.status)).length,
    orders: open.length,
    lowStock: state.inventory.filter((p) => Number(p.qty) <= Number(p.min)).length,
    unread: state.messages.filter((m) => m.dir === 'in' && !m.read).length,
    requests: state.bookingRequests.filter((b) => b.status === 'new').length,
  };
}

const NAV = [
  {
    items: [
      { to: '/', label: 'Today', icon: LayoutGrid, end: true },
      { to: '/workflow', label: 'Workflow', icon: SquareKanban, count: 'workflow' },
      { to: '/orders', label: 'Repair Orders', icon: ClipboardList, count: 'orders' },
      { to: '/calendar', label: 'Calendar', icon: CalendarDays, count: 'requests', badge: true },
      { to: '/messages', label: 'Messages', icon: MessageSquare, count: 'unread', badge: true },
    ],
  },
  {
    title: 'Customers',
    items: [
      { to: '/customers', label: 'Customers', icon: Users },
      { to: '/vehicles', label: 'Vehicles', icon: Car },
      { to: '/marketing', label: 'Marketing', icon: Megaphone },
    ],
  },
  {
    title: 'Technical',
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

function Sidebar({ onNavigate }) {
  const { state } = useShop();
  const { setPaletteOpen, theme, setTheme } = useUI();
  const { can, user, role } = useAccess();
  const [switching, setSwitching] = useState(false);
  const counts = useNavCounts();
  const nav = NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(i.to)) })).filter((g) => g.items.length);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-ink">
      <div className="flex h-16 items-center gap-3 px-4">
        <Logo size={32} />
        <div className="min-w-0 leading-tight">
          <div className="text-md font-semibold tracking-tight text-white">AutoShop Pro</div>
          <div className="truncate font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-sidebar-ink-2">{state.shop.name}</div>
        </div>
      </div>

      <div className="px-3 pb-2">
        <button
          onClick={() => {
            setPaletteOpen(true);
            onNavigate?.();
          }}
          className="flex h-8 w-full items-center gap-2 rounded-[8px] border border-sidebar-line bg-sidebar-2 px-2.5 text-sm text-sidebar-ink-2 transition-colors hover:border-sidebar-ink-2/40 hover:text-sidebar-ink"
        >
          <Search size={14} strokeWidth={2} />
          <span className="flex-1 text-left">Search</span>
          <span className="flex gap-0.5">
            <kbd className="kbd-dark">{isMac ? '⌘' : 'Ctrl'}</kbd>
            <kbd className="kbd-dark">K</kbd>
          </span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 [scrollbar-color:rgb(255_255_255/0.15)_transparent]">
        {nav.map((group, gi) => (
          <div key={gi} className={gi ? 'mt-5' : 'mt-2'}>
            {group.title && <div className="mb-1.5 px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-ink-2/80">{group.title}</div>}
            <div className="space-y-px">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `group relative flex h-8 items-center gap-2.5 rounded-[7px] px-2.5 text-[13.5px] transition-colors ${
                      isActive ? 'bg-sidebar-2 font-medium text-white' : 'text-sidebar-ink/80 hover:bg-white/[0.05] hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-sky" />}
                      <item.icon size={17} strokeWidth={1.75} className={isActive ? 'text-sky' : 'text-sidebar-ink-2 group-hover:text-sidebar-ink'} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.count && counts[item.count] > 0 &&
                        (item.badge ? (
                          <span className="tabular flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1.5 text-2xs font-semibold text-white">{counts[item.count]}</span>
                        ) : (
                          <span className="tabular text-xs text-sidebar-ink-2">{counts[item.count]}</span>
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
        <button onClick={() => setSwitching(true)} className="mb-2.5 flex w-full items-center gap-2.5 rounded-[9px] px-1.5 py-1.5 text-left transition-colors hover:bg-white/[0.05]" title="Switch user">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate to-graphite text-xs font-semibold text-white ring-1 ring-sidebar-line">
            {user.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 text-xs leading-4">
            <span className="block truncate font-medium text-sidebar-ink">{user.name}</span>
            <span className="block truncate text-sidebar-ink-2">{ROLES[role]?.label}</span>
          </span>
          <ChevronsUpDown size={14} className="shrink-0 text-sidebar-ink-2" />
        </button>
        <div className="flex rounded-[8px] bg-sidebar-2 p-[2px] ring-1 ring-sidebar-line" role="radiogroup" aria-label="Appearance">
          {THEMES.map((t) => (
            <button
              key={t.value}
              role="radio"
              aria-checked={theme === t.value}
              title={t.label}
              onClick={() => setTheme(t.value)}
              className={`flex h-6 flex-1 items-center justify-center rounded-[6px] transition-all ${
                theme === t.value ? 'bg-white/[0.12] text-white shadow-[0_1px_2px_rgb(0_0_0/0.3)]' : 'text-sidebar-ink-2 hover:text-white'
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

/** App mark: a wrench on a blue tile. */
export function Logo({ size = 28 }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-sky to-accent text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_2px_6px_rgb(31_99_212/0.35)]"
      style={{ width: size, height: size }}
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

  useEffect(() => {
    document.getElementById('main-scroll')?.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-canvas">
      <aside className="no-print hidden w-[240px] shrink-0 lg:block">
        <Sidebar />
      </aside>

      {navOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/25" onClick={() => setNavOpen(false)} />
          <aside className="relative h-full w-[272px] animate-slide-in bg-sidebar shadow-sheet">
            <button onClick={() => setNavOpen(false)} className="btn-icon btn absolute right-2 top-4 rounded-full text-sidebar-ink-2 hover:bg-white/10 hover:text-white" aria-label="Close menu">
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
          {/* Faint blueprint grid that fades out below the page header. */}
          <div aria-hidden className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[420px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
          <div className="relative mx-auto w-full max-w-[1320px] px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-9">
            {can(location.pathname) ? <Outlet /> : <NoAccess />}
          </div>
        </main>
      </div>

      <CommandPalette />
      <Toasts />
    </div>
  );
}
