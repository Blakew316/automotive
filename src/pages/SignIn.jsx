// Staff sign-in for the shop's cloud. After signing in, a device that isn't sharing the shop's data
// yet loads it automatically, so a new tablet or phone is ready in one step.
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, KeyRound, ArrowRight } from 'lucide-react';
import { useShop, useSync, useUI } from '../store/hooks';
import { Spinner, Field } from '../components/ui';
import { Logo } from '../components/Layout';
import { signIn, signOut, changePassword, isStaffSession, sessionClaims } from '../lib/cloudShare';
import { syncApi } from '../lib/sync/api';
import { homeFor } from '../lib/access';

export default function SignIn() {
  const { state } = useShop();
  const sync = useSync();
  const { toast, setUserId } = useUI();
  const navigate = useNavigate();
  const cfg = sync?.cfg;
  const [email, setEmail] = useState(sync?.session?.email || '');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState(sync?.signedIn && sync?.session?.mustChange ? 'password' : 'signin');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const finish = async (session) => {
    const claims = sessionClaims(session).app_metadata || {};
    // Switch this device to the person who signed in.
    const profile = (state.shop.staff || []).find((p) => p.id === claims.autoshop_staff_id);
    if (profile) setUserId(profile.id);
    let joined = sync.enabled;
    if (!joined) {
      setBusy('Checking for the shop’s data…');
      const n = await syncApi(cfg).count();
      if (n > 0) {
        setBusy('Loading the shop’s data…');
        await sync.join((count) => setBusy(`Loading the shop’s data… ${count.toLocaleString()} records`));
        joined = true;
      }
    }
    toast(`Signed in as ${profile?.name || session.name || session.email}`, { tone: 'success' });
    if (!joined && claims.autoshop_role === 'owner') navigate('/settings?tab=cloud#sync');
    else navigate(homeFor(claims.autoshop_role || profile?.role || 'owner'));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy('Signing in…');
    try {
      const session = await signIn(cfg, email.trim(), password);
      setPassword('');
      if (!isStaffSession(session)) {
        signOut();
        throw new Error('This account isn’t set up as shop staff. Ask the owner to add you under Team → Staff & access.');
      }
      if (session.mustChange) {
        setStep('password');
        setBusy('');
        return;
      }
      await finish(session);
    } catch (err) {
      setError(err.message || 'Sign-in failed');
    } finally {
      setBusy('');
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setError('');
    setBusy('Saving your password…');
    try {
      await changePassword(cfg, newPassword);
      await finish(sync.session ? { ...sync.session, mustChange: false } : { name: '' });
    } catch (err) {
      setError(err.message || 'Couldn’t save the password');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={44} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">{step === 'password' ? 'Choose your password' : 'Sign in'}</h1>
          <p className="mt-1 text-sm text-ink-3">{state.shop.name} · AutoShop Pro</p>
        </div>
        <div className="card p-5">
          {!cfg ? (
            <p className="text-sm text-ink-2">
              This device isn’t connected to a Shop Cloud. Set it up under <Link to="/settings?tab=cloud" className="link">Settings → Shop Cloud</Link>.
            </p>
          ) : step === 'password' ? (
            <form className="space-y-4" onSubmit={savePassword}>
              <p className="text-sm text-ink-2">You signed in with a temporary password. Pick one only you know.</p>
              <Field label="New password" hint="At least 10 characters">
                {(id) => <input id={id} type="password" autoComplete="new-password" className="input h-10" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoFocus />}
              </Field>
              <button type="submit" className="btn-primary btn-lg w-full" disabled={newPassword.length < 10 || Boolean(busy)}>
                {busy ? <Spinner size={15} /> : <KeyRound size={15} />} Save and continue
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              <Field label="Email">
                {(id) => <input id={id} type="email" autoComplete="username" className="input h-10" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus={!email} />}
              </Field>
              <Field label="Password">
                {(id) => <input id={id} type="password" autoComplete="current-password" className="input h-10" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus={Boolean(email)} />}
              </Field>
              <button type="submit" className="btn-primary btn-lg w-full" disabled={!email || !password || Boolean(busy)}>
                {busy ? <Spinner size={15} /> : <LogIn size={15} />} Sign in
              </button>
            </form>
          )}
          {busy && <p className="mt-3 text-center text-sm text-ink-2">{busy}</p>}
          {error && <p className="mt-3 text-sm text-bad">{error}</p>}
        </div>
        <p className="mt-4 text-center text-xs text-ink-3">
          Forgot your password? Ask the shop owner to reset it under Team → Staff & access.
        </p>
        {sync?.signedIn && step === 'signin' && (
          <Link to="/" className="mt-3 flex items-center justify-center gap-1 text-sm text-accent hover:underline">
            Continue as {sync.session.email} <ArrowRight size={13} />
          </Link>
        )}
      </div>
    </div>
  );
}
