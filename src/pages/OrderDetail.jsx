import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Printer, Send, MoreHorizontal, Plus, Trash2, MessageSquare, Mail, Check, ClipboardCheck, Wrench, StickyNote,
  CircleCheck, Play, PackageCheck, Receipt, CreditCard, RotateCcw, FileText, Search, Camera, MonitorSmartphone, Share2, PenLine, HandCoins,
} from 'lucide-react';
import { useShop, useUI, useLookup, useTotals } from '../store/hooks';
import { PageHeader, Card, Tabs, Menu, EmptyState, Modal, SearchInput, InlineText, Toggle } from '../components/ui';
import ServiceBlock from './order/ServiceBlock';
import InspectionPanel from './order/InspectionPanel';
import OrderSidebar, { PaymentModal } from './order/OrderSidebar';
import MediaPanel, { MediaViewer } from './order/MediaPanel';
import { useMediaViewer } from '../lib/useMedia';
import AuthorizeModal from './order/AuthorizeModal';
import ComposeModal from '../components/Compose';
import { removeFiles, forgetUrls } from '../lib/media';
import { STATUSES, STATUS } from '../lib/workflow';
import { money, fullName, vehicleName, dateTime, relTime } from '../lib/format';
import { serviceTotal } from '../lib/pricing';

const ShareModal = lazy(() => import('./order/ShareModal'));

const NEXT = {
  estimate: { to: 'approved', label: 'Mark approved', icon: CircleCheck },
  approved: { to: 'in_progress', label: 'Start work', icon: Play },
  in_progress: { to: 'ready', label: 'Finish & invoice', icon: Receipt },
  waiting_parts: { to: 'in_progress', label: 'Parts arrived', icon: PackageCheck },
};

