// Sends one template to many customers. With the business line connected, texts all go out from
// the shop's Twilio number in one pass; with email set up, emails go out personalized from the
// shop's own address the same way. Otherwise they go one tap at a time from the shop's own phone or
// mail app (or as one BCC email), and the list can be exported for any bulk tool. Every send is
// logged to the customer's thread.
import { useMemo, useState } from 'react';
import { MessageSquare, Mail, SkipForward, Download, Check, Users, Send } from 'lucide-react';
import { useShop, useUI, usePhone, useEmail } from '../store/hooks';
import { Modal, Segmented, Avatar, Spinner } from './ui';
import { fillTemplate, messageContext, sendHref } from '../lib/messaging';
import { downloadCsv } from '../lib/accounting';
import { toCsv } from '../lib/serviceHistory';
import { fullName, mailHref, phone as fmtPhone, vehicleName } from '../lib/format';

export default function SendQueue({ recipients, templateId, initialBody, name, automation, channel: initialChannel, onClose }) {
  const { state, addMessage, logCampaign } = useShop();
  const { toast } = useUI();
  const line = usePhone();
  const email = useEmail();
  const [bulk, setBulk] = useState(null);
  const templates = state.shop.templates || [];
  const [body, setBody] = useState(initialBody ?? templates.find((t) => t.id === templateId)?.body ?? '');
  const [channel, setChannel] = useState(initialChannel || (recipients.some((r) => r.customer.phone) ? 'sms' : 'email'));
  const [subject, setSubject] = useState(`${name} — ${state.shop.name}`);
  const [index, setIndex] = useState(0);
  const [sent, setSent] = useState([]);
  const [started, setStarted] = useState(false);

  // Addresses that bounced or marked the shop as spam are left out (sending again hurts delivery for everyone).
  const list = useMemo(() => recipients.filter((r) => (channel === 'sms' ? r.customer.phone && r.customer.textOptIn !== false && !line.optedOut(r.customer.phone) : r.customer.email && !r.customer.emailProblem)), [recipients, channel, line]);
  const viaLine = channel === 'sms' && line.ready;
  const viaEmail = channel === 'email' && Boolean(email.send);
  const viaServer = viaLine || viaEmail;
  const personalize = (r) => fillTemplate(body, messageContext(state, { customer: r.customer, vehicle: r.vehicle, order: r.order, appointment: r.appointment, extra: r.extra }));
  const meta = (extra = {}) => (templateId || automation ? { ...(templateId ? { template: templateId } : {}), ...(automation ? { automation } : {}), ...extra } : Object.keys(extra).length ? extra : undefined);
  const current = list[index];
  const done = started && index >= list.length;

  const finish = (count = sent.length) => {
    if (count) logCampaign({ name, template: templateId || null, channel, count, customerIds: sent.length ? sent : list.map((r) => r.customer.id) });
    onClose();
  };

  const sendOne = () => {
    const text = personalize(current);
    addMessage({ customerId: current.customer.id, orderId: current.order?.id || null, channel, body: text, meta: meta() });
    setSent((s) => [...s, current.customer.id]);
    setIndex((i) => i + 1);
  };

  // Business line or the shop's email: every message in one pass.
  const sendAll = async () => {
    setStarted(true);
    setBulk({ done: 0, failed: 0, total: list.length, running: true });
    const ok = [];
    for (const r of list) {
      try {
        if (viaEmail) await email.send({ customer: r.customer, subject: subject.trim() || state.shop.name, text: personalize(r), orderId: r.order?.id || null, kind: templateId || automation || 'campaign', meta: meta() });
        else await line.send({ customer: r.customer, body: personalize(r), orderId: r.order?.id || null, meta: meta() });
        ok.push(r.customer.id);
        setBulk((b) => ({ ...b, done: b.done + 1 }));
      } catch {
        setBulk((b) => ({ ...b, failed: b.failed + 1 }));
      }
    }
    setSent(ok);
    setIndex(list.length);
    setBulk((b) => ({ ...b, running: false }));
  };

  const bcc = () => {
    // One email to everyone (BCC), with personal fields made generic.
    const generic = fillTemplate(body, { ...messageContext(state, {}), first: 'there', vehicle: 'vehicle' });
    const addresses = list.map((r) => r.customer.email);
    for (const r of list) addMessage({ customerId: r.customer.id, channel: 'email', body: generic, meta: meta({ bulk: true }) });
    window.location.href = `${mailHref(state.shop.email || '', subject, generic)}&bcc=${encodeURIComponent(addresses.join(','))}`;
    logCampaign({ name, template: templateId || null, channel: 'email', count: list.length, customerIds: list.map((r) => r.customer.id) });
    toast(`Opened one email to ${list.length} recipients (BCC)`, { tone: 'success' });
    onClose();
  };

  const exportCsv = () => {
    downloadCsv(
      toCsv(['First name', 'Last name', 'Phone', 'Email', 'Vehicle', 'Message'], list.map((r) => [r.customer.firstName, r.customer.lastName, r.customer.phone, r.customer.email, r.vehicle ? vehicleName(r.vehicle) : '', personalize(r)])),
      `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`,
    );
    toast('Recipient list exported');
  };

  return (
    <Modal
      open
      onClose={() => (sent.length ? finish() : onClose())}
      title={name}
      subtitle={`${list.length} of ${recipients.length} recipient${recipients.length === 1 ? '' : 's'} reachable by ${channel === 'sms' ? 'text' : 'email'}`}
      size="md"
      footer={
        !started ? (
          <>
            <button className="btn-plain mr-auto" onClick={exportCsv} disabled={!list.length}>
              <Download size={14} /> Export list
            </button>
            {channel === 'email' && list.length > 1 && (
              <button className="btn-secondary" onClick={bcc} disabled={!body.trim()} title="One email to everyone; personal fields become generic">
                <Users size={14} /> One email (BCC)
              </button>
            )}
            {viaServer ? (
              <button className="btn-primary" disabled={!list.length || !body.trim()} onClick={sendAll}>
                <Send size={14} /> Send {list.length} {viaEmail ? 'email' : 'text'}{list.length === 1 ? '' : 's'}
              </button>
            ) : (
              <button className="btn-primary" disabled={!list.length || !body.trim()} onClick={() => setStarted(true)}>
                {channel === 'sms' ? <MessageSquare size={14} /> : <Mail size={14} />} Send one by one
              </button>
            )}
          </>
        ) : bulk?.running ? (
          <span className="mr-auto flex items-center gap-2 text-sm text-ink-3">
            <Spinner size={14} /> Sending {bulk.done + bulk.failed + 1} of {bulk.total}…
          </span>
        ) : done ? (
          <button className="btn-primary" onClick={() => finish()}>
            <Check size={14} /> Done
          </button>
        ) : (
          <>
            <span className="mr-auto text-sm text-ink-3">
              {index + 1} of {list.length} · {sent.length} sent
            </span>
            <button className="btn-secondary" onClick={() => setIndex((i) => i + 1)}>
              <SkipForward size={14} /> Skip
            </button>
            <a className="btn-primary" href={sendHref(channel, current.customer, personalize(current), subject) || undefined} onClick={sendOne}>
              {channel === 'sms' ? <MessageSquare size={14} /> : <Mail size={14} />} {channel === 'sms' ? 'Text' : 'Email'} {current.customer.firstName || fullName(current.customer)}
            </a>
          </>
        )
      }
    >
      {!started ? (
        <div className="space-y-3">
          <Segmented
            size="sm"
            value={channel}
            onChange={setChannel}
            options={[
              { value: 'sms', label: 'Text', icon: MessageSquare },
              { value: 'email', label: 'Email', icon: Mail },
            ]}
          />
          {channel === 'email' && <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" />}
          <textarea rows={5} className="input resize-none" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Message template" />
          <p className="text-xs text-ink-3">
            Merge fields like {'{first}'}, {'{vehicle}'}, {'{service}'} and {'{bookLink}'} fill in for each customer. Preview for {list[0] ? fullName(list[0].customer) : 'the first recipient'}:
          </p>
          {list[0] && <p className="whitespace-pre-wrap rounded-[10px] bg-fill/[0.06] px-3 py-2 text-sm">{personalize(list[0])}</p>}
          {list.length < recipients.length && (
            <p className="text-xs text-warn">
              {recipients.length - list.length} customer{recipients.length - list.length === 1 ? ' has' : 's have'} no {channel === 'sms' ? 'mobile number or opted out of texts' : 'working email address'}.
            </p>
          )}
          <p className="text-xs text-ink-3">
            {viaLine
              ? `Each text is personalized and sent from your business number ${line.status?.phone ? `(${fmtPhone(line.status.phone)})` : ''}; replies come back to Messages. Only text customers who agreed to hear from you.`
              : viaEmail
                ? `Each email is personalized and sent from ${email.status?.from || 'your shop’s address'}; you’ll see Delivered, Opened or Bounced in each conversation.`
                : 'Texts open in your Messages app one at a time so each comes from the shop’s number. To blast hundreds at once, export the list into a bulk texting or email service.'}
          </p>
        </div>
      ) : bulk?.running ? (
        <div className="space-y-3 py-6 text-center">
          <div className="text-md font-semibold">Sending {viaEmail ? 'emails' : 'texts'}…</div>
          <div className="mx-auto h-1.5 max-w-xs overflow-hidden rounded-full bg-fill/[0.12]">
            <div className="h-full bg-accent transition-all" style={{ width: `${((bulk.done + bulk.failed) / Math.max(1, bulk.total)) * 100}%` }} />
          </div>
          <p className="text-sm text-ink-3">{bulk.done} sent{bulk.failed ? ` · ${bulk.failed} didn’t go through` : ''}</p>
        </div>
      ) : done ? (
        <div className="py-6 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ok/15 text-ok">
            <Check size={22} />
          </span>
          <div className="text-md font-semibold">{sent.length} message{sent.length === 1 ? '' : 's'} sent</div>
          <p className="text-sm text-ink-3">Logged to each customer’s conversation.{bulk?.failed ? ` ${bulk.failed} didn’t go through — check those ${viaEmail ? 'addresses' : 'numbers'} in Messages.` : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Avatar name={fullName(current.customer)} size={36} />
            <div className="min-w-0">
              <div className="font-semibold">{fullName(current.customer)}</div>
              <div className="text-xs text-ink-3">
                {channel === 'sms' ? fmtPhone(current.customer.phone) : current.customer.email}
                {current.vehicle ? ` · ${vehicleName(current.vehicle)}` : ''}
              </div>
            </div>
          </div>
          <p className="whitespace-pre-wrap rounded-[10px] bg-fill/[0.06] px-3 py-2 text-sm">{personalize(current)}</p>
          <div className="h-1 overflow-hidden rounded-full bg-fill/[0.12]">
            <div className="h-full bg-accent transition-all" style={{ width: `${(index / list.length) * 100}%` }} />
          </div>
        </div>
      )}
    </Modal>
  );
}
