// Cloud logins for the team: each person signs in with their own email, so the change history shows
// who did what and access can be removed when someone leaves.
import { useEffect, useState } from 'react';
import { UserPlus, KeyRound, UserX, Copy, Check, CloudOff, ShieldCheck } from 'lucide-react';
import { useShop, useSync, useAccess, useUI } from '../../store/hooks';
import { Card, CardHeader, Modal, Field, Spinner, Avatar } from '../../components/ui';
import { shopAdmin } from '../../lib/sync/api';
import { ROLES } from '../../lib/access';
import { relTime } from '../../lib/format';

export default function Logins() {
  const { state } = useShop();
  const sync = useSync();
  const { role } = useAccess();
  const { toast } = useUI();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [inviting, setInviting] = useState(null);
  const [secret, setSecret] = useState(null);
  const [busy, setBusy] = useState('');
  const owner = role === 'owner';
  const cfg = sync?.cfg;
  const ready = Boolean(sync?.staff && (role === 'owner' || role === 'manager'));

  const load = () =>
    shopAdmin(cfg, 'list').then(
      (r) => {
        setUsers(r.users || []);
        setError('');
      },
      (e) => {
        setUsers([]);
        setError(e.message);
      },
    );
  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    shopAdmin(cfg, 'list').then(
      (r) => alive && setUsers(r.users || []),
      (e) => alive && (setUsers([]), setError(e.message)),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, cfg?.url]);

  if (!sync?.cfg) return null;
  if (!ready) {
    return (
      <Card className="p-4 text-sm text-ink-2">
        <div className="flex items-start gap-3">
          <CloudOff size={18} className="mt-0.5 shrink-0 text-ink-3" />
          <span>Sign in to the Shop Cloud (Settings → Shop Cloud) as the owner to give each person their own login.</span>
        </div>
      </Card>
    );
  }

  const act = async (label, fn) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      toast(e.message, { tone: 'error' });
    } finally {
      setBusy('');
    }
  };
  const staff = state.shop.staff || [];
  const byProfile = new Map((users || []).filter((u) => u.staffId).map((u) => [u.staffId, u]));
  const unlinked = (users || []).filter((u) => !u.staffId || !staff.some((p) => p.id === u.staffId));

  return (
    <Card>
      <CardHeader icon={ShieldCheck} title="Logins" subtitle="Each person’s own sign-in for the shop’s shared data — needed on any device that isn’t already signed in" />
      {users === null ? (
        <p className="flex items-center gap-2 px-4 py-4 text-sm text-ink-3">
          <Spinner size={13} /> Loading logins…
        </p>
      ) : (
        <ul className="divide-y divide-line/70">
          {staff.map((p) => {
            const u = byProfile.get(p.id);
            const roleOff = u && u.active && u.role !== p.role;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar name={p.name} size={32} />
                <div className="min-w-[160px] flex-1">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-ink-3">
                    {u ? (
                      <>
                        {u.email} · {u.active ? (u.mustChange ? 'temporary password not changed yet' : u.lastSignIn ? `signed in ${relTime(u.lastSignIn)}` : 'not signed in yet') : 'login removed'}
                      </>
                    ) : (
                      'No login'
                    )}
                  </div>
                  {roleOff && <div className="text-xs text-warn">Login role is {ROLES[u.role]?.label || u.role}; profile is {ROLES[p.role]?.label}.</div>}
                </div>
                {owner && (
                  <div className="flex flex-wrap gap-1.5">
                    {roleOff && (
                      <button className="btn-secondary btn-sm" disabled={Boolean(busy)} onClick={() => act('role', async () => (await shopAdmin(cfg, 'update', { userId: u.id, role: p.role }), await load(), toast('Login role updated — applies at their next sign-in', { tone: 'success' })))}>
                        Match role
                      </button>
                    )}
                    {!u || !u.active ? (
                      <button className="btn-secondary btn-sm" onClick={() => setInviting({ profile: p, email: u?.email || '' })}>
                        <UserPlus size={13} /> {u ? 'Restore login' : 'Add login'}
                      </button>
                    ) : (
                      <>
                        <button
                          className="btn-plain btn-sm"
                          disabled={Boolean(busy)}
                          onClick={() =>
                            act('reset', async () => {
                              const r = await shopAdmin(cfg, 'reset', { userId: u.id });
                              setSecret({ email: u.email, password: r.password, name: p.name });
                              await load();
                            })
                          }
                        >
                          <KeyRound size={13} /> Reset password
                        </button>
                        {u.id !== sync.session?.userId && (
                          <button className="btn-plain btn-sm text-bad" disabled={Boolean(busy)} onClick={() => act('remove', async () => (await shopAdmin(cfg, 'remove', { userId: u.id }), await load(), toast(`${p.name} can no longer sign in`)))}>
                            <UserX size={13} /> Remove
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {unlinked.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <Avatar name={u.name || u.email} size={32} />
              <div className="min-w-[160px] flex-1">
                <div className="font-medium">{u.name || u.email}</div>
                <div className="text-xs text-ink-3">{u.email} · not linked to a staff profile</div>
              </div>
              {owner && (
                <select
                  className="input h-8 w-auto"
                  value=""
                  onChange={(e) => e.target.value && act('link', async () => (await shopAdmin(cfg, 'update', { userId: u.id, staffId: e.target.value, role: staff.find((p) => p.id === e.target.value)?.role }), await load()))}
                  aria-label={`Link ${u.email} to a staff profile`}
                >
                  <option value="">Link to…</option>
                  {staff.filter((p) => !byProfile.has(p.id)).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="border-t border-line/70 px-4 py-2.5 text-sm text-bad">{error}</p>}
      <p className="border-t border-line/70 px-4 py-2.5 text-xs text-ink-3">New logins get a temporary password to hand over in person; they choose their own the first time they sign in at <b>/app/signin</b>.</p>

      {inviting && (
        <InviteModal
          profile={inviting.profile}
          initialEmail={inviting.email}
          onClose={() => setInviting(null)}
          onInvite={async (email) => {
            const r = await shopAdmin(cfg, 'invite', { email, name: inviting.profile.name, role: inviting.profile.role, staffId: inviting.profile.id });
            setInviting(null);
            setSecret({ email: r.user.email, password: r.password, name: inviting.profile.name });
            await load();
          }}
        />
      )}
      {secret && <SecretModal {...secret} onClose={() => setSecret(null)} />}
    </Card>
  );
}

function InviteModal({ profile, initialEmail, onClose, onInvite }) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Login for ${profile.name}`}
      subtitle={ROLES[profile.role]?.label}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) || busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await onInvite(email.trim());
              } catch (e) {
                setError(e.message);
                setBusy(false);
              }
            }}
          >
            {busy ? <Spinner size={14} /> : <UserPlus size={14} />} Create login
          </button>
        </>
      }
    >
      <Field label="Their email" hint="They sign in with this email and a temporary password you’ll see next">
        {(id) => <input id={id} type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />}
      </Field>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
    </Modal>
  );
}

function SecretModal({ email, password, name, onClose }) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal open onClose={onClose} size="sm" title={`Temporary password for ${name}`} footer={<button className="btn-primary" onClick={onClose}>Done</button>}>
      <p className="text-sm text-ink-2">Give this to {name.split(' ')[0]} in person. It’s shown only once; they’ll pick their own password when they first sign in.</p>
      <div className="mt-3 rounded-[10px] border border-line bg-raised p-3">
        <div className="text-xs text-ink-3">Email</div>
        <div className="font-medium">{email}</div>
        <div className="mt-2 text-xs text-ink-3">Temporary password</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-lg tracking-wide">{password}</code>
          <button
            className="btn-secondary btn-sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(password);
                setCopied(true);
              } catch {
                // Select and copy manually.
              }
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
