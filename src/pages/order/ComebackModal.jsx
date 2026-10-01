// Mark a repair order as a comeback: the vehicle is back for work the shop already did. Links it to
// the original RO and technician (for the comeback report) and can make this visit no charge.
import { useState } from 'react';
import { useShop, useUI } from '../../store/hooks';
import { Modal, Field, Toggle } from '../../components/ui';
import { dateShort } from '../../lib/format';

export default function ComebackModal({ order, onClose }) {
  const { state, updateOrder } = useShop();
  const { toast } = useUI();
  const past = state.orders
    .filter((o) => o.vehicleId === order.vehicleId && o.id !== order.id && ['ready', 'closed'].includes(o.status))
    .sort((a, b) => String(b.invoicedAt || b.createdAt).localeCompare(String(a.invoicedAt || a.createdAt)));
  const [of, setOf] = useState(order.comeback?.of || past[0]?.id || '');
  const orig = past.find((o) => o.id === of);
  const [techId, setTechId] = useState(order.comeback?.techId || orig?.techId || '');
  const [reason, setReason] = useState(order.comeback?.reason || '');
  const [free, setFree] = useState(true);

  const save = () => {
    updateOrder(order.id, (o) => ({
      comeback: { of, ofNumber: orig?.number, techId: techId || null, reason: reason.trim(), at: o.comeback?.at || new Date().toISOString() },
      ...(free ? { services: o.services.map((s) => (s.status === 'declined' ? s : { ...s, noCharge: s.noCharge || 'comeback' })) } : {}),
    }));
    toast(`Marked as a comeback of RO #${orig?.number}`, { tone: 'success' });
    onClose();
  };

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title="Comeback"
      subtitle="Back for work we already did — tracked by technician on the Reports page."
      footer={
        <>
          {order.comeback && (
            <button className="btn-plain mr-auto text-bad" onClick={() => (updateOrder(order.id, { comeback: null }), onClose())}>
              Not a comeback
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!orig} onClick={save}>Save</button>
        </>
      }
    >
      {past.length === 0 ? (
        <p className="text-sm text-ink-2">This vehicle has no earlier repair orders here.</p>
      ) : (
        <div className="space-y-3">
          <Field label="Original repair order">
            {(id) => (
              <select
                id={id}
                className="input"
                value={of}
                onChange={(e) => {
                  setOf(e.target.value);
                  setTechId(past.find((o) => o.id === e.target.value)?.techId || '');
                }}
              >
                {past.map((o) => (
                  <option key={o.id} value={o.id}>
                    RO #{o.number} · {dateShort(o.invoicedAt || o.createdAt)} · {o.services.filter((s) => s.status !== 'declined').map((s) => s.title).join(', ').slice(0, 60)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Technician responsible">
            {(id) => (
              <select id={id} className="input" value={techId} onChange={(e) => setTechId(e.target.value)}>
                <option value="">Not assigned</option>
                {state.technicians.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="What came back">{(id) => <input id={id} className="input" placeholder="e.g. Brake squeal returned, part failure" value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
          {!order.comeback && (
            <label className="flex items-center justify-between gap-3 rounded-[8px] border border-line px-3 py-2 text-sm">
              No charge for the work on this visit
              <Toggle checked={free} onChange={setFree} label="No charge" />
            </label>
          )}
        </div>
      )}
    </Modal>
  );
}
