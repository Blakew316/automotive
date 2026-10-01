import { useState } from 'react';
import { Cloud, LogIn, LogOut, PlugZap, Download, FileClock, Copy, Check } from 'lucide-react';
import { useShop, useUI } from '../../store/hooks';
import { Card, CardHeader, Field, InlineText, Spinner, ExternalLink } from '../../components/ui';
import { cloudConfig, cloudSession, signIn, signOut, testConnection } from '../../lib/cloudShare';
import { serviceHistory, toCsv, HISTORY_COLUMNS } from '../../lib/serviceHistory';
import { isoDate, addDays, number } from '../../lib/format';

const policySql = (bucket) => `-- Run once in Supabase → SQL Editor. Lets signed-in shop staff manage files in the
-- "${bucket}" bucket; customers read them through public links only.
create policy "Shop staff can upload" on storage.objects
  for insert to authenticated with check (bucket_id = '${bucket}');
create policy "Shop staff can replace" on storage.objects
  for update to authenticated using (bucket_id = '${bucket}');
create policy "Shop staff can read" on storage.objects
  for select to authenticated using (bucket_id = '${bucket}');
create policy "Shop staff can delete" on storage.objects
  for delete to authenticated using (bucket_id = '${bucket}');`;

export function SharingSection() {
  const { state, updateShop } = useShop();
  const { toast } = useUI();
  const cloud = state.shop.cloud || {};
  const cfg = cloudConfig(state.shop);
  const [session, setSession] = useState(cloudSession);
  const [email, setEmail] = useState(session?.email || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const bucket = cloud.bucket || 'shop-media';
  const signedIn = Boolean(cfg && session && session.url === cfg.url);
  const set = (k) => ({ value: cloud[k] || '', onCommit: (v) => updateShop({ cloud: { bucket: 'shop-media', ...cloud, [k]: v.trim() } }) });

  const run = async (label, fn) => {
    setError('');
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      setError(e.message || 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card id="sharing" className="scroll-mt-6">
      <CardHeader icon={Cloud} title="Photo & video sharing" subtitle="Text customers a link to their vehicle report, photos and video" />
      <div className="space-y-4 p-4">
        <p className="text-sm text-ink-2">
          Photos are always kept on this device. To send links that open on a customer’s phone, connect your shop’s own{' '}
          <ExternalLink href="https://supabase.com/dashboard">Supabase</ExternalLink> storage (free tier available). Reports are published to unguessable links that you can update or turn off.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Project URL" className="sm:col-span-2" hint="Supabase → Project Settings → API, e.g. https://abcd1234.supabase.co">
            {(id) => <InlineText id={id} className="input font-mono text-sm" placeholder="https://xxxxxxxx.supabase.co" {...set('url')} />}
          </Field>
          <Field label="Anon / publishable key" hint="The public key — never the service-role key">
            {(id) => <InlineText id={id} className="input font-mono text-sm" placeholder="eyJhbGciOi…" {...set('key')} />}
          </Field>
          <Field label="Storage bucket" hint="A public bucket">
            {(id) => <InlineText id={id} className="input font-mono text-sm" placeholder="shop-media" value={cloud.bucket || ''} onCommit={(v) => updateShop({ cloud: { ...cloud, bucket: v.trim() || 'shop-media' } })} />}
          </Field>
        </div>

        {cfg && (
          <div className="rounded-[10px] border border-line p-3">
            {signedIn ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1 text-sm text-ink-2">
                  Signed in as <span className="font-medium text-ink">{session.email}</span> on this device.
                </span>
                <button className="btn-secondary btn-sm" disabled={Boolean(busy)} onClick={() => run('Testing…', async () => (await testConnection(cfg), toast('Connected — uploads and public links work', { tone: 'success' })))}>
                  <PlugZap size={13} /> Test
                </button>
                <button
                  className="btn-plain btn-sm"
                  onClick={() => {
                    signOut();
                    setSession(null);
                  }}
                >
                  <LogOut size={13} /> Sign out
                </button>
              </div>
            ) : (
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run('Signing in…', async () => {
                    setSession(await signIn(cfg, email.trim(), password));
                    setPassword('');
                    toast('Signed in', { tone: 'success' });
                  });
                }}
              >
                <Field label="Staff email" className="min-w-[200px] flex-1">
                  {(id) => <input id={id} type="email" autoComplete="username" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />}
                </Field>
                <Field label="Password" className="min-w-[160px] flex-1">
                  {(id) => <input id={id} type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />}
                </Field>
                <button type="submit" className="btn-primary" disabled={!email || !password || Boolean(busy)}>
                  <LogIn size={14} /> Sign in
                </button>
              </form>
            )}
            {busy && (
              <p className="mt-2 flex items-center gap-2 text-sm text-ink-2">
                <Spinner size={13} /> {busy}
              </p>
            )}
            {error && <p className="mt-2 text-sm text-bad">{error}</p>}
          </div>
        )}

        <details className="rounded-[10px] border border-line px-3 py-2.5 text-sm">
          <summary className="cursor-pointer select-none font-medium">One-time setup (about 5 minutes)</summary>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink-2">
            <li>Create a project at supabase.com. In Project Settings → API, copy the Project URL and the anon (publishable) key into the fields above.</li>
            <li>
              Storage → New bucket → name it <code className="rounded bg-fill/[0.1] px-1 font-mono text-xs">{bucket}</code> and turn on <b>Public bucket</b>. Set the file size limit
              high enough for your videos (the free plan allows up to 50 MB per file).
            </li>
            <li>Authentication → Users → Add user with a staff email and password (auto-confirm). Then turn off “Allow new users to sign up” so only your staff accounts exist.</li>
            <li>
              SQL Editor → run:
              <div className="relative mt-2">
                <pre className="overflow-x-auto rounded-[8px] bg-fill/[0.08] p-3 font-mono text-[11.5px] leading-5 text-ink">{policySql(bucket)}</pre>
                <button
                  className="btn-secondary btn-sm absolute right-2 top-2"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(policySql(bucket));
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch {
                      // Select and copy manually.
                    }
                  }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </li>
            <li>Sign in above on each computer or tablet that publishes reports, then press Test.</li>
          </ol>
          <p className="mt-3 text-xs text-ink-3">
            Only photos and video marked “Customer can see” are uploaded. Links use random 22-character IDs; anyone who has a link can view that report, so treat links like a
            photo you text to the customer.
          </p>
        </details>
      </div>
    </Card>
  );
}

