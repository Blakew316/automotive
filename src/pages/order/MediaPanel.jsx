import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ImagePlus, Play, EyeOff, Eye, Trash2, Download, ChevronLeft, ChevronRight, X, Images, Film, Info } from 'lucide-react';
import { useShop, useUI } from '../../store/hooks';
import { useIngest } from '../../lib/useMedia';
import { Card, Segmented, Spinner, EmptyState, Toggle } from '../../components/ui';
import { removeFiles, forgetUrls, useMediaUrl, formatBytes, formatDuration, storageEstimate, MAX_VIDEO_MB } from '../../lib/media';
import { inspectionTemplateFor, inspectionPoints } from '../../lib/inspection';
import { dateTime } from '../../lib/format';

const ACCEPT = 'image/*,video/*,.heic,.heif,.mov';
const inspectionLabel = (key) => (key ? key.split('::')[1] : null);

/** Hidden file input + button. `capture` opens the camera directly on phones and tablets. */
export function PickButton({ onFiles, capture, multiple = true, className = 'btn-secondary', children, title }) {
  const ref = useRef(null);
  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.click()} title={title}>
        {children}
      </button>
      <input
        ref={ref}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        capture={capture ? 'environment' : undefined}
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );
}

export function MediaThumb({ media, onClick, className = '', showMeta = true }) {
  const url = useMediaUrl(media.hasThumb ? media.id : null, 'thumb', media.cloud);
  return (
    <button type="button" onClick={onClick} className={`group relative block overflow-hidden rounded-[10px] bg-fill/[0.08] ${className}`} aria-label={media.caption || media.name}>
      {url ? (
        <img src={url} alt={media.caption || ''} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-ink-3">{media.kind === 'video' ? <Film size={22} /> : <Images size={22} />}</span>
      )}
      {media.kind === 'video' && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
            <Play size={16} fill="currentColor" className="ml-0.5" />
          </span>
        </span>
      )}
      {showMeta && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-6 text-left text-2xs font-medium text-white">
          <span className="line-clamp-2">{media.caption || inspectionLabel(media.inspectionKey) || ''}</span>
          <span className="flex shrink-0 items-center gap-1">
            {media.kind === 'video' && media.duration != null && formatDuration(media.duration)}
            {!media.customer && <EyeOff size={12} aria-label="Hidden from customer" />}
          </span>
        </span>
      )}
    </button>
  );
}

/** Thumbnails for media linked to one service or inspection item, with an add button. */
export function MediaStrip({ order, filter, extra, editable, onOpen, label = 'Photo' }) {
  const { ingest, busy } = useIngest(order);
  const items = (order.media || []).filter(filter);
  if (!items.length && !editable) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((m) => (
        <MediaThumb key={m.id} media={m} showMeta={false} onClick={() => onOpen(m.id)} className="h-12 w-12" />
      ))}
      {editable && (
        <PickButton capture onFiles={(f) => ingest(f, extra)} className="btn-ghost btn-sm h-8" title="Take or attach a photo or video">
          {busy ? <Spinner size={13} /> : <Camera size={14} />} {items.length ? '' : label}
        </PickButton>
      )}
    </div>
  );
}

