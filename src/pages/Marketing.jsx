import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BellRing, Undo2, HeartHandshake, Star, Megaphone, Send, Settings2, MessageSquare, Mail, Info, CalendarCheck } from 'lucide-react';
import { useShop } from '../store/hooks';
import { PageHeader, Card, CardHeader, Tabs, EmptyState, Stat, Field, Segmented } from '../components/ui';
import ComposeModal from '../components/Compose';
import SendQueue from '../components/SendQueue';
import { serviceReminders, declinedWork, lapsedCustomers, reviewCandidates, campaignAudience } from '../lib/marketing';
import { bookingLink } from '../lib/booking';
import { money, money0, date, dateShort, relTime, fullName, vehicleName, number } from '../lib/format';

// Month and day for this year, with the year for anything older.
const when = (iso) => (new Date(iso).getFullYear() === new Date().getFullYear() ? dateShort(iso) : date(iso));

const TABS = [
  { value: 'due', label: 'Service due', icon: BellRing },
  { value: 'declined', label: 'Declined work', icon: Undo2 },
  { value: 'lapsed', label: 'Win-back', icon: HeartHandshake },
  { value: 'reviews', label: 'Reviews', icon: Star },
  { value: 'campaigns', label: 'Campaigns', icon: Megaphone },
];

