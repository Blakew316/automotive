// Charge a finished repair order to a business account: the vehicle goes home and the invoice goes
// on the account's statement, due on the account's terms.
import { useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { useShop, useUI, useTotals } from '../../store/hooks';
import { Modal, Field } from '../../components/ui';
import { accountSummary, dueDate, termsLabel } from '../../lib/accounts';
import { money, date } from '../../lib/format';

export default function ChargeModal({ order, customer, onClose }) {
  const { state, chargeToAccount } = useShop();
  const { toast } = useUI();
  const totals = useTotals();
  const a = customer.account;
  const [po, setPo] = useState(order.po || '');
  const balance = Math.max(0, totals(order).balance);
  const sum = accountSummary(state, customer);
  // The account balance already includes this invoice while it's open (ready for pickup).
  const after = sum.balance + (sum.invoices.some((i) => i.order.id === order.id) ? 0 : balance);
  const over = a.creditLimit ? after - a.creditLimit : 0;
  const due = dueDate({ ...order, charge: null, invoicedAt: order.invoicedAt || new Date().toISOString() }, customer);
  const needsPo = a.poRequired && !po.trim();

  const submit = () => {
    if (needsPo) return;
    chargeToAccount(order.id, { po: po.trim() });
    toast(`${money(balance)} charged to ${customer.company} — due ${date(due)}`, { tone: 'success' });
    onClose();
  };

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title="Charge to account"
      subtitle={`RO #${order.number} · ${customer.company}`}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={needsPo} onClick={submit}>Charge {money(balance)}</button>
        </>
      }
    >
      <div className="space-y-4">
        <dl className="space-y-1 rounded-[10px] bg-fill/[0.06] px-3 py-2 text-sm">
          <div className="flex justify-between"><dt className="text-ink-2">Terms</dt><dd>{termsLabel(a.terms)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-2">Due</dt><dd>{date(due)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-2">Account balance after</dt><dd className="tabular">{money(after)}</dd></div>
          {a.creditLimit && <div className="flex justify-between"><dt className="text-ink-2">Credit limit</dt><dd className="tabular">{money(a.creditLimit)}</dd></div>}
        </dl>
        <Field label={a.poRequired ? 'PO number (required)' : 'PO number'} hint={a.poRequired ? `${customer.company} needs its purchase order number on every invoice.` : undefined}>
          {(id) => <input id={id} className="input" value={po} onChange={(e) => setPo(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && submit()} />}
        </Field>
        {over > 0.004 && (
          <p className="flex items-start gap-2 rounded-[8px] border border-warn/40 bg-warn/[0.08] px-3 py-2 text-sm text-ink">
            <CircleAlert size={15} className="mt-0.5 shrink-0 text-warn" />
            This puts the account {money(over)} over its credit limit{sum.pastDue > 0 ? `, and ${money(sum.pastDue)} is already past due` : ''}. You can still charge it, or take a payment instead.
          </p>
        )}
      </div>
    </Modal>
  );
}
