// Online booking requests waiting for the shop to confirm. Accepting creates (or matches) the
// customer and vehicle, books the appointment and offers to text a confirmation.
import { useState } from 'react';
import { Globe, Check, X, Phone, Mail, Car, CalendarCheck } from 'lucide-react';
import { useShop, useUI } from '../../store/hooks';
import { Card, CardHeader, Modal, Field, Avatar } from '../../components/ui';
import ComposeModal from '../../components/Compose';
import { relTime, isoDate, phone as fmtPhone } from '../../lib/format';

const fmt = (iso) => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
// Website requests name a day and a time of day; the shop picks the exact time when confirming.
const when = (b) => (b.window ? `${fmtDay(b.start)} · ${b.window === 'Flexible' ? 'any time' : b.window.toLowerCase()} (preferred)` : `${fmt(b.start)} · ${b.duration} min`);

export default function BookingRequests() {
  const { state, declineBooking } = useShop();
  const { toast } = useUI();
  const [accepting, setAccepting] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const requests = state.bookingRequests.filter((b) => b.status === 'new').sort((a, b) => a.start.localeCompare(b.start));
  if (!requests.length && !confirm) return null;

  const confirmAppt = confirm && state.appointments.find((a) => a.id === confirm.appointmentId);
  const confirmCustomer = confirmAppt && state.customers.find((c) => c.id === confirmAppt.customerId);

  return (
    <>
      {requests.length > 0 && (
        <Card className="mb-6 border-accent/30">
          <CardHeader icon={Globe} title={`${requests.length} booking request${requests.length === 1 ? '' : 's'}`} subtitle="Confirm to add them to the calendar" />
          <ul className="divide-y divide-line/70">
            {requests.map((b) => {
              const clash = state.appointments.filter((a) => {
                const s = new Date(a.start).getTime();
                const bs = new Date(b.start).getTime();
                return a.status !== 'cancelled' && s < bs + b.duration * 60000 && s + a.duration * 60000 > bs;
              }).length;
              return (
                <li key={b.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                  <Avatar name={b.name} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold">{b.name}</span>
                      <span className="text-xs text-ink-3">{b.source === 'website' ? 'from your website · ' : b.source === 'phone' ? 'by phone (AI receptionist) · ' : ''}requested {relTime(b.createdAt)}</span>
                    </div>
                    <div className="mt-0.5 text-sm text-ink-2">
                      <CalendarCheck size={13} className="mr-1 inline text-accent" />
                      {when(b)}{clash ? <span className="text-warn"> · {clash} other appointment{clash === 1 ? '' : 's'} then</span> : ''}
                    </div>
                    <div className="mt-0.5 text-sm">{b.services.join(', ') || 'General service'}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-3">
                      {b.vehicle && (
                        <span>
                          <Car size={12} className="mr-1 inline" />
                          {b.vehicle}
                        </span>
                      )}
                      {b.phone && (
                        <a href={`tel:${b.phone}`} className="hover:text-accent">
                          <Phone size={12} className="mr-1 inline" />
                          {fmtPhone(b.phone)}
                        </a>
                      )}
                      {b.email && (
                        <a href={`mailto:${b.email}`} className="hover:text-accent">
                          <Mail size={12} className="mr-1 inline" />
                          {b.email}
                        </a>
                      )}
                    </div>
                    {b.notes && <p className="mt-1.5 whitespace-pre-line rounded-[8px] bg-fill/[0.06] px-2.5 py-1.5 text-sm">{b.notes}</p>}
                  </div>
                  {/* On a phone the buttons get their own row under the request, full width. */}
                  <div className="flex w-full gap-2 pl-[46px] sm:w-auto sm:pl-0 [&>button]:flex-1 sm:[&>button]:flex-none">
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => {
                        declineBooking(b.id);
                        toast('Request declined — let the customer know another time works');
                      }}
                    >
                      <X size={13} /> Decline
                    </button>
                    <button className="btn-primary btn-sm" onClick={() => setAccepting(b)}>
                      <Check size={13} /> Confirm
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      {accepting && (
        <AcceptModal
          request={accepting}
          onClose={() => setAccepting(null)}
          onAccepted={(appointmentId) => {
            setAccepting(null);
            setConfirm({ appointmentId });
          }}
        />
      )}
      {confirmAppt && confirmCustomer && (confirmCustomer.phone || confirmCustomer.email) && (
        <ComposeModal customer={confirmCustomer} appointment={confirmAppt} templateId="appt" onClose={() => setConfirm(null)} />
      )}
    </>
  );
}

function AcceptModal({ request, onClose, onAccepted }) {
  const { state, acceptBooking } = useShop();
  const { toast } = useUI();
  const s = new Date(request.start);
  const [f, setF] = useState({
    date: isoDate(s),
    time: `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`,
    duration: request.duration || 60,
    techId: '',
    title: request.services.join(', ') || 'Online booking',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const accept = () => {
    const [y, mo, d] = f.date.split('-').map(Number);
    const [h, m] = f.time.split(':').map(Number);
    const id = acceptBooking(request.id, { start: new Date(y, mo - 1, d, h, m).toISOString(), duration: Number(f.duration), techId: f.techId || null, title: f.title });
    toast('Appointment booked', { tone: 'success' });
    onAccepted(id);
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Confirm ${request.name}`}
      subtitle="Adjust the time if needed — the customer and vehicle are added automatically"
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!f.date || !f.time} onClick={accept}>
            <Check size={14} /> Book it
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Reason for visit" className="col-span-2">{(id) => <input id={id} className="input" value={f.title} onChange={set('title')} />}</Field>
        <Field label="Date">{(id) => <input id={id} type="date" className="input" value={f.date} onChange={set('date')} />}</Field>
        <Field label="Time">{(id) => <input id={id} type="time" step={900} className="input" value={f.time} onChange={set('time')} />}</Field>
        <Field label="Duration">
          {(id) => (
            <select id={id} className="input" value={f.duration} onChange={set('duration')}>
              {[30, 45, 60, 90, 120, 180, 240, 480].map((m) => (
                <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} hr`}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Technician">
          {(id) => (
            <select id={id} className="input" value={f.techId} onChange={set('techId')}>
              <option value="">Unassigned</option>
              {state.technicians.filter((t) => t.active !== false).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </Field>
      </div>
    </Modal>
  );
}
