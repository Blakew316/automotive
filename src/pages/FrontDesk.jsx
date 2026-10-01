// Front desk: today's self check-ins, customers waiting in the lobby, loaners, shuttle rides, and
// the self check-in link (with a QR code for the key-drop sign and the lobby tablet).
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConciergeBell, MonitorPlay, QrCode as QrIcon, KeyRound, Car, MapPin, Clock, MessageSquare, Printer, Package, Phone } from 'lucide-react';
import { useShop, useSync } from '../store/hooks';
import { PageHeader, Card, CardHeader, EmptyState, StatusLabel, Stat, Modal, CopyButton } from '../components/ui';
import QrCode from '../components/QrCode';
import ComposeModal from '../components/Compose';
import { TRANSPORT, loanerBoard, shuttleRuns, coreList, checkinLink } from '../lib/operations';
import { fullName, vehicleName, time, dateTime, relTime, telHref, phone as fmtPhone, money } from '../lib/format';

const sameDay = (a, b = new Date()) => new Date(a).toDateString() === new Date(b).toDateString();

export default function FrontDesk() {
  const { state, updateOrder } = useShop();
  const sync = useSync();
  const [qr, setQr] = useState(false);
  const [composing, setComposing] = useState(null);
  const now = useMemo(() => new Date(), []);
  const find = (id, list) => list.find((x) => x.id === id);

  const checkins = state.orders.filter((o) => o.checkin && sameDay(o.checkin.at, now)).sort((a, b) => b.checkin.at.localeCompare(a.checkin.at));
  const waiting = state.orders.filter((o) => o.transport === 'waiting' && !['ready', 'closed'].includes(o.status));
  const loaners = loanerBoard(state);
  const rides = shuttleRuns(state, now);
  const cores = coreList(state).filter((c) => c.status === 'owed');
  const link = checkinLink(state);
  const enabled = state.shop.frontDesk?.checkin?.enabled;

  return (
    <>
      <PageHeader
        title="Front desk"
        subtitle="Check-ins, waiting customers, loaners and rides"
        actions={
          <>
            <button className="btn-secondary" onClick={() => setQr(true)} disabled={!link}>
              <QrIcon size={15} /> Self check-in
            </button>
            <Link to="/lobby" target="_blank" className="btn-secondary">
              <MonitorPlay size={15} /> Lobby screen
            </Link>
          </>
        }
      />
      <Card className="mb-6 grid grid-cols-2 divide-line p-1 md:grid-cols-4 md:divide-x">
        <Stat label="Self check-ins today" value={checkins.length} />
        <Stat label="Waiting in the lobby" value={waiting.length} />
        <Stat label="Loaners out" value={`${loaners.filter((l) => l.order).length} of ${loaners.length}`} />
        <Stat label="Shuttle rides today" value={rides.length} sub={rides.filter((r) => !r.done).length ? `${rides.filter((r) => !r.done).length} to go` : undefined} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Self check-ins" icon={ConciergeBell} subtitle={enabled ? 'From the lobby tablet and key drop' : 'Turned off — Settings → Front desk'} />
          {checkins.length === 0 ? (
            <EmptyState icon={KeyRound} title="None yet today" body={link ? 'Customers check in on the lobby tablet or at the key drop with their phone.' : 'Connect Shop Cloud to use self check-in.'} />
          ) : (
            <ul className="divide-y divide-line/70">
              {checkins.map((o) => {
                const c = find(o.customerId, state.customers);
                const v = find(o.vehicleId, state.vehicles);
                return (
                  <li key={o.id} className="px-4 py-3 text-sm">
                    <div className="flex items-start gap-3">
                      <Link to={`/orders/${o.id}`} className="min-w-0 flex-1 hover:underline">
                        <div className="font-medium">{fullName(c)} · {v ? vehicleName(v) : 'Vehicle'}</div>
                        <div className="line-clamp-2 text-xs text-ink-2">{o.concern || 'No concern given'}</div>
                      </Link>
                      <StatusLabel status={o.status} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                      <span>{time(o.checkin.at)}</span>
                      <span className="flex items-center gap-1"><KeyRound size={11} /> {o.checkin.dropoff === 'dropbox' ? 'Drop box' : 'Counter'}{o.checkin.keyTag ? ` · tag ${o.checkin.keyTag}` : ''}</span>
                      {o.transport && <span>{TRANSPORT[o.transport]}</span>}
                      {o.promisedAt && <span>Needs it by {dateTime(o.promisedAt)}</span>}
                      {c && (
                        <button className="ml-auto inline-flex items-center gap-1 text-accent hover:underline" onClick={() => setComposing({ customer: c, order: o })}>
                          <MessageSquare size={11} /> Confirm
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Waiting in the lobby" icon={Clock} />
          {waiting.length === 0 ? (
            <p className="px-4 py-4 text-sm text-ink-3">Nobody is waiting. Set an RO’s transportation to “Waiting” to see it here and first on the lobby screen.</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {waiting.map((o) => {
                const c = find(o.customerId, state.customers);
                const v = find(o.vehicleId, state.vehicles);
                return (
                  <li key={o.id}>
                    <Link to={`/orders/${o.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-fill/[0.04]">
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{fullName(c)}</span>
                        <span className="block text-xs text-ink-3">{v ? vehicleName(v) : ''} · waiting {relTime(o.checkin?.at || o.createdAt, now).replace(' ago', '')}</span>
                      </span>
                      {o.promisedAt && <span className="text-xs text-ink-2">{time(o.promisedAt)}</span>}
                      <StatusLabel status={o.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Loaners" icon={Car} actions={<Link to="/settings?tab=frontdesk" className="btn-plain btn-sm">Manage</Link>} />
          {loaners.length === 0 ? (
            <p className="px-4 py-4 text-sm text-ink-3">Add your loaner cars in <Link to="/settings?tab=frontdesk" className="link">Settings → Front desk</Link>, then check them out from a repair order’s Transportation box.</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {loaners.map(({ loaner: l, order: o, customer: c }) => (
                <li key={l.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${o ? 'bg-warn' : 'bg-ok'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{l.name}{l.plate ? <span className="font-normal text-ink-3"> · {l.plate}</span> : null}</span>
                    <span className="block text-xs text-ink-3">
                      {o ? (
                        <>
                          With {fullName(c)} since {dateTime(o.loaner.outAt)} · <Link to={`/orders/${o.id}`} className="link">RO #{o.number}</Link>
                          {o.promisedAt ? ` · back ${dateTime(o.promisedAt)}` : ''}
                        </>
                      ) : (
                        `Available${l.mileage ? ` · ${Number(l.mileage).toLocaleString()} mi` : ''}${l.fuel ? ` · ${l.fuel} tank` : ''}`
                      )}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Shuttle — today" icon={MapPin} />
          {rides.length === 0 ? (
            <p className="px-4 py-4 text-sm text-ink-3">No rides scheduled. Choose “Shuttle ride” on a repair order and set the times.</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {rides.map((r) => {
                const address = r.address || (r.customer?.address ? `${r.customer.address}, ${r.customer.city || ''}` : '');
                return (
                  <li key={`${r.order.id}-${r.leg}`} className={`flex items-start gap-3 px-4 py-2.5 text-sm ${r.done ? 'opacity-60' : ''}`}>
                    <input type="checkbox" className="mt-1 h-4 w-4" checked={Boolean(r.done)} onChange={(e) => updateOrder(r.order.id, { shuttle: { ...r.order.shuttle, [r.leg]: { ...r.order.shuttle[r.leg], done: e.target.checked } } })} aria-label={`${r.leg === 'dropoff' ? 'Drop-off' : 'Pick-up'} done`} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {time(r.at)} · {r.leg === 'dropoff' ? 'Drop off' : 'Pick up'} {fullName(r.customer)}
                      </span>
                      {address && (
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-accent hover:underline">
                          {address}
                        </a>
                      )}
                    </span>
                    {r.customer?.phone && (
                      <a href={telHref(r.customer.phone)} className="btn-ghost btn-icon h-7 w-7" aria-label={`Call ${fullName(r.customer)}`} title={fmtPhone(r.customer.phone)}>
                        <Phone size={13} />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {cores.length > 0 && (
        <Link to="/parts?tab=cores" className="card mt-6 flex items-center gap-3 px-4 py-3 text-sm hover:bg-fill/[0.03]">
          <Package size={16} className="text-ink-3" />
          <span className="flex-1">{cores.length} core{cores.length === 1 ? '' : 's'} to return to vendors · {money(cores.reduce((s, c) => s + c.amount, 0))} in credits waiting</span>
          <span className="text-accent">Parts → Cores</span>
        </Link>
      )}

      {qr && (
        <Modal open size="sm" onClose={() => setQr(false)} title="Self check-in" subtitle="Open this on the lobby tablet, or print the QR code for the key drop.">
          <div className="flex flex-col items-center gap-3">
            <QrCode text={link} size={200} label="Self check-in QR code" />
            <div className="flex w-full items-center gap-1 rounded-[8px] border border-line bg-raised px-2 py-1.5">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-2">{link}</span>
              <CopyButton text={link} label="Copy check-in link" className="h-7 w-7 px-0" />
            </div>
            <div className="flex w-full gap-2">
              <a href={`${link}&kiosk=1`} target="_blank" rel="noopener noreferrer" className="btn-secondary flex-1">
                <MonitorPlay size={14} /> Open as lobby kiosk
              </a>
              <Link to="/frontdesk/sign" className="btn-secondary flex-1">
                <Printer size={14} /> Print key-drop sign
              </Link>
            </div>
            {!sync?.staff && <p className="text-xs text-warn">Sign in to Shop Cloud on this device so check-ins arrive automatically.</p>}
          </div>
        </Modal>
      )}
      {composing && <ComposeModal customer={composing.customer} order={composing.order} templateId="checkedin" onClose={() => setComposing(null)} />}
    </>
  );
}
