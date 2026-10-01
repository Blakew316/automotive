import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MessageSquare, Mail, Globe, NotebookPen, ChevronLeft, PenSquare, Inbox, Phone, ArrowDownLeft } from 'lucide-react';
import { useShop, useUI } from '../store/hooks';
import { PageHeader, Card, SearchInput, Avatar, Segmented, EmptyState, Modal } from '../components/ui';
import { CustomerPicker } from '../components/forms';
import ComposeModal from '../components/Compose';
import { fullName, vehicleName, relTime, time, date, telHref, phone as fmtPhone } from '../lib/format';
import { STATUS } from '../lib/workflow';

const CHANNEL_ICON = { sms: MessageSquare, email: Mail, portal: Globe, note: NotebookPen, call: Phone };
const CHANNEL_LABEL = { sms: 'Text', email: 'Email', portal: 'From report / booking page', note: 'Logged', call: 'Call' };

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
      const t = byCustomer.get(m.customerId) || { customerId: m.customerId, last: null, unread: 0, count: 0 };
      t.count += 1;
      if (!m.read && m.dir === 'in') t.unread += 1;
      if (!t.last || m.at > t.last.at) t.last = m;
      byCustomer.set(m.customerId, t);
    }
    // A thread opened for a customer with no messages yet still shows.
    if (customerId && !byCustomer.has(customerId)) byCustomer.set(customerId, { customerId, last: null, unread: 0, count: 0 });
    return [...byCustomer.values()]
      .map((t) => ({ ...t, customer: state.customers.find((c) => c.id === t.customerId) }))
      .filter((t) => t.customer)
      .filter((t) => filter === 'all' || t.unread > 0)
      .filter((t) => !q || `${fullName(t.customer)} ${t.customer.phone} ${t.last?.body || ''}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (b.last?.at || '9').localeCompare(a.last?.at || '9'));
  }, [state.messages, state.customers, customerId, filter, q]);

  const unreadTotal = state.messages.filter((m) => !m.read && m.dir === 'in').length;
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
            <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread', count: unreadTotal || null }]} />
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {threads.map((t) => {
              const Icon = t.last ? CHANNEL_ICON[t.last.channel] || MessageSquare : MessageSquare;
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
                        {t.last && <Icon size={12} className="shrink-0 text-ink-4" />}
                        <span className={`line-clamp-1 text-xs ${t.unread ? 'text-ink' : 'text-ink-3'}`}>
                          {t.last ? `${t.last.dir === 'out' ? 'You: ' : ''}${t.last.body}` : 'No messages yet'}
                        </span>
                        {t.unread > 0 && <span className="ml-auto flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-accent px-1 text-2xs font-semibold text-white">{t.unread}</span>}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
            {!threads.length && <EmptyState icon={Inbox} title={filter === 'unread' ? 'All caught up' : 'No conversations'} body="Messages you send from repair orders, reminders and campaigns appear here." />}
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
  const [composing, setComposing] = useState(null);
  const [reply, setReply] = useState('');
  const end = useRef(null);
  const list = useMemo(() => state.messages.filter((m) => m.customerId === customer.id).sort((a, b) => a.at.localeCompare(b.at)), [state.messages, customer.id]);
  const orders = state.orders.filter((o) => o.customerId === customer.id);
  const open = orders.filter((o) => !['closed'].includes(o.status)).sort((a, b) => b.number - a.number)[0];
  const vehicles = state.vehicles.filter((v) => v.customerId === customer.id);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [list.length, customer.id]);

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
        <a href={telHref(customer.phone)} className="btn-secondary btn-icon" aria-label="Call">
          <Phone size={15} />
        </a>
      </header>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-fill/[0.02] px-4 py-4">
        {list.map((m, i) => {
          const day = date(m.at);
          const showDay = i === 0 || day !== date(list[i - 1].at);
          const out = m.dir === 'out';
          const Icon = CHANNEL_ICON[m.channel] || MessageSquare;
          const order = m.orderId && state.orders.find((o) => o.id === m.orderId);
          return (
            <div key={m.id}>
              {showDay && <div className="py-2 text-center text-2xs font-medium text-ink-3">{day}</div>}
              <div className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[78%] ${out ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div
                    className={`whitespace-pre-wrap rounded-[18px] px-3.5 py-2 text-sm leading-5 ${
                      m.channel === 'note' ? 'border border-dashed border-line bg-surface text-ink-2' : out ? 'bg-accent text-white' : 'bg-fill/[0.12] text-ink'
                    } ${out ? 'rounded-br-[6px]' : 'rounded-bl-[6px]'}`}
                  >
                    {m.body}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 px-1 text-2xs text-ink-3">
                    <Icon size={11} />
                    {CHANNEL_LABEL[m.channel]} · {time(m.at)}
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
            </div>
          );
        })}
        {!list.length && <p className="py-10 text-center text-sm text-ink-3">No messages with {customer.firstName || 'this customer'} yet.</p>}
        <div ref={end} />
      </div>

      <footer className="border-t border-line/70 p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
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
            placeholder="Type a message, or paste a reply the customer sent"
            className="input min-h-[44px] flex-1 resize-none"
            aria-label="Message"
          />
          <div className="flex flex-col gap-1.5">
            <button className="btn-primary" disabled={!reply.trim()} onClick={() => setComposing({ body: reply })}>
              <MessageSquare size={14} /> Send
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
      </footer>
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
