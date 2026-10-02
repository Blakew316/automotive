// Set up two-step sign-in: scan a QR code with an authenticator app (Google Authenticator, Microsoft
// Authenticator, 1Password, Authy…), then type the 6-digit code it shows to confirm.
import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Spinner, CopyButton } from './ui';
import QrCode from './QrCode';
import { enrollAuthenticator, verifyCode, cloudSession } from '../lib/cloudShare';

export default function TwoStepSetup({ cfg, issuer, onDone, onCancel }) {
  const [factor, setFactor] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    enrollAuthenticator(cfg, issuer)
      .then((f) => alive && setFactor(f))
      .catch((e) => alive && setError(e.message || 'Couldn’t start setup'));
    return () => {
      alive = false;
    };
  }, [cfg, issuer]);

  const confirm = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const session = await verifyCode(cfg, cloudSession(), factor.id, code);
      onDone?.(session);
    } catch (err) {
      setError(/invalid|expired|code/i.test(err.message) ? 'That code didn’t match — check the time on your phone and try the newest code.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!factor)
    return error ? <p className="text-sm text-bad">{error}</p> : (
      <div className="flex justify-center py-6 text-ink-3">
        <Spinner size={18} />
      </div>
    );

  return (
    <form className="space-y-4" onSubmit={confirm} data-testid="two-step-setup">
      <ol className="space-y-3 text-sm text-ink-2">
        <li>
          <span className="font-medium text-ink">1. Scan this with your authenticator app</span> — Google Authenticator, Microsoft Authenticator, 1Password, Authy or your phone’s built-in password app.
        </li>
      </ol>
      <div className="flex flex-col items-center gap-2">
        <span className="rounded-[12px] bg-white p-2 shadow-card">
          <QrCode text={factor.uri} size={168} label="Two-step sign-in QR code" />
        </span>
        <details className="w-full text-xs text-ink-3">
          <summary className="cursor-pointer text-center">Can’t scan? Type this key instead</summary>
          <div className="mt-2 flex items-center gap-1 rounded-[8px] bg-fill/[0.08] px-2 py-1">
            <code className="min-w-0 flex-1 break-all font-mono text-xs" data-testid="two-step-secret">{factor.secret}</code>
            <CopyButton text={factor.secret} label="Copy key" />
          </div>
        </details>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-ink">2. Enter the 6-digit code it shows</span>
        <input
          className="input mt-1.5 h-11 text-center font-mono text-lg tracking-[0.3em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          aria-label="6-digit code"
          autoFocus
        />
      </label>
      {error && <p className="text-sm text-bad">{error}</p>}
      <div className="flex gap-2">
        {onCancel && (
          <button type="button" className="btn-secondary flex-1" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn-primary flex-1" disabled={code.length !== 6 || busy}>
          {busy ? <Spinner size={14} /> : <ShieldCheck size={15} />} Turn on
        </button>
      </div>
    </form>
  );
}
