// Accounting → QuickBooks & exports → QuickBooks Online: connect the shop's QuickBooks company
// (through the shop's own Intuit app), choose which QuickBooks account each line of the daily sales
// journal posts to, and post days — by hand for any period, or automatically every day.
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Landmark, Lock, Check, AlertTriangle, RefreshCw, Unplug, Send, ChevronDown, ChevronUp, FlaskConical } from 'lucide-react';
import { useShop, useSync, useAccess, useUI } from '../../store/hooks';
import { Card, CardHeader, Segmented, Spinner, Toggle, ExternalLink, CopyButton } from '../../components/ui';
import { shopQbo } from '../../lib/sync/api';
import { JOURNAL_ACCOUNTS, suggestAccountMap } from '../../lib/accounting';
import { QBO_ENVS, AUTO_DAYS, journalsFor, unmappedAccounts, postJournals, resultLine } from '../../lib/quickbooks';
import { relTime } from '../../lib/format';

const STATUS_CHIP = {
  created: ['border-ok/40 bg-ok/[0.08] text-ok', 'Posted'],
  updated: ['border-accent/30 bg-accent/[0.06] text-accent', 'Updated'],
  unchanged: ['border-line text-ink-3', 'Up to date'],
  empty: ['border-line text-ink-3', 'Nothing to post'],
  error: ['border-bad/40 bg-bad/[0.07] text-bad', 'Didn’t post'],
};