export function HistorySection() {
  const { state } = useShop();
  const { toast } = useUI();
  const [from, setFrom] = useState(() => isoDate(addDays(new Date(), -30)));
  const [to, setTo] = useState(() => isoDate(new Date()));
  const { rows, orders, missing } = serviceHistory(state, { from, to });

  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([toCsv(HISTORY_COLUMNS, rows)], { type: 'text/csv' }));
    a.download = `service-history-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`Exported ${number(rows.length)} service records`, { tone: 'success' });
  };

  return (
    <Card id="history" className="scroll-mt-6">
      <CardHeader icon={FileClock} title="Vehicle history reporting (CARFAX)" subtitle="Get your completed work onto vehicle history reports" />
      <div className="space-y-4 p-4 text-sm text-ink-2">
        <p>
          CARFAX doesn’t take uploads from individual shops directly. Service records reach CARFAX Reports through a data connection set up when a shop joins its free service-shop
          program; supported shop systems send each closed repair order automatically, tied to the VIN.
        </p>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            Enroll your shop in the free CARFAX Car Care service-shop program at <ExternalLink href="https://www.carfaxserviceshops.com/">carfaxserviceshops.com</ExternalLink>.
          </li>
          <li>Tell their onboarding team you use your own shop software and ask how they want to receive your records. The export below has the fields a history record needs.</li>
          <li>Record the VIN and odometer on every RO — repair orders without a VIN can’t be matched to a vehicle history.</li>
        </ol>
        <div className="flex flex-wrap items-end gap-3 rounded-[10px] border border-line p-3">
          <Field label="From">{(id) => <input id={id} type="date" className="input h-8 w-auto py-0" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />}</Field>
          <Field label="To">{(id) => <input id={id} type="date" className="input h-8 w-auto py-0" value={to} min={from} onChange={(e) => setTo(e.target.value)} />}</Field>
          <button className="btn-secondary" disabled={!rows.length} onClick={download}>
            <Download size={14} /> Export service history (CSV)
          </button>
          <p className="w-full text-xs text-ink-3">
            {number(orders)} invoiced RO{orders === 1 ? '' : 's'} · {number(rows.length)} service record{rows.length === 1 ? '' : 's'}
            {missing.vin ? ` · ${missing.vin} skipped without a VIN` : ''}
            {missing.mileage ? ` · ${missing.mileage} missing odometer` : ''}
          </p>
        </div>
      </div>
    </Card>
  );
}
