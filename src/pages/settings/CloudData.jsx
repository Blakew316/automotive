// Shared shop data: turning it on, joining from another device, status, and cloud backups.
import { useEffect, useState } from 'react';
import { CloudUpload, CloudDownload, RefreshCw, Monitor, LogOut, ShieldCheck, DatabaseBackup, Download, History, Radio, TriangleAlert } from 'lucide-react';
import { useShop, useSync, useUI, useAccess } from '../../store/hooks';
import { Modal, Spinner, InlineText, Field } from '../../components/ui';
import { listBackups, getBackup, backupNow, restoreBackup } from '../../lib/sync/api';
import { stateFromRows, withoutLocal } from '../../lib/sync/records';
import { downloadJson, syncLabel } from '../../lib/sync/labels';
import Section from './Section';

export function SyncSection() {
  const { state, clearAll } = useShop();
  const sync = useSync();
  const { toast } = useUI();
  const { role } = useAccess();
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState(0);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState('');
  if (!sync?.cfg) return null;
  const owner = role === 'owner';
  const s = sync.status;

  const run = async (label, fn) => {
    setError('');
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      setError(e.message || 'Something went wrong');
    } finally {
      setBusy('');
      setConfirm(null);
    }
  };

  const join = () =>
    run('Loading the shop’s data…', async () => {
      await sync.join((n) => setProgress(n));
      toast('This device now shares the shop’s data', { tone: 'success' });
    });
  const upload = (fresh) =>
    run('Uploading…', async () => {
      if (fresh) await clearAll();
      await sync.upload();
      toast(fresh ? 'Shared data is on — starting with an empty shop' : 'Shared data is on — uploading this device’s data', { tone: 'success' });
    });

  return (
    <Section id="sync" icon={Radio} title="Shared shop data" subtitle="Every computer, tablet and phone in the shop sees the same repair orders, customers and schedule — live">
      {!sync.signedIn ? (
        <p className="text-sm text-ink-2">Sign in above with a staff login to share this shop’s data across devices.</p>
      ) : !sync.staff ? (
        <p className="flex items-center gap-1.5 text-sm text-warn">
          <TriangleAlert size={14} /> This login isn’t marked as shop staff.
        </p>
      ) : sync.enabled ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-raised p-3">
            <span className={`flex h-9 w-9 items-center justify-center rounded-full ${s.phase === 'error' || s.phase === 'offline' ? 'bg-warn/10 text-warn' : 'bg-ok/10 text-ok'}`}>
              {s.phase === 'syncing' || s.pending ? <Spinner size={16} /> : <ShieldCheck size={18} />}
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-medium">{syncLabel(sync)}</div>
              <div className="text-ink-3">
                {s.live ? 'Live updates on' : 'Checking for changes every few seconds'} · on since {new Date(sync.joinedAt || Date.now()).toLocaleDateString()}
                {s.error && s.phase !== 'idle' ? ` · ${s.error}` : ''}
              </div>
            </div>
            <button className="btn-secondary btn-sm" onClick={() => sync.syncNow()}>
              <RefreshCw size={13} /> Sync now
            </button>
          </div>
          <Field label="This device" hint="Shown in the change history next to edits made here">
            {(id) => <InlineText id={id} className="input max-w-sm" value={sync.device.name} onCommit={sync.renameDevice} />}
          </Field>
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <Monitor size={14} className="text-ink-3" />
            <span className="flex-1 text-xs text-ink-3">Changes made offline are kept on this device and sent when it’s back online. If two people edit the same repair order, both edits are kept.</span>
            <button className="btn-plain btn-sm text-bad" onClick={() => setConfirm('leave')}>
              <LogOut size={13} /> Stop syncing this device
            </button>
          </div>
        </div>
      ) : sync.cloudHasData === null ? (
        sync.cloudError ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-bad">
            Couldn’t reach the cloud: {sync.cloudError}
            <button className="btn-secondary btn-sm" onClick={sync.recheck}>
              <RefreshCw size={13} /> Retry
            </button>
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-ink-3">
            <Spinner size={13} /> Checking the cloud…
          </p>
        )
      ) : sync.cloudHasData ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-2">
            <b className="font-medium text-ink">This shop’s data is already in the cloud.</b> Load it on this device to work with the rest of the team. What’s on this device now ({state.orders.length} repair orders, {state.customers.length} customers) will be replaced.
          </p>
          <button className="btn-primary" disabled={Boolean(busy)} onClick={() => setConfirm('join')}>
            <CloudDownload size={14} /> Load shop data on this device
          </button>
        </div>
      ) : owner ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-2">Turn on shared data to put this shop in the cloud. Other devices then sign in and load it. Every change is kept in a history and the whole shop is backed up nightly.</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={Boolean(busy)} onClick={() => setConfirm('upload')}>
              <CloudUpload size={14} /> Use this device’s data
            </button>
            <button className="btn-secondary" disabled={Boolean(busy)} onClick={() => setConfirm('fresh')}>
              Start with an empty shop
            </button>
          </div>
          <p className="text-xs text-ink-3">“Use this device’s data” uploads the {state.orders.length} repair orders and {state.customers.length} customers here (including the sample shop’s made-up records if you haven’t cleared them). “Start with an empty shop” keeps your settings, rates, service menu and team but removes customers, vehicles and orders.</p>
        </div>
      ) : (
        <p className="text-sm text-ink-2">Ask the shop owner to turn on shared data, then load it here.</p>
      )}

      {busy && (
        <p className="mt-3 flex items-center gap-2 text-sm text-ink-2">
          <Spinner size={13} /> {busy} {busy.startsWith('Loading') && progress ? `${progress} records` : ''}
        </p>
      )}
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}

      <Modal
        open={Boolean(confirm)}
        onClose={() => !busy && setConfirm(null)}
        size="sm"
        title={{ join: 'Load the shop’s data here?', upload: 'Upload this device’s data?', fresh: 'Start with an empty shop?', leave: 'Stop syncing this device?' }[confirm] || ''}
        footer={
          <>
            <button className="btn-secondary" disabled={Boolean(busy)} onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className={confirm === 'leave' || confirm === 'fresh' ? 'btn-danger' : 'btn-primary'}
              disabled={Boolean(busy)}
              onClick={() => {
                if (confirm === 'join') join();
                else if (confirm === 'upload') upload(false);
                else if (confirm === 'fresh') upload(true);
                else {
                  sync.leave();
                  setConfirm(null);
                  toast('This device stopped syncing — its copy of the data stays here');
                }
              }}
            >
              {busy ? <Spinner size={14} /> : null}
              {{ join: 'Load shop data', upload: 'Upload and turn on', fresh: 'Empty and turn on', leave: 'Stop syncing' }[confirm]}
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          {confirm === 'join' && 'Everything currently on this device is replaced with the shop’s shared data. Photos from other devices download when you open them.'}
          {confirm === 'upload' && 'This device’s customers, vehicles, repair orders and settings become the shop’s shared data. Other devices can then sign in and load it.'}
          {confirm === 'fresh' && 'Customers, vehicles, repair orders, appointments and inventory on this device are removed first. Settings, rates, the service menu and your team are kept.'}
          {confirm === 'leave' && 'This device keeps its current copy but stops sending and receiving changes. You can load the shared data again any time.'}
        </p>
        {confirm === 'join' && (
          <button className="btn-plain btn-sm mt-2 px-0" onClick={() => downloadJson(withoutLocal(state), `wpi-driveline-this-device-${new Date().toISOString().slice(0, 10)}.json`)}>
            <Download size={13} /> Download this device’s data first
          </button>
        )}
      </Modal>
    </Section>
  );
}

