import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Copy, MessageSquare, Mail, RefreshCw, Link2Off, Download, MonitorSmartphone, Cloud, Check, Settings2 } from 'lucide-react';
import { useShop, useUI } from '../../store/hooks';
import { Modal, Spinner, Toggle } from '../../components/ui';
import { buildReport } from '../../lib/report';
import { cloudConfig, cloudSession, publishReport, revokeReport } from '../../lib/cloudShare';
import { buildReportHtml, downloadHtml, exportSize } from '../../lib/reportHtml';
import { formatBytes } from '../../lib/media';
import { smsHref, mailHref, vehicleName, relTime } from '../../lib/format';

export default function ShareModal({ order, customer, vehicle, showPrices: initialPrices = true, onClose }) {
  const { state, setShare, addMessage } = useShop();
  const { toast } = useUI();
  const [showPrices, setShowPrices] = useState(initialPrices);
  const [includeVideo, setIncludeVideo] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const cfg = cloudConfig(state.shop);
  const session = cfg ? cloudSession() : null;
  const signedIn = Boolean(session && session.url === cfg?.url);
  const share = order.share && !order.share.revoked ? order.share : null;
  const visible = (order.media || []).filter((m) => m.customer);
  const hidden = (order.media || []).length - visible.length;
  const shop = state.shop;
  const vName = vehicleName(vehicle);
  const message = (url) => `Hi ${customer?.firstName || 'there'}, here’s the report for your ${vName} from ${shop.name}${visible.length ? ', with photos' : ''}: ${url}`;

  const publish = async () => {
    setError('');
    setBusy({ label: 'Preparing…' });
    try {
      const report = buildReport(order, state, { showPrices });
      const next = await publishReport(cfg, report, order.share?.revoked ? null : order.share, ({ done, total }) =>
        setBusy({ label: total ? `Uploading ${Math.min(done + 1, total)} of ${total}…` : 'Saving report…' }),
      );
      setShare(order.id, { ...next, showPrices });
      toast(share ? 'Link updated with the latest changes' : 'Share link created', { tone: 'success' });
    } catch (e) {
      setError(e.message || 'Could not publish');
    } finally {
      setBusy(null);
    }
  };

  const revoke = async () => {
    setError('');
    setBusy({ label: 'Turning off link…' });
    try {
      setShare(order.id, await revokeReport(cfg, share));
      toast('Link turned off');
    } catch (e) {
      setError(e.message || 'Could not turn off the link');
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    setBusy({ label: 'Building file…' });
    try {
      const html = await buildReportHtml(buildReport(order, state, { showPrices }), { includeVideo });
      downloadHtml(html, `${shop.name.replace(/[^\w]+/g, '-')}-RO${order.number}-report.html`);
    } catch (e) {
      toast(e.message || 'Could not build the file', { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast('Copy failed — select the link and copy it manually', { tone: 'error' });
    }
  };

  const size = exportSize(order, includeVideo);

  return (
    <Modal open onClose={onClose} title="Share vehicle report" subtitle={`RO #${order.number} · ${visible.length} photo${visible.length === 1 ? '' : 's'}/video${hidden ? ` (${hidden} internal not shared)` : ''}`} size="md">
      <div className="space-y-4">
        <label className="flex items-center justify-between gap-3 rounded-[8px] border border-line px-3 py-2 text-sm">
          Show prices and totals
          <Toggle checked={showPrices} onChange={setShowPrices} label="Show prices and totals" />
        </label>

        <section className="rounded-[10px] border border-line">
          <div className="flex items-center gap-2 border-b border-line/70 px-3 py-2.5">
            <Cloud size={16} className="text-ink-3" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">Share link</div>
              <div className="text-xs text-ink-3">Anyone with the link can view the report, photos and video — no login.</div>
            </div>
          </div>
          <div className="space-y-3 p-3">
            {!cfg ? (
              <>
                <p className="text-sm text-ink-2">Links that open on a customer’s phone need the files hosted online. Connect your shop’s free cloud storage once and every RO can be shared.</p>
                <Link to="/settings#sharing" onClick={onClose} className="btn-secondary">
                  <Settings2 size={14} /> Set up sharing
                </Link>
              </>
            ) : !signedIn ? (
              <>
                <p className="text-sm text-ink-2">Sign in to your shop’s storage account on this device to publish links.</p>
                <Link to="/settings#sharing" onClick={onClose} className="btn-secondary">
                  <Settings2 size={14} /> Sign in
                </Link>
              </>
            ) : share ? (
              <>
                <div className="flex gap-2">
                  <input readOnly value={share.url} onFocus={(e) => e.target.select()} className="input flex-1 font-mono text-xs" aria-label="Share link" />
                  <button className="btn-secondary" onClick={copy}>
                    {copied ? <Check size={14} className="text-ok" /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={customer?.phone ? smsHref(customer.phone, message(share.url)) : undefined}
                    onClick={() => customer && addMessage({ customerId: customer.id, orderId: order.id, channel: 'sms', body: message(share.url) })}
                    aria-disabled={!customer?.phone}
                    className={`btn-primary ${customer?.phone ? '' : 'pointer-events-none opacity-50'}`}
                  >
                    <MessageSquare size={14} /> Text to customer
                  </a>
                  <a
                    href={customer?.email ? mailHref(customer.email, `Your ${vName} — ${shop.name}`, `${message(share.url)}\n\n${shop.name}\n${shop.phone}`) : undefined}
                    onClick={() => customer && addMessage({ customerId: customer.id, orderId: order.id, channel: 'email', body: message(share.url) })}
                    aria-disabled={!customer?.email}
                    className={`btn-secondary ${customer?.email ? '' : 'pointer-events-none opacity-50'}`}
                  >
                    <Mail size={14} /> Email
                  </a>
                  <a href={share.url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                    <Link2 size={14} /> Open
                  </a>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-3 text-xs text-ink-3">
                  <span>Published {relTime(share.publishedAt)} — publish again after adding photos or changing the RO.</span>
                  <span className="flex gap-1.5">
                    <button className="btn-secondary btn-sm" disabled={Boolean(busy)} onClick={publish}>
                      <RefreshCw size={13} /> Update
                    </button>
                    <button className="btn-plain btn-sm text-bad" disabled={Boolean(busy)} onClick={revoke}>
                      <Link2Off size={13} /> Turn off
                    </button>
                  </span>
                </div>
              </>
            ) : (
              <button className="btn-primary" disabled={Boolean(busy)} onClick={publish}>
                <Link2 size={14} /> Create share link
              </button>
            )}
            {busy && (
              <p className="flex items-center gap-2 text-sm text-ink-2">
                <Spinner size={14} /> {busy.label}
              </p>
            )}
            {error && <p className="text-sm text-bad">{error}</p>}
          </div>
        </section>

        <section className="rounded-[10px] border border-line">
          <div className="flex items-center gap-2 border-b border-line/70 px-3 py-2.5">
            <Download size={16} className="text-ink-3" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">Report file</div>
              <div className="text-xs text-ink-3">One .html file with everything embedded — email it, AirDrop it, or keep it with your records. Works offline.</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 p-3">
            <button className="btn-secondary" disabled={Boolean(busy)} onClick={download}>
              <Download size={14} /> Download ({formatBytes(size * 1.37)})
            </button>
            {visible.some((m) => m.kind === 'video') && (
              <label className="flex items-center gap-2 text-sm text-ink-2">
                <Toggle checked={includeVideo} onChange={setIncludeVideo} label="Include video" /> Include video
              </label>
            )}
          </div>
        </section>

        <Link to={`/orders/${order.id}/report`} onClick={onClose} className="flex items-center gap-3 rounded-[10px] border border-line px-3 py-2.5 text-sm hover:bg-fill/[0.04]">
          <MonitorSmartphone size={16} className="text-ink-3" />
          <span className="flex-1">
            <span className="font-semibold">Show on this screen</span>
            <span className="block text-xs text-ink-3">Hand a tablet to the customer — they can approve or decline work right there.</span>
          </span>
        </Link>
      </div>
    </Modal>
  );
}
