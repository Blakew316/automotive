// Tech view: what a technician needs on the shop floor, sized for a phone or tablet.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, Check, LogIn, LogOut, Camera, ClipboardCheck, Cable, StickyNote, Timer, Hand, Wrench, Clock, Stethoscope } from 'lucide-react';
import { useUI, useLookup, useScopedShop } from '../store/hooks';
import { Card, Avatar, EmptyState, Spinner, Modal } from '../components/ui';
import { PickButton } from './order/MediaPanel';
import { useIngest } from '../lib/useMedia';
import { useNow, openShift, runningJob, serviceClockMs, fmtDuration, entryMs, hours } from '../lib/time';
import { serviceHours } from '../lib/pricing';
import { vehicleName, time, dateTime, fullName } from '../lib/format';
import { catalogPath } from '../lib/catalog';
import { STATUS } from '../lib/workflow';

const TECH_KEY = 'autoshop-pro:tech';
const readTech = () => {
  try {
    return localStorage.getItem(TECH_KEY) || null;
  } catch {
    return null;
  }
};

export default function Tech() {
  const { state, clockIn, clockOut, startJob, stopJob } = useScopedShop();
  const { toast } = useUI();
  const lookup = useLookup();
  const now = useNow(1000);
  const techs = state.technicians.filter((t) => t.active !== false);
  const [techId, setTechId] = useState(() => (techs.some((t) => t.id === readTech()) ? readTech() : null));
  const tech = techs.find((t) => t.id === techId);
  const pickTech = (id) => {
    setTechId(id);
    try {
      localStorage.setItem(TECH_KEY, id);
    } catch {
      // Remembering the tech on this device is a convenience only.
    }
  };

  const shift = tech && openShift(state.timeEntries, tech.id);
  const running = tech && runningJob(state.timeEntries, tech.id);
  const active = useMemo(() => state.orders.filter((o) => ['approved', 'in_progress', 'waiting_parts'].includes(o.status)), [state.orders]);
  const mine = tech ? active.map((o) => ({ o, services: o.services.filter((s) => s.status === 'approved' && (s.techId || o.techId) === tech.id) })).filter((x) => x.services.length) : [];
  const open = active.map((o) => ({ o, services: o.services.filter((s) => s.status === 'approved' && !s.techId && !o.techId && !s.done) })).filter((x) => x.services.length);

  // Today's numbers.
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const todayEntries = tech ? state.timeEntries.filter((e) => e.techId === tech.id) : [];
  const shiftToday = todayEntries.filter((e) => e.kind === 'shift').reduce((s, e) => s + entryMs(e, now, dayStart.getTime()), 0);
  const jobToday = todayEntries.filter((e) => e.kind === 'job').reduce((s, e) => s + entryMs(e, now, dayStart.getTime()), 0);
  const flaggedToday = state.orders.reduce(
    (sum, o) => sum + o.services.filter((s) => s.done && (s.techId || o.techId) === tech?.id && todayEntries.some((e) => e.serviceId === s.id && new Date(e.start) >= dayStart)).reduce((a, s) => a + serviceHours(s), 0),
    0,
  );

  if (!tech)
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="mb-1 text-3xl font-bold">Tech view</h1>
        <p className="mb-6 text-md text-ink-2">Who’s using this device? Your jobs, clock and timers will be ready each time.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {techs.map((t) => (
            <button key={t.id} onClick={() => pickTech(t.id)} className="card flex items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-fill/[0.03]">
              <Avatar name={t.name} size={44} />
              <span>
                <span className="block text-md font-semibold">{t.name}</span>
                <span className="block text-sm text-ink-3">{t.role}</span>
              </span>
            </button>
          ))}
        </div>
        {!techs.length && <EmptyState icon={Wrench} title="No technicians yet" body="Add your team on the Team page." action={<Link to="/team" className="btn-secondary">Team</Link>} />}
      </div>
    );

  const runningSvc = running && lookup.order.get(running.orderId)?.services.find((s) => s.id === running.serviceId);
  const runningOrder = running && lookup.order.get(running.orderId);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Avatar name={tech.name} size={44} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">{tech.name}</h1>
          <button className="text-sm text-accent hover:underline" onClick={() => setTechId(null)}>
            Not you? Switch
          </button>
        </div>
      </div>

      <Card className="mb-4 flex flex-wrap items-center gap-4 p-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${shift ? 'bg-ok/[0.12] text-ok' : 'bg-fill/[0.1] text-ink-3'}`}>
          <Clock size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-md font-semibold">{shift ? 'On the clock' : 'Off the clock'}</div>
          <div className="text-sm text-ink-3">{shift ? `Since ${time(shift.start)} · ${fmtDuration(entryMs(shift, now))}` : 'Clock in to start your day'}</div>
        </div>
        {shift ? (
          <button
            className="btn-secondary h-11 px-5 text-md"
            onClick={() => {
              clockOut(tech.id);
              toast('Clocked out — see you tomorrow');
            }}
          >
            <LogOut size={17} /> Clock out
          </button>
        ) : (
          <button
            className="btn-primary h-11 px-5 text-md"
            onClick={() => {
              clockIn(tech.id);
              toast('Clocked in', { tone: 'success' });
            }}
          >
            <LogIn size={17} /> Clock in
          </button>
        )}
      </Card>

      {running && runningSvc && (
        <Card className="mb-4 flex flex-wrap items-center gap-4 border border-accent/40 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
            <Timer size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-md font-semibold">{runningSvc.title}</div>
            <div className="truncate text-sm text-ink-3">
              {vehicleName(lookup.vehicle.get(runningOrder.vehicleId))} · RO #{runningOrder.number}
            </div>
          </div>
          <div className="tabular text-2xl font-semibold tracking-tight">{fmtDuration(entryMs(running, now), { seconds: true })}</div>
          <button className="btn-secondary h-11 px-4" onClick={() => stopJob(running.id)}>
            <Pause size={17} /> Pause
          </button>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="On the clock today" value={fmtDuration(shiftToday)} />
        <Stat label="On jobs today" value={fmtDuration(jobToday)} />
        <Stat label="Flagged today" value={`${flaggedToday.toFixed(1)} hr`} sub={jobToday ? `${Math.round((flaggedToday / hours(jobToday)) * 100)}% efficiency` : ''} />
      </div>

      <h2 className="section-label mb-2">My jobs</h2>
      {mine.length === 0 ? (
        <Card className="mb-6">
          <EmptyState icon={Wrench} title="No jobs assigned" body="Claim one from the open jobs below, or ask your service advisor." />
        </Card>
      ) : (
        <div className="mb-6 space-y-4">
          {mine.map(({ o, services }) => (
            <JobCard key={o.id} order={o} services={services} tech={tech} running={running} now={now} onStart={(sid) => startJob(tech.id, o.id, sid)} onStop={() => running && stopJob(running.id)} />
          ))}
        </div>
      )}

      {open.length > 0 && (
        <>
          <h2 className="section-label mb-2">Open jobs</h2>
          <Card className="mb-6 divide-y divide-line/70">
            {open.map(({ o, services }) =>
              services.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{s.title}</div>
                    <div className="truncate text-xs text-ink-3">
                      {vehicleName(lookup.vehicle.get(o.vehicleId))} · RO #{o.number} · {serviceHours(s).toFixed(1)} hr
                    </div>
                  </div>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      startJob(tech.id, o.id, s.id);
                      toast(`Started ${s.title}`, { tone: 'success' });
                    }}
                  >
                    <Hand size={15} /> Claim & start
                  </button>
                </div>
              )),
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <Card className="px-3 py-3">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="tabular mt-0.5 text-xl font-semibold">{value}</div>
      {sub && <div className="text-2xs text-ink-3">{sub}</div>}
    </Card>
  );
}

