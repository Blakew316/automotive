// Settings → Keys & AI: the AI assistant's setup (model, monthly limit, usage) and the shop's
// integration keys. Keys are saved to the shop's server (Supabase Vault) and never come back to
// this screen — only whether each one is set and its last four characters.
import { useEffect, useState } from 'react';
import { Sparkles, KeyRound, Check, Trash2, Lock } from 'lucide-react';
import { useSync, useAccess, useUI } from '../../store/hooks';
import { Card, CardHeader, Field, Spinner } from '../../components/ui';
import { shopSecrets, shopAi } from '../../lib/sync/api';
import { AI_MODELS, KEY_GROUPS, modelValue } from '../../lib/ai';
import { Link } from 'react-router-dom';
import { relTime } from '../../lib/format';

export default function KeysSettings() {
  const sync = useSync();
  const { role } = useAccess();
  const { toast } = useUI();
  const owner = role === 'owner';
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const cfg = sync?.cfg;
  const staff = Boolean(sync?.staff && cfg);

  const [rev, setRev] = useState(0);
  useEffect(() => {
    if (!staff) return undefined;
    let alive = true;
    Promise.all([shopSecrets(cfg, 'list'), shopAi(cfg, { action: 'status' })])
      .then(([list, st]) => {
        if (!alive) return;
        setData(list);
        setStatus(st);
        setError('');
      })
      .catch((e) => alive && setError(e.message || 'Couldn’t load the keys'));
    return () => {
      alive = false;
    };
  }, [cfg, staff, rev]);

  const save = async (name, value) => {
    try {
      await shopSecrets(cfg, value === null ? 'clear' : 'set', { name, value });
      toast(value === null ? 'Removed' : 'Saved', { tone: 'success' });
      setRev((r) => r + 1);
    } catch (e) {
      toast(e.message || 'Couldn’t save', { tone: 'error' });
    }
  };

  if (!staff)
    return (
      <Card className="px-4 py-4 text-sm text-ink-2">
        <Lock size={16} className="mb-2 text-ink-3" />
        Integration keys are kept on your Shop Cloud server. Sign in to Shop Cloud (Settings → Shop Cloud) as the owner to add or change them.
      </Card>
    );
  if (!['owner', 'manager'].includes(role)) return <Card className="px-4 py-4 text-sm text-ink-2">Only the owner or a manager can see integration keys.</Card>;
  if (error) return <Card className="px-4 py-4 text-sm text-bad">{error}</Card>;
  if (!data)
    return (
      <Card className="flex items-center justify-center py-10 text-ink-3">
        <Spinner size={18} />
      </Card>
    );

  const keyOf = (name) => data.keys.find((k) => k.name === name);
  const settings = data.settings || {};

  return (
    <>
      <Card>
        <CardHeader title="AI assistant" icon={Sparkles} subtitle={status?.ready ? `On · ${status.usage || 0} request${status.usage === 1 ? '' : 's'} this month` : 'Add an Anthropic API key below to turn it on'} />
        <div className="space-y-3 px-4 pb-4 text-sm">
          <p className="text-ink-2">
            The assistant drafts customer-friendly explanations of estimates, status texts and replies, writes cause &amp; correction from tech notes, suggests diagnostic plans and summarizes customers. It runs on Claude through your own Anthropic account (billed by Anthropic per use), and only the data on the screen you’re using is sent. Staff always review before anything goes to a customer.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Model">
              {(id) => (
                <select id={id} className="input" value={modelValue(settings.ai_model) || AI_MODELS[0].value} disabled={!owner} onChange={(e) => save('ai_model', e.target.value)}>
                  {AI_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Monthly limit (requests)" hint="Blank for no limit">
              {(id) => <CapInput id={id} value={settings.ai_monthly_cap || ''} disabled={!owner} onSave={(v) => save('ai_monthly_cap', v ? String(v) : null)} />}
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Integration keys" icon={KeyRound} subtitle="Stored encrypted on your Shop Cloud server · never shown again after saving" />
        <div className="divide-y divide-line/70">
          {KEY_GROUPS.map((g) => (
            <div key={g.title} className="px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                {g.title}
                {!g.keys.some((k) => k.ready) && <span className="rounded-full bg-fill/[0.08] px-2 py-0.5 text-2xs font-medium text-ink-3">Used when this integration is turned on</span>}
                {g.setup && g.keys.every((k) => k.auto || k.optional || keyOf(k.name)) && (
                  <Link to={g.setup.to} className="link ml-auto text-xs font-normal">{g.setup.label}</Link>
                )}
              </div>
              <div className="space-y-2.5">
                {g.keys.map((k) => (
                  <KeyRow key={k.name} def={k} current={keyOf(k.name)} value={k.setting ? settings[k.name] : undefined} owner={owner} onSave={(v) => save(k.name, v)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function CapInput({ id, value, disabled, onSave }) {
  const [v, setV] = useState(value);
  return (
    <input
      id={id}
      inputMode="numeric"
      className="input"
      value={v}
      disabled={disabled}
      onChange={(e) => setV(e.target.value.replace(/\D/g, ''))}
      onBlur={() => v !== value && onSave(Number(v) || null)}
      placeholder="No limit"
    />
  );
}

function KeyRow({ def, current, value, owner, onSave }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    await onSave(draft.trim());
    setDraft('');
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
      <div>
        <div className="text-sm">{def.label}</div>
        <div className="text-xs text-ink-3">
          {current ? (
            <span className="inline-flex items-center gap-1 text-ok">
              <Check size={11} /> {value != null ? value : current.hint ? `Set · ••••${current.hint}` : 'Set'}
              <span className="text-ink-3">· {relTime(current.updatedAt)}</span>
            </span>
          ) : (
            'Not set'
          )}
        </div>
      </div>
      {owner ? (
        <div className="flex gap-1.5">
          <input type={def.setting ? 'text' : 'password'} autoComplete="off" className="input" placeholder={current ? 'Replace…' : def.hint} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={def.label} />
          <button className="btn-secondary shrink-0" disabled={!draft.trim() || busy}>{busy ? <Spinner size={13} /> : 'Save'}</button>
          {current && (
            <button type="button" className="btn-ghost btn-icon shrink-0 text-ink-3 hover:text-bad" onClick={() => onSave(null)} aria-label={`Remove ${def.label}`}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-ink-3">{def.hint}</p>
      )}
    </form>
  );
}
