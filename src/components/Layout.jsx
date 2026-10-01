import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutGrid, SquareKanban, ClipboardList, CalendarDays, Users, Car, ScanLine, Package,
  BookOpen, ChartColumn, Settings, Search, Menu as MenuIcon, Sun, Moon, Monitor, Wrench, X, Database,
} from 'lucide-react';
import { useShop, useUI } from '../store/hooks';
import { OPEN_STATUSES, WIP_STATUSES } from '../lib/workflow';
import CommandPalette from './CommandPalette';
import Toasts from './Toasts';

function useNavCounts() {
  const { state } = useShop();
  const open = state.orders.filter((o) => OPEN_STATUSES.includes(o.status));
  return {
    workflow: open.filter((o) => WIP_STATUSES.includes(o.status)).length,
    orders: open.length,
    lowStock: state.inventory.filter((p) => Number(p.qty) <= Number(p.min)).length,
  };
}

const NAV = [
  {
    items: [
      { to: '/', label: 'Today', icon: LayoutGrid, end: true },
      { to: '/workflow', label: 'Workflow', icon: SquareKanban, count: 'workflow' },
      { to: '/orders', label: 'Repair Orders', icon: ClipboardList, count: 'orders' },
      { to: '/calendar', label: 'Calendar', icon: CalendarDays },
    ],
  },
  {
    title: 'Customers',
    items: [
      { to: '/customers', label: 'Customers', icon: Users },
      { to: '/vehicles', label: 'Vehicles', icon: Car },
    ],
  },
  {
    title: 'Technical',
    items: [
      { to: '/catalog', label: 'Vehicle Database', icon: Database },
      { to: '/vin', label: 'VIN Decoder', icon: ScanLine },
      { to: '/parts', label: 'Parts & Inventory', icon: Package, count: 'lowStock' },
      { to: '/library', label: 'Service Library', icon: BookOpen },
    ],
  },
  {
    title: 'Shop',
    items: [
      { to: '/reports', label: 'Reports', icon: ChartColumn },
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
  const counts = useNavCounts();
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-ink text-canvas shadow-[inset_0_1px_0_rgb(255_255_255/0.15)]">
          <Wrench size={15} strokeWidth={2.1} />
        </span>
        <div className="min-w-0 leading-tight">
          <div className="text-md font-semibold tracking-tight text-ink">AutoShop Pro</div>
        </div>
      </div>

      <div className="px-3 pb-2">
        <button
          onClick={() => {
            setPaletteOpen(true);
            onNavigate?.();
          }}
          className="flex h-8 w-full items-center gap-2 rounded-[7px] bg-fill/[0.1] px-2.5 text-sm text-ink-3 transition-colors hover:bg-fill/[0.15]"
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
        {NAV.map((group, gi) => (
          <div key={gi} className={gi ? 'mt-4' : 'mt-1'}>
            {group.title && <div className="mb-1 px-2.5 text-xs font-semibold text-ink-3">{group.title}</div>}
            <div className="space-y-px">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `group flex h-8 items-center gap-2.5 rounded-[7px] px-2.5 text-[13.5px] transition-colors ${
                      isActive ? 'bg-fill/[0.16] font-medium text-ink' : 'text-ink/85 hover:bg-fill/[0.08]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={17} strokeWidth={1.75} className={isActive ? 'text-accent' : 'text-ink-2'} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.count && counts[item.count] > 0 && <span className="tabular text-xs text-ink-3">{counts[item.count]}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-line/80 px-3 py-3">
        <div className="mb-2.5 truncate px-1 text-xs text-ink-3">
          <span className="font-medium text-ink-2">{state.shop.name}</span>
          <br />
          {state.shop.city && `${state.shop.city}, ${state.shop.state}`}
        </div>
        <div className="flex rounded-[8px] bg-fill/[0.1] p-[2px]" role="radiogroup" aria-label="Appearance">
          {THEMES.map((t) => (
            <button
              key={t.value}
              role="radio"
              aria-checked={theme === t.value}
              title={t.label}
              onClick={() => setTheme(t.value)}
              className={`flex h-6 flex-1 items-center justify-center rounded-[6px] transition-all ${
                theme === t.value ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.12)]' : 'text-ink-3 hover:text-ink'
              }`}
            >
              <t.icon size={13} strokeWidth={2} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { navOpen, setNavOpen, setPaletteOpen } = useUI();
  const location = useLocation();

  useEffect(() => {
    document.getElementById('main-scroll')?.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-canvas">
      <aside className="no-print hidden w-[232px] shrink-0 border-r border-line/80 bg-sidebar/80 lg:block">
        <Sidebar />
      </aside>

      {navOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/25" onClick={() => setNavOpen(false)} />
          <aside className="relative h-full w-[272px] animate-slide-in bg-sidebar shadow-sheet">
            <button onClick={() => setNavOpen(false)} className="btn-ghost btn-icon absolute right-2 top-3 rounded-full" aria-label="Close menu">
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
            <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-ink text-canvas">
              <Wrench size={13} strokeWidth={2.1} />
            </span>
            <span className="text-md font-semibold">AutoShop Pro</span>
          </div>
          <button onClick={() => setPaletteOpen(true)} className="btn-ghost btn-icon" aria-label="Search">
            <Search size={18} />
          </button>
        </header>
        <main id="main-scroll" className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-9">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette />
      <Toasts />
    </div>
  );
}
