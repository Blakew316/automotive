import { CreditCard, HandCoins, ExternalLink as ExtIcon } from 'lucide-react';
import { useShop } from '../../store/hooks';
import { Field, InlineText, NumInput, Toggle, Segmented } from '../../components/ui';
import { PAY_PROVIDERS, payLink } from '../../lib/messaging';
import { monthlyPayment } from '../../lib/financing';
import { money } from '../../lib/format';
import Section from './Section';

export function PaymentsSection() {
  const { state, updateShop } = useShop();
  const p = state.shop.payments || {};
  const set = (patch) => updateShop({ payments: { ...p, ...patch } });
  const provider = PAY_PROVIDERS.find((x) => x.value === p.provider) || PAY_PROVIDERS[0];
  const example = payLink(state.shop, 248.5, 'RO 10482');
  return (
    <Section icon={CreditCard} title="Payments" subtitle="In-person payment options and online text-to-pay links">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-[8px] border border-line px-3 py-2 text-sm">
            <span>
              Ask for a tip
              <span className="block text-xs text-ink-3">Shows 10 / 15 / 20% options when taking payment</span>
            </span>
            <Toggle checked={Boolean(p.tipsEnabled)} onChange={(v) => set({ tipsEnabled: v })} label="Ask for a tip" />
          </label>
          <Field label="Card surcharge (%)" hint="Added to card payments only. Check your state’s rules and card-network registration first.">
            {(id) => <NumInput id={id} align="left" className="input" value={p.surchargePct || 0} onCommit={(v) => set({ surchargePct: Math.max(0, Math.min(4, v)) })} />}
          </Field>
        </div>
        <div>
          <span className="field-label">Online payment link</span>
          <p className="mb-2 text-xs text-ink-3">Customers pay through your own processor account — money goes straight to you. Links go in payment requests, ready-for-pickup texts and the customer report.</p>
          <select className="input w-auto" value={p.provider || 'none'} onChange={(e) => set({ provider: e.target.value })} aria-label="Payment link provider">
            {PAY_PROVIDERS.map((x) => (
              <option key={x.value} value={x.value}>{x.label}</option>
            ))}
          </select>
        </div>
        {provider.field && (
          <Field label={provider.field === 'link' ? 'Payment link URL' : 'Account handle'} hint={provider.amount ? 'The invoice balance is filled in automatically.' : 'This link has a fixed or customer-entered amount — the balance is included in the message.'}>
            {(id) => <InlineText id={id} className="input font-mono text-sm" placeholder={provider.placeholder} value={p[provider.field] || ''} onCommit={(v) => set({ [provider.field]: v.trim() })} />}
          </Field>
        )}
        {example && (
          <p className="flex items-center gap-1.5 truncate text-xs text-ink-3">
            Example for a $248.50 balance:{' '}
            <a href={example} target="_blank" rel="noopener noreferrer" className="truncate text-accent hover:underline">
              {example}
            </a>
            <ExtIcon size={11} className="shrink-0" />
          </p>
        )}
      </div>
    </Section>
  );
}

export function FinancingSection() {
  const { state, updateShop } = useShop();
  const f = state.shop.financing || {};
  const set = (patch) => updateShop({ financing: { ...f, ...patch } });
  return (
    <Section icon={HandCoins} title="Customer financing" subtitle="Offer monthly payments on larger repairs through your financing partner">
      <div className="space-y-4">
        <label className="flex items-center justify-between gap-3 rounded-[8px] border border-line px-3 py-2 text-sm">
          <span>
            Show financing on estimates
            <span className="block text-xs text-ink-3">Adds “as low as $X/mo” to repair orders and customer reports above the minimum</span>
          </span>
          <Toggle checked={Boolean(f.enabled)} onChange={(v) => set({ enabled: v })} label="Show financing" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Financing partner">{(id) => <InlineText id={id} className="input" placeholder="e.g. your lender or consumer-finance program" value={f.provider || ''} onCommit={(v) => set({ provider: v })} />}</Field>
          <Field label="Application link" hint="Where customers apply (from your partner)">{(id) => <InlineText id={id} className="input font-mono text-sm" placeholder="https://…" value={f.url || ''} onCommit={(v) => set({ url: v.trim() })} />}</Field>
          <Field label="Example APR (%)" hint="Used only for the estimate shown to customers">{(id) => <NumInput id={id} align="left" className="input" value={f.apr ?? 0} onCommit={(v) => set({ apr: Math.max(0, v) })} />}</Field>
          <Field label="Minimum repair ($)">{(id) => <NumInput id={id} align="left" className="input" value={f.minAmount ?? 0} onCommit={(v) => set({ minAmount: Math.max(0, v) })} />}</Field>
        </div>
        <div>
          <span className="field-label">Terms offered</span>
          <Segmented
            size="sm"
            value={JSON.stringify(f.terms || [])}
            onChange={(v) => set({ terms: JSON.parse(v) })}
            options={[
              { value: JSON.stringify([6, 12]), label: '6 · 12 mo' },
              { value: JSON.stringify([6, 12, 24]), label: '6 · 12 · 24 mo' },
              { value: JSON.stringify([12, 24, 36]), label: '12 · 24 · 36 mo' },
              { value: JSON.stringify([12, 24, 36, 48, 60]), label: '12–60 mo' },
            ]}
          />
          <p className="mt-2 text-xs text-ink-3">
            Example on $1,200 at {f.apr ?? 0}% APR: {(f.terms || []).map((n) => `${money(monthlyPayment(1200, f.apr, n))}/mo × ${n}`).join(' · ')}. Final terms come from the lender after approval.
          </p>
        </div>
      </div>
    </Section>
  );
}
