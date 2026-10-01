import { useState } from 'react';
import { MessageSquareText, Megaphone, RotateCcw } from 'lucide-react';
import { useShop } from '../../store/hooks';
import { Field, InlineText, NumInput } from '../../components/ui';
import { MESSAGE_TEMPLATES } from '../../store/defaults';
import { fillTemplate, messageContext } from '../../lib/messaging';
import Section from './Section';

const FIELDS = ['first', 'shop', 'phone', 'vehicle', 'ro', 'total', 'balance', 'amount', 'link', 'payLink', 'bookLink', 'reviewLink', 'date', 'time', 'service'];

export function TemplatesSection() {
  const { state, updateShop } = useShop();
  const templates = state.shop.templates || [];
  const [open, setOpen] = useState(templates[0]?.id);
  const sample = state.orders.find((o) => o.status === 'ready') || state.orders[0];
  const customer = sample && state.customers.find((c) => c.id === sample.customerId);
  const ctx = messageContext(state, { customer, order: sample, extra: { amount: 120, service: 'an oil change' } });
  const set = (id, body) => updateShop({ templates: templates.map((t) => (t.id === id ? { ...t, body } : t)) });
  const reset = (id) => set(id, MESSAGE_TEMPLATES.find((t) => t.id === id)?.body || '');
  return (
    <Section icon={MessageSquareText} title="Message templates" subtitle="Used across estimates, payments, reminders and campaigns" flush>
      <ul className="divide-y divide-line/70">
        {templates.map((t) => (
          <li key={t.id}>
            <button onClick={() => setOpen(open === t.id ? null : t.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-fill/[0.03]">
              <span className="w-44 shrink-0 text-sm font-medium">{t.label}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink-3">{t.body}</span>
            </button>
            {open === t.id && (
              <div className="space-y-2 px-4 pb-4">
                <InlineText multiline rows={3} className="input" value={t.body} onCommit={(v) => set(t.id, v)} aria-label={`${t.label} template`} />
                <div className="rounded-[10px] bg-fill/[0.06] px-3 py-2 text-sm text-ink-2">
                  <div className="mb-0.5 text-2xs font-semibold uppercase tracking-wide text-ink-3">Preview</div>
                  {fillTemplate(t.body, ctx) || <span className="text-ink-4">Empty</span>}
                </div>
                <div className="flex flex-wrap items-center gap-1 text-2xs text-ink-3">
                  Fields:
                  {FIELDS.map((f) => (
                    <code key={f} className="rounded bg-fill/[0.08] px-1 py-0.5 font-mono">{`{${f}}`}</code>
                  ))}
                  <button className="btn-plain btn-sm ml-auto" onClick={() => reset(t.id)}>
                    <RotateCcw size={12} /> Default
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="border-t border-line/70 px-4 py-2 text-xs text-ink-3">A sentence that contains a link you haven’t set up (payment, booking, review) is left out automatically.</p>
    </Section>
  );
}

export function MarketingSettings() {
  const { state, updateShop } = useShop();
  const m = state.shop.marketing || {};
  const set = (patch) => updateShop({ marketing: { ...m, ...patch } });
  return (
    <Section icon={Megaphone} title="Reminders & reviews" subtitle="Drives service reminders, win-back lists and review requests in Marketing">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Review link" className="sm:col-span-2" hint="Your Google Business Profile “Get more reviews” link, Yelp, or similar">
          {(id) => <InlineText id={id} className="input font-mono text-sm" placeholder="https://g.page/r/…/review" value={m.reviewUrl || ''} onCommit={(v) => set({ reviewUrl: v.trim() })} />}
        </Field>
        <Field label="Oil service interval (months)">{(id) => <NumInput id={id} align="left" className="input" value={m.oilMonths ?? 6} onCommit={(v) => set({ oilMonths: Math.max(1, v) })} />}</Field>
        <Field label="Oil service interval (miles)">{(id) => <NumInput id={id} align="left" className="input" value={m.oilMiles ?? 5000} onCommit={(v) => set({ oilMiles: Math.max(500, v) })} />}</Field>
        <Field label="Typical miles per day" hint="Estimates mileage since the last visit">{(id) => <NumInput id={id} align="left" className="input" value={m.milesPerDay ?? 35} onCommit={(v) => set({ milesPerDay: Math.max(1, v) })} />}</Field>
        <Field label="Win-back after (months without a visit)">{(id) => <NumInput id={id} align="left" className="input" value={m.winbackMonths ?? 9} onCommit={(v) => set({ winbackMonths: Math.max(2, v) })} />}</Field>
      </div>
    </Section>
  );
}
