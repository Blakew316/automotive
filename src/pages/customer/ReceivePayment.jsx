// Receive one payment (usually a check or ACH from a fleet's accounts payable) and apply it across
// several invoices — oldest first, or to the invoices the remittance lists.
import { useMemo, useState } from 'react';
import { useShop, useUI } from '../../store/hooks';
import { Modal, Field } from '../../components/ui';
import { allocate } from '../../lib/accounts';
import { PAYMENT_METHODS } from '../../lib/workflow';
import { money, dateShort, isoDate, round2, vehicleName, fullName } from '../../lib/format';

const METHODS = PAYMENT_METHODS.filter((m) => m !== 'Fleet account');

export default function ReceivePayment({ customer, invoices, selected: initial, onClose }) {
  const { state, receivePayment } = useShop();
  const { toast } = useUI();
  const [picked, setPicked] = useState(() => new Set(initial?.length ? initial : invoices.map((i) => i.order.id)));
  const pickedTotal = round2(invoices.filter((i) => picked.has(i.order.id)).reduce((s, i) => s + i.balance, 0));
  const [amount, setAmount] = useState(() => String(pickedTotal.toFixed(2)));
  const [touched, setTouched] = useState(false);
  const [method, setMethod] = useState('Check');
  const [ref, setRef] = useState('');
  const [day, setDay] = useState(isoDate(new Date()));

  const amt = round2(parseFloat(String(touched ? amount : pickedTotal).replace(/[^0-9.]/g, '')) || 0);
  const { allocations, unapplied } = useMemo(() => allocate(invoices, amt, [...picked]), [invoices, amt, picked]);
  const applied = new Map(allocations.map((a) => [a.orderId, a]));

  const toggle = (id) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = () => {
    const at = day === isoDate(new Date()) ? new Date().toISOString() : new Date(`${day}T12:00:00`).toISOString();
    receivePayment(customer.id, { method, ref: ref.trim(), at, allocations });
    const closes = allocations.filter((a) => a.closes).length;
    toast(`${money(amt)} applied to ${allocations.length} invoice${allocations.length === 1 ? '' : 's'}${closes ? ` · ${closes} paid in full` : ''}`, { tone: 'success' });
    onClose();
  };

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title="Receive payment"
      subtitle={`${customer.company || fullName(customer)} · apply one payment across invoices`}
      footer={
        <>
          <span className="mr-auto text-sm text-ink-2">
            {unapplied > 0.004 ? <span className="text-bad">{money(unapplied)} more than the selected invoices — select more or lower the amount.</span> : `Applying ${money(amt)} to ${allocations.length} invoice${allocations.length === 1 ? '' : 's'}`}
          </span>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={amt <= 0 || unapplied > 0.004 || !allocations.length} onClick={save}>
            Record payment
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Amount">
          {(id) => (
            <input
              id={id}
              inputMode="decimal"
              className="input tabular"
              value={touched ? amount : pickedTotal.toFixed(2)}
              onChange={(e) => {
                setTouched(true);
                setAmount(e.target.value);
              }}
              autoFocus
            />
          )}
        </Field>
        <Field label="Method">
          {(id) => (
            <select id={id} className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label={method === 'Check' ? 'Check number' : 'Reference'}>{(id) => <input id={id} className="input" value={ref} onChange={(e) => setRef(e.target.value)} />}</Field>
        <Field label="Received">{(id) => <input id={id} type="date" className="input" value={day} max={isoDate(new Date())} onChange={(e) => setDay(e.target.value || isoDate(new Date()))} />}</Field>
      </div>

      <div className="mt-4 overflow-x-auto rounded-[8px] border border-line">
        <table className="table">
          <thead>
            <tr>
              <th className="w-8" />
              <th>Invoice</th>
              <th className="hidden sm:table-cell">Unit / vehicle</th>
              <th>Due</th>
              <th className="text-right">Balance</th>
              <th className="text-right">Applying</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => {
              const v = state.vehicles.find((x) => x.id === i.order.vehicleId);
              const a = applied.get(i.order.id);
              return (
                <tr key={i.order.id} className="cursor-pointer" onClick={() => toggle(i.order.id)}>
                  <td>
                    <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={picked.has(i.order.id)} onChange={() => toggle(i.order.id)} onClick={(e) => e.stopPropagation()} aria-label={`Apply to RO #${i.order.number}`} />
                  </td>
                  <td>
                    <div className="tabular font-medium">RO #{i.order.number}</div>
                    <div className="text-xs text-ink-3">{dateShort(i.invoiced)}{i.order.po ? ` · PO ${i.order.po}` : ''}</div>
                  </td>
                  <td className="hidden sm:table-cell">
                    <div className="truncate">{v?.unit ? `Unit ${v.unit}` : v ? vehicleName(v) : '—'}</div>
                    {v?.unit && <div className="truncate text-xs text-ink-3">{vehicleName(v)}</div>}
                  </td>
                  <td className={i.pastDue > 0 ? 'text-bad' : 'text-ink-2'}>
                    {dateShort(i.due)}
                    {i.pastDue > 0 && <div className="text-xs">{i.pastDue} days past due</div>}
                  </td>
                  <td className="tabular text-right">{money(i.balance)}</td>
                  <td className={`tabular text-right font-medium ${a ? '' : 'text-ink-4'}`}>{a ? money(a.amount) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-3">Payments go to the oldest selected invoices first. A partial payment leaves the rest of that invoice open.</p>
    </Modal>
  );
}
