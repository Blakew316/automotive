// Settings → Messaging → Email from your shop's address: send customer emails (with PDF estimates
// and invoices) from the shop's own domain through the shop's Resend account, track delivery, and
// get a summary of the day by email.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Check, RefreshCw, Send, Lock, AlertTriangle } from 'lucide-react';
import { useShop, useSync, useAccess, useUI, useEmail } from '../../store/hooks';
import { Spinner, ExternalLink, CopyButton, Toggle } from '../../components/ui';
import Section from './Section';
import { shopEmail, digestSave } from '../../lib/sync/api';

const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: h, label: new Date(2026, 0, 1, h).toLocaleTimeString('en-US', { hour: 'numeric' }) }));
const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';

export default function EmailSettings() {
  const { state } = useShop();
  const sync = useSync();
  const { role } = useAccess();
  const { toast } = useUI();
  const email = useEmail();
  const cfg = sync?.cfg;
  const staff = Boolean(sync?.staff && cfg);
  const owner = role === 'owner';
  const manager = ['owner', 'manager'].includes(role);
  const st = email.status;
  const [busy, setBusy] = useState('');
  const [domainName, setDomainName] = useState('');
  const [digest, setDigest] = useState(null);

  useEffect(() => {
    email.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (st?.digest) setDigest({ ...st.digest, recipientsText: (st.digest.recipients || []).join(', ') });
  }, [st?.digest]);

  const run = async (key, fn, ok) => {
    setBusy(key);
    try {
      await fn();
      if (ok) toast(ok, { tone: 'success' });
      email.refresh();
    } catch (e) {
      toast(e.message || 'That didn’t work', { tone: 'error' });
    } finally {
      setBusy('');
    }
  };

  if (!staff)
    return (
      <Section id="email" icon={Mail} title="Email from your shop’s address">
        <p className="flex items-start gap-2 text-sm text-ink-2">
          <Lock size={15} className="mt-0.5 shrink-0 text-ink-3" />
          Sending email from your own address runs on your Shop Cloud server. Sign in under Settings → Shop Cloud to set it up. Until then, emails open in this device’s Mail app.
        </p>
      </Section>
    );

  const d = st?.domain;
  const verified = d?.status === 'verified';
  const saveDigest = (patch) => {
    const next = { ...digest, ...patch };
    setDigest(next);
    const recipients = String(next.recipientsText || '')
      .split(/[,\s]+/)
      .filter(Boolean);
    return run('digest', () => digestSave(cfg, { enabled: Boolean(next.enabled), hour: Number(next.hour), tz: next.tz || localZone(), recipients }), 'Daily summary saved');
  };

  return (
    <Section
      id="email"
      icon={Mail}
      title="Email from your shop’s address"
      subtitle={email.ready ? `On · sending as ${st.from}` : 'Estimates, invoices and receipts as PDFs, from your own address — with delivery tracking'}
      actions={
        st ? (
          <button className="btn-ghost btn-icon btn-sm" onClick={() => email.refresh()} aria-label="Check again" title="Check again">
            <RefreshCw size={14} />
          </button>
        ) : null
      }
    >
      {!st ? (
        <div className="flex justify-center py-4 text-ink-3">
          <Spinner size={16} />
        </div>
      ) : (
        <div className="space-y-4 text-sm" data-testid="email-settings">
          <ol className="space-y-3">
            <Step n={1} done={st.keySet}>
              Create a free account at <ExternalLink href="https://resend.com">resend.com</ExternalLink> and an API key with “Sending access”, then paste it in <Link to="/settings?tab=keys" className="link">Settings → Keys &amp; AI</Link> with the address to send from (e.g. <span className="font-mono text-xs">Main Street Auto &lt;service@yourshop.com&gt;</span>).
            </Step>
            <Step n={2} done={verified}>
              Prove you own the domain: add these DNS records where your domain is managed (GoDaddy, Google, Cloudflare…).
              {st.error && <div className="mt-1 text-bad">{st.error}</div>}
              {st.configured && d?.status === 'not_added' && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input className="input h-8 w-56" placeholder={d.name || 'yourshop.com'} value={domainName} onChange={(e) => setDomainName(e.target.value)} aria-label="Your email domain" />
                  <button className="btn-primary btn-sm" disabled={!owner || busy === 'add'} onClick={() => run('add', () => shopEmail(cfg, 'addDomain', { name: domainName || d.name }), 'Domain added — now add its DNS records')}>
                    {busy === 'add' ? <Spinner size={13} /> : null} Add {domainName || d.name || 'domain'}
                  </button>
                </div>
              )}
              {d?.records?.length > 0 && (
                <div className="mt-2 overflow-x-auto rounded-[10px] border border-line">
                  <table className="table text-xs" data-testid="dns-records">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Name</th>
                        <th>Value</th>
                        <th className="text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.records.map((r, i) => (
                        <tr key={`${r.type}-${r.name}-${i}`}>
                          <td className="font-mono">{r.type}{r.priority != null ? ` ${r.priority}` : ''}</td>
                          <td>
                            <span className="inline-flex items-center font-mono">
                              {r.name}
                              <CopyButton text={r.name} label={`Copy ${r.type} name`} className="h-6 w-6 px-0" />
                            </span>
                          </td>
                          <td className="max-w-[260px]">
                            <span className="inline-flex max-w-full items-center font-mono">
                              <span className="truncate">{r.value}</span>
                              <CopyButton text={r.value} label={`Copy ${r.type} value`} className="h-6 w-6 shrink-0 px-0" />
                            </span>
                          </td>
                          <td className="text-right">
                            <span className={`pill ${r.status === 'verified' ? 'bg-ok/[0.1] text-ok' : r.status === 'failed' ? 'bg-bad/[0.1] text-bad' : 'bg-warn/[0.12] text-warn'}`}>{r.status === 'verified' ? 'Verified' : r.status === 'failed' ? 'Failed' : 'Waiting'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {d?.id && !verified && (
                <button className="btn-secondary btn-sm mt-2" disabled={!owner || busy === 'verify'} onClick={() => run('verify', () => shopEmail(cfg, 'verifyDomain', { id: d.id }), 'Checking — DNS changes can take a few minutes to an hour')}>
                  {busy === 'verify' ? <Spinner size={13} /> : <RefreshCw size={13} />} Check DNS records
                </button>
              )}
            </Step>
            <Step n={3} done={st.webhookSet}>
              For delivery tracking, add a webhook in Resend (Webhooks → Add endpoint) for <i>delivered, bounced, complained, opened</i> and <i>delivery delayed</i>, pointing at
              <span className="mt-1 flex items-center gap-1 rounded-[8px] bg-fill/[0.08] px-2 py-1">
                <code className="min-w-0 flex-1 truncate font-mono text-xs" data-testid="email-webhook">{st.webhook}</code>
                <CopyButton text={st.webhook} label="Copy webhook URL" />
              </span>
              then paste its signing secret (whsec_…) in Keys &amp; AI.
            </Step>
          </ol>

          {email.ready && manager && (
            <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-ok/30 bg-ok/[0.06] px-3 py-2.5">
              <Check size={15} className="text-ok" />
              <span className="min-w-0 flex-1">Customer emails now come from <b>{st.from}</b>{st.replyTo ? <> and replies go to <b>{st.replyTo}</b></> : null}.</span>
              <button
                className="btn-secondary btn-sm"
                disabled={busy === 'test'}
                onClick={() => run('test', async () => {
                  const r = await shopEmail(cfg, 'test', { to: sync.session?.email, shop: state.shop.name, phone: state.shop.phone, address: state.shop.address });
                  toast(`Test sent to ${r.to}`, { tone: 'success' });
                })}
              >
                {busy === 'test' ? <Spinner size={13} /> : <Send size={13} />} Send me a test
              </button>
            </div>
          )}
          {st.configured && !verified && (
            <p className="flex items-start gap-2 rounded-[10px] bg-warn/[0.08] px-3 py-2 text-xs text-ink-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" />
              Until the domain is verified, emails keep opening in this device’s Mail app so nothing is lost.
            </p>
          )}

          {manager && digest && (
            <div className="rounded-[10px] border border-line px-3 py-3" data-testid="digest-settings">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">Daily summary email</div>
                  <div className="text-xs text-ink-3">Sales, money collected, car count, what’s in the shop, open estimates, receivables, tomorrow’s appointments and anything that needs attention.</div>
                </div>
                <Toggle label="Daily summary email" checked={Boolean(digest.enabled)} disabled={!email.ready || busy === 'digest'} onChange={(v) => saveDigest({ enabled: v, tz: digest.tz || localZone() })} />
              </div>
              {digest.enabled && (
                <div className="mt-3 grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)]">
                  <label className="text-xs text-ink-2">
                    Send at
                    <select className="input mt-1" value={digest.hour} onChange={(e) => saveDigest({ hour: Number(e.target.value) })}>
                      {HOURS.map((h) => (
                        <option key={h.value} value={h.value}>{h.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-ink-2">
                    To (comma-separated)
                    <input className="input mt-1" value={digest.recipientsText} onChange={(e) => setDigest({ ...digest, recipientsText: e.target.value })} onBlur={() => saveDigest({})} placeholder={sync.session?.email || 'you@yourshop.com'} />
                  </label>
                  <p className="text-xs text-ink-3 sm:col-span-2">
                    {digest.tz} time{digest.last_sent ? ` · last sent ${digest.last_sent}` : ''}. The numbers come from whichever owner or manager device was used last today.
                  </p>
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-ink-3">Resend has a free tier (3,000 emails a month when this was written) and paid plans above that. Messages go to customers from your address, replies come to your normal inbox, and each email shows Delivered, Opened or Bounced in the conversation.</p>
        </div>
      )}
    </Section>
  );
}

function Step({ n, done, children }) {
  return (
    <li className="flex gap-2.5">
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-2xs font-semibold ${done ? 'bg-ok text-white' : 'bg-fill/[0.12] text-ink-2'}`}>{done ? <Check size={12} strokeWidth={3} /> : n}</span>
      <div className="min-w-0 flex-1 text-ink-2">{children}</div>
    </li>
  );
}
