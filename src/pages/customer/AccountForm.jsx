// Business / fleet account settings for a customer: payment terms, credit limit, PO numbers, tax
// exemption, pre-approved spending and where statements go.
import { useState } from 'react';
import { useShop, useUI } from '../../store/hooks';
import { Modal, Field, Toggle } from '../../components/ui';
import { TERMS, BLANK_ACCOUNT } from '../../lib/accounts';

const toNum = (v) => {
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export default function AccountForm({ customer, onClose, onSaved }) {
  const { saveAccount, saveCustomer } = useShop();
  const { toast } = useUI();
  const existing = customer.account;
  const [company, setCompany] = useState(customer.company || '');
  const [f, setF] = useState(() => {
    const a = { ...BLANK_ACCOUNT, ...(existing || {}) };
    return { ...a, creditLimit: a.creditLimit ?? '', preApproved: a.preApproved ?? '', billingEmail: a.billingEmail || customer.email || '' };
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const valid = company.trim().length > 0;

  const save = (e) => {
    e?.preventDefault();
    if (!valid) return;
    if (company.trim() !== customer.company) saveCustomer({ id: customer.id, company: company.trim() });
    saveAccount(customer.id, {
      terms: f.terms,
      creditLimit: toNum(f.creditLimit),
      preApproved: toNum(f.preApproved),
      poRequired: Boolean(f.poRequired),
      taxExempt: Boolean(f.taxExempt),
      taxId: f.taxExempt ? f.taxId.trim() : '',
      billingEmail: f.billingEmail.trim(),
      invoiceNote: f.invoiceNote.trim(),
    });
    toast(existing ? 'Account updated' : `${company.trim()} is now a business account`, { tone: 'success' });
    onSaved?.();
    onClose();
  };

  const remove = () => {
    saveAccount(customer.id, null);
    toast('Business account turned off — invoices are due on receipt again');
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? 'Account settings' : 'Set up a business account'}
      subtitle="Fleet and commercial customers: invoices on terms, statements, PO numbers and maintenance schedules for every unit."
      footer={
        <>
          {existing && (
            <button className="btn-plain mr-auto text-bad" onClick={remove}>
              Turn off account
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!valid} onClick={save}>{existing ? 'Save' : 'Create account'}</button>
        </>
      }
    >
      <form onSubmit={save} className="grid grid-cols-2 gap-3">
        <Field label="Company name" className="col-span-2">{(id) => <input id={id} className="input" value={company} onChange={(e) => setCompany(e.target.value)} autoFocus={!company} />}</Field>
        <Field label="Payment terms">
          {(id) => (
            <select id={id} className="input" value={f.terms} onChange={set('terms')}>
              {TERMS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Credit limit" hint="Blank for no limit">
          {(id) => <input id={id} inputMode="decimal" className="input tabular" placeholder="$0" value={f.creditLimit} onChange={set('creditLimit')} />}
        </Field>
        <Field label="Pre-approved up to" className="col-span-2" hint="Repairs under this amount per visit can go ahead without calling (the fleet’s not-to-exceed limit). Blank to always call.">
          {(id) => <input id={id} inputMode="decimal" className="input tabular" placeholder="$0" value={f.preApproved} onChange={set('preApproved')} />}
        </Field>
        <div className="col-span-2 flex items-center justify-between gap-3 rounded-[8px] border border-line px-3 py-2.5">
          <span className="text-sm">
            <span className="block font-medium">PO number required</span>
            <span className="text-xs text-ink-3">Asks for the customer’s purchase order number before an invoice is charged to the account.</span>
          </span>
          <Toggle checked={Boolean(f.poRequired)} onChange={(v) => setF((x) => ({ ...x, poRequired: v }))} label="PO number required" />
        </div>
        <div className="col-span-2 rounded-[8px] border border-line px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">
              <span className="block font-medium">Tax exempt</span>
              <span className="text-xs text-ink-3">New repair orders for this account start tax exempt. Keep the exemption certificate on file.</span>
            </span>
            <Toggle checked={Boolean(f.taxExempt)} onChange={(v) => setF((x) => ({ ...x, taxExempt: v }))} label="Tax exempt" />
          </div>
          {f.taxExempt && (
            <Field label="Exemption certificate / tax ID" className="mt-2">
              {(id) => <input id={id} className="input" value={f.taxId} onChange={set('taxId')} />}
            </Field>
          )}
        </div>
        <Field label="Billing email" className="col-span-2" hint="Statements and invoices go here (often accounts payable)">
          {(id) => <input id={id} type="email" className="input" value={f.billingEmail} onChange={set('billingEmail')} />}
        </Field>
        <Field label="Note on every invoice" className="col-span-2">
          {(id) => <textarea id={id} rows={2} className="input" placeholder="e.g. Reference your PO number on payment. Remit to …" value={f.invoiceNote} onChange={set('invoiceNote')} />}
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