/** Nightly cloud backups: download any of the last 14, or put the shop back to one (owner). */
export function CloudBackups() {
  const { state } = useShop();
  const sync = useSync();
  const { role } = useAccess();
  const { toast } = useUI();
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(null);
  const [restoring, setRestoring] = useState(null);
  const owner = role === 'owner';
  const cfg = sync?.cfg;
  const ready = Boolean(sync?.enabled && sync?.staff);

  const load = () =>
    listBackups(cfg).then(setList, (e) => {
      setList([]);
      toast(e.message, { tone: 'error' });
    });
  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    listBackups(cfg).then(
      (l) => alive && setList(l),
      () => alive && setList([]),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, cfg?.url]);
  if (!ready) return null;

  const download = async (b) => {
    setBusy(b.id);
    try {
      const full = await getBackup(cfg, b.id);
      const rows = (full?.data || []).map(([collection, id, data]) => ({ collection, id, data }));
      // Only what the cloud holds — device-local flags such as the sample-shop marker never go in a backup.
      const skeleton = { version: 2, seededAt: full.created_at, shop: {}, counters: {} };
      for (const k of Object.keys(state)) if (Array.isArray(state[k])) skeleton[k] = [];
      downloadJson(stateFromRows(rows, skeleton), `wpi-driveline-cloud-backup-${full.created_at.slice(0, 10)}.json`);
    } catch (e) {
      toast(e.message, { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section
      icon={DatabaseBackup}
      title="Cloud backups"
      subtitle="The whole shop is backed up every night at 3:15 AM; the last 14 are kept"
      actions={
        owner && (
          <button
            className="btn-secondary btn-sm"
            disabled={busy === 'now'}
            onClick={async () => {
              setBusy('now');
              try {
                await backupNow(cfg);
                await load();
                toast('Backup made', { tone: 'success' });
              } catch (e) {
                toast(e.message, { tone: 'error' });
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === 'now' ? <Spinner size={13} /> : <DatabaseBackup size={13} />} Back up now
          </button>
        )
      }
      flush
    >
      {list === null ? (
        <p className="flex items-center gap-2 px-4 py-4 text-sm text-ink-3">
          <Spinner size={13} /> Loading backups…
        </p>
      ) : list.length === 0 ? (
        <p className="px-4 py-4 text-sm text-ink-3">No backups yet — the first one runs tonight.</p>
      ) : (
        <ul className="divide-y divide-line/70">
          {list.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <History size={15} className="text-ink-3" />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{new Date(b.created_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                <span className="text-ink-3"> · {b.note || 'Backup'} · {b.records.toLocaleString()} records</span>
              </span>
              <button className="btn-plain btn-sm" disabled={busy === b.id} onClick={() => download(b)}>
                {busy === b.id ? <Spinner size={12} /> : <Download size={13} />} Download
              </button>
              {owner && (
                <button className="btn-plain btn-sm text-bad" onClick={() => setRestoring(b)}>
                  Restore…
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={Boolean(restoring)}
        onClose={() => busy !== 'restore' && setRestoring(null)}
        size="sm"
        title="Put the shop back to this backup?"
        footer={
          <>
            <button className="btn-secondary" disabled={busy === 'restore'} onClick={() => setRestoring(null)}>
              Cancel
            </button>
            <button
              className="btn-danger"
              disabled={busy === 'restore'}
              onClick={async () => {
                setBusy('restore');
                try {
                  await restoreBackup(cfg, restoring.id);
                  await sync.syncNow();
                  toast('Shop restored — every device updates in a moment', { tone: 'success' });
                  setRestoring(null);
                  load();
                } catch (e) {
                  toast(e.message, { tone: 'error' });
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === 'restore' ? <Spinner size={14} /> : null} Restore for everyone
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          Every device goes back to the shop as it was on {restoring && new Date(restoring.created_at).toLocaleString()}. Changes made since then are undone, but a backup of the shop right now is made first, so this can be reversed.
        </p>
      </Modal>
    </Section>
  );
}
