// The app's destinations: the sidebar (desktop and iPad landscape), the tab bar and the More screen
// (iPhone and iPad portrait) all read from here.
import {
  LayoutGrid, SquareKanban, ClipboardList, CalendarDays, Users, Car, ScanLine, Package, BookOpen, ChartColumn, Settings,
  Database, MessageSquare, Megaphone, Timer, UsersRound, Landmark, Blocks, Building2, ConciergeBell, Stethoscope,
  Wrench, Tags, Tractor,
} from 'lucide-react';
import { OPEN_STATUSES, WIP_STATUSES } from '../lib/workflow';
import { SMALL_ENGINE, TERMS, routeInEdition } from '../lib/edition';
import { useScopedShop } from '../store/hooks';

export function useNavCounts() {
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

// Each section wears one of the brand's cool hues on its icons.
export const HUE = {
  navy: { icon: 'text-accent/75 group-hover:text-accent', active: 'bg-accent/[0.09] text-ink', on: 'text-accent', tone: 'navy' },
  lilac: { icon: 'text-hue-lilac/75 group-hover:text-hue-lilac', active: 'bg-hue-lilac/[0.1] text-ink', on: 'text-hue-lilac', tone: 'lilac' },
  azure: { icon: 'text-hue-azure/75 group-hover:text-hue-azure', active: 'bg-hue-azure/[0.1] text-ink', on: 'text-hue-azure', tone: 'azure' },
  teal: { icon: 'text-hue-teal/75 group-hover:text-hue-teal', active: 'bg-hue-teal/[0.1] text-ink', on: 'text-hue-teal', tone: 'teal' },
};

// Both editions' destinations; each build keeps the ones that belong to it (see lib/edition.js).
const ALL_NAV = [
  {
    title: 'Shop floor',
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
      { to: '/vehicles', label: TERMS.vehicles, icon: SMALL_ENGINE ? Tractor : Car },
      { to: '/marketing', label: 'Marketing', icon: Megaphone },
    ],
  },
  {
    title: 'Technical',
    hue: 'azure',
    items: [
      { to: '/diagnose', label: 'Auto Diagnosis', icon: Stethoscope },
      { to: '/troubleshoot', label: 'Troubleshooting', icon: Wrench },
      { to: '/tech', label: 'Tech Time Clock', icon: Timer },
      { to: '/brands', label: 'Brands & Parts', icon: Tags },
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

export const NAV = ALL_NAV.map((g) => ({ ...g, items: g.items.filter((i) => routeInEdition(i.to)) }));

/** Tab bar destinations (plus More): the front counter's day, or a technician's. */
export const TABS = {
  default: [
    { to: '/', label: 'Today', icon: LayoutGrid, end: true },
    { to: '/workflow', label: 'Board', icon: SquareKanban },
    { to: '/orders', label: 'Orders', icon: ClipboardList },
    { to: '/messages', label: 'Messages', icon: MessageSquare, count: 'unread' },
  ],
  tech: [
    { to: '/tech', label: 'Clock', icon: Timer },
    { to: '/workflow', label: 'Board', icon: SquareKanban },
    { to: '/orders', label: 'Orders', icon: ClipboardList },
    SMALL_ENGINE ? { to: '/troubleshoot', label: 'Troubleshoot', icon: Wrench } : { to: '/diagnose', label: 'Diagnose', icon: Stethoscope },
  ],
};

export const matchesPath = (item, path) => (item.end ? path === item.to : path === item.to || path.startsWith(`${item.to}/`));

/** The tabs this person can open. */
export const tabsFor = (role, can) => (TABS[role] || TABS.default).filter((t) => can(t.to));

/** A page's name from the menu, for the navigation bar on pages without their own header. */
export const navLabel = (path) => NAV.flatMap((g) => g.items).find((i) => matchesPath(i, path))?.label ?? null;
