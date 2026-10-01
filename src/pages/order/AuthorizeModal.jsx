import { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { AUTH_METHODS } from '../../lib/authMethods';
import { useShop, useUI } from '../../store/hooks';
import { Modal, Segmented, Field } from '../../components/ui';
import SignaturePad from '../../components/SignaturePad';
import { serviceTotal, orderTotals } from '../../lib/pricing';
import { money, fullName, dateTime } from '../../lib/format';


/** Record the customer's decision on pending work — with a signature when they're at the counter. */
export default function AuthorizeModal({ order, customer, onClose }) {
  const { state, authorize } = useShop();
  const { toast } = useUI();
  const pending = order.services.filter((s) => s.status === 'pending');
  const [decisions, setDecisions] = useState(() => Object.fromEntries(pending.map((s) => [s.id, 'approve'])));
  const [method, setMethod] = useState('phone');
  const [by, setBy] = useState(fullName(customer) === 'Walk-in' ? '' : fullName(customer));
  const [signature, setSignature] = useState(null);
  const [note, setNote] = useState('');
  const approveIds = pending.filter((s) => decisions[s.id] === 'approve').map((s) => s.id);
  const declineIds = pending.filter((s) => decisions[s.id] === 'decline').map((s) => s.id);
  const amount = useMemo(() => orderTotals({ ...order, services: order.services.filter((s) => approveIds.includes(s.id)) }, state.shop).total, [order, approveIds, state.shop]);
  const needsSignature = method === 'in-person';
  const valid = (approveIds.length || declineIds.length) && by.trim() && (!needsSignature || signature);

  const submit = () => {
    if (!valid) return;
    authorize(order.id, { serviceIds: approveIds, declineIds, method, by: by.trim(), signature: needsSignature ? signature : null, note: note.trim() });
    toast(approveIds.length ? `${money(amount)} authorized by ${by.trim()}` : 'Decision recorded', { tone: 'success' });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Authorize work"
      subtitle={`RO #${order.number} · record the customer’s approval`}
      size="md"
      footer={
        <>
          <span className="mr-auto text-sm text-ink-2">
            Approving <span className="tabular font-semibold text-ink">{money(amount)}</span>
          </span>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!valid} onClick={submit}>
            <Check size={15} /> Record authorization
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <ul className="divide-y divide-line/70 overflow-hidden rounded-[10px] border border-line">
          {pending.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{s.title}</div>
                {s.note && <div className="truncate text-xs text-ink-3">{s.note}</div>}
              </div>
              <span className="tabular text-sm">{money(serviceTotal(s))}</span>
              <Segmented
                size="sm"
                value={decisions[s.id]}
                onChange={(v) => setDecisions({ ...decisions, [s.id]: v })}
                options={[
                  { value: 'approve', label: 'Approve', icon: Check },
                  { value: 'decline', label: 'Decline', icon: X },
                  { value: 'later', label: 'Later' },
                ]}
              />
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-1.5">
          <button className="btn-plain btn-sm" onClick={() => setDecisions(Object.fromEntries(pending.map((s) => [s.id, 'approve'])))}>Approve all</button>
          <button className="btn-plain btn-sm" onClick={() => setDecisions(Object.fromEntries(pending.map((s) => [s.id, 'decline'])))}>Decline all</button>
        </div>
        <div>
          <span className="field-label">How did they authorize?</span>
          <Segmented size="sm" value={method} onChange={setMethod} options={Object.entries(AUTH_METHODS).filter(([k]) => k !== 'online').map(([value, m]) => ({ value, label: m.label, icon: m.icon }))} />
        </div>
        <Field label="Authorized by">{(id) => <input id={id} className="input" value={by} onChange={(e) => setBy(e.target.value)} placeholder="Customer name" />}</Field>
        {needsSignature && <SignaturePad onChange={setSignature} label="Customer signs here" />}
        <Field label="Note" hint="Optional — e.g. “OK up to $900, call if more is needed”">{(id) => <input id={id} className="input" value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
      </div>
    </Modal>
  );
}

export function AuthorizationLog({ order }) {
  const list = order.authorizations || [];
  if (!list.length) return null;
  return (
    <ul className="divide-y divide-line/70">
      {[...list].reverse().map((a) => {
        const M = AUTH_METHODS[a.method] || AUTH_METHODS.phone;
        return (
          <li key={a.id} className="px-4 py-2.5 text-sm">
            <div className="flex items-start gap-2.5">
              <M.icon size={15} className="mt-0.5 shrink-0 text-ink-3" />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <span className="truncate font-medium">{a.by || 'Customer'}</span>
                  <span className="tabular shrink-0">{money(a.amount)}</span>
                </div>
                <div className="text-xs text-ink-3">
                  {M.label} · {dateTime(a.at)} · {a.serviceIds.length} approved{a.declinedIds?.length ? `, ${a.declinedIds.length} declined` : ''}
                </div>
                {a.note && <div className="mt-0.5 text-xs text-ink-2">{a.note}</div>}
              </div>
            </div>
            {a.signature && <img src={a.signature} alt={`Signature of ${a.by}`} className="mt-2 h-12 rounded-[6px] border border-line bg-white px-2" />}
          </li>
        );
      })}
    </ul>
  );
}