export default function MediaPanel({ order, editable, viewer }) {
  const { ingest, busy } = useIngest(order);
  const [filter, setFilter] = useState('all');
  const [drag, setDrag] = useState(false);
  const [usage, setUsage] = useState(null);
  const media = useMemo(() => order.media || [], [order.media]);

  useEffect(() => {
    storageEstimate().then(setUsage);
  }, [media.length]);

  const shown = media.filter((m) => filter === 'all' || (filter === 'customer' ? m.customer : filter === 'internal' ? !m.customer : filter === 'video' ? m.kind === 'video' : m.kind === 'image'));
  const total = media.reduce((s, m) => s + (m.size || 0), 0);
  const serviceTitle = (id) => order.services.find((s) => s.id === id)?.title;

  const grouped = new Map();
  for (const m of shown) {
    const key = m.serviceId && serviceTitle(m.serviceId) ? `svc:${m.serviceId}` : m.inspectionKey ? `insp:${m.inspectionKey}` : 'general';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(m);
  }
  const groups = [...grouped.entries()].sort((a, b) => (a[0] === 'general' ? -1 : b[0] === 'general' ? 1 : 0));

  const groupTitle = (key) => (key === 'general' ? 'General' : key.startsWith('svc:') ? serviceTitle(key.slice(4)) : `Inspection · ${inspectionLabel(key.slice(5))}`);

  return (
    <div className="space-y-4">
      {editable && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            ingest(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-6 text-center transition-colors sm:flex-row sm:text-left ${drag ? 'border-accent bg-accent/[0.05]' : 'border-line'}`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fill/[0.1] text-ink-2">{busy ? <Spinner size={18} /> : <ImagePlus size={19} />}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{busy ? `Saving ${busy} file${busy === 1 ? '' : 's'}…` : 'Add photos & video'}</div>
            <div className="text-xs text-ink-3">Drag files here, or use the camera on a phone or tablet. Photos are resized and stripped of location data; videos up to {MAX_VIDEO_MB} MB.</div>
          </div>
          <div className="flex gap-2">
            <PickButton capture onFiles={(f) => ingest(f)} className="btn-secondary">
              <Camera size={15} /> Camera
            </PickButton>
            <PickButton onFiles={(f) => ingest(f)} className="btn-primary">
              <ImagePlus size={15} /> Upload
            </PickButton>
          </div>
        </div>
      )}

      {media.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All', count: media.length },
              { value: 'image', label: 'Photos', count: media.filter((m) => m.kind === 'image').length },
              { value: 'video', label: 'Video', count: media.filter((m) => m.kind === 'video').length },
              { value: 'customer', label: 'Customer can see', count: media.filter((m) => m.customer).length },
              { value: 'internal', label: 'Internal', count: media.filter((m) => !m.customer).length },
            ]}
          />
          <span className="text-xs text-ink-3">
            {formatBytes(total)} on this device{usage?.quota ? ` · ${formatBytes(usage.used)} of ${formatBytes(usage.quota)} browser storage used` : ''}
          </span>
        </div>
      )}

      {media.length === 0 ? (
        <Card>
          <EmptyState icon={Images} title="No photos or video yet" body="Document worn parts, leaks, measurements and finished work. Customers see them in their vehicle report." />
        </Card>
      ) : shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-3">Nothing matches this filter.</p>
      ) : (
        groups.map(([key, list]) => (
          <section key={key}>
            <h3 className="section-label mb-2">{groupTitle(key)}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {list.map((m) => (
                <MediaThumb key={m.id} media={m} onClick={() => viewer.open(m.id)} className="aspect-[4/3] w-full" />
              ))}
            </div>
          </section>
        ))
      )}

      <p className="flex items-start gap-2 text-xs text-ink-3">
        <Info size={13} className="mt-0.5 shrink-0" />
        Photos and videos are stored in this browser on this device and aren’t part of the JSON backup. Publish a share link (or download the report) to give customers a copy.
      </p>
    </div>
  );
}

/** Lightbox with caption, links and visibility controls (open it with `useMediaViewer`). */
export function MediaViewer({ order, mediaId, editable, onNavigate, onClose }) {
  const { state, updateMedia, removeMedia } = useShop();
  const { toast } = useUI();
  const list = order.media || [];
  const idx = list.findIndex((m) => m.id === mediaId);
  const m = list[idx];
  const url = useMediaUrl(m?.id, 'blob', m?.cloud);
  const prev = list[idx - 1];
  const next = list[idx + 1];

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && prev) onNavigate(prev.id);
      if (e.key === 'ArrowRight' && next) onNavigate(next.id);
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [prev, next, onClose, onNavigate]);

  if (!m) return null;
  const up = (patch) => updateMedia(order.id, m.id, patch);
  const inspectionKeys = inspectionPoints(inspectionTemplateFor(state, order)).map((p) => p.key);
  const link = m.serviceId ? `svc:${m.serviceId}` : m.inspectionKey ? `insp:${m.inspectionKey}` : '';

  const remove = async () => {
    removeMedia(order.id, [m.id]);
    forgetUrls([m.id]);
    await removeFiles([m.id]).catch(() => {});
    toast('Deleted');
    if (next) onNavigate(next.id);
    else if (prev) onNavigate(prev.id);
    else onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white lg:flex-row" role="dialog" aria-modal="true" aria-label="Photo viewer">
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6">
        {!url ? (
          <Spinner size={22} className="text-white/70" />
        ) : m.kind === 'video' ? (
          <video key={url} src={url} controls playsInline className="max-h-full max-w-full rounded-[8px]" />
        ) : (
          <img src={url} alt={m.caption || ''} className="max-h-full max-w-full rounded-[6px] object-contain" />
        )}
        {prev && (
          <button onClick={() => onNavigate(prev.id)} aria-label="Previous" className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
            <ChevronLeft size={20} />
          </button>
        )}
        {next && (
          <button onClick={() => onNavigate(next.id)} aria-label="Next" className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
            <ChevronRight size={20} />
          </button>
        )}
        <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
          <X size={18} />
        </button>
        <span className="absolute left-4 top-4 text-xs text-white/60">
          {idx + 1} / {list.length}
        </span>
      </div>
      <aside className="max-h-[42vh] w-full shrink-0 overflow-y-auto bg-surface p-4 text-ink lg:max-h-none lg:w-[320px]">
        <label className="block">
          <span className="field-label">Caption</span>
          <textarea
            key={m.id}
            rows={3}
            defaultValue={m.caption}
            disabled={!editable}
            onBlur={(e) => e.target.value !== m.caption && up({ caption: e.target.value.trim() })}
            placeholder="What the customer is looking at — e.g. “Front pads at 2 mm, metal backing visible”"
            className="input resize-none"
          />
        </label>
        <label className="mt-3 block">
          <span className="field-label">Linked to</span>
          <select
            className="input"
            disabled={!editable}
            value={link}
            onChange={(e) => {
              const v = e.target.value;
              up({ serviceId: v.startsWith('svc:') ? v.slice(4) : null, inspectionKey: v.startsWith('insp:') ? v.slice(5) : null });
            }}
          >
            <option value="">General (whole vehicle)</option>
            {order.services.length > 0 && (
              <optgroup label="Services">
                {order.services.map((s) => (
                  <option key={s.id} value={`svc:${s.id}`}>{s.title}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="Inspection">
              {inspectionKeys.map((k) => (
                <option key={k} value={`insp:${k}`}>{inspectionLabel(k)}</option>
              ))}
            </optgroup>
          </select>
        </label>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[8px] border border-line px-3 py-2">
          <span className="flex items-center gap-2 text-sm">
            {m.customer ? <Eye size={15} className="text-ink-3" /> : <EyeOff size={15} className="text-ink-3" />}
            {m.customer ? 'Customer can see' : 'Internal only'}
          </span>
          <Toggle checked={m.customer} disabled={!editable} onChange={(v) => up({ customer: v })} label="Customer can see" />
        </div>
        <dl className="mt-4 space-y-1 text-xs text-ink-3">
          <div className="flex justify-between gap-3"><dt>File</dt><dd className="truncate text-ink-2">{m.name}</dd></div>
          <div className="flex justify-between gap-3"><dt>Size</dt><dd className="text-ink-2">{formatBytes(m.size)}{m.width ? ` · ${m.width}×${m.height}` : ''}{m.duration != null ? ` · ${formatDuration(m.duration)}` : ''}</dd></div>
          <div className="flex justify-between gap-3"><dt>Added</dt><dd className="text-ink-2">{dateTime(m.createdAt)}</dd></div>
        </dl>
        <div className="mt-4 flex gap-2">
          {url && (
            <a href={url} download={m.kind === 'image' ? `RO${order.number}-${m.id}.jpg` : m.name} className="btn-secondary flex-1">
              <Download size={14} /> Download
            </a>
          )}
          {editable && (
            <button className="btn-secondary text-bad" onClick={remove}>
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
