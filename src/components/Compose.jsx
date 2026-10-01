// One composer for every customer message: estimates, updates, payment requests, reminders.
// With the business line connected, texts go out from the shop's Twilio number; otherwise texts and
// emails open in the device's Messages/Mail app. Either way they're logged to the conversation.
import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Mail, NotebookPen, Info, CreditCard } from 'lucide-react';
import { useShop, useUI, usePhone, usePay } from '../store/hooks';
import { Modal, Segmented, Spinner } from './ui';
import { fillTemplate, messageContext, sendHref } from '../lib/messaging';
import { openPayLink } from '../lib/payments';
import { orderTotals } from '../lib/pricing';
import { shopAt } from '../lib/locations';
import { fullName, phone as fmtPhone } from '../lib/format';

export default function ComposeModal({ customer, order, appointment, templateId = 'update', initialBody, channel: initialChannel, extra, subject: initialSubject, onClose, onSent }) {
  const { state, addMessage } = useShop();
  const { toast } = useUI();
  const line = usePhone();
  const [busy, setBusy] = useState(false);
  const ctx = useMemo(() => messageContext(state, { customer, order, appointment, extra }), [state, customer, order, appointment, extra]);
  const templates = state.shop.templates || [];
  const [tid, setTid] = useState(initialBody ? '' : templateId);
  const [channel, setChannel] = useState(initialChannel || (customer?.phone ? 'sms' : 'email'));
  const [body, setBody] = useState(() => initialBody ?? fillTemplate(templates.find((t) => t.id === templateId)?.body || '', ctx));
  const [subject, setSubject] = useState(initialSubject || (order ? `RO #${order.number} — ${state.shop.name}` : state.shop.name));
  const canSms = Boolean(customer?.phone);
  const canEmail = Boolean(customer?.email);
  const href = sendHref(channel, customer, body, subject);
  const viaLine = channel === 'sms' && line.ready && canSms;
  // Replied STOP: the business line won't send until they reply START.
  const stopped = viaLine && line.optedOut(customer?.phone);

  const pickTemplate = (id) => {
    setTid(id);
    const filled = fillTemplate(templates.find((t) => t.id === id)?.body || '', ctx);
    auto.current = filled;
    setBody(filled);
  };

  // A template with {payLink} and Stripe connected: make a secure pay link for the exact balance,
  // then fill it in (unless the message was already edited).
  const pay = usePay();
  const auto = useRef(body);
  const latestBody = useRef(body);
  latestBody.current = body;
  const tplBody = templates.find((t) => t.id === tid)?.body || '';
  const balance = order ? Math.max(0, orderTotals(order, shopAt(state.shop, order.locationId)).balance) : 0;
  const needLink = Boolean(pay.ensureLink && order && balance >= 0.5 && tplBody.includes('{payLink}') && !openPayLink(order, balance));
  const [linkError, setLinkError] = useState('');
  useEffect(() => {
    if (!needLink) return undefined;
    let alive = true;
    pay
      .ensureLink(order)
      .then((link) => {
        if (!alive || latestBody.current !== auto.current) return;
        const filled = fillTemplate(tplBody, { ...ctx, payLink: link.url });
        auto.current = filled;
        setBody(filled);
      })
      .catch((e) => alive && setLinkError(e.message || 'Couldn’t make a pay link'));
    return () => {
      alive = false;
    };
    // Once per template and order; ctx changes as the link lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needLink, tid, order?.id]);
  const linking = needLink && !linkError;

  const log = (dir = 'out', ch = channel) => {
    addMessage({ customerId: customer.id, orderId: order?.id || null, dir, channel: ch, body: body.trim(), meta: tid ? { template: tid } : undefined });
  };

  const send = async () => {
    if (!body.trim() || !href) return;
    if (viaLine) {
      setBusy(true);
      try {
        await line.send({ customer, body: body.trim(), orderId: order?.id || null, meta: tid ? { template: tid } : undefined });
        toast(`Text sent from ${fmtPhone(line.status?.phone || '')}`, { tone: 'success' });
        onSent?.();
        onClose();
      } catch (e) {
        toast(e.message || 'The text didn’t send', { tone: 'error' });
      } finally {
        setBusy(false);
      }
      return;
    }
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
          <button className="btn-primary" disabled={!body.trim() || !href || busy || stopped || linking} onClick={send}>
            {busy ? <Spinner size={14} /> : channel === 'sms' ? <MessageSquare size={15} /> : <Mail size={15} />} {channel === 'sms' ? 'Send text' : 'Send email'}
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
        {(linking || linkError || (pay.ready && order && openPayLink(order, balance) && body.includes(openPayLink(order, balance).url))) && (
          <p className={`flex items-center gap-1.5 text-xs ${linkError ? 'text-bad' : 'text-ink-3'}`}>
            {linking ? <Spinner size={12} /> : <CreditCard size={12} />}
            {linking ? 'Creating a secure pay link for the balance…' : linkError ? `Pay link: ${linkError}` : 'Includes a secure Stripe pay link for the exact balance — it’s recorded on the RO when paid.'}
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-ink-3">
          <span>{channel === 'sms' ? `${body.length} characters${body.length > 160 ? ` · ${Math.ceil(body.length / 153)} texts` : ''}` : ''}</span>
          {channel === 'sms' && (line.optedOut(customer?.phone) ? <span className="text-bad">Replied STOP — texts are blocked until they reply START</span> : customer?.textOptIn === false ? <span className="text-warn">Customer opted out of texts</span> : null)}
        </div>
        <p className="flex items-start gap-2 rounded-[8px] bg-fill/[0.06] px-3 py-2 text-xs text-ink-3">
          <Info size={13} className="mt-0.5 shrink-0" />
          {viaLine ? (
            <span>
              Sends from your business number {fmtPhone(line.status?.phone || '')}; replies and delivery receipts show up in Messages.{' '}
              {href && (
                <a href={href} className="link" onClick={() => { log(); onClose(); }}>
                  Use this device’s Messages app instead
                </a>
              )}
            </span>
          ) : channel === 'sms' ? (
            'Opens your Messages app with this text ready to send from your shop phone (iPhone, Android, or Messages on Mac). Replies arrive there — log them here, or they arrive automatically when customers reply from their report link.'
          ) : (
            'Opens your email app with this message ready to send.'
          )}
        </p>
      </div>
    </Modal>
  );
}
