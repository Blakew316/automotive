// A photo or recording kept in the shop's private storage (texted pictures, voicemail), loaded with
// the signed-in staff member's session.
import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { useSync } from '../store/hooks';
import { downloadPath } from '../lib/sync/api';
import { Spinner } from './ui';

const urls = new Map();

export default function PrivateMedia({ path, type = '', className = '' }) {
  const sync = useSync();
  const [state, setState] = useState(() => (urls.has(path) ? { url: urls.get(path) } : { loading: true }));
  useEffect(() => {
    if (urls.has(path) || !sync?.staff || !sync?.cfg) return undefined;
    let alive = true;
    downloadPath(sync.cfg, path)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        urls.set(path, url);
        if (alive) setState({ url });
      })
      .catch(() => alive && setState({ error: true }));
    return () => {
      alive = false;
    };
  }, [path, sync?.staff, sync?.cfg]);

  if (!sync?.staff) return <span className="text-xs text-ink-3">Sign in to Shop Cloud to see this file</span>;
  if (state.error)
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-ink-3 ${className}`}>
        <ImageOff size={12} /> File unavailable
      </span>
    );
  if (!state.url) return <Spinner size={14} className={className} />;
  if (type.startsWith('audio/')) return <audio controls preload="metadata" src={state.url} className={`h-9 max-w-full ${className}`} />;
  if (type.startsWith('video/')) return <video controls playsInline preload="metadata" src={state.url} className={`max-h-56 rounded-[10px] ${className}`} />;
  if (type.startsWith('image/'))
    return (
      <a href={state.url} target="_blank" rel="noopener noreferrer">
        <img src={state.url} alt="Picture from the customer" className={`max-h-56 rounded-[10px] object-cover ${className}`} />
      </a>
    );
  return (
    <a href={state.url} target="_blank" rel="noopener noreferrer" className={`link text-xs ${className}`}>
      Open attachment
    </a>
  );
}
