// Small helpers shared by the sync screens and the sidebar.
import { relTime } from '../format';

export function downloadJson(data, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** One-line description of where sync is at. */
export function syncLabel(sync) {
  const s = sync?.status || {};
  if (!sync?.enabled) return '';
  if (s.phase === 'signed-out') return 'Signed out — sign in to sync';
  if (s.phase === 'not-staff') return 'This login isn’t shop staff';
  if (s.phase === 'offline') return s.pending ? `Offline · ${s.pending} change${s.pending === 1 ? '' : 's'} waiting` : 'Offline';
  if (s.phase === 'error') return 'Sync problem — retrying';
  if (s.phase === 'syncing' || s.pending) return s.pending ? `Syncing · ${s.pending} left` : 'Syncing…';
  return s.lastSync ? `Synced ${relTime(s.lastSync)}` : 'Synced';
}

