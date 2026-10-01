import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Link2Off, Send, CircleCheck } from 'lucide-react';
import { EmptyState, Spinner } from '../components/ui';
import ReportView, { MediaFallback } from '../components/ReportView';
import ApprovalPanel from '../components/ApprovalPanel';
import { parseShareSource, fetchSharedReport, submitToInbox } from '../lib/cloudShare';
import { usePromise } from '../lib/usePromise';

/** Public page behind a share link: loads the published report from the shop's storage. */
export default function SharedReport() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const source = parseShareSource(params.get('from') || '');
  const [decisions, setDecisions] = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');
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

  const inbox = report.inbox;
  const submit = async ({ name, signature }) => {
    setSending(true);
    setError('');
    try {
      await submitToInbox(inbox, 'approval', id, { ro: report.ro.number, name, signature, decisions, at: new Date().toISOString() });
      const n = Object.values(decisions).filter((d) => d === 'approved').length;
      setSent(`${n} item${n === 1 ? '' : 's'} approved. ${report.shop.name} will be in touch${report.shop.phone ? ` — questions? Call ${report.shop.phone}` : ''}.`);
    } catch (e) {
      setError(`${e.message}. You can also text or call the shop to approve.`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      <ReportView
        report={report}
        Media={RemoteMedia}
        decisions={decisions}
        onDecision={inbox && !sent ? (sid, d) => setDecisions((x) => ({ ...x, [sid]: d })) : undefined}
        footer={inbox ? <ApprovalPanel report={report} decisions={decisions} onSubmit={submit} busy={sending} done={sent} error={error} /> : null}
      />
      {inbox && <MessageShop inbox={inbox} shareId={id} report={report} />}
    </div>
  );
}

function MessageShop({ inbox, shareId, report }) {
  const [text, setText] = useState('');
  const [state, setState] = useState({ status: 'idle' });
  const send = async () => {
    setState({ status: 'sending' });
    try {
      await submitToInbox(inbox, 'message', shareId, { ro: report.ro.number, text: text.trim(), at: new Date().toISOString() });
      setText('');
      setState({ status: 'sent' });
    } catch (e) {
      setState({ status: 'error', error: e.message });
    }
  };
  return (
    <div className="mx-auto -mt-10 max-w-[760px] px-4 pb-16">
      <section className="card p-4">
        <h2 className="card-title mb-2">Message {report.shop.name}</h2>
        {state.status === 'sent' ? (
          <p className="flex items-center gap-2 text-sm text-ink-2">
            <CircleCheck size={16} className="text-ok" /> Sent — the shop will reply by text or phone.
          </p>
        ) : (
          <>
            <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} className="input resize-none" placeholder="Questions about your estimate, pickup time…" aria-label="Message to the shop" />
            {state.status === 'error' && <p className="mt-1 text-sm text-bad">{state.error}</p>}
            <button className="btn-secondary mt-2" disabled={!text.trim() || state.status === 'sending'} onClick={send}>
              <Send size={14} /> Send message
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function RemoteMedia({ media, variant, className }) {
  const url = variant === 'thumb' ? media.thumbSrc : media.src;
  if (!url) return <MediaFallback media={media} className={className} />;
  if (media.kind === 'video' && variant === 'full') return <video src={url} controls playsInline autoPlay className={className} />;
  return <img src={url} alt={media.caption || ''} loading="lazy" className={className} />;
}
