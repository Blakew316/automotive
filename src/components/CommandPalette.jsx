import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search, ClipboardList, UserPlus, ScanLine, CalendarPlus, Users, Car, LayoutGrid, SquareKanban,
  CalendarDays, Package, BookOpen, ChartColumn, Settings, CircleAlert, CornerDownLeft, FileText, Database,
  MessageSquare, Megaphone, Timer, UsersRound, Landmark, Blocks, Upload, Receipt, Truck, Globe,
} from 'lucide-react';
import { useShop, useUI, useLookup, useAccess } from '../store/hooks';
import { fullName, vehicleName } from '../lib/format';
import { cleanVin } from '../lib/vin';
import { loadIndex, searchIndex } from '../lib/catalog';
import { StatusLabel } from './ui';

const PAGES = [
  { label: 'Today', to: '/', icon: LayoutGrid },
  { label: 'Workflow board', to: '/workflow', icon: SquareKanban },
  { label: 'Repair orders', to: '/orders', icon: ClipboardList },
  { label: 'Calendar & online booking requests', to: '/calendar', icon: CalendarDays },
  { label: 'Messages — texts & emails', to: '/messages', icon: MessageSquare },
  { label: 'Marketing — service reminders, reviews, campaigns', to: '/marketing', icon: Megaphone },
  { label: 'Tech time clock', to: '/tech', icon: Timer },
  { label: 'Team — timesheets, productivity, pay', to: '/team', icon: UsersRound },
  { label: 'Accounting — profit & loss, expenses, sales tax', to: '/accounting', icon: Landmark },
  { label: 'QuickBooks exports', to: '/accounting?tab=export', icon: Landmark },
  { label: 'Purchase orders', to: '/parts?tab=orders', icon: Truck },
  { label: 'Integrations', to: '/integrations', icon: Blocks },
  { label: 'Import data from another system', to: '/import', icon: Upload },
  { label: 'Customers', to: '/customers', icon: Users },
  { label: 'Vehicles', to: '/vehicles', icon: Car },
  { label: 'Vehicle database — makes, models, diagrams, parts', to: '/catalog', icon: Database },
  { label: 'VIN decoder', to: '/vin', icon: ScanLine },
  { label: 'Parts & inventory', to: '/parts', icon: Package },
  { label: 'Service library — OEM service info', to: '/library', icon: BookOpen },
  { label: 'Wiring references & pinouts', to: '/library?tab=wiring', icon: BookOpen },
  { label: 'Trouble code lookup', to: '/library?tab=dtc', icon: CircleAlert },
  { label: 'Reports', to: '/reports', icon: ChartColumn },
  { label: 'Settings', to: '/settings', icon: Settings },
];

const ACTIONS = [
  { label: 'New repair order', to: '/orders/new', icon: ClipboardList, keywords: 'estimate ro work order create' },
  { label: 'New customer', to: '/customers?new=1', icon: UserPlus, keywords: 'add client' },
  { label: 'Book appointment', to: '/calendar?new=1', icon: CalendarPlus, keywords: 'schedule' },
  { label: 'Decode a VIN', to: '/vin', icon: ScanLine, keywords: 'vin lookup decode' },
  { label: 'New message', to: '/messages', icon: MessageSquare, keywords: 'text sms email customer' },
  { label: 'Add expense', to: '/accounting?tab=expenses', icon: Receipt, keywords: 'bill cost accounting' },
  { label: 'Clock in / start a job', to: '/tech', icon: Timer, keywords: 'time clock punch' },
  { label: 'Online booking settings', to: '/settings?tab=booking', icon: Globe, keywords: 'schedule book online' },
  { label: 'Shop website', to: '/settings?tab=website', icon: Globe, keywords: 'website site public google contact' },
  { label: 'Tire registration log', to: '/parts?tab=tires', icon: Package, keywords: 'tires dot tin registration recall' },
  { label: 'Goals & growth planner', to: '/reports?tab=goals', icon: ChartColumn, keywords: 'targets scorecard roi calculator' },
  { label: 'Marketing automations', to: '/marketing', icon: Megaphone, keywords: 'reminders follow up review request automation' },
];

export default function CommandPalette() {
  const { paletteOpen: open, setPaletteOpen } = useUI();
  if (!open) return null;
  return createPortal(<Palette onClose={() => setPaletteOpen(false)} />, document.body);
}