export default function Marketing() {
  const { state } = useShop();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'due';
  const now = useMemo(() => new Date(), []);
  const lists = useMemo(
    () => ({
      due: serviceReminders(state, now),
      declined: declinedWork(state, {}, now),
      lapsed: lapsedCustomers(state, now),
      reviews: reviewCandidates(state, now),
    }),
    [state, now],
  );
  const declinedValue = lists.declined.reduce((s, r) => s + r.value, 0);
  const [queue, setQueue] = useState(null);
  const [compose, setCompose] = useState(null);
  const m = state.shop.marketing || {};
  const hasBooking = Boolean(bookingLink(state));

  return (
    <>
      <PageHeader
        title="Marketing"
        subtitle="Reminders, follow-ups and campaigns that bring customers back"
        actions={
          <Link to="/settings?tab=messaging" className="btn-secondary">
            <Settings2 size={15} /> Intervals & templates
          </Link>
        }
      />

      <Card className="mb-6 grid grid-cols-2 divide-line p-1 lg:grid-cols-4 lg:divide-x">
        <Stat label="Due for service" value={number(lists.due.length)} sub={`Every ${m.oilMonths || 6} mo or ${number(m.oilMiles || 5000)} mi`} />
        <Stat label="Declined work" value={money0(declinedValue)} sub={`${lists.declined.length} open recommendations`} />
        <Stat label="Lapsed customers" value={number(lists.lapsed.length)} sub={`No visit in ${m.winbackMonths || 9}+ months`} />
        <Stat label="Ask for a review" value={number(lists.reviews.length)} sub="Closed in the last 2 weeks" />
      </Card>

      <Tabs
        className="mb-5"
        value={tab}
        onChange={(t) => setParams(t === 'due' ? {} : { tab: t }, { replace: true })}
        tabs={TABS.map((t) => ({ ...t, count: t.value === 'campaigns' ? state.campaigns.length || null : lists[t.value].length }))}
      />

      {!hasBooking && tab !== 'campaigns' && (
        <p className="mb-4 flex items-start gap-2 rounded-[10px] bg-fill/[0.06] px-3 py-2 text-xs text-ink-3">
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>
            Turn on <Link to="/settings?tab=booking" className="link">online booking</Link> so reminders include a link customers can book from.
          </span>
        </p>
      )}

      {tab === 'due' && (
        <ListCard
          title="Due for an oil service"
          subtitle="By time or estimated mileage since their last oil change here — including the next two weeks"
          rows={lists.due}
          templateId="service"
          campaign="Service reminders"
          empty={{ icon: BellRing, title: 'Nobody is due right now', body: 'Vehicles appear here as they approach their next oil service.' }}
          onQueue={setQueue}
          onCompose={setCompose}
          render={(r) => (
            <>
              <div className="text-sm text-ink-2">{vehicleName(r.vehicle)}</div>
              <div className="text-xs text-ink-3">
                Last oil service {when(r.last)}
                {r.estMiles ? ` · est. ${number(r.estMiles)} mi now (${number(r.estMiles - r.lastMiles)} since)` : ''}
              </div>
            </>
          )}
          badge={(r) => (r.due === 'soon' ? <span className="chip">Due soon</span> : <span className="chip border-warn/40 text-warn">{r.due === 'mileage' ? 'Mileage due' : `${r.overdueDays} days overdue`}</span>)}
        />
      )}
      {tab === 'declined' && (
        <ListCard
          title="Declined recommendations"
          subtitle="Work customers passed on in the last year that hasn’t been done since"
          rows={lists.declined}
          templateId="declined"
          campaign="Declined work follow-up"
          empty={{ icon: Undo2, title: 'No open declined work', body: 'When a customer declines a recommended service, it shows up here for follow-up.' }}
          onQueue={setQueue}
          onCompose={setCompose}
          render={(r) => (
            <>
              <div className="text-sm text-ink-2">
                {r.service.title} · <Link to={`/orders/${r.order.id}`} className="link">RO #{r.order.number}</Link>
              </div>
              <div className="text-xs text-ink-3">
                {r.vehicle ? vehicleName(r.vehicle) : ''} · declined {when(r.at)}
              </div>
            </>
          )}
          badge={(r) => <span className="tabular text-sm font-semibold">{money(r.value)}</span>}
        />
      )}
      {tab === 'lapsed' && (
        <ListCard
          title="Customers you haven’t seen in a while"
          subtitle="Sorted by lifetime spend"
          rows={lists.lapsed}
          templateId="winback"
          campaign="Win-back"
          empty={{ icon: HeartHandshake, title: 'No lapsed customers', body: `Customers appear here after ${m.winbackMonths || 9} months without a visit.` }}
          onQueue={setQueue}
          onCompose={setCompose}
          render={(r) => (
            <>
              <div className="text-sm text-ink-2">{r.vehicle ? vehicleName(r.vehicle) : 'No vehicle on file'}</div>
              <div className="text-xs text-ink-3">Last visit {relTime(r.last)}</div>
            </>
          )}
          badge={(r) => <span className="tabular text-sm text-ink-2">{money0(r.spend)} lifetime</span>}
        />
      )}
      {tab === 'reviews' && (
        <>
          {!m.reviewUrl && (
            <p className="mb-4 flex items-start gap-2 rounded-[10px] border border-warn/30 bg-warn/[0.06] px-3 py-2 text-sm">
              <Star size={15} className="mt-0.5 shrink-0 text-warn" />
              <span>
                Add your Google review link in <Link to="/settings?tab=messaging" className="link">Settings → Messaging</Link> so requests include it. In Google Business Profile, choose <b>Ask for reviews</b> to copy it.
              </span>
            </p>
          )}
          <ListCard
            title="Recent happy customers"
            subtitle="Closed in the last two weeks and not asked yet"
            rows={lists.reviews}
            templateId="review"
            campaign="Review requests"
            empty={{ icon: Star, title: 'All caught up', body: 'Customers appear here after their repair order is closed.' }}
            onQueue={setQueue}
            onCompose={setCompose}
            render={(r) => (
              <>
                <div className="text-sm text-ink-2">
                  {r.vehicle ? vehicleName(r.vehicle) : ''} · <Link to={`/orders/${r.order.id}`} className="link">RO #{r.order.number}</Link>
                </div>
                <div className="text-xs text-ink-3">Closed {relTime(r.at)}</div>
              </>
            )}
          />
        </>
      )}
      {tab === 'campaigns' && <Campaigns onQueue={setQueue} />}

      {queue && <SendQueue {...queue} onClose={() => setQueue(null)} />}
      {compose && <ComposeModal {...compose} onClose={() => setCompose(null)} />}
    </>
  );
}