export default function OrderDetail() {
  const { id } = useParams();
  const { state, setOrderStatus, deleteOrder, updateOrder, addNote } = useShop();
  const { toast } = useUI();
  const lookup = useLookup();
  const totals = useTotals();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(() => (['services', 'inspection', 'media', 'notes'].includes(params.get('tab')) ? params.get('tab') : 'services'));
  const [addingService, setAddingService] = useState(false);
  const [paying, setPaying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [composing, setComposing] = useState(null);

  const order = state.orders.find((o) => o.id === id);
  const viewer = useMediaViewer();
  if (!order) {
    return <EmptyState icon={FileText} title="Repair order not found" body="It may have been deleted." action={<Link to="/orders" className="btn-secondary">All repair orders</Link>} />;
  }
  const customer = lookup.customer.get(order.customerId);
  const vehicle = lookup.vehicle.get(order.vehicleId);
  const t = totals(order);
  const editable = order.status !== 'closed';
  const isInvoice = order.status === 'ready' || order.status === 'closed';
  const docName = isInvoice ? 'Invoice' : order.status === 'estimate' ? 'Estimate' : 'Work order';
  const flagged = Object.values(order.inspection).filter((i) => i.rating === 'soon' || i.rating === 'now').length;

  const move = (status) => {
    const prev = order.status;
    setOrderStatus(order.id, status);
    toast(`Moved to ${STATUS[status].label}`, { action: { label: 'Undo', onClick: () => setOrderStatus(order.id, prev) } });
  };

  const next = NEXT[order.status];
  const shop = state.shop;
  const firstName = customer?.firstName || 'there';
  const vName = vehicleName(vehicle);
  const lines = order.services.filter((s) => s.status !== 'declined').map((s) => `• ${s.title} — ${money(serviceTotal(s))}`).join('\n');
  const message = isInvoice
    ? `Hi ${firstName}, your ${vName} is ready for pickup at ${shop.name}. Total ${money(t.total)}${t.balance > 0.004 ? `, balance due ${money(t.balance)}` : ''}. Questions? Call ${shop.phone}.`
    : `Hi ${firstName}, it's ${shop.name}. Your estimate for the ${vName} is ${money(t.total)}. Reply YES to approve or call ${shop.phone} with questions.`;
  const emailBody = `${message}\n\n${lines}\n\nSubtotal ${money(t.subtotal - t.discount)}\nTax ${money(t.tax)}\nTotal ${money(t.total)}\n\n${isInvoice ? shop.invoiceTerms : shop.estimateTerms}\n\n${shop.name}\n${shop.address}, ${shop.city}, ${shop.state} ${shop.zip}\n${shop.phone}`;

  return (
    <>
      <PageHeader
        back="/orders"
        eyebrow={
          <span>
            {docName} <span className="font-medium text-ink-2">#{order.number}</span> · opened {dateTime(order.createdAt)}
          </span>
        }
        title={vehicle ? vName : fullName(customer)}
        subtitle={vehicle ? `${fullName(customer)}${vehicle.plate ? ` · ${vehicle.plate}` : ''}` : undefined}
        actions={
          <>
            <Menu
              trigger={({ toggle }) => (
                <button className="btn-secondary" onClick={toggle}>
                  <Send size={14} /> Send
                </button>
              )}
              items={[
                { label: `Text ${docName.toLowerCase()}`, icon: MessageSquare, disabled: !customer?.phone, onClick: () => setComposing({ channel: 'sms', templateId: isInvoice ? 'ready' : 'estimate' }) },
                { label: `Email ${docName.toLowerCase()}`, icon: Mail, disabled: !customer?.email, onClick: () => setComposing({ channel: 'email', templateId: isInvoice ? 'ready' : 'estimate', initialBody: emailBody }) },
                isInvoice && t.balance > 0.004 && { label: 'Request payment', icon: HandCoins, disabled: !customer, onClick: () => setComposing({ templateId: 'pay' }) },
                { label: 'Status update…', icon: MessageSquare, disabled: !customer, onClick: () => setComposing({ templateId: 'update' }) },
                '-',
                { label: 'Share vehicle report & photos', icon: Share2, onClick: () => setSharing(true) },
                { label: 'Show customer view', icon: MonitorSmartphone, onClick: () => navigate(`/orders/${order.id}/report`) },
                { label: 'Print or save PDF', icon: Printer, onClick: () => navigate(`/orders/${order.id}/print`) },
              ]}
            />
            <Link to={`/orders/${order.id}/print`} className="btn-secondary btn-icon" aria-label="Print">
              <Printer size={15} />
            </Link>
            {order.status === 'estimate' && t.pending > 0 ? (
              <button className="btn-primary" onClick={() => setAuthorizing(true)}>
                <PenLine size={15} /> Authorize
              </button>
            ) : (
              next && (
                <button className="btn-primary" onClick={() => move(next.to)}>
                  <next.icon size={15} /> {next.label}
                </button>
              )
            )}
            {order.status === 'ready' && t.balance > 0.004 && (
              <button className="btn-primary" onClick={() => setPaying(true)}>
                <CreditCard size={15} /> Take payment
              </button>
            )}
            {order.status === 'ready' && t.balance <= 0.004 && (
              <button className="btn-primary" onClick={() => move('closed')}>
                <Check size={15} /> Close out
              </button>
            )}
            <Menu
              trigger={({ toggle }) => (
                <button className="btn-secondary btn-icon" onClick={toggle} aria-label="More">
                  <MoreHorizontal size={16} />
                </button>
              )}
              items={[
                order.status === 'in_progress' && { label: 'Waiting on parts', icon: PackageCheck, onClick: () => move('waiting_parts') },
                order.status === 'closed' && { label: 'Reopen', icon: RotateCcw, onClick: () => move('ready') },
                { label: order.taxExempt ? 'Charge tax' : 'Mark tax exempt', icon: Receipt, onClick: () => updateOrder(order.id, { taxExempt: !order.taxExempt }) },
                '-',
                { label: 'Delete repair order', icon: Trash2, danger: true, onClick: () => setConfirmDelete(true) },
              ]}
            />
          </>
        }
      />

      <Stepper status={order.status} onPick={move} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <Tabs
            className="mb-4"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'services', label: 'Services', icon: Wrench, count: order.services.length },
              { value: 'inspection', label: 'Inspection', icon: ClipboardCheck, count: flagged || null },
              { value: 'media', label: 'Photos & video', icon: Camera, count: order.media?.length || null },
              { value: 'notes', label: 'Notes', icon: StickyNote, count: order.notes.length || null },
            ]}
          />

          {tab === 'services' && (
            <div className="space-y-4">
              <Card className="px-4 py-3">
                <div className="section-label mb-1.5">Customer concern</div>
                <InlineText
                  multiline
                  rows={2}
                  value={order.concern}
                  placeholder="What the customer said — symptoms, when it happens, noises…"
                  onCommit={(concern) => updateOrder(order.id, { concern })}
                  disabled={!editable}
                  className="w-full resize-none rounded-[6px] border border-transparent bg-transparent px-1.5 py-1 text-md text-ink outline-none -mx-1.5 hover:border-line focus:border-accent/60 focus:ring-[3px] focus:ring-accent/15"
                />
              </Card>

              {order.services.map((s, i) => (
                <ServiceBlock key={s.id} order={order} service={s} vehicle={vehicle} index={i} editable={editable} onOpenMedia={viewer.open} />
              ))}

              {order.services.length === 0 && (
                <Card>
                  <EmptyState icon={Wrench} title="No services yet" body="Add a canned job from your menu or build one line by line." />
                </Card>
              )}

              {editable && (
                <button onClick={() => setAddingService(true)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line py-3.5 text-sm font-medium text-accent transition-colors hover:bg-fill/[0.04]">
                  <Plus size={16} /> Add service
                </button>
              )}

              {order.status === 'estimate' && t.pending > 0 && (
                <p className="text-center text-xs text-ink-3">
                  {t.pending} service{t.pending === 1 ? '' : 's'} pending approval. Use “Authorize” to record the customer’s approval, or share the report so they can approve online.
                </p>
              )}
            </div>
          )}

          {tab === 'inspection' && <InspectionPanel order={order} editable={editable} onOpenMedia={viewer.open} />}

          {tab === 'media' && <MediaPanel order={order} editable viewer={viewer} />}

          {tab === 'notes' && <NotesPanel order={order} onAdd={(text, internal) => addNote(order.id, text, internal)} />}
        </div>

        <OrderSidebar order={order} customer={customer} vehicle={vehicle} editable={editable} onTakePayment={() => setPaying(true)} onCompose={(c) => setComposing(c)} onAuthorize={() => setAuthorizing(true)} />
      </div>

      {addingService && <AddServiceModal order={order} onClose={() => setAddingService(false)} />}
      {paying && <PaymentModal order={order} customer={customer} onClose={() => setPaying(false)} onReceipt={(amount) => setComposing({ templateId: 'receipt', extra: { amount } })} />}
      {authorizing && <AuthorizeModal order={order} customer={customer} onClose={() => setAuthorizing(false)} />}
      {composing && customer && <ComposeModal customer={customer} order={order} {...composing} onClose={() => setComposing(null)} />}
      {sharing && (
        <Suspense fallback={null}>
          <ShareModal order={order} customer={customer} vehicle={vehicle} onClose={() => setSharing(false)} />
        </Suspense>
      )}
      {/* Photos can be added and edited at any stage, including after the RO is closed. */}
      {viewer.id && <MediaViewer order={order} mediaId={viewer.id} editable onNavigate={viewer.setId} onClose={viewer.close} />}
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete RO #${order.number}?`}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button
              className="btn-primary !bg-bad"
              onClick={() => {
                const mediaIds = (order.media || []).map((m) => m.id);
                deleteOrder(order.id);
                forgetUrls(mediaIds);
                removeFiles(mediaIds).catch(() => {});
                toast(`RO #${order.number} deleted`);
                navigate('/orders', { replace: true });
              }}
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-2">This removes the repair order, its inspection, photos and video, and payment history. This can’t be undone.</p>
      </Modal>
    </>
  );
}

