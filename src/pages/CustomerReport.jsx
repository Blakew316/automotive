import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Share2, Eye } from 'lucide-react';
import { useShop, useUI } from '../store/hooks';
import { EmptyState, Toggle } from '../components/ui';
import ReportView, { MediaFallback } from '../components/ReportView';
import ShareModal from './order/ShareModal';
import Toasts from '../components/Toasts';
import { buildReport } from '../lib/report';
import { useMediaUrl } from '../lib/media';

/** Photo or video stored on this device. */
export function LocalMedia({ media, variant, className }) {
  const url = useMediaUrl(variant === 'thumb' && !media.hasThumb ? null : media.id, variant === 'thumb' ? 'thumb' : 'blob');
  if (!url) return <MediaFallback media={media} className={className} />;
  if (media.kind === 'video' && variant === 'full') return <video src={url} controls playsInline autoPlay className={className} />;
  return <img src={url} alt={media.caption || ''} loading="lazy" className={className} />;
}

/** The customer-facing report, shown in the shop (counter screen, tablet hand-off). */
export default function CustomerReport() {
  const { id } = useParams();
  const { state, updateService } = useShop();
  const { toast } = useUI();
  const [showPrices, setShowPrices] = useState(true);
  const [sharing, setSharing] = useState(false);
  const order = state.orders.find((o) => o.id === id);
  const report = useMemo(() => (order ? buildReport(order, state, { showPrices }) : null), [order, state, showPrices]);
  if (!order) return <EmptyState title="Repair order not found" action={<Link to="/orders" className="btn-secondary">Back</Link>} />;
  const customer = state.customers.find((c) => c.id === order.customerId);
  const vehicle = state.vehicles.find((v) => v.id === order.vehicleId);

  return (
    <div className="min-h-screen bg-canvas">
      <div className="glass sticky top-0 z-10 border-b border-line bg-canvas/80">
        <div className="mx-auto flex max-w-[760px] flex-wrap items-center gap-3 px-4 py-2.5">
          <Link to={`/orders/${order.id}`} className="btn-plain -ml-2 px-1.5">
            <ChevronLeft size={17} strokeWidth={2} /> RO #{order.number}
          </Link>
          <span className="flex items-center gap-1.5 text-xs text-ink-3">
            <Eye size={13} /> Customer view
          </span>
          <label className="ml-auto flex items-center gap-2 text-xs text-ink-2">
            <Toggle checked={showPrices} onChange={setShowPrices} label="Show prices" /> Prices
          </label>
          <button className="btn-primary" onClick={() => setSharing(true)}>
            <Share2 size={15} /> Share
          </button>
        </div>
      </div>
      <ReportView
        report={report}
        Media={LocalMedia}
        onDecision={(serviceId, status) => {
          updateService(order.id, serviceId, { status });
          toast(status === 'approved' ? 'Approved — thank you!' : 'Declined', { tone: status === 'approved' ? 'success' : undefined });
        }}
      />
      <Toasts />
      {sharing && <ShareModal order={order} customer={customer} vehicle={vehicle} showPrices={showPrices} onClose={() => setSharing(false)} />}
    </div>
  );
}
