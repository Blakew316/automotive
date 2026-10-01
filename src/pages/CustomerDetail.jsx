import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Phone, MessageSquare, Mail, Pencil, Plus, Car, Trash2, MoreHorizontal, CalendarPlus, Users, ChevronRight, History } from 'lucide-react';
import RecordHistory from '../components/RecordHistory';
import ComposeModal from '../components/Compose';
import { useShop, useUI, useTotals, useSync } from '../store/hooks';
import { PageHeader, Card, CardHeader, Avatar, StatusLabel, EmptyState, Menu, Modal, ListRow, KV } from '../components/ui';
import { CustomerForm, VehicleForm, AppointmentForm } from '../components/forms';
import { money, money0, fullName, vehicleName, phone, telHref, mailHref, dateShort, date, number, time, relTime } from '../lib/format';

export default function CustomerDetail() {
  const { id } = useParams();
  const { state, deleteCustomer } = useShop();
  const { toast } = useUI();
  const totals = useTotals();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [booking, setBooking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [history, setHistory] = useState(false);
  const sync = useSync();
  const [composing, setComposing] = useState(null);
  const c = state.customers.find((x) => x.id === id);

  const data = useMemo(() => {
    if (!c) return null;
    const orders = state.orders.filter((o) => o.customerId === c.id).sort((a, b) => b.number - a.number);
    const paid = orders.filter((o) => o.status === 'closed' || o.status === 'ready');
    const spend = paid.reduce((s, o) => s + totals(o).total, 0);
    const balance = paid.reduce((s, o) => s + Math.max(0, totals(o).balance), 0);
    const declined = orders.flatMap((o) => o.services.filter((s) => s.status === 'declined').map((s) => ({ s, o })));
    return {
      orders,
      vehicles: state.vehicles.filter((v) => v.customerId === c.id),
      spend,
      balance,
      aro: paid.length ? spend / paid.length : 0,
      visits: paid.length,
      declined,
      appointments: state.appointments.filter((a) => a.customerId === c.id && new Date(a.start) > new Date()).sort((a, b) => new Date(a.start) - new Date(b.start)),
    };
  }, [c, state.orders, state.vehicles, state.appointments, totals]);

  if (!c) return <EmptyState icon={Users} title="Customer not found" action={<Link to="/customers" className="btn-secondary">All customers</Link>} />;

  return (
    <>
      <PageHeader
        back="/customers"
        title={
          <span className="flex items-center gap-4">
            <Avatar person={c} size={52} />
            <span className="min-w-0">
              {fullName(c)}
              <span className="block text-md font-normal text-ink-2">{c.company || `Customer since ${date(c.createdAt)}`}</span>
            </span>
          </span>
        }
        actions={
          <>
            <a href={telHref(c.phone)} className="btn-secondary btn-icon" aria-label="Call"><Phone size={15} /></a>
            <button onClick={() => setComposing({ channel: 'sms' })} disabled={!c.phone} className="btn-secondary btn-icon" aria-label="Text"><MessageSquare size={15} /></button>
            <button onClick={() => setComposing({ channel: 'email' })} disabled={!c.email} className="btn-secondary btn-icon" aria-label="Email"><Mail size={15} /></button>
            <button className="btn-secondary" onClick={() => setBooking(true)}><CalendarPlus size={15} /> Book</button>
            <Link to={`/orders/new?customer=${c.id}`} className="btn-primary"><Plus size={16} strokeWidth={2.2} /> Repair order</Link>
            <Menu
              trigger={({ toggle }) => (
                <button className="btn-secondary btn-icon" onClick={toggle} aria-label="More"><MoreHorizontal size={16} /></button>
              )}
              items={[
                { label: 'Edit customer', icon: Pencil, onClick: () => setEditing(true) },
                sync?.enabled && { label: 'Change history', icon: History, onClick: () => setHistory(true) },
                '-',
                { label: 'Delete customer', icon: Trash2, danger: true, onClick: () => setConfirmDelete(true) },
              ]}
            />
          </>
        }
      />

      {history && <RecordHistory collection="customers" id={c.id} title={fullName(c)} onClose={() => setHistory(false)} />}
      <Card className="mb-6 grid grid-cols-2 divide-line p-1 md:grid-cols-4 md:divide-x">
        <Metric label="Lifetime spend" value={money0(data.spend)} />
        <Metric label="Visits" value={data.visits} />
        <Metric label="Average repair order" value={money0(data.aro)} />
        <Metric label="Balance due" value={money(data.balance)} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Vehicles" subtitle={`${data.vehicles.length} on file`} actions={<button className="btn-plain btn-sm" onClick={() => setAddingVehicle(true)}><Plus size={14} /> Add vehicle</button>} />
            {data.vehicles.length === 0 ? (
              <EmptyState icon={Car} title="No vehicles yet" body="Add one by VIN to decode it automatically." />
            ) : (
              <div className="divide-y divide-line/70">
                {data.vehicles.map((v) => (
                  <ListRow key={v.id} to={`/vehicles/${v.id}`}>
                    <Car size={18} strokeWidth={1.6} className="shrink-0 text-ink-3" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{vehicleName(v, { trim: true })}</div>
                      <div className="truncate font-mono text-[11.5px] text-ink-3">{v.vin}</div>
                    </div>
                    <div className="hidden text-right text-sm sm:block">
                      <div>{v.plate || '—'}</div>
                      <div className="tabular text-xs text-ink-3">{number(v.mileage)} mi</div>
                    </div>
                  </ListRow>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Service history" subtitle={`${data.orders.length} repair orders`} />
            {data.orders.length === 0 ? (
              <EmptyState title="No repair orders yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>RO</th>
                      <th>Date</th>
                      <th>Vehicle</th>
                      <th className="hidden md:table-cell">Work</th>
                      <th>Status</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders.map((o) => {
                      const v = state.vehicles.find((x) => x.id === o.vehicleId);
                      return (
                        <tr key={o.id} className="row-link" onClick={() => navigate(`/orders/${o.id}`)}>
                          <td className="tabular font-medium">#{o.number}</td>
                          <td className="whitespace-nowrap text-ink-2">{dateShort(o.closedAt || o.createdAt)}</td>
                          <td className="whitespace-nowrap">{v ? `${v.year} ${v.model}` : '—'}</td>
                          <td className="hidden max-w-[260px] truncate text-ink-2 md:table-cell">{o.services.filter((s) => s.status !== 'declined').map((s) => s.title).join(', ')}</td>
                          <td><StatusLabel status={o.status} /></td>
                          <td className="tabular text-right">{money(totals(o).total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {data.declined.length > 0 && (
            <Card>
              <CardHeader title="Declined work" subtitle="Follow-up opportunities — previously recommended but not approved" />
              <ul className="divide-y divide-line/70">
                {data.declined.slice(0, 8).map(({ s, o }) => {
                  const v = state.vehicles.find((x) => x.id === o.vehicleId);
                  return (
                    <li key={s.id}>
                      <Link to={`/orders/${o.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-fill/[0.04]">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{s.title}</span>
                          <span className="block text-xs text-ink-3">{v ? `${v.year} ${v.model}` : ''} · RO #{o.number} · {dateShort(o.createdAt)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="px-4 py-2">
            <dl className="divide-y divide-line/70">
              <KV label="Mobile">{c.phone ? <a href={telHref(c.phone)} className="link">{phone(c.phone)}</a> : '—'}</KV>
              <KV label="Email">{c.email ? <a href={mailHref(c.email)} className="link break-all">{c.email}</a> : '—'}</KV>
              <KV label="Address">
                {c.address ? (
                  <>
                    {c.address}
                    <br />
                    {[c.city, c.state].filter(Boolean).join(', ')} {c.zip}
                  </>
                ) : '—'}
              </KV>
              {c.tags?.length > 0 && <KV label="Tags">{c.tags.join(', ')}</KV>}
            </dl>
          </Card>
          <RecentMessages customerId={c.id} />
          {c.notes && (
            <Card className="px-4 py-3">
              <div className="section-label mb-1">Notes</div>
              <p className="whitespace-pre-wrap text-sm text-ink-2">{c.notes}</p>
            </Card>
          )}
          <Card>
            <CardHeader title="Upcoming" actions={<button className="btn-plain btn-sm" onClick={() => setBooking(true)}><Plus size={14} /> Book</button>} />
            {data.appointments.length === 0 ? (
              <p className="px-4 py-3 text-sm text-ink-3">No upcoming appointments.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {data.appointments.map((a) => (
                  <li key={a.id} className="px-4 py-2.5 text-sm">
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-ink-3">{dateShort(a.start)}, {time(a.start)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {editing && <CustomerForm open initial={c} onClose={() => setEditing(false)} />}
      {composing && <ComposeModal customer={c} templateId="update" {...composing} onClose={() => setComposing(null)} />}
      {addingVehicle && <VehicleForm open initial={{ customerId: c.id }} onClose={() => setAddingVehicle(false)} />}
      {booking && <AppointmentForm open initial={{ customerId: c.id, vehicleId: data.vehicles[0]?.id }} onClose={() => setBooking(false)} />}
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${fullName(c)}?`}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button
              className="btn-primary !bg-bad"
              onClick={() => {
                deleteCustomer(c.id);
                toast('Customer deleted');
                navigate('/customers', { replace: true });
              }}
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-2">Their vehicles stay on file without an owner. Repair orders are kept for your records.</p>
      </Modal>
    </>
  );
}

function Metric({ label, value }) {
  return (
    <div className="px-4 py-3.5">
      <div className="text-sm text-ink-2">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function RecentMessages({ customerId }) {
  const { state } = useShop();
  const list = state.messages.filter((m) => m.customerId === customerId).sort((a, b) => b.at.localeCompare(a.at));
  const unread = list.filter((m) => m.dir === 'in' && !m.read).length;
  return (
    <Card>
      <CardHeader
        title="Messages"
        subtitle={unread ? `${unread} unread` : `${list.length} in conversation`}
        actions={
          <Link to={`/messages/${customerId}`} className="btn-plain btn-sm">
            Open <ChevronRight size={14} />
          </Link>
        }
      />
      {list.length === 0 ? (
        <p className="px-4 py-3 text-sm text-ink-3">No messages yet.</p>
      ) : (
        <ul className="divide-y divide-line/70">
          {list.slice(0, 3).map((m) => (
            <li key={m.id} className="px-4 py-2.5 text-sm">
              <div className="mb-0.5 flex justify-between text-xs text-ink-3">
                <span>{m.dir === 'out' ? 'You' : 'Customer'}</span>
                <span>{relTime(m.at)}</span>
              </div>
              <p className={`line-clamp-2 ${m.dir === 'in' && !m.read ? 'font-medium text-ink' : 'text-ink-2'}`}>{m.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
