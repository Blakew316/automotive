// The tab bar's More screen (iPhone, iPad portrait): who's signed in, this device's location, every
// place that isn't a tab, shared-data status and appearance — laid out like iOS Settings.
import { useState } from 'react';
import { Search, Sun, Monitor, Moon, MapPin } from 'lucide-react';
import { Logo } from '../brand/Logo';
import { otherName } from '../brand/artwork';
import { PageHeader, IconTile, ListRow, Segmented, Avatar } from '../components/ui';
import { useShop, useUI, useAccess, useSync, useSite } from '../store/hooks';
import { NAV, HUE, useNavCounts, tabsFor } from '../components/nav';
import { ROLES } from '../lib/access';
import { syncLabel } from '../lib/sync/labels';
import SwitchUser from '../components/SwitchUser';

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'Automatic', icon: Monitor },
  { value: 'dark', label: 'Dark', icon: Moon },
];

function Group({ title, children, footer }) {
  return (
    <section className="mb-7">
      {title && <h2 className="mb-1.5 px-4 text-xs font-medium uppercase tracking-[0.04em] text-ink-3">{title}</h2>}
      <div className="card divide-y divide-line/80 overflow-hidden">{children}</div>
      {footer && <p className="mt-1.5 px-4 text-xs text-ink-3">{footer}</p>}
    </section>
  );
}

export default function More() {
  const { state } = useShop();
  const { theme, setTheme, setPaletteOpen } = useUI();
  const { can, role, user } = useAccess();
  const sync = useSync();
  const site = useSite();
  const counts = useNavCounts();
  const [switching, setSwitching] = useState(false);
  const inTabs = new Set(tabsFor(role, can).map((t) => t.to));
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(i.to) && !inTabs.has(i.to)) })).filter((g) => g.items.length);
  const status = sync?.enabled ? syncLabel(sync) : '';
  const warn = sync?.enabled && ['signed-out', 'not-staff', 'error', 'offline'].includes(sync.status.phase);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="More" subtitle={state.shop.name} />

      <button onClick={() => setPaletteOpen(true)} className="mb-6 flex h-10 w-full items-center gap-2 rounded-[10px] bg-fill/[0.12] px-3 text-left text-[16px] text-ink-3">
        <Search size={17} strokeWidth={2} />
        Search customers, vehicles, RO #…
      </button>

      <Group>
        <ListRow onClick={() => setSwitching(true)} className="py-3">
          <Avatar name={user.name} size={46} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[17px] font-semibold text-ink">{user.name}</span>
            <span className="block truncate text-sm text-ink-3">{ROLES[role]?.label} · Switch user</span>
          </span>
        </ListRow>
        {site.multi && (
          <label className="flex min-h-[48px] items-center gap-3 px-4">
            <IconTile icon={MapPin} tone="rose" size={30} />
            <span className="flex-1 text-base text-ink">Location</span>
            <select className="max-w-[55%] bg-transparent text-right text-base text-ink-3 outline-none" value={site.current} onChange={(e) => site.setCurrent(e.target.value)} aria-label="Location">
              <option value="all">All locations</option>
              {site.sites.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>
        )}
        {status && (
          <ListRow to={sync.status.phase === 'signed-out' || (sync.status.phase === 'not-staff' && sync.session?.mfa) ? '/signin' : '/settings?tab=cloud#sync'}>
            <span className={`ml-[11px] mr-[11px] h-2 w-2 shrink-0 rounded-full ${warn ? 'bg-warn' : 'bg-ok'}`} />
            <span className="min-w-0 flex-1 truncate text-base text-ink">{status}</span>
            {sync.status.live && !warn && <span className="text-2xs font-semibold uppercase tracking-wide text-ok">Live</span>}
          </ListRow>
        )}
      </Group>

      {groups.map((g) => (
        <Group key={g.title} title={g.title}>
          {g.items.map((i) => {
            const n = i.count ? counts[i.count] : 0;
            return (
              <ListRow key={i.to} to={i.to}>
                <IconTile icon={i.icon} tone={HUE[g.hue].tone} size={30} />
                <span className="min-w-0 flex-1 truncate text-base text-ink">{i.label}</span>
                {n > 0 &&
                  (i.badge ? (
                    <span className="tabular flex h-5 min-w-[20px] items-center justify-center rounded-full bg-bad px-1.5 text-xs font-semibold text-white">{n}</span>
                  ) : (
                    <span className="tabular text-base text-ink-3">{n}</span>
                  ))}
              </ListRow>
            );
          })}
        </Group>
      ))}

      <Group title="Appearance">
        <div className="px-4 py-3">
          <Segmented options={THEMES} value={theme} onChange={setTheme} className="w-full [&>button]:flex-1" />
        </div>
      </Group>

      <div className="flex flex-col items-center gap-1.5 px-4 pt-2 text-xs text-ink-4">
        <Logo variant="full" className="h-14 opacity-90" />
        {otherName(state.shop.name) && <p>{otherName(state.shop.name)}</p>}
      </div>
      {switching && <SwitchUser onClose={() => setSwitching(false)} />}
    </div>
  );
}
