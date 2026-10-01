// The AI assistant panel: pick a task (explain the estimate, draft a text, diagnostic ideas, cause &
// correction, customer summary, reply, or ask anything), see the answer, then copy it or put it to
// work — in a message, a note, or a service's cause & correction. Answers come from Claude through
// the shop's own server function; nothing is sent until a task is run.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Sparkles, X, Copy, Check, MessageSquare, StickyNote, Wrench, RotateCcw, CircleAlert } from 'lucide-react';
import { useShop, useSync, useAccess } from '../store/hooks';
import { Spinner } from './ui';
import { shopAi } from '../lib/sync/api';
import { AI_TASKS, parseStory } from '../lib/ai';

export default function AiAssistant({ title, subtitle, tasks, buildContext, services = [], onUseMessage, onSaveNote, onApplyStory, onClose }) {
  const { state } = useShop();
  const sync = useSync();
  const { role } = useAccess();
  const [task, setTask] = useState(tasks[0]);
  const [prompt, setPrompt] = useState('');
  const [serviceId, setServiceId] = useState(services[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const ready = Boolean(sync?.staff && sync?.cfg);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const context = buildContext(task, { serviceId });
      const r = await shopAi(sync.cfg, { task, context, prompt: task === 'ask' ? prompt.trim() : '', shop: state.shop.name });
      setResult({ task, text: r.text, model: r.model });
    } catch (e) {
      setError({ message: e.message || 'The assistant couldn’t answer', setup: e.status === 412 });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — the text is selectable.
    }
  };

  const use = result && AI_TASKS[result.task]?.use;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="AI assistant">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-[440px] animate-slide-in flex-col bg-surface shadow-sheet">
        <header className="flex items-start gap-3 border-b border-line px-4 py-3.5">
          <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-[9px] bg-accent/[0.1] text-accent">
            <Sparkles size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{title || 'Assistant'}</h2>
            <p className="truncate text-xs text-ink-3">{subtitle || 'Claude, through your shop’s Anthropic key'}</p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon h-8 w-8" aria-label="Close assistant">
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {!ready ? (
            <p className="rounded-[10px] border border-line bg-raised px-3 py-3 text-sm text-ink-2">Sign in to Shop Cloud on this device to use the assistant (Settings → Shop Cloud).</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Task">
                {tasks.map((t) => (
                  <button key={t} role="radio" aria-checked={task === t} onClick={() => setTask(t)} className={`chip h-8 ${task === t ? 'border-accent bg-accent/[0.08] text-ink' : 'hover:bg-fill/[0.05]'}`}>
                    {AI_TASKS[t].short}
                  </button>
                ))}
              </div>
              {task === 'story' && services.length > 0 && (
                <label className="block">
                  <span className="field-label">Service</span>
                  <select className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                </label>
              )}
              {task === 'ask' && (
                <label className="block">
                  <span className="field-label">Your question</span>
                  <textarea rows={3} className="input" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. What should I check first for this noise? What did we do on the last visit?" autoFocus />
                </label>
              )}
              <button className="btn-primary w-full" onClick={run} disabled={busy || (task === 'ask' && !prompt.trim()) || (task === 'story' && !serviceId)}>
                {busy ? <Spinner size={15} /> : <Sparkles size={15} />} {AI_TASKS[task].label}
              </button>

              {error && (
                <div className="flex items-start gap-2 rounded-[10px] border border-warn/40 bg-warn/[0.07] px-3 py-2.5 text-sm">
                  <CircleAlert size={15} className="mt-0.5 shrink-0 text-warn" />
                  <span>
                    {error.message}
                    {error.setup && role === 'owner' && (
                      <>
                        {' '}
                        <Link to="/settings?tab=keys" className="link" onClick={onClose}>Set it up</Link>
                      </>
                    )}
                  </span>
                </div>
              )}

              {result && (
                <section className="rounded-[12px] border border-line">
                  <div className="whitespace-pre-wrap px-3.5 py-3 text-sm leading-relaxed text-ink" data-testid="ai-result">{result.text}</div>
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-line/70 px-2.5 py-2">
                    {use === 'message' && onUseMessage && (
                      <button className="btn-primary btn-sm" onClick={() => onUseMessage(result.text)}>
                        <MessageSquare size={13} /> Use in a message
                      </button>
                    )}
                    {use === 'story' && onApplyStory && (
                      <button className="btn-primary btn-sm" onClick={() => onApplyStory(serviceId, parseStory(result.text))}>
                        <Wrench size={13} /> Add to the service
                      </button>
                    )}
                    {onSaveNote && (
                      <button className="btn-secondary btn-sm" onClick={() => onSaveNote(result.text, result.task)}>
                        <StickyNote size={13} /> Save as note
                      </button>
                    )}
                    <button className="btn-plain btn-sm" onClick={copy}>
                      {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button className="btn-plain btn-sm ml-auto" onClick={run} disabled={busy} title="Try again">
                      <RotateCcw size={13} />
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
        <footer className="border-t border-line px-4 py-2.5 text-[11px] leading-snug text-ink-3">
          AI can get things wrong — read it before it goes to a customer, and confirm specs and prices in your service information. Only the data for this screen is sent.
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
