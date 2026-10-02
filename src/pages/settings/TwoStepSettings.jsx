// Settings → Shop Cloud → Two-step sign-in: each person can protect their login with an
// authenticator app, and the owner can require it for roles that can see money and keys.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ShieldOff, Shield } from 'lucide-react';
import { useShop, useSync, useAccess, useUI } from '../../store/hooks';
import { Spinner, Toggle } from '../../components/ui';
import Section from './Section';
import TwoStepSetup from '../../components/TwoStepSetup';
import { twoStepFactors, removeAuthenticator, cloudSession } from '../../lib/cloudShare';
import { mfaPolicy, setMfaPolicy } from '../../lib/sync/api';
import { ROLES } from '../../lib/access';
import { dateShort } from '../../lib/format';

const POLICY_ROLES = ['owner', 'manager', 'advisor', 'tech'];

export default function TwoStepSettings() {
  const { state } = useShop();
  const sync = useSync();
  const { role } = useAccess();
  const { toast } = useUI();
  const cfg = sync?.cfg;
  const staff = Boolean(sync?.staff && cfg);
  const [factors, setFactors] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [setup, setSetup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    if (!staff) return undefined;
    let alive = true;
    Promise.all([twoStepFactors(cfg, cloudSession()), mfaPolicy(cfg)])
      .then(([f, p]) => {
        if (!alive) return;
        setFactors(f);
        setPolicy(p);
      })
      .catch(() => alive && setFactors([]));
    return () => {
      alive = false;
    };
  }, [staff, cfg, rev]);

  if (!staff) return null;
  const on = factors?.length > 0;
  const owner = role === 'owner';

  const turnOff = async () => {
    if (!window.confirm('Turn off two-step sign-in for your login? Anyone with your password could then sign in.')) return;
    setBusy(true);
    try {
      for (const f of factors) await removeAuthenticator(cfg, f.id);
      toast('Two-step sign-in is off for your login');
      setRev((r) => r + 1);
    } catch (e) {
      toast(e.message || 'Couldn’t turn it off', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const setRequired = async (r, required) => {
    const next = required ? [...new Set([...(policy || []), r])] : (policy || []).filter((x) => x !== r);
    setBusy(true);
    try {
      setPolicy(await setMfaPolicy(cfg, next));
      toast(required ? `${ROLES[r]?.label || r}s must now use two-step sign-in` : `Two-step sign-in is optional for ${(ROLES[r]?.label || r).toLowerCase()}s`, { tone: 'success' });
    } catch (e) {
      toast(e.message || 'Couldn’t change that', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section id="two-step" icon={ShieldCheck} title="Two-step sign-in" subtitle="A code from an authenticator app on your phone, as well as your password">
      {factors === null ? (
        <div className="flex justify-center py-3 text-ink-3">
          <Spinner size={16} />
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          {setup ? (
            <div className="mx-auto max-w-sm">
              <TwoStepSetup
                cfg={cfg}
                issuer={state.shop.name}
                onCancel={() => setSetup(false)}
                onDone={() => {
                  setSetup(false);
                  toast('Two-step sign-in is on — you’ll enter a code when you sign in on a new device', { tone: 'success' });
                  setRev((r) => r + 1);
                }}
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line px-3 py-2.5" data-testid="two-step-status">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${on ? 'bg-ok/10 text-ok' : 'bg-fill/[0.1] text-ink-3'}`}>{on ? <ShieldCheck size={17} /> : <Shield size={17} />}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{on ? 'On for your login' : 'Off for your login'}</div>
                <div className="text-xs text-ink-3">
                  {on ? `Authenticator app added ${dateShort(factors[0].created_at)} · you’ll enter a code when signing in on a new device` : 'Recommended for anyone who can see the books, take refunds or change keys'}
                </div>
              </div>
              {on ? (
                <button className="btn-plain btn-sm text-bad" onClick={turnOff} disabled={busy}>
                  <ShieldOff size={13} /> Turn off
                </button>
              ) : (
                <button className="btn-primary btn-sm" onClick={() => setSetup(true)}>
                  <ShieldCheck size={13} /> Set up
                </button>
              )}
            </div>
          )}

          {owner && policy && (
            <div>
              <div className="mb-1.5 font-medium">Require it for</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {POLICY_ROLES.map((r) => (
                  <label key={r} className="flex items-center justify-between gap-3 rounded-[8px] border border-line px-3 py-2">
                    <span>{ROLES[r]?.label || r}s</span>
                    <Toggle label={`Require two-step sign-in for ${ROLES[r]?.label || r}s`} checked={policy.includes(r)} disabled={busy || (r === 'owner' && !on && !policy.includes(r))} onChange={(v) => setRequired(r, v)} />
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-3">
                People in these roles set it up at their next sign-in and can’t reach the shop’s data until they do. See who has it on under <Link to="/team?tab=access" className="link">Team → Staff & access</Link>, where you can also reset it for someone who lost their phone.
                {!on && ' Turn it on for yourself first to require it for owners.'}
              </p>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
