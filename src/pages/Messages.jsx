import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MessageSquare, Mail, Globe, NotebookPen, ChevronLeft, PenSquare, Inbox, Phone, ArrowDownLeft, Sparkles, PhoneMissed, PhoneIncoming, PhoneOutgoing, Voicemail, Bot, CalendarCheck, Check, CheckCheck, CircleAlert, Ban } from 'lucide-react';
import { useShop, useUI, usePhone } from '../store/hooks';
import { PageHeader, Card, SearchInput, Avatar, Segmented, EmptyState, Modal, Spinner } from '../components/ui';
import { CustomerPicker } from '../components/forms';
import ComposeModal from '../components/Compose';
import AiAssistant from '../components/AiAssistant';
import CallButton from '../components/CallButton';
import PrivateMedia from '../components/PrivateMedia';
import { threadContext } from '../lib/ai';
import { needsCallback } from '../lib/phone';
import { fullName, vehicleName, relTime, time, date, dateShort, phone as fmtPhone } from '../lib/format';
import { STATUS } from '../lib/workflow';

const CHANNEL_ICON = { sms: MessageSquare, email: Mail, portal: Globe, web: Globe, note: NotebookPen, call: Phone };
const CHANNEL_LABEL = { sms: 'Text', email: 'Email', portal: 'From report / booking page', web: 'From your website', note: 'Logged', call: 'Call' };
const AUTOMATION_LABEL = { reminder: 'Automatic reminder', confirm: 'Automatic confirmation', textback: 'Missed-call text', afterhours: 'After-hours reply', receptionist: 'Sent by the AI receptionist', auto: 'Sent automatically' };
const DELIVERY = {
  sent: { icon: Check, label: 'Sent', cls: 'text-ink-3' },
  delivered: { icon: CheckCheck, label: 'Delivered', cls: 'text-ok' },
  undelivered: { icon: CircleAlert, label: 'Not delivered', cls: 'text-bad' },
  failed: { icon: CircleAlert, label: 'Not delivered', cls: 'text-bad' },
};

