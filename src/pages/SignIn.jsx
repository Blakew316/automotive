// Staff sign-in for the shop's cloud. After signing in, a device that isn't sharing the shop's data
// yet loads it automatically, so a new tablet or phone is ready in one step.
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, KeyRound, ArrowRight, ShieldCheck } from 'lucide-react';
import { useShop, useSync, useUI } from '../store/hooks';
import { Spinner, Field } from '../components/ui';
import { Logo } from '../components/Layout';
import TwoStepSetup from '../components/TwoStepSetup';
import { signIn, signOut, changePassword, isStaffSession, sessionClaims, needsCode, twoStepFactors, verifyCode } from '../lib/cloudShare';
import { syncApi, mfaOk } from '../lib/sync/api';
import { homeFor } from '../lib/access';

export default function SignIn() {
  const { state } = useShop();
  const sync = useSync();
  const { toast, setUserId } = useUI();
  const navigate = useNavigate();
  const cfg = sync?.cfg;
  const [email, setEmail] = useState(sync?.session?.email || '');
  const [password, setPassword] = useState('');
  // Already signed in on this device but the code is still needed (e.g. two-step was just turned on).
  const waiting = sync?.signedIn && needsCode(sync.session);
  const [step, setStep] = useState(waiting ? 'code' : sync?.signedIn && sync?.session?.mustChange ? 'password' : sync?.twoStepNeeded ? 'enroll' : 'signin');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  // Two-step sign-in: the password-only session waiting for its code, and the app to check against.
  const [pending, setPending] = useState(waiting ? sync.session : null);
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    if (step !== 'code' || !pending || factorId) return;
    twoStepFactors(cfg, pending)
      .then((f) => setFactorId(f[0]?.id || ''))
      .catch((e) => setError(e.message || 'Couldn’t start two-step sign-in'));
  }, [step, pending, factorId, cfg]);

  /** After the password (and code): a new password if it's temporary, then two-step setup if the shop requires it. */
  const proceed = async (session) => {
    if (session.mustChange) {
      setStep('password');
      return;
    }
    if (!(await mfaOk(cfg).catch(() => true))) {
      setStep('enroll');
      return;
    }
    await finish(session);
  };

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
      if (!sessionClaims(session).app_metadata?.autoshop_staff) {
        signOut();
        throw new Error('This account isn’t set up as shop staff. Ask the owner to add you under Team → Staff & access.');
      }
      if (session.pending) {
        setPending(session);
        setStep('code');
        return;
      }
      await proceed(session);
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
      await proceed(sync.session ? { ...sync.session, mustChange: false } : { name: '', mustChange: false });
    } catch (err) {
      setError(err.message || 'Couldn’t save the password');
    } finally {
      setBusy('');
    }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setError('');
    setBusy('Checking the code…');
    try {
      const session = await verifyCode(cfg, pending, factorId, code);
      setPending(null);
      setCode('');
      if (!isStaffSession(session)) throw new Error('This account isn’t set up as shop staff.');
      await proceed(session);
    } catch (err) {
      setCode('');
      setError(/invalid|expired|code/i.test(err.message) ? 'That code didn’t match — try the newest one in your authenticator app.' : err.message || 'Couldn’t check the code');
    } finally {
      setBusy('');
    }
  };

  const titles = { password: 'Choose your password', code: 'Enter your code', enroll: 'Set up two-step sign-in', signin: 'Sign in' };
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={44} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">{titles[step]}</h1>
          <p className="mt-1 text-sm text-ink-3">{state.shop.name} · AutoShop Pro</p>
        </div>
        <div className="card p-5">
          {!cfg ? (
            <p className="text-sm text-ink-2">
              This device isn’t connected to a Shop Cloud. Set it up under <Link to="/settings?tab=cloud" className="link">Settings → Shop Cloud</Link>.
            </p>
          ) : step === 'code' ? (
            <form className="space-y-4" onSubmit={submitCode}>
              <p className="flex items-start gap-2 text-sm text-ink-2">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-ok" />
                Open your authenticator app and enter the 6-digit code for AutoShop Pro.
              </p>
              <input
                className="input h-12 text-center font-mono text-xl tracking-[0.35em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                aria-label="6-digit code"
                autoFocus
              />
              <button type="submit" className="btn-primary btn-lg w-full" disabled={code.length !== 6 || !factorId || Boolean(busy)}>
                {busy ? <Spinner size={15} /> : <ShieldCheck size={15} />} Continue
              </button>
              <button
                type="button"
                className="btn-plain w-full"
                onClick={() => {
                  signOut();
                  setPending(null);
                  setFactorId('');
                  setStep('signin');
                }}
              >
                Use a different account
              </button>
            </form>
          ) : step === 'enroll' ? (
            <div className="space-y-3">
              <p className="text-sm text-ink-2">The shop requires two-step sign-in for your role. It takes a minute and keeps the shop’s data safe if your password is ever guessed or stolen.</p>
              <TwoStepSetup cfg={cfg} issuer={state.shop.name} onDone={(session) => finish(session)} />
            </div>
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
                {(id) => <input id={id} type="email" autoComplete="username" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next" className="input h-10" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus={!email} />}
              </Field>
              <Field label="Password">
                {(id) => <input id={id} type="password" autoComplete="current-password" enterKeyHint="go" className="input h-10" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus={Boolean(email)} />}
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
          Forgot your password or lost your phone? Ask the shop owner to reset it under Team → Staff & access.
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