export default function QuickBooksSync({ from, to, label }) {
  const { state, updateShop } = useShop();
  const sync = useSync();
  const { role } = useAccess();
  const { toast } = useUI();
  const [params, setParams] = useSearchParams();
  const cfg = sync?.cfg;
  const staff = Boolean(sync?.staff && cfg);
  const owner = role === 'owner';
  const allowed = ['owner', 'manager'].includes(role);
  const qbo = state.shop.qbo || {};

  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [rev, setRev] = useState(0);
  const [env, setEnv] = useState('sandbox');
  const [busy, setBusy] = useState('');
  const [accounts, setAccounts] = useState(null);
  const [draft, setDraft] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [results, setResults] = useState(null);

  // Back from Intuit's sign-in.
  const back = params.get('qbo');
  useEffect(() => {
    if (!back) return;
    if (back === 'connected') toast('QuickBooks connected', { tone: 'success' });
    else toast(params.get('message') || 'QuickBooks wasn’t connected', { tone: 'error' });
    setParams({ tab: 'export' }, { replace: true });
    setRev((r) => r + 1);
  }, [back, params, setParams, toast]);

  useEffect(() => {
    if (!staff || !allowed) return undefined;
    let alive = true;
    shopQbo(cfg, 'status')
      .then((st) => {
        if (!alive) return;
        setStatus(st);
        setLoadError('');
        if (st.env) setEnv(st.env);
      })
      .catch((e) => alive && setLoadError(e.message || 'Couldn’t reach QuickBooks'));
    return () => {
      alive = false;
    };
  }, [cfg, staff, allowed, rev]);

  const connected = Boolean(status?.connected && !status?.error);
  useEffect(() => {
    if (!connected) return undefined;
    let alive = true;
    shopQbo(cfg, 'accounts')
      .then((r) => alive && setAccounts(r.accounts || []))
      .catch((e) => alive && toast(e.message || 'Couldn’t load your QuickBooks accounts', { tone: 'error' }));
    return () => {
      alive = false;
    };
  }, [connected, cfg, toast]);

  const saved = useMemo(() => qbo.map || {}, [qbo.map]);
  const suggested = useMemo(() => (accounts ? suggestAccountMap(accounts, saved) : null), [accounts, saved]);
  const map = draft || suggested || saved;
  const dirty = Boolean(accounts) && JSON.stringify(map) !== JSON.stringify(saved);
  const journals = useMemo(() => journalsFor(state, from, to), [state, from, to]);
  const missing = unmappedAccounts(journals, saved);
  // Open the mapping when nothing's been chosen yet.
  useEffect(() => {
    if (accounts && !Object.keys(saved).length) setShowMap(true);
  }, [accounts, saved]);

  const connect = async () => {
    setBusy('connect');
    try {
      const r = await shopQbo(cfg, 'authorize', { env, returnUrl: `${window.location.origin}${window.location.pathname}?tab=export` });
      window.location.assign(r.url);
    } catch (e) {
      toast(e.message || 'Couldn’t start connecting', { tone: 'error' });
      setBusy('');
    }
  };
  const disconnect = async () => {
    if (!window.confirm('Disconnect QuickBooks? Entries already posted stay in QuickBooks.')) return;
    setBusy('disconnect');
    try {
      await shopQbo(cfg, 'disconnect');
      updateShop({ qbo: { ...qbo, auto: false } });
      setAccounts(null);
      setResults(null);
      toast('QuickBooks disconnected', { tone: 'success' });
      setRev((r) => r + 1);
    } catch (e) {
      toast(e.message || 'Couldn’t disconnect', { tone: 'error' });
    } finally {
      setBusy('');
    }
  };
  const saveMap = () => {
    updateShop({ qbo: { ...qbo, map } });
    setDraft(null);
    toast('Account mapping saved', { tone: 'success' });
  };
  const post = async () => {
    setBusy('post');
    setResults(null);
    try {
      const r = await postJournals(cfg, journals, saved);
      setResults(r.results);
      toast(resultLine(r), { tone: r.errors ? 'error' : 'success' });
    } catch (e) {
      toast(e.message || 'Couldn’t post to QuickBooks', { tone: 'error' });
    } finally {
      setBusy('');
    }
  };

  const header = (subtitle, actions) => <CardHeader title="QuickBooks Online" icon={Landmark} subtitle={subtitle} actions={actions} />;

  if (!staff)
    return (
      <Card>
        {header('Post your daily sales straight to QuickBooks')}
        <p className="flex items-start gap-2 px-4 pb-4 text-sm text-ink-2">
          <Lock size={15} className="mt-0.5 shrink-0 text-ink-3" />
          Direct posting runs on your Shop Cloud server. Sign in under Settings → Shop Cloud to set it up — or use the CSV exports below with any version of QuickBooks.
        </p>
      </Card>
    );
  if (!allowed)
    return (
      <Card>
        {header('Post your daily sales straight to QuickBooks')}
        <p className="px-4 pb-4 text-sm text-ink-2">Only the owner or a manager can work with QuickBooks.</p>
      </Card>
    );
  if (loadError)
    return (
      <Card>
        {header('Post your daily sales straight to QuickBooks')}
        <p className="px-4 pb-4 text-sm text-bad">{loadError}</p>
      </Card>
    );
  if (!status)
    return (
      <Card>
        {header('Checking the connection…')}
        <div className="flex justify-center py-6 text-ink-3">
          <Spinner size={18} />
        </div>
      </Card>
    );

  // ---------------------------------------------------------------- Not set up yet
  if (!status.configured || !status.connected)
    return (
      <Card data-testid="qbo-card">
        {header(status.configured ? 'Keys saved — connect your company' : 'Post your daily sales straight to QuickBooks — about 10 minutes to set up')}
        <div className="space-y-3 px-4 pb-4 text-sm">
          <ol className="space-y-2.5">
            <Step n={1} done={status.configured}>
              Create a free app at <ExternalLink href="https://developer.intuit.com/app/developer/dashboard">developer.intuit.com</ExternalLink> and give it the <b>Accounting</b> scope.
            </Step>
            <Step n={2} done={status.configured}>
              Under <b>Keys &amp; credentials → Redirect URIs</b> (development and production), add:
              <span className="mt-1 flex items-center gap-1 rounded-[8px] bg-fill/[0.08] px-2 py-1">
                <code className="min-w-0 flex-1 truncate font-mono text-xs" data-testid="qbo-redirect">{status.redirectUri}</code>
                <CopyButton text={status.redirectUri} label="Copy redirect URI" />
              </span>
            </Step>
            <Step n={3} done={status.configured}>
              Paste its Client ID and Client secret in <Link to="/settings?tab=keys" className="link">Settings → Keys &amp; AI</Link>.
            </Step>
            <Step n={4} done={false}>
              {status.configured ? (
                owner ? (
                  <div className="space-y-2">
                    <div>Choose the company to connect, then sign in to QuickBooks and approve.</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Segmented size="sm" options={QBO_ENVS} value={env} onChange={setEnv} />
                      <button className="btn-primary btn-sm" onClick={connect} disabled={busy === 'connect'}>
                        {busy === 'connect' ? <Spinner size={13} /> : <Landmark size={13} />} Connect to QuickBooks
                      </button>
                    </div>
                  </div>
                ) : (
                  'Ask the owner to connect the QuickBooks company here.'
                )
              ) : (
                'Connect your company here.'
              )}
            </Step>
          </ol>
          <p className="rounded-[10px] bg-fill/[0.06] px-3 py-2 text-xs text-ink-3">
            A new Intuit app’s development keys connect to a free sandbox company right away — good for a trial run. To connect your real company, Intuit has you fill in its production-keys questionnaire for the app (a privacy policy and terms link, and how the app uses data), then switch to the production keys. The CSV exports below work with any QuickBooks meanwhile.
          </p>
        </div>
      </Card>
    );

  // ---------------------------------------------------------------- Connected
  const last = qbo.lastAuto;
  return (
    <Card data-testid="qbo-card">
      {header(
        status.error ? 'Needs to be connected again' : `Connected${status.company ? ` · ${status.company}` : ''} · ${status.env === 'production' ? 'live company' : 'sandbox'}`,
        owner ? (
          <button className="btn-plain btn-sm" onClick={disconnect} disabled={busy === 'disconnect'}>
            {busy === 'disconnect' ? <Spinner size={13} /> : <Unplug size={13} />} Disconnect
          </button>
        ) : null,
      )}
      <div className="space-y-4 px-4 pb-4 text-sm">
        {status.error && (
          <div className="flex flex-wrap items-center gap-2 rounded-[10px] bg-bad/[0.07] px-3 py-2 text-bad">
            <AlertTriangle size={15} className="shrink-0" />
            <span className="min-w-0 flex-1">{status.error}</span>
            {owner && (
              <button className="btn-secondary btn-sm" onClick={connect} disabled={busy === 'connect'}>
                <RefreshCw size={13} /> Reconnect
              </button>
            )}
          </div>
        )}
        {status.env !== 'production' && !status.error && (
          <p className="flex items-start gap-2 rounded-[10px] border border-warn/40 bg-warn/[0.07] px-3 py-2">
            <FlaskConical size={15} className="mt-0.5 shrink-0 text-warn" />
            <span>This is a sandbox company — entries here don’t touch your real books. When your Intuit app has production keys, save them in Keys &amp; AI, disconnect, and connect “My real company”.</span>
          </p>
        )}

        {connected && (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">Post daily sales for {label}</div>
                <div className="text-xs text-ink-3">
                  {journals.length ? `${journals.length} day${journals.length === 1 ? '' : 's'} with sales or payments · one journal entry per day (SALES-YYYYMMDD) · posting again updates them` : 'No sales or payments in this period'}
                </div>
                {missing.length > 0 && <div className="mt-1 text-xs text-bad">Choose QuickBooks accounts for: {missing.join(', ')}</div>}
              </div>
              <button className="btn-primary btn-sm" onClick={post} disabled={busy === 'post' || !journals.length || missing.length > 0 || dirty}>
                {busy === 'post' ? <Spinner size={13} /> : <Send size={13} />} Post to QuickBooks
              </button>
            </div>

            {results && (
              <ul className="max-h-72 divide-y divide-line/70 overflow-y-auto rounded-[10px] border border-line" data-testid="qbo-results">
                {results.map((r) => (
                  <li key={r.no} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
                    <span className="font-mono text-xs">{r.no}</span>
                    <span className={`chip ${STATUS_CHIP[r.status]?.[0] || ''}`}>{STATUS_CHIP[r.status]?.[1] || r.status}</span>
                    {r.error && <span className="w-full text-xs text-bad sm:w-auto">{r.error}</span>}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-start gap-3">
              <Toggle label="Post automatically every day" checked={Boolean(qbo.auto)} disabled={missing.length > 0 && !qbo.auto} onChange={(v) => updateShop({ qbo: { ...qbo, auto: v, lastAuto: v ? qbo.lastAuto : undefined } })} />
              <div className="min-w-0 flex-1">
                <div className="font-medium">Post automatically every day</div>
                <p className="text-xs text-ink-3">
                  Each day, the first owner or manager device that’s open posts the last {AUTO_DAYS} days through yesterday — so late payments and edits are picked up.
                  {qbo.auto && last && (
                    <span className={`block ${last.ok ? '' : 'text-bad'}`} data-testid="qbo-last">
                      Last run {relTime(last.at)}{last.by ? ` by ${last.by}` : ''}: {last.summary}
                      {last.error ? ` — ${last.error}` : ''}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="rounded-[10px] border border-line">
              <button className="flex w-full items-center gap-2 px-3 py-2.5 text-left" onClick={() => setShowMap((v) => !v)} aria-expanded={showMap}>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Account mapping</span>
                  <span className="block text-xs text-ink-3">{Object.keys(saved).length ? `${Object.keys(saved).length} of ${JOURNAL_ACCOUNTS.length} accounts chosen` : 'Choose where each line posts in your chart of accounts'}</span>
                </span>
                {showMap ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {showMap && (
                <div className="border-t border-line/70 px-3 py-3">
                  {!accounts ? (
                    <div className="flex justify-center py-4 text-ink-3">
                      <Spinner size={16} />
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] sm:items-center">
                        {JOURNAL_ACCOUNTS.map((a) => (
                          <MapRow key={a.name} def={a} accounts={accounts} value={map[a.name]?.id || ''} isNew={!saved[a.name] && Boolean(map[a.name])} onChange={(id) => setDraft({ ...map, [a.name]: id ? { id, name: accounts.find((x) => x.id === id)?.name } : undefined })} />
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-ink-3">Suggestions come from your chart of accounts — check them before saving. Lines a day doesn’t use (e.g. no tips) can be left blank. If QuickBooks manages your sales tax and won’t take journal lines on its own sales-tax account, map Sales Tax Payable to a separate liability account (e.g. “Sales tax collected”) and have your accountant clear it when you file.</p>
                      <div className="mt-3 flex justify-end gap-2">
                        {dirty && (
                          <button className="btn-plain btn-sm" onClick={() => setDraft(saved)}>
                            Undo
                          </button>
                        )}
                        <button className="btn-primary btn-sm" onClick={saveMap} disabled={!dirty}>
                          <Check size={13} /> Save mapping
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-ink-3">
              Sales post on the invoice date (accrual): receivables, income by type, discounts and sales tax. Payments post on the day received to Undeposited Funds with tips and surcharges; Stripe’s fee is booked to card processing fees so deposits match the bank. Lines on receivables use a customer named “AutoShop Pro daily sales”.
            </p>
          </>
        )}
      </div>
    </Card>
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

function MapRow({ def, accounts, value, isNew, onChange }) {
  const fits = accounts.filter((x) => def.types.includes(x.type));
  const rest = accounts.filter((x) => !def.types.includes(x.type));
  const id = `qbo-map-${def.name.replace(/\W+/g, '-')}`;
  const opt = (x) => (
    <option key={x.id} value={x.id}>
      {x.number ? `${x.number} · ` : ''}
      {x.name}
    </option>
  );
  return (
    <>
      <label htmlFor={id} className="flex items-center gap-1.5 text-sm">
        {def.name}
        {isNew && <span className="rounded-full bg-accent/[0.08] px-1.5 text-2xs font-medium text-accent">Suggested</span>}
      </label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Not mapped —</option>
        {fits.length > 0 && <optgroup label={def.types.join(' / ')}>{fits.map(opt)}</optgroup>}
        {rest.length > 0 && <optgroup label="Other accounts">{rest.map(opt)}</optgroup>}
      </select>
    </>
  );
}