function Palette({ onClose }) {
  const { state } = useShop();
  const { can } = useAccess();
  const lookup = useLookup();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [dtc, setDtc] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    import('../data/dtcCodes').then((m) => setDtc(m.dtcCodes));
    loadIndex().then(setCatalog, () => {});
  }, []);

  const groups = useMemo(() => {
    const query = q.trim().toLowerCase();
    const out = [];
    if (!query) {
      out.push({ title: 'Actions', items: ACTIONS.filter((a) => can(a.to.split('?')[0])).map((a) => ({ ...a, key: a.label })) });
      out.push({ title: 'Go to', items: PAGES.filter((p) => can(p.to.split('?')[0])).map((p) => ({ ...p, key: p.to })) });
      return out;
    }
    const words = query.split(/\s+/);
    const match = (text) => words.every((w) => text.toLowerCase().includes(w));

    const vin = cleanVin(q);
    if (vin.length === 17) out.push({ title: 'VIN', items: [{ key: 'vin', label: `Decode ${vin}`, icon: ScanLine, to: `/vin?vin=${vin}` }] });

    const code = q.trim().toUpperCase();
    if (dtc && /^[PBCU][0-9A-F]{1,4}$/.test(code)) {
      const hits = Object.entries(dtc).filter(([k]) => k.startsWith(code)).slice(0, 6);
      if (hits.length) out.push({ title: 'Trouble codes', items: hits.map(([k, v]) => ({ key: k, label: k, sub: v.d, icon: CircleAlert, to: `/library?tab=dtc&code=${k}` })) });
    }

    const roNum = query.replace(/^#/, '');
    const orders = state.orders
      .filter((o) => {
        const c = lookup.customer.get(o.customerId);
        const v = lookup.vehicle.get(o.vehicleId);
        return String(o.number).startsWith(roNum) || match(`${fullName(c)} ${vehicleName(v)} ${o.concern || ''}`);
      })
      .sort((a, b) => b.number - a.number)
      .slice(0, 5)
      .map((o) => ({
        key: o.id,
        label: `#${o.number} · ${fullName(lookup.customer.get(o.customerId))}`,
        sub: vehicleName(lookup.vehicle.get(o.vehicleId)),
        icon: FileText,
        to: `/orders/${o.id}`,
        status: o.status,
      }));
    if (orders.length) out.push({ title: 'Repair orders', items: orders });

    const customers = state.customers
      .filter((c) => match(`${fullName(c)} ${c.phone} ${c.email} ${c.company || ''}`))
      .slice(0, 5)
      .map((c) => ({ key: c.id, label: fullName(c), sub: c.phone, icon: Users, to: `/customers/${c.id}` }));
    if (customers.length) out.push({ title: 'Customers', items: customers });

    const vehicles = state.vehicles
      .filter((v) => match(`${vehicleName(v, { trim: true })} ${v.vin} ${v.plate || ''} ${v.unit ? `unit ${v.unit}` : ''}`))
      .slice(0, 5)
      .map((v) => ({ key: v.id, label: `${v.unit ? `Unit ${v.unit} · ` : ''}${vehicleName(v, { trim: true })}`, sub: `${v.plate || ''} · ${v.vin}`, icon: Car, to: `/vehicles/${v.id}` }));
    if (vehicles.length) out.push({ title: 'Vehicles', items: vehicles });

    if (catalog && query.length >= 2) {
      const hits = searchIndex(catalog, q, 5).map((r) => ({
        key: `cat:${r.makeSlug}/${r.modelSlug}`,
        label: `${r.year ? `${r.year} ` : ''}${r.make} ${r.model}`,
        sub: `Vehicle database · ${r.yf === r.yt ? r.yf : `${r.yf}–${r.yt}`}`,
        icon: Database,
        to: `/catalog/${r.makeSlug}/${r.modelSlug}${r.year ? `?year=${r.year}` : ''}`,
      }));
      if (hits.length) out.push({ title: 'Vehicle database', items: hits });
    }

    const pages = [...ACTIONS, ...PAGES].filter((p) => can(p.to.split('?')[0]) && match(`${p.label} ${p.keywords || ''}`)).map((p) => ({ ...p, key: p.to + p.label }));
    if (pages.length) out.push({ title: 'Go to', items: pages });
    return out;
  }, [q, state, lookup, dtc, catalog, can]);

  const flat = groups.flatMap((g) => g.items);
  const current = Math.min(active, Math.max(0, flat.length - 1));

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${current}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  const go = (item) => {
    if (!item) return;
    navigate(item.to);
    onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((current + 1) % Math.max(1, flat.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((current - 1 + flat.length) % Math.max(1, flat.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(flat[current]);
    } else if (e.key === 'Escape') onClose();
  };

  let idx = -1;
  return (
    <div className="fixed inset-0 z-[55] flex justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search">
      <div className="absolute inset-0 animate-fade-in bg-black/20" onClick={onClose} />
      <div className="glass relative flex max-h-[64vh] w-full max-w-[620px] animate-sheet-in flex-col overflow-hidden rounded-xl bg-surface/95 shadow-sheet">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} strokeWidth={2} className="shrink-0 text-ink-3" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search customers, vehicles, VINs, RO #, trouble codes…"
            className="h-14 flex-1 bg-transparent text-lg text-ink outline-none placeholder:text-ink-4"
          />
          <kbd className="kbd">esc</kbd>
        </div>
        <div ref={listRef} className="overflow-y-auto p-2">
          {flat.length === 0 && <div className="px-3 py-10 text-center text-sm text-ink-3">No results for “{q}”</div>}
          {groups.map((g) => (
            <div key={g.title} className="mb-1">
              <div className="px-3 pb-1 pt-2 text-xs font-medium text-ink-3">{g.title}</div>
              {g.items.map((item) => {
                idx += 1;
                const i = idx;
                const sel = i === current;
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    data-idx={i}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(item)}
                    className={`flex w-full items-center gap-3 rounded-[8px] px-3 py-2 text-left transition-colors ${sel ? 'bg-accent text-on-accent' : 'text-ink'}`}
                  >
                    {Icon && <Icon size={16} strokeWidth={1.8} className={`shrink-0 ${sel ? 'text-on-accent' : 'text-ink-3'}`} />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.label}</span>
                      {item.sub && <span className={`block truncate text-xs ${sel ? 'text-on-accent/75' : 'text-ink-3'}`}>{item.sub}</span>}
                    </span>
                    {item.status && !sel && <StatusLabel status={item.status} className="text-xs" />}
                    {sel && <CornerDownLeft size={14} className="shrink-0 text-on-accent/80" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