function ListCard({ title, subtitle, rows, templateId, campaign, empty, render, badge, onQueue, onCompose }) {
  const [selected, setSelected] = useState(() => new Set());
  const all = rows.length > 0 && rows.every((r) => selected.has(r.key));
  const picked = rows.filter((r) => selected.has(r.key));
  const toggle = (key) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const recipients = (list) => list.map((r) => ({ customer: r.customer, vehicle: r.vehicle, order: r.order || r.lastOrder, extra: r.service?.title ? { service: r.service.title.toLowerCase() } : r.service ? { service: r.service } : undefined }));

  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={subtitle}
        actions={
          rows.length > 0 && (
            <button className="btn-primary btn-sm" onClick={() => onQueue({ recipients: recipients(picked.length ? picked : rows), templateId, name: campaign })}>
              <Send size={13} /> Send to {picked.length || 'all'} {picked.length ? 'selected' : ''}
            </button>
          )
        }
      />
      {rows.length ? (
        <>
          <label className="flex items-center gap-3 border-b border-line/70 px-4 py-2 text-xs text-ink-3">
            <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={all} onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.key)))} />
            {picked.length ? `${picked.length} selected` : 'Select all'}
          </label>
          <ul className="divide-y divide-line/70">
            {rows.map((r) => (
              <li key={r.key} className="flex items-center gap-3 px-4 py-2.5">
                <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={selected.has(r.key)} onChange={() => toggle(r.key)} aria-label={`Select ${fullName(r.customer)}`} />
                <div className="min-w-0 flex-1">
                  <Link to={`/customers/${r.customer.id}`} className="font-medium hover:underline">
                    {fullName(r.customer)}
                  </Link>
                  {render(r)}
                  {r.contacted && <div className="mt-0.5 text-2xs text-ok">Contacted {relTime(r.contacted)}</div>}
                </div>
                {badge && <div className="hidden shrink-0 sm:block">{badge(r)}</div>}
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    const [rec] = recipients([r]);
                    onCompose({ customer: rec.customer, order: rec.order, templateId, extra: rec.extra });
                  }}
                  aria-label={`Message ${fullName(r.customer)}`}
                >
                  {r.customer.phone ? <MessageSquare size={13} /> : <Mail size={13} />} <span className="hidden sm:inline">Message</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState {...empty} className="py-12" />
      )}
    </Card>
  );
}

const VISITED = [
  { value: 'any', label: 'Anyone' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last year' },
  { value: 'lapsed', label: 'Over a year ago' },
];

function Campaigns({ onQueue }) {
  const { state } = useShop();
  const [f, setF] = useState({ name: 'Seasonal special', tag: '', make: '', visited: 'any', channel: 'sms', body: 'Hi {first}, it’s {shop}. This month: free brake & tire check with any oil service. Call {phone} or book online: {bookLink}' });
  const tags = useMemo(() => [...new Set(state.customers.flatMap((c) => c.tags || []))].sort(), [state.customers]);
  const makes = useMemo(() => [...new Set(state.vehicles.map((v) => v.make).filter(Boolean))].sort(), [state.vehicles]);
  const audience = useMemo(() => campaignAudience(state, f), [state, f]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target ? e.target.value : e });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader title="New campaign" subtitle="Pick an audience, write once, personalize automatically" icon={Megaphone} />
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="Campaign name" className="sm:col-span-2">{(id) => <input id={id} className="input" value={f.name} onChange={set('name')} />}</Field>
          <Field label="Customer tag">
            {(id) => (
              <select id={id} className="input" value={f.tag} onChange={set('tag')}>
                <option value="">All customers</option>
                {tags.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Drives a">
            {(id) => (
              <select id={id} className="input" value={f.make} onChange={set('make')}>
                <option value="">Any make</option>
                {makes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Last visit" className="sm:col-span-2">
            {() => <Segmented size="sm" options={VISITED} value={f.visited} onChange={set('visited')} />}
          </Field>
          <Field label="Send by">
            {() => (
              <Segmented
                size="sm"
                value={f.channel}
                onChange={set('channel')}
                options={[
                  { value: 'sms', label: 'Text', icon: MessageSquare },
                  { value: 'email', label: 'Email', icon: Mail },
                ]}
              />
            )}
          </Field>
          <div className="self-end text-right text-sm">
            <span className="text-2xl font-semibold tabular">{audience.length}</span> <span className="text-ink-3">recipient{audience.length === 1 ? '' : 's'}</span>
          </div>
          <Field label="Message" className="sm:col-span-2" hint="Merge fields: {first} {vehicle} {shop} {phone} {bookLink} {reviewLink}">
            {(id) => <textarea id={id} rows={4} className="input resize-none" value={f.body} onChange={set('body')} />}
          </Field>
        </div>
        <div className="flex justify-end border-t border-line/70 px-4 py-3">
          <button className="btn-primary" disabled={!audience.length || !f.body.trim()} onClick={() => onQueue({ recipients: audience, initialBody: f.body, name: f.name || 'Campaign' })}>
            <Send size={14} /> Review & send
          </button>
        </div>
      </Card>
      <Card>
        <CardHeader title="Sent campaigns" icon={CalendarCheck} />
        {state.campaigns.length ? (
          <ul className="divide-y divide-line/70">
            {state.campaigns.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                {c.channel === 'email' ? <Mail size={15} className="text-ink-3" /> : <MessageSquare size={15} className="text-ink-3" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.name}</div>
                  <div className="text-xs text-ink-3">{relTime(c.at)}</div>
                </div>
                <span className="tabular text-ink-2">{c.count} sent</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Megaphone} title="No campaigns yet" body="Reminders and campaigns you send are recorded here." className="py-10" />
        )}
      </Card>
    </div>
  );
}
