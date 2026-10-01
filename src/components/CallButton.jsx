// Call a customer. With the business line connected, AutoShop Pro rings the advisor's phone first and
// then connects the customer, so the customer sees the shop's number; otherwise it's a plain tel: link.
import { useState } from 'react';
import { Phone, PhoneCall } from 'lucide-react';
import { usePhone, useUI } from '../store/hooks';
import { Modal, Spinner } from './ui';
import { fullName, phone as fmtPhone, telHref } from '../lib/format';
import { e164 } from '../lib/phone';

const RING_KEY = 'autoshop:ring-phone';
const remembered = () => {
  try {
    return localStorage.getItem(RING_KEY) || '';
  } catch {
    return '';
  }
};

export default function CallButton({ customer, orderId = null, className = 'btn-secondary btn-icon', label, size = 15, children }) {
  const line = usePhone();
  const [open, setOpen] = useState(false);
  if (!customer?.phone) return null;
  const content = children || (
    <>
      <Phone size={size} />
      {label}
    </>
  );
  if (!line.connected)
    return (
      <a href={telHref(customer.phone)} className={className} aria-label={`Call ${fullName(customer)}`} title={fmtPhone(customer.phone)}>
        {content}
      </a>
    );
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} aria-label={`Call ${fullName(customer)}`} title={`${fmtPhone(customer.phone)} · from the business line`}>
        {content}
      </button>
      {open && <CallModal customer={customer} orderId={orderId} onClose={() => setOpen(false)} />}
    </>
  );
}

function CallModal({ customer, orderId, onClose }) {
  const line = usePhone();
  const { toast } = useUI();
  const phones = (line.ringPhones || []).filter((f) => e164(f.number));
  const saved = remembered();
  const [ring, setRing] = useState(saved || phones[0]?.number || '');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      await line.call({ customer, ring, orderId });
      try {
        localStorage.setItem(RING_KEY, ring);
      } catch {
        // Remembered for this session only.
      }
      toast(`Calling ${fmtPhone(ring)} — answer, and we’ll connect ${customer.firstName || 'the customer'}`, { tone: 'success' });
      onClose();
    } catch (e) {
      toast(e.message || 'The call didn’t go through', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Call ${fullName(customer)}`}
      subtitle={`${fmtPhone(customer.phone)} · from the business line ${fmtPhone(line.status?.phone || '')}`}
      size="sm"
      footer={
        <>
          <a href={telHref(customer.phone)} className="btn-plain mr-auto" onClick={onClose}>
            Use this device instead
          </a>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!e164(ring) || busy} onClick={go}>
            {busy ? <Spinner size={14} /> : <PhoneCall size={15} />} Call
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-ink-2">We’ll ring your phone first. When you answer, the customer is connected and sees the shop’s number — not yours.</p>
      <label className="block">
        <span className="field-label">Ring this phone</span>
        {phones.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {phones.map((f) => (
              <label key={f.number} className={`flex cursor-pointer items-center gap-2 rounded-[10px] border px-3 py-2 text-sm ${e164(ring) === e164(f.number) ? 'border-accent/60 bg-accent/[0.05]' : 'border-line'}`}>
                <input type="radio" name="ring" checked={e164(ring) === e164(f.number)} onChange={() => setRing(f.number)} />
                <span className="font-medium">{f.label || 'Phone'}</span>
                <span className="text-ink-3">{fmtPhone(f.number)}</span>
              </label>
            ))}
          </div>
        )}
        <input className="input" value={phones.some((f) => e164(f.number) === e164(ring)) ? '' : ring} onChange={(e) => setRing(e.target.value)} placeholder={phones.length ? 'Or another number, e.g. your mobile' : 'Your phone number'} inputMode="tel" aria-label="Phone to ring" />
      </label>
    </Modal>
  );
}
