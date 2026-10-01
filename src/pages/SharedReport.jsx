import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Link2Off } from 'lucide-react';
import { EmptyState, Spinner } from '../components/ui';
import ReportView, { MediaFallback } from '../components/ReportView';
import { parseShareSource, fetchSharedReport } from '../lib/cloudShare';
import { usePromise } from '../lib/usePromise';

/** Public page behind a share link: loads the published report from the shop's storage. */
export default function SharedReport() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const source = parseShareSource(params.get('from') || '');
  const state = usePromise(() => (source ? fetchSharedReport(source, id) : Promise.reject(new Error('This link is incomplete or invalid.'))), `${source}|${id}`);
  // Resolve each file to its public URL once.
  const report = useMemo(() => {
    if (!state.data) return null;
    const base = `${source}/${id}`;
    const url = (f) => (f ? `${base}/${encodeURIComponent(f)}` : null);
    return { ...state.data, media: (state.data.media || []).map((m) => ({ ...m, src: url(m.file), thumbSrc: url(m.thumbFile) || (m.kind === 'image' ? url(m.file) : null) })) };
  }, [state.data, source, id]);

  if (state.status === 'loading')
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-ink-3">
        <Spinner size={22} />
      </div>
    );
  if (state.status === 'error')
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <EmptyState icon={Link2Off} title="Report unavailable" body={state.error.message} />
      </div>
    );

  return (
    <div className="min-h-screen bg-canvas">
      <ReportView report={report} Media={RemoteMedia} />
    </div>
  );
}

function RemoteMedia({ media, variant, className }) {
  const url = variant === 'thumb' ? media.thumbSrc : media.src;
  if (!url) return <MediaFallback media={media} className={className} />;
  if (media.kind === 'video' && variant === 'full') return <video src={url} controls playsInline autoPlay className={className} />;
  return <img src={url} alt={media.caption || ''} loading="lazy" className={className} />;
}
