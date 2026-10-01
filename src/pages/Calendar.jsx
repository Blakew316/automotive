import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Globe } from 'lucide-react';
import { useShop, useLookup } from '../store/hooks';
import { PageHeader, Card, Segmented, Dot } from '../components/ui';
import { AppointmentForm } from '../components/forms';
import BookingRequests from './calendar/BookingRequests';
import { addDays, startOfDay, sameDay, time, fullName, vehicleName } from '../lib/format';

const START_HOUR = 7;
const END_HOUR = 19;
const HOUR_PX = 56;

export default function Calendar() {
  const { state } = useShop();
  const lookup = useLookup();
  const [params, setParams] = useSearchParams();
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [view, setView] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 900 ? 'day' : 'week'));
  const [editing, setEditing] = useState(params.get('new') ? {} : null);

  const days = useMemo(() => {
    if (view === 'day') return [anchor];
    const monday = addDays(anchor, -((anchor.getDay() + 6) % 7));
    return Array.from({ length: 6 }, (_, i) => addDays(monday, i));
  }, [anchor, view]);

  const today = startOfDay(new Date());
  const step = view === 'day' ? 1 : 7;
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const label =
    view === 'day'
      ? anchor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      : `${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[days.length - 1].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const close = () => {
    setEditing(null);
    if (params.get('new')) setParams({});
  };

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle={label}
        actions={
          <>
            <Segmented value={view} onChange={setView} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }]} />
            <div className="flex items-center">
              <button className="btn-ghost btn-icon" onClick={() => setAnchor((a) => addDays(a, -step))} aria-label="Previous">
                <ChevronLeft size={18} />
              </button>
              <button className="btn-secondary btn-sm" onClick={() => setAnchor(today)}>Today</button>
              <button className="btn-ghost btn-icon" onClick={() => setAnchor((a) => addDays(a, step))} aria-label="Next">
                <ChevronRight size={18} />
              </button>
            </div>
            <button className="btn-primary" onClick={() => setEditing({})}>
              <Plus size={16} strokeWidth={2.2} /> Appointment
            </button>
          </>
        }
      />

      <BookingRequests />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: view === 'day' ? 0 : 820 }}>
            <div className="grid border-b border-line" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
              <div />
              {days.map((d) => {
                const isToday = sameDay(d, today);
                const count = state.appointments.filter((a) => sameDay(a.start, d)).length;
                return (
                  <button key={d.toISOString()} onClick={() => { setAnchor(d); setView('day'); }} className="border-l border-line/70 px-3 py-2.5 text-left transition-colors hover:bg-fill/[0.04]">
                    <div className="text-xs text-ink-3">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-xl font-semibold ${isToday ? 'flex h-7 w-7 items-center justify-center rounded-full bg-accent text-base text-on-accent' : 'text-ink'}`}>{d.getDate()}</span>
                      {count > 0 && <span className="text-xs text-ink-3">{count} appt{count === 1 ? '' : 's'}</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
              <div>
                {hours.map((h) => (
                  <div key={h} className="relative border-b border-line/50 pr-2 text-right text-2xs text-ink-3" style={{ height: HOUR_PX }}>
                    <span className="relative -top-2">{h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}</span>
                  </div>
                ))}
              </div>
              {days.map((d) => {
                const appts = state.appointments.filter((a) => sameDay(a.start, d)).sort((a, b) => new Date(a.start) - new Date(b.start));
                const isToday = sameDay(d, today);
                const nowTop = ((new Date().getHours() + new Date().getMinutes() / 60 - START_HOUR) * HOUR_PX);
                return (
                  <div key={d.toISOString()} className={`relative border-l border-line/70 ${isToday ? 'bg-accent/[0.025]' : ''}`}>
                    {hours.map((h) => (
                      <button
                        key={h}
                        className="block w-full border-b border-line/50 transition-colors hover:bg-fill/[0.04]"
                        style={{ height: HOUR_PX }}
                        onClick={() => {
                          const s = new Date(d);
                          s.setHours(h, 0, 0, 0);
                          setEditing({ start: s.toISOString() });
                        }}
                        aria-label={`Book at ${h}:00`}
                      />
                    ))}
                    {isToday && nowTop > 0 && nowTop < hours.length * HOUR_PX && (
                      <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: nowTop }}>
                        <span className="-ml-1 h-2 w-2 rounded-full bg-bad" />
                        <span className="h-px flex-1 bg-bad/70" />
                      </div>
                    )}
                    {layout(appts).map(({ a, col, cols }) => {
                      const s = new Date(a.start);
                      const top = (s.getHours() + s.getMinutes() / 60 - START_HOUR) * HOUR_PX;
                      const height = Math.max(26, (a.duration / 60) * HOUR_PX - 3);
                      const c = lookup.customer.get(a.customerId);
                      const v = lookup.vehicle.get(a.vehicleId);
                      const tech = lookup.tech.get(a.techId);
                      const order = a.orderId && lookup.order.get(a.orderId);
                      return (
                        <button
                          key={a.id}
                          onClick={() => setEditing(a)}
                          className="absolute z-[5] overflow-hidden rounded-[7px] border border-line bg-surface px-2 py-1 text-left shadow-[0_1px_2px_rgb(0_0_0/0.06)] transition-shadow hover:shadow-pop"
                          style={{ top: Math.max(0, top) + 1, height, left: `calc(${(col / cols) * 100}% + 3px)`, width: `calc(${100 / cols}% - 6px)` }}
                        >
                          <span className="absolute inset-y-1 left-0.5 w-[3px] rounded-full bg-accent/70" />
                          <div className="pl-1.5">
                            <div className="flex items-center gap-1.5 text-2xs text-ink-3">
                              {time(a.start)}
                              {a.status === 'arrived' && <Dot className="bg-ok" size={5} />}
                              {a.source === 'online' && <Globe size={10} className="text-accent" aria-label="Booked online" />}
                              {tech && <span className="truncate">· {tech.name.split(' ')[0]}</span>}
                            </div>
                            <div className="truncate text-xs font-semibold text-ink">{fullName(c)}</div>
                            {height > 50 && <div className="truncate text-2xs text-ink-2">{v ? `${v.year} ${v.model}` : ''} — {a.title}</div>}
                            {height > 80 && order && <div className="truncate text-2xs text-accent">RO #{order.number}</div>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      <UpcomingList />

      {editing && <AppointmentForm open onClose={close} initial={editing.id || editing.start ? editing : undefined} key={editing.id || editing.start || 'new'} />}
    </>
  );
}

/** Side-by-side columns for overlapping appointments. */
function layout(appts) {
  const out = [];
  let group = [];
  let groupEnd = 0;
  const flush = () => {
    const cols = [];
    group.forEach((a) => {
      const s = new Date(a.start).getTime();
      let c = cols.findIndex((end) => end <= s);
      if (c === -1) c = cols.length;
      cols[c] = s + a.duration * 60000;
      out.push({ a, col: c });
    });
    out.slice(out.length - group.length).forEach((x) => (x.cols = cols.length));
    group = [];
  };
  appts.forEach((a) => {
    const s = new Date(a.start).getTime();
    if (group.length && s >= groupEnd) flush();
    group.push(a);
    groupEnd = Math.max(groupEnd, s + a.duration * 60000);
  });
  if (group.length) flush();
  return out;
}

function UpcomingList() {
  const { state } = useShop();
  const lookup = useLookup();
  const now = new Date();
  const upcoming = state.appointments.filter((a) => new Date(a.start) > now).sort((a, b) => new Date(a.start) - new Date(b.start)).slice(0, 8);
  if (!upcoming.length) return null;
  return (
    <Card className="mt-6">
      <div className="card-header">
        <h2 className="card-title">Coming up</h2>
      </div>
      <ul className="divide-y divide-line/70">
        {upcoming.map((a) => {
          const c = lookup.customer.get(a.customerId);
          const v = lookup.vehicle.get(a.vehicleId);
          return (
            <li key={a.id} className="flex items-center gap-4 px-4 py-2.5 text-sm">
              <div className="w-28 shrink-0 text-ink-2">
                {new Date(a.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                <div className="text-xs text-ink-3">{time(a.start)}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{fullName(c)}</div>
                <div className="truncate text-xs text-ink-3">{vehicleName(v)} — {a.title}</div>
              </div>
              <Link to={`/orders/new?appointment=${a.id}`} className="btn-outline btn-sm">Check in</Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
