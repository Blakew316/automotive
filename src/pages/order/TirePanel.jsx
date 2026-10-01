// Tire quote on a service: side-by-side good / better / best options, the customer's pick, and the
// DOT numbers of the tires installed (kept for manufacturer registration and recalls).
import { Disc3, Plus, X, Check, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useShop } from '../../store/hooks';
import { IconTile, InlineText, NumInput, Toggle } from '../../components/ui';
import { TIERS, newTireOption, checkTin, tireLabel } from '../../lib/tires';
import { priceFromMatrix } from '../../lib/pricing';
import { money } from '../../lib/format';

const field = 'h-7 w-full rounded-[6px] border border-line bg-surface px-2 text-sm outline-none transition focus:border-accent/60 focus:ring-[3px] focus:ring-accent/15 disabled:opacity-60';

export default function TirePanel({ order, service, editable }) {
  const { state, updateService, selectTire } = useShop();
  const q = service.tires;
  const set = (patch) => updateService(order.id, service.id, { tires: { ...q, ...patch } });
  const setOption = (id, patch) => set({ options: q.options.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  const selected = q.options.find((o) => o.id === q.selectedId);
  const qty = Number(q.qty) || 4;
  const dots = Array.from({ length: qty }, (_, i) => (q.dots || [])[i] || '');
  const showDots = Boolean(selected) && service.status !== 'pending';

  return (
    <div className="border-t border-line/70 px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <IconTile icon={Disc3} tone="slate" size={26} />
        <div className="text-sm font-semibold">Tire options</div>
        <label className="flex items-center gap-1.5 text-xs text-ink-3">
          Size
          <InlineText value={q.size} placeholder="225/55R17" onCommit={(size) => set({ size: size.toUpperCase() })} disabled={!editable} className={`${field} w-28 font-mono`} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-3">
          Qty
          <NumInput value={qty} onCommit={(n) => set({ qty: Math.max(1, Math.min(8, Math.round(n))) })} disabled={!editable} className={`${field} w-14`} aria-label="Tire quantity" />
        </label>
        {editable && q.options.length < 4 && (
          <button className="btn-plain btn-sm ml-auto" onClick={() => set({ options: [...q.options, newTireOption('best')] })}>
            <Plus size={13} /> Option
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {q.options.map((o) => {
          const on = o.id === q.selectedId;
          const each = Number(o.price) || priceFromMatrix(Number(o.cost) || 0, state.shop.matrix);
          return (
            <div key={o.id} className={`relative rounded-[10px] border p-3 transition-colors ${on ? 'border-accent bg-accent/[0.04] ring-1 ring-accent/30' : 'border-line bg-raised'}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <select value={o.tier} onChange={(e) => setOption(o.id, { tier: e.target.value })} disabled={!editable} className="h-6 rounded-full border border-line bg-surface px-2 font-mono text-2xs font-semibold uppercase tracking-wide text-ink-2 outline-none" aria-label="Tier">
                  {Object.entries(TIERS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                {editable && q.options.length > 1 && (
                  <button className="btn-ghost btn-icon h-6 w-6" onClick={() => set({ options: q.options.filter((x) => x.id !== o.id), selectedId: on ? null : q.selectedId })} aria-label="Remove option">
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <InlineText value={o.brand} placeholder="Brand" onCommit={(brand) => setOption(o.id, { brand })} disabled={!editable} className={field} />
                <InlineText value={o.model} placeholder="Model" onCommit={(model) => setOption(o.id, { model })} disabled={!editable} className={field} />
                <InlineText value={o.spec} placeholder="Load / speed (e.g. 101H)" onCommit={(spec) => setOption(o.id, { spec })} disabled={!editable} className={`${field} col-span-2`} />
                <InlineText value={o.warranty} placeholder="Tread warranty (mi)" onCommit={(warranty) => setOption(o.id, { warranty })} disabled={!editable} className={`${field} col-span-2`} />
                <label className="text-2xs text-ink-3">
                  Cost each
                  <NumInput value={o.cost} format={(v) => Number(v).toFixed(2)} onCommit={(cost) => setOption(o.id, { cost })} disabled={!editable} className={field} aria-label="Cost each" />
                </label>
                <label className="text-2xs text-ink-3">
                  Price each
                  <NumInput value={o.price || each} format={(v) => Number(v).toFixed(2)} onCommit={(price) => setOption(o.id, { price })} disabled={!editable} className={field} aria-label="Price each" />
                </label>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <div className="text-xs text-ink-3">
                  <span className="tabular text-md font-semibold text-ink">{money(each)}</span> each · {money(each * qty)} set
                </div>
                <button
                  className={on ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                  disabled={!editable || !(o.brand || o.model)}
                  onClick={() => selectTire(order.id, service.id, o.id)}
                >
                  {on ? (
                    <>
                      <Check size={13} /> Selected
                    </>
                  ) : (
                    'Select'
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {!selected && <p className="mt-2 text-xs text-ink-3">Fill in two or three options and the customer can choose on their report link or the counter tablet. Selecting one adds it to this service.</p>}

      {showDots && (
        <div className="mt-4 rounded-[10px] border border-line p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold">
              DOT numbers <span className="font-normal text-ink-3">· {tireLabel(selected, q.size)}</span>
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-2">
              <ShieldCheck size={14} className={q.registered ? 'text-ok' : 'text-ink-4'} /> Registered with manufacturer
              <Toggle checked={Boolean(q.registered)} onChange={(registered) => set({ registered })} label="Registered with manufacturer" />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {dots.map((d, i) => {
              const c = checkTin(d);
              return (
                <label key={i} className="block">
                  <span className="mb-0.5 flex items-center justify-between text-2xs text-ink-3">
                    Tire {i + 1}
                    {c.ok && <span className={c.old ? 'text-warn' : 'text-ok'}>{c.old ? `Made ${c.year} — ${Math.floor(c.ageYears)} yrs old` : `Wk ${c.week} ${c.year}`}</span>}
                  </span>
                  <InlineText
                    value={d}
                    placeholder="DOT XXXX XXXX 2324"
                    onCommit={(v) => {
                      const next = [...dots];
                      next[i] = v.toUpperCase().trim();
                      set({ dots: next });
                    }}
                    className={`${field} font-mono ${!c.empty && !c.ok ? 'border-bad/60' : ''}`}
                  />
                  {!c.empty && !c.ok && (
                    <span className="mt-0.5 flex items-center gap-1 text-2xs text-bad">
                      <TriangleAlert size={11} /> {c.message}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-2xs text-ink-3">Tire sellers must give buyers a way to register their tires so they can be reached about recalls. The tire log (Parts → Tires) exports these numbers for the manufacturer or registration service you use.</p>
        </div>
      )}
    </div>
  );
}