function Stepper({ status, onPick }) {
  const idx = STATUSES.findIndex((s) => s.id === status);
  return (
    <div className="card flex overflow-x-auto p-1">
      {STATUSES.map((s, i) => {
        const current = i === idx;
        const past = i < idx;
        return (
          <button
            key={s.id}
            onClick={() => !current && onPick(s.id)}
            className={`flex min-w-[128px] flex-1 items-center gap-2 rounded-[8px] px-3 py-2 text-left transition-colors ${current ? 'bg-fill/[0.1]' : 'hover:bg-fill/[0.05]'}`}
          >
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-2xs font-semibold ${past ? 'bg-ink/80 text-canvas' : current ? 'bg-accent text-white' : 'border border-line text-ink-4'}`}>
              {past ? <Check size={11} strokeWidth={3} /> : i + 1}
            </span>
            <span className={`truncate text-sm ${current ? 'font-semibold text-ink' : past ? 'text-ink-2' : 'text-ink-3'}`}>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function AddServiceModal({ order, onClose }) {
  const { state, addService } = useShop();
  const [q, setQ] = useState('');
  const jobs = useMemo(() => state.cannedJobs.filter((j) => `${j.title} ${j.category}`.toLowerCase().includes(q.toLowerCase())), [q, state.cannedJobs]);
  const add = (payload) => {
    addService(order.id, payload);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="Add service" subtitle="Pick from your service menu, or start blank." size="lg">
      <div className="mb-3 flex gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search canned jobs" className="flex-1" autoFocus />
        <button className="btn-secondary" onClick={() => add({ title: q || 'New service', items: [{ type: 'labor', description: '', hours: 1 }] })}>
          <Plus size={14} /> Blank service
        </button>
      </div>
      <div className="overflow-hidden rounded-[10px] border border-line">
        {jobs.map((j) => {
          const hours = j.items.filter((i) => i.type === 'labor').reduce((s, i) => s + i.hours, 0);
          const parts = j.items.filter((i) => i.type === 'part').length;
          return (
            <button key={j.id} onClick={() => add({ jobId: j.id })} className="flex w-full items-center gap-3 border-b border-line/70 px-4 py-2.5 text-left last:border-0 hover:bg-fill/[0.05]">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{j.title}</div>
                <div className="text-xs text-ink-3">
                  {j.category} · {hours.toFixed(1)} hr{parts ? ` · ${parts} part${parts === 1 ? '' : 's'}` : ''}
                </div>
              </div>
              <Plus size={16} className="text-accent" />
            </button>
          );
        })}
        {!jobs.length && (
          <div className="p-8 text-center text-sm text-ink-3">
            <Search size={20} className="mx-auto mb-2 text-ink-4" />
            No canned jobs match. Use “Blank service” to build one.
          </div>
        )}
      </div>
    </Modal>
  );
}

function NotesPanel({ order, onAdd }) {
  const [text, setText] = useState('');
  const [internal, setInternal] = useState(true);
  return (
    <div className="space-y-4">
      <Card className="p-3">
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a note — calls, authorizations, parts ETAs…" className="input resize-none border-transparent bg-transparent shadow-none focus:ring-0" />
        <div className="mt-2 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <Toggle checked={internal} onChange={setInternal} label="Internal note" /> Internal only
          </label>
          <button
            className="btn-primary btn-sm"
            disabled={!text.trim()}
            onClick={() => {
              onAdd(text.trim(), internal);
              setText('');
            }}
          >
            Add note
          </button>
        </div>
      </Card>
      {order.notes.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-3">No notes yet.</p>
      ) : (
        <Card>
          <ul className="divide-y divide-line/70">
            {order.notes.map((n) => (
              <li key={n.id} className="px-4 py-3">
                <div className="mb-0.5 flex items-center gap-2 text-xs text-ink-3">
                  <span>{dateTime(n.at)}</span>
                  <span>·</span>
                  <span>{relTime(n.at)}</span>
                  <span className="ml-auto">{n.internal ? 'Internal' : 'Customer-visible'}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-ink">{n.text}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
