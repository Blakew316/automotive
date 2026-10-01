// Who changed a record, when, from which device and what changed — with one-click restore.
import { useEffect, useMemo, useState } from 'react';
import { History, RotateCcw, Smartphone } from 'lucide-react';
import { useShop, useSync, useUI, useAccess } from '../store/hooks';
import { Modal, Spinner, EmptyState } from './ui';
import { recordHistory } from '../lib/sync/api';
import { describeChange } from '../lib/sync/describe';
import { relTime } from '../lib/format';

export default function RecordHistory({ collection, id, title, onClose }) {
  const sync = useSync();
  const { restoreRecord } = useShop();
  const { role } = useAccess();
  const { toast } = useUI();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    recordHistory(sync.cfg, collection, id).then(
      (r) => alive && setRows(r || []),
      (e) => alive && (setError(e.message), setRows([])),
    );
    return () => {
      alive = false;
    };
  }, [sync.cfg, collection, id]);

  const entries = useMemo(() => (rows || []).map((r, i) => ({ ...r, changes: describeChange(collection, rows[i + 1]?.deleted ? null : rows[i + 1]?.data, r.deleted ? null : r.data) })), [rows, collection]);
  const canRestore = role === 'owner' || role === 'manager' || role === 'advisor';

  return (
    <Modal open onClose={onClose} title="Change history" subtitle={title} size="md">
      {rows === null ? (
        <p className="flex items-center gap-2 py-6 text-sm text-ink-3">
          <Spinner size={14} /> Loading history…
        </p>
      ) : !entries.length ? (
        <EmptyState icon={History} title="No history yet" body={error || 'Changes appear here once this device has synced them.'} />
      ) : (
        <ol className="relative -mx-1 space-y-1 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-line">
          {entries.map((e, i) => (
            <li key={e.version} className="relative flex gap-3 rounded-[10px] px-1 py-2">
              <span className={`relative z-[1] mt-1 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 border-surface text-[10px] font-semibold ${i === 0 ? 'bg-accent text-on-accent' : 'bg-fill/[0.16] text-ink-2'}`}>{e.version}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-medium">{e.actor || 'Someone'}</span>
                  <span className="text-xs text-ink-3" title={new Date(e.changed_at).toLocaleString()}>
                    {relTime(e.changed_at)}
                  </span>
                  {e.device && (
                    <span className="flex items-center gap-1 text-xs text-ink-4">
                      <Smartphone size={11} /> {e.device}
                    </span>
                  )}
                </div>
                <ul className="mt-0.5 space-y-0.5 text-sm text-ink-2">
                  {e.changes.slice(0, 8).map((c, k) => (
                    <li key={k}>{c}</li>
                  ))}
                  {e.changes.length > 8 && <li className="text-ink-3">and {e.changes.length - 8} more</li>}
                </ul>
              </div>
              {i > 0 && !e.deleted && canRestore && (
                <button
                  className="btn-plain btn-sm shrink-0 self-start"
                  onClick={() => {
                    restoreRecord(collection, id, e.data);
                    toast(`Restored version ${e.version}`, { tone: 'success' });
                    onClose();
                  }}
                >
                  <RotateCcw size={12} /> Restore
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