export default function Messages() {
  const { customerId } = useParams();
  const { state, markThreadRead } = useShop();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [picking, setPicking] = useState(false);

  const threads = useMemo(() => {
    const byCustomer = new Map();
    for (const m of state.messages) {
      const t = byCustomer.get(m.customerId) || { customerId: m.customerId, last: null, unread: 0, count: 0, callback: false };
      t.count += 1;
      if (!m.read && m.dir === 'in') t.unread += 1;
      if (m.channel === 'call' && needsCallback(state, m)) t.callback = true;
      if (!t.last || m.at > t.last.at) t.last = m;
      byCustomer.set(m.customerId, t);
    }
    // A thread opened for a customer with no messages yet still shows.
    if (customerId && !byCustomer.has(customerId)) byCustomer.set(customerId, { customerId, last: null, unread: 0, count: 0 });
    return [...byCustomer.values()]
      .map((t) => ({ ...t, customer: state.customers.find((c) => c.id === t.customerId) }))
      .filter((t) => t.customer)
      .filter((t) => filter === 'all' || (filter === 'calls' ? t.callback : t.unread > 0))
      .filter((t) => !q || `${fullName(t.customer)} ${t.customer.phone} ${t.last?.body || ''}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (b.last?.at || '9').localeCompare(a.last?.at || '9'));
    // state is read only for callbacks, which depend on messages and customers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.messages, state.customers, customerId, filter, q]);

  const unreadTotal = state.messages.filter((m) => !m.read && m.dir === 'in').length;
  const callbacks = useMemo(() => new Set(state.messages.filter((m) => m.channel === 'call' && needsCallback(state, m)).map((m) => m.customerId)).size, [state]);
  const active = customerId ? state.customers.find((c) => c.id === customerId) : null;

  useEffect(() => {
    if (active && state.messages.some((m) => m.customerId === active.id && !m.read)) markThreadRead(active.id);
  }, [active, state.messages, markThreadRead]);

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle={unreadTotal ? `${unreadTotal} unread` : 'Texts, emails and replies from customers in one place'}
        actions={
          <button className="btn-primary" onClick={() => setPicking(true)}>
            <PenSquare size={15} /> New message
          </button>
        }
      />
      <Card className="grid h-[calc(100vh-190px)] min-h-[480px] overflow-hidden md:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={`min-h-0 flex-col border-line md:flex md:border-r ${active ? 'hidden' : 'flex'}`}>
          <div className="space-y-2 border-b border-line/70 p-3">
            <SearchInput value={q} onChange={setQ} placeholder="Search conversations" />
            <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread', count: unreadTotal || null }, { value: 'calls', label: 'Call back', count: callbacks || null }]} />
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {threads.map((t) => {
              const Icon = t.last ? (t.last.channel === 'call' && t.callback ? PhoneMissed : CHANNEL_ICON[t.last.channel] || MessageSquare) : MessageSquare;
              const on = t.customerId === customerId;
              return (
                <li key={t.customerId}>
                  <Link to={`/messages/${t.customerId}`} className={`flex gap-3 border-b border-line/50 px-3 py-2.5 ${on ? 'bg-fill/[0.08]' : 'hover:bg-fill/[0.04]'}`}>
                    <Avatar person={t.customer} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-sm ${t.unread ? 'font-semibold' : 'font-medium'}`}>{fullName(t.customer)}</span>
                        <span className="shrink-0 text-2xs text-ink-3">{t.last ? relTime(t.last.at) : ''}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        {t.last && <Icon size={12} className={`shrink-0 ${t.callback && t.last.channel === 'call' ? 'text-bad' : 'text-ink-4'}`} />}
                        <span className={`line-clamp-1 text-xs ${t.unread ? 'text-ink' : 'text-ink-3'}`}>
                          {t.last ? `${t.last.dir === 'out' ? 'You: ' : ''}${t.last.body}` : 'No messages yet'}
                        </span>
                        {t.unread > 0 && <span className="ml-auto flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-accent px-1 text-2xs font-semibold text-on-accent">{t.unread}</span>}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
            {!threads.length && <EmptyState icon={Inbox} title={filter === 'all' ? 'No conversations' : 'All caught up'} body={filter === 'calls' ? 'Missed calls and voicemails you haven’t returned show up here.' : 'Messages you send from repair orders, reminders and campaigns appear here.'} />}
          </ul>
        </aside>
        <section className={`min-h-0 flex-col ${active ? 'flex' : 'hidden md:flex'}`}>
          {active ? <Thread customer={active} onBack={() => navigate('/messages')} /> : <EmptyState className="m-auto" icon={MessageSquare} title="Select a conversation" body="Or start a new message to any customer." />}
        </section>
      </Card>
      {picking && (
        <Modal open onClose={() => setPicking(false)} title="New message" subtitle="Choose a customer" size="md">
          <CustomerPicker
            onChange={(id) => {
              setPicking(false);
              navigate(`/messages/${id}`);
            }}
          />
        </Modal>
      )}
    </>
  );
}

function Thread({ customer, onBack }) {
  const { state, addMessage } = useShop();
  const { toast } = useUI();
  const line = usePhone();
  const [composing, setComposing] = useState(null);
  const [reply, setReply] = useState('');
  const [assist, setAssist] = useState(false);
  const [sending, setSending] = useState(false);
  const end = useRef(null);
  const list = useMemo(() => state.messages.filter((m) => m.customerId === customer.id).sort((a, b) => a.at.localeCompare(b.at)), [state.messages, customer.id]);
  const orders = state.orders.filter((o) => o.customerId === customer.id);
  const open = orders.filter((o) => !['closed'].includes(o.status)).sort((a, b) => b.number - a.number)[0];
  const vehicles = state.vehicles.filter((v) => v.customerId === customer.id);
  const direct = line.ready && Boolean(customer.phone);
  const stopped = direct && line.optedOut(customer.phone);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [list.length, customer.id]);

  const send = async () => {
    const body = reply.trim();
    if (!body) return;
    if (!direct) return setComposing({ body });
    setSending(true);
    // Clear the box right away (like any messaging app); put the text back if it doesn't send.
    setReply('');
    try {
      await line.send({ customer, body, orderId: open?.id || null });
    } catch (e) {
      setReply((cur) => cur || body);
      toast(e.message || 'The text didn’t send', { tone: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <header className="flex items-center gap-3 border-b border-line/70 px-4 py-2.5">
        <button className="btn-ghost btn-icon -ml-2 md:hidden" onClick={onBack} aria-label="Back to conversations">
          <ChevronLeft size={18} />
        </button>
        <Avatar person={customer} size={34} />
        <div className="min-w-0 flex-1">
          <Link to={`/customers/${customer.id}`} className="block truncate text-sm font-semibold hover:text-accent">
            {fullName(customer)}
          </Link>
          <div className="truncate text-xs text-ink-3">
            {[fmtPhone(customer.phone), vehicles.map((v) => vehicleName(v)).join(', ')].filter(Boolean).join(' · ')}
          </div>
        </div>
        {open && (
          <Link to={`/orders/${open.id}`} className="chip hidden hover:border-accent/50 sm:inline-flex">
            RO #{open.number} · {STATUS[open.status]?.short}
          </Link>
        )}
        <CallButton customer={customer} orderId={open?.id || null} />
      </header>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-fill/[0.02] px-4 py-4">
        {list.map((m, i) => {
          const day = date(m.at);
          const showDay = i === 0 || day !== date(list[i - 1].at);
          const out = m.dir === 'out';
          const Icon = CHANNEL_ICON[m.channel] || MessageSquare;
          const order = m.orderId && state.orders.find((o) => o.id === m.orderId);
          const delivery = out && m.meta?.via === 'line' ? DELIVERY[m.meta.status] || DELIVERY.sent : null;
          return (
            <div key={m.id}>
              {showDay && <div className="py-2 text-center text-2xs font-medium text-ink-3">{day}</div>}
              {m.channel === 'call' ? (
                <CallEntry m={m} order={order} />
              ) : (
                <div className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] ${out ? 'items-end' : 'items-start'} flex flex-col`}>
                    {m.meta?.media?.length > 0 && (
                      <div className={`mb-1 flex flex-wrap gap-1.5 ${out ? 'justify-end' : ''}`}>
                        {m.meta.media.map((f) => (
                          <PrivateMedia key={f.path} path={f.path} type={f.type} />
                        ))}
                      </div>
                    )}
                    {(m.body || !m.meta?.media?.length) && (
                      <div
                        className={`whitespace-pre-wrap rounded-[18px] px-3.5 py-2 text-sm leading-5 ${
                          m.channel === 'note' ? 'border border-dashed border-line bg-surface text-ink-2' : out ? 'bg-accent text-on-accent' : 'bg-fill/[0.12] text-ink'
                        } ${out ? 'rounded-br-[6px]' : 'rounded-bl-[6px]'}`}
                      >
                        {m.body}
                      </div>
                    )}
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 px-1 text-2xs text-ink-3">
                      <Icon size={11} />
                      {m.meta?.automation ? AUTOMATION_LABEL[m.meta.automation] || CHANNEL_LABEL[m.channel] : CHANNEL_LABEL[m.channel]} · {time(m.at)}
                      {delivery && (
                        <span className={`inline-flex items-center gap-0.5 ${delivery.cls}`} title={m.meta.error ? `Carrier error ${m.meta.error}` : undefined}>
                          · <delivery.icon size={11} /> {delivery.label}
                        </span>
                      )}
                      {m.meta?.optOut === 'stop' && <span className="text-bad">· Opted out of texts</span>}
                      {m.meta?.optOut === 'start' && <span className="text-ok">· Opted back in</span>}
                      {order && (
                        <>
                          {' '}·{' '}
                          <Link to={`/orders/${order.id}`} className="hover:text-accent">
                            RO #{order.number}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!list.length && <p className="py-10 text-center text-sm text-ink-3">No messages with {customer.firstName || 'this customer'} yet.</p>}
        <div ref={end} />
      </div>

      <footer className="border-t border-line/70 p-3">
        {stopped && (
          <p className="mb-2 flex items-center gap-1.5 rounded-[8px] bg-bad/[0.07] px-2.5 py-1.5 text-xs text-bad">
            <Ban size={12} /> {customer.firstName || 'This customer'} replied STOP — texts are blocked until they reply START. Call or email instead.
          </p>
        )}
        <div className="mb-2 flex flex-wrap gap-1.5">
          <button className="chip h-6 text-xs hover:border-accent/50" onClick={() => setAssist(true)}>
            <Sparkles size={11} /> Suggest reply
          </button>
          {['update', 'estimate', 'ready', 'pay', 'appt', 'service'].map((id) => {
            const t = state.shop.templates.find((x) => x.id === id);
            if (!t) return null;
            return (
              <button key={id} className="chip h-6 text-xs hover:border-accent/50" onClick={() => setComposing(id)}>
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            rows={2}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (direct && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
            }}
            placeholder={direct ? `Text ${customer.firstName || 'the customer'} from ${fmtPhone(line.status?.phone || '')}` : 'Type a message, or paste a reply the customer sent'}
            className="input min-h-[44px] flex-1 resize-none"
            aria-label="Message"
          />
          <div className="flex flex-col gap-1.5">
            <button className="btn-primary" disabled={!reply.trim() || sending || stopped} onClick={send}>
              {sending ? <Spinner size={14} /> : <MessageSquare size={14} />} Send
            </button>
            <button
              className="btn-secondary btn-sm"
              disabled={!reply.trim()}
              title="Record a text or call from the customer"
              onClick={() => {
                addMessage({ customerId: customer.id, orderId: open?.id || null, dir: 'in', channel: 'sms', body: reply.trim() });
                setReply('');
                toast('Reply logged');
              }}
            >
              <ArrowDownLeft size={13} /> Log reply
            </button>
          </div>
        </div>
        {direct && <p className="mt-1.5 text-2xs text-ink-3">Sends from your business number · {reply.length > 160 ? `${Math.ceil(reply.length / 153)} texts` : `${reply.length}/160`}</p>}
      </footer>
      {assist && (
        <AiAssistant
          title={`Assistant · ${fullName(customer)}`}
          tasks={['reply', 'ask']}
          buildContext={() => threadContext(state, customer.id)}
          onUseMessage={(text) => {
            setReply(text);
            setAssist(false);
          }}
          onClose={() => setAssist(false)}
        />
      )}
      {composing && (
        <ComposeModal
          customer={customer}
          order={open}
          templateId={typeof composing === 'string' ? composing : 'update'}
          initialBody={typeof composing === 'object' ? composing.body : undefined}
          onClose={() => setComposing(null)}
          onSent={() => setReply('')}
        />
      )}
    </>
  );
}

const secs = (n) => {
  const v = Math.round(Number(n) || 0);
  return v < 60 ? `${v} sec` : `${Math.floor(v / 60)} min ${v % 60 ? `${v % 60} sec` : ''}`.trim();
};

/** A phone call in the conversation: answered, missed, voicemail or the AI receptionist. */
function CallEntry({ m, order }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const c = m.meta?.call || {};
  const outgoing = m.dir === 'out';
  const voicemail = Boolean(c.voicemailPath || c.voicemailText);
  const missed = !outgoing && c.status !== 'answered' && !c.receptionist;
  const kind = outgoing
    ? { icon: PhoneOutgoing, title: 'Outgoing call', tone: 'text-ink-3' }
    : c.receptionist
      ? { icon: Bot, title: 'AI receptionist took the call', tone: 'text-accent' }
      : c.status === 'answered'
        ? { icon: PhoneIncoming, title: 'Answered call', tone: 'text-ok' }
        : voicemail
          ? { icon: Voicemail, title: 'Voicemail', tone: 'text-bad' }
          : { icon: PhoneMissed, title: 'Missed call', tone: 'text-bad' };
  const length = c.talkSeconds || c.voicemailSeconds || c.seconds;
  return (
    <div className="mx-auto my-2 w-full max-w-[480px] rounded-[12px] border border-line bg-surface px-3.5 py-2.5 text-sm shadow-[0_1px_0_rgb(0_0_0/0.02)]" data-testid="call-entry">
      <div className="flex items-center gap-2">
        <kind.icon size={15} className={kind.tone} />
        <span className="font-medium">{kind.title}</span>
        <span className="ml-auto text-2xs text-ink-3">
          {time(m.at)}
          {length ? ` · ${secs(length)}` : ''}
        </span>
      </div>
      {c.receptionist && <p className="mt-1 text-ink-2">{c.summary || m.body}</p>}
      {c.receptionist && c.message && c.message !== c.summary && (
        <p className="mt-1 rounded-[8px] bg-fill/[0.05] px-2.5 py-1.5 text-xs">
          <b>Message:</b> {c.message}
        </p>
      )}
      {c.appointment && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-2">
          <CalendarCheck size={13} className="text-accent" />
          Requested {c.appointment.service || 'an appointment'} · {c.appointment.date ? dateShort(`${c.appointment.date}T12:00:00`) : ''} {c.appointment.window && c.appointment.window !== 'Flexible' ? c.appointment.window.toLowerCase() : 'any time'} —{' '}
          <Link to="/calendar" className="link">
            confirm in Calendar
          </Link>
        </p>
      )}
      {c.voicemailPath && (
        <div className="mt-2">
          <PrivateMedia path={c.voicemailPath} type="audio/mpeg" className="w-full" />
        </div>
      )}
      {c.voicemailText && <p className="mt-1 italic text-ink-2">“{c.voicemailText}”</p>}
      {!c.receptionist && !voicemail && missed && !c.textedBack && <p className="mt-1 text-xs text-ink-3">No voicemail left.</p>}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink-3">
        {c.textedBack && <span>Missed-call text sent</span>}
        {order && (
          <Link to={`/orders/${order.id}`} className="hover:text-accent">
            RO #{order.number}
          </Link>
        )}
        {c.turns?.length > 1 && (
          <button className="link" onClick={() => setShowTranscript((v) => !v)}>
            {showTranscript ? 'Hide conversation' : `Show conversation (${c.turns.length})`}
          </button>
        )}
      </div>
      {showTranscript && (
        <ol className="mt-2 space-y-1 border-t border-line/70 pt-2 text-xs">
          {c.turns.map((t, i) => (
            <li key={i} className={t.who === 'caller' ? 'text-ink' : 'text-ink-3'}>
              <b className="font-medium">{t.who === 'caller' ? 'Caller' : 'Receptionist'}:</b> {t.text}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
