import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Clock, Package, MoreHorizontal, ArrowRight } from 'lucide-react';
import { useShop, useLookup, useTotals, useUI } from '../store/hooks';
import { PageHeader, SearchInput, Avatar, Dot, Menu, Segmented } from '../components/ui';
import { STATUSES, STATUS } from '../lib/workflow';
import { money, money0, fullName, time, sameDay, dateShort, relTime } from '../lib/format';

const COLUMNS = STATUSES.filter((s) => s.id !== 'closed');

export default function Workflow() {
  const { state, setOrderStatus } = useShop();
  const lookup = useLookup();
  const totals = useTotals();
  const { toast } = useUI();
  const [q, setQ] = useState('');
  const [tech, setTech] = useState('all');
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);
  const now = useMemo(() => new Date(), []);

  const byStatus = useMemo(() => {
    const query = q.toLowerCase();
    const map = Object.fromEntries(COLUMNS.map((c) => [c.id, []]));
    state.orders.forEach((o) => {
      if (!map[o.status]) return;
      if (tech !== 'all' && (tech === 'none' ? o.techId : o.techId !== tech)) return;
      if (query) {
        const c = lookup.customer.get(o.customerId);
        const v = lookup.vehicle.get(o.vehicleId);
        const hay = `${o.number} ${fullName(c)} ${v?.year} ${v?.make} ${v?.model} ${v?.plate} ${o.concern}`.toLowerCase();
        if (!hay.includes(query)) return;
      }
      map[o.status].push(o);
    });
    Object.values(map).forEach((list) => list.sort((a, b) => new Date(a.promisedAt || a.createdAt) - new Date(b.promisedAt || b.createdAt)));
    return map;
  }, [state.orders, q, tech, lookup]);

  const move = (id, status) => {
    const o = lookup.order.get(id);
    if (!o || o.status === status) return;
    const prev = o.status;
    setOrderStatus(id, status);
    toast(`#${o.number} moved to ${STATUS[status].label}`, { action: { label: 'Undo', onClick: () => setOrderStatus(id, prev) } });
  };

  const techOptions = [
    { value: 'all', label: 'Everyone' },
    ...state.technicians.map((t) => ({ value: t.id, label: t.name.split(' ')[0] })),
  ];

  return (
    <>
      <PageHeader
        title="Workflow"
        subtitle="Drag repair orders between stages. Everything updates instantly."
        actions={
          <Link to="/orders/new" className="btn-primary">
            <Plus size={16} strokeWidth={2.2} /> New repair order
          </Link>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Filter by RO, customer, vehicle, plate" className="w-full sm:w-72" />
        <Segmented options={techOptions} value={tech} onChange={setTech} size="sm" className="max-w-full overflow-x-auto" />
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="grid min-w-[1100px] grid-cols-5 gap-3">
          {COLUMNS.map((col) => {
            const list = byStatus[col.id];
            const sum = list.reduce((s, o) => s + totals(o).total, 0);
            return (
              <section
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(col.id);
                }}
                onDragLeave={() => setOver((o) => (o === col.id ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('text/plain') || dragId;
                  setOver(null);
                  setDragId(null);
                  move(id, col.id);
                }}
                className={`relative flex min-h-[60vh] flex-col overflow-hidden rounded-xl p-1.5 pt-2 transition-colors ${over === col.id ? 'bg-accent/[0.07] ring-1 ring-accent/30' : 'bg-fill/[0.07]'}`}
              >
                <header className="flex items-center justify-between px-2 pb-2 pt-1">
                  <div className="flex items-center gap-2">
                    <Dot className={col.dot} size={7} />
                    <h2 className="text-sm font-semibold text-ink">{col.label}</h2>
                    <span className="tabular rounded-full bg-surface px-1.5 text-2xs font-semibold text-ink-2 shadow-card">{list.length}</span>
                  </div>
                  <span className="tabular font-mono text-2xs text-ink-3">{money0(sum)}</span>
                </header>
                <div className="flex flex-1 flex-col gap-1.5">
                  {list.map((o) => (
                    <BoardCard
                      key={o.id}
                      order={o}
                      now={now}
                      dragging={dragId === o.id}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', o.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDragId(o.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOver(null);
                      }}
                      onMove={(s) => move(o.id, s)}
                    />
                  ))}
                  {list.length === 0 && <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line py-8 text-xs text-ink-4">{col.hint}</div>}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}

function BoardCard({ order: o, now, dragging, onDragStart, onDragEnd, onMove }) {
  const lookup = useLookup();
  const totals = useTotals();
  const navigate = useNavigate();
  const c = lookup.customer.get(o.customerId);
  const v = lookup.vehicle.get(o.vehicleId);
  const tech = lookup.tech.get(o.techId);
  const t = totals(o);
  const late = o.promisedAt && new Date(o.promisedAt) < now && !['ready', 'closed', 'estimate'].includes(o.status);
  const partsOut = o.services.flatMap((s) => s.items).filter((i) => i.type === 'part' && i.partStatus === 'ordered').length;
  const done = o.services.filter((s) => s.status !== 'declined' && s.done).length;
  const active = o.services.filter((s) => s.status !== 'declined').length;

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => navigate(`/orders/${o.id}`)}
      className={`group cursor-pointer rounded-[10px] bg-surface p-3 shadow-card transition-all hover:shadow-pop ${dragging ? 'rotate-1 opacity-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink">{v ? `${v.year} ${v.make} ${v.model}` : 'No vehicle'}</div>
          <div className="truncate text-xs text-ink-3">
            #{o.number} · {fullName(c)}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <Menu
            trigger={({ toggle }) => (
              <button onClick={toggle} className="btn-ghost btn-icon -mr-1.5 -mt-1 h-6 w-6 opacity-60 group-hover:opacity-100" aria-label="Move">
                <MoreHorizontal size={15} />
              </button>
            )}
            items={[
              ...STATUSES.filter((s) => s.id !== o.status).map((s) => ({ label: `Move to ${s.label}`, icon: ArrowRight, onClick: () => onMove(s.id) })),
            ]}
          />
        </div>
      </div>
      {o.concern && <p className="mt-2 line-clamp-2 text-xs leading-4 text-ink-2">{o.concern}</p>}
      {active > 0 && o.status !== 'estimate' && (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-1 flex-1 rounded-full bg-fill/[0.14]">
            <div className={`h-full rounded-full ${done === active ? 'bg-ok' : 'bg-accent'}`} style={{ width: `${(done / active) * 100}%` }} />
          </div>
          <span className="tabular text-2xs text-ink-3">
            {done}/{active}
          </span>
        </div>
      )}
      <div className="mt-2.5 flex items-center gap-2 border-t border-line/70 pt-2.5 text-xs">
        {tech ? <Avatar name={tech.name} size={20} /> : <span className="h-5 w-5 rounded-full border border-dashed border-ink-4" title="Unassigned" />}
        {o.promisedAt && o.status !== 'estimate' ? (
          <span className={`flex items-center gap-1 whitespace-nowrap ${late ? 'text-bad' : 'text-ink-3'}`}>
            <Clock size={12} />
            {sameDay(o.promisedAt, now) ? time(o.promisedAt) : dateShort(o.promisedAt)}
          </span>
        ) : (
          <span className="whitespace-nowrap text-ink-3">{relTime(o.createdAt, now)}</span>
        )}
        {partsOut > 0 && (
          <span className="flex items-center gap-1 text-ink-3" title="Parts on order">
            <Package size={12} /> {partsOut}
          </span>
        )}
        <span className="tabular ml-auto font-medium text-ink">{money(o.status === 'ready' ? t.balance : t.total)}</span>
      </div>
    </article>
  );
}
