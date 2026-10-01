// One composer for every customer message: estimates, updates, payment requests, reminders.
// Texts and emails open in the device's Messages/Mail app (so they come from the shop's own number
// and address) and are logged to the customer's conversation.
import { useMemo, useState } from 'react';
import { MessageSquare, Mail, NotebookPen, Info } from 'lucide-react';
import { useShop, useUI } from '../store/hooks';
import { Modal, Segmented } from './ui';
import { fillTemplate, messageContext, sendHref } from '../lib/messaging';
import { fullName, phone as fmtPhone } from '../lib/format';

export default function ComposeModal({ customer, order, appointment, templateId = 'update', initialBody, channel: initialChannel, extra, subject: initialSubject, onClose, onSent }) {
  const { state, addMessage } = useShop();
  const { toast } = useUI();
  const ctx = useMemo(() => messageContext(state, { customer, order, appointment, extra }), [state, customer, order, appointment, extra]);
  const templates = state.shop.templates || [];
  const [tid, setTid] = useState(initialBody ? '' : templateId);
  const [channel, setChannel] = useState(initialChannel || (customer?.phone ? 'sms' : 'email'));
  const [body, setBody] = useState(() => initialBody ?? fillTemplate(templates.find((t) => t.id === templateId)?.body || '', ctx));
  const [subject, setSubject] = useState(initialSubject || (order ? `RO #${order.number} — ${state.shop.name}` : state.shop.name));
  const canSms = Boolean(customer?.phone);
  const canEmail = Boolean(customer?.email);
  const href = sendHref(channel, customer, body, subject);

  const pickTemplate = (id) => {
    setTid(id);
    setBody(fillTemplate(templates.find((t) => t.id === id)?.body || '', ctx));
  };

  const log = (dir = 'out', ch = channel) => {
    addMessage({ customerId: customer.id, orderId: order?.id || null, dir, channel: ch, body: body.trim(), meta: tid ? { template: tid } : undefined });
  };

  const send = () => {
    if (!body.trim() || !href) return;
    log();
    window.location.href = href;
    toast(channel === 'sms' ? 'Opened in Messages — logged to the conversation' : 'Opened in Mail — logged to the conversation', { tone: 'success' });
    onSent?.();
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Message ${fullName(customer)}`}
      subtitle={channel === 'sms' ? (canSms ? fmtPhone(customer.phone) : 'No mobile number on file') : canEmail ? customer.email : 'No email on file'}
      size="md"
      footer={
        <>
          <button
            className="btn-plain mr-auto"
            disabled={!body.trim()}
            onClick={() => {
              log('out', 'note');
              toast('Saved to the conversation');
              onClose();
            }}
            title="Record without sending — e.g. you called the customer"
          >
            <NotebookPen size={14} /> Log only
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!body.trim() || !href} onClick={send}>
            {channel === 'sms' ? <MessageSquare size={15} /> : <Mail size={15} />} {channel === 'sms' ? 'Send text' : 'Send email'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            size="sm"
            value={channel}
            onChange={setChannel}
            options={[
              { value: 'sms', label: 'Text', icon: MessageSquare },
              { value: 'email', label: 'Email', icon: Mail },
            ]}
          />
          <select className="input h-7 w-auto py-0 text-sm" value={tid || ''} onChange={(e) => pickTemplate(e.target.value)} aria-label="Template">
            {!tid && <option value="">Custom message</option>}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
        {channel === 'email' && <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" placeholder="Subject" />}
        <textarea rows={6} className="input resize-none" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Message" autoFocus />
        <div className="flex items-center justify-between text-xs text-ink-3">
          <span>{channel === 'sms' ? `${body.length} characters${body.length > 160 ? ` · ${Math.ceil(body.length / 153)} texts` : ''}` : ''}</span>
          {customer && customer.textOptIn === false && channel === 'sms' && <span className="text-warn">Customer opted out of texts</span>}
        </div>
        <p className="flex items-start gap-2 rounded-[8px] bg-fill/[0.06] px-3 py-2 text-xs text-ink-3">
          <Info size={13} className="mt-0.5 shrink-0" />
          {channel === 'sms'
            ? 'Opens your Messages app with this text ready to send from your shop phone (iPhone, Android, or Messages on Mac). Replies arrive there — log them here, or they arrive automatically when customers reply from their report link.'
            : 'Opens your email app with this message ready to send.'}
        </p>
      </div>
    </Modal>
  );
}