function JobCard({ order, services, running, now, onStart, onStop }) {
  const { state, updateService } = useScopedShop();
  const lookup = useLookup();
  const { ingest, busy } = useIngest(order);
  const [notesFor, setNotesFor] = useState(null);
  const v = lookup.vehicle.get(order.vehicleId);
  const c = lookup.customer.get(order.customerId);
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start gap-3 border-b border-line/70 px-4 py-3">
        <div className="min-w-0 flex-1">
          <Link to={`/orders/${order.id}`} className="block truncate text-md font-semibold hover:text-accent">
            {vehicleName(v, { trim: true })}
          </Link>
          <div className="truncate text-xs text-ink-3">
            RO #{order.number} · {STATUS[order.status]?.label} · {fullName(c)}
            {order.promisedAt && ` · promised ${dateTime(order.promisedAt)}`}
          </div>
          {order.concern && <p className="mt-1 text-sm text-ink-2">“{order.concern}”</p>}
        </div>
        <div className="flex gap-1.5">
          <PickButton capture onFiles={(f) => ingest(f)} className="btn-secondary btn-icon h-9 w-9" title="Photo or video">
            {busy ? <Spinner size={14} /> : <Camera size={16} />}
          </PickButton>
          <Link to={`/diagnose?order=${order.id}`} className="btn-secondary btn-icon h-9 w-9" title="Auto diagnosis" aria-label="Auto diagnosis">
            <Stethoscope size={16} />
          </Link>
          <Link to={`/orders/${order.id}?tab=inspection`} className="btn-secondary btn-icon h-9 w-9" title="Inspection">
            <ClipboardCheck size={16} />
          </Link>
          {v && (
            <Link to={catalogPath(v)} className="btn-secondary btn-icon h-9 w-9" title="Diagrams, parts & repair guides">
              <Cable size={16} />
            </Link>
          )}
        </div>
      </div>
      <ul className="divide-y divide-line/70">
        {services.map((s) => {
          const isRunning = running && running.serviceId === s.id;
          const clocked = serviceClockMs(state.timeEntries, s.id, now);
          const flagged = serviceHours(s);
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <button
                onClick={() => {
                  if (!s.done && isRunning) onStop();
                  updateService(order.id, s.id, { done: !s.done });
                }}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${s.done ? 'border-ok bg-ok text-white' : 'border-ink-4 hover:border-ink-2'}`}
                aria-label={s.done ? 'Mark not done' : 'Mark done'}
              >
                {s.done && <Check size={16} strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1">
                <div className={`text-md font-medium ${s.done ? 'text-ink-3 line-through' : ''}`}>{s.title}</div>
                <div className="text-xs text-ink-3">
                  {flagged.toFixed(1)} hr flagged · <span className={clocked / 3600000 > flagged && flagged ? 'text-warn' : ''}>{fmtDuration(clocked)} clocked</span>
                  {s.note && ` · ${s.note}`}
                </div>
              </div>
              <button className="btn-ghost btn-icon h-9 w-9" onClick={() => setNotesFor(s)} title="Cause & correction">
                <StickyNote size={16} />
              </button>
              {!s.done &&
                (isRunning ? (
                  <button className="btn-secondary h-9 px-3" onClick={onStop}>
                    <Pause size={15} /> {fmtDuration(entryMs(running, now), { seconds: true })}
                  </button>
                ) : (
                  <button className="btn-primary h-9 px-3" onClick={() => onStart(s.id)}>
                    <Play size={15} /> Start
                  </button>
                ))}
            </li>
          );
        })}
      </ul>
      {notesFor && <StoryModal order={order} service={notesFor} onClose={() => setNotesFor(null)} />}
    </Card>
  );
}

function StoryModal({ order, service, onClose }) {
  const { updateService } = useScopedShop();
  const [cause, setCause] = useState(service.cause || '');
  const [correction, setCorrection] = useState(service.correction || '');
  return (
    <Modal
      open
      onClose={onClose}
      title={service.title}
      subtitle="What you found and what you did — goes on the invoice and the customer report"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => {
              updateService(order.id, service.id, { cause: cause.trim(), correction: correction.trim() });
              onClose();
            }}
          >
            Save
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="field-label">Cause</span>
          <textarea rows={3} className="input resize-none" value={cause} onChange={(e) => setCause(e.target.value)} placeholder="e.g. Front pads at 2 mm, rotors below discard" />
        </label>
        <label className="block">
          <span className="field-label">Correction</span>
          <textarea rows={3} className="input resize-none" value={correction} onChange={(e) => setCorrection(e.target.value)} placeholder="e.g. Replaced pads & rotors, serviced slides, road tested" />
        </label>
      </div>
    </Modal>
  );
}
