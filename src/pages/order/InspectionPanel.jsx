import { Plus } from 'lucide-react';
import { useShop, useUI } from '../../store/hooks';
import { Card, CardHeader, Dot, InlineText } from '../../components/ui';
import { INSPECTION_RATINGS } from '../../lib/workflow';
import { inspectionTemplateFor, inspectionPoints, measurementKind, ratingForMeasurement } from '../../lib/inspection';
import { MediaStrip } from './MediaPanel';

const RATING_ORDER = ['good', 'soon', 'now'];

export default function InspectionPanel({ order, editable, onOpenMedia }) {
  const { state, setInspection, addService, updateOrder } = useShop();
  const { toast } = useUI();
  const template = inspectionTemplateFor(state, order);
  const all = inspectionPoints(template);
  const ratings = all.map((i) => order.inspection[i.key]?.rating).filter(Boolean);
  const count = (r) => ratings.filter((x) => x === r).length;
  const flagged = all.filter((i) => ['soon', 'now'].includes(order.inspection[i.key]?.rating));

  const recommend = (item) => {
    addService(order.id, { title: `${item.label.replace(/\s*\(.*\)$/, '')} — ${order.inspection[item.key]?.rating === 'now' ? 'urgent' : 'recommended'}`, items: [{ type: 'labor', description: 'Inspect, quote & replace as needed', hours: 0.5 }] });
    toast('Added as a pending service on the estimate', { tone: 'success' });
  };

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        {state.inspectionTemplates.length > 1 && (
          <select
            className="input h-8 w-auto py-0 text-sm font-medium"
            value={template.id}
            disabled={!editable}
            onChange={(e) => updateOrder(order.id, { inspectionTemplateId: e.target.value })}
            aria-label="Inspection template"
          >
            {state.inspectionTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        <div className="text-sm text-ink-2">
          <span className="font-semibold text-ink">{ratings.length}</span> of {all.length} points inspected
        </div>
        {RATING_ORDER.map((r) => (
          <div key={r} className="flex items-center gap-1.5 text-sm text-ink-2">
            <Dot className={INSPECTION_RATINGS[r].dot} size={7} />
            <span className="tabular font-medium text-ink">{count(r)}</span> {INSPECTION_RATINGS[r].short || INSPECTION_RATINGS[r].label}
          </div>
        ))}
      </Card>

      {flagged.length > 0 && (
        <Card>
          <CardHeader title="Recommendations" subtitle="Items that need attention — add them to the estimate for approval" />
          <ul className="divide-y divide-line/70">
            {flagged.map((i) => (
              <li key={i.key} className="flex items-center gap-3 px-4 py-2.5">
                <Dot className={INSPECTION_RATINGS[order.inspection[i.key].rating].dot} size={7} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{i.label}</div>
                  <div className="truncate text-xs text-ink-3">{order.inspection[i.key].note || i.section}</div>
                </div>
                {editable && (
                  <button className="btn-plain btn-sm" onClick={() => recommend(i)}>
                    <Plus size={13} /> Add to estimate
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {template.sections.map((section) => (
        <Card key={section.section}>
          <CardHeader title={section.section} />
          <ul className="divide-y divide-line/70">
            {section.items.map((label) => {
              const key = `${section.section}::${label}`;
              const entry = order.inspection[key] || {};
              const kind = measurementKind(label);
              return (
                <li key={key} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2">
                  <span className="min-w-[180px] flex-1 text-sm text-ink">{label}</span>
                  <div className="flex rounded-[8px] bg-fill/[0.1] p-[2px]" role="radiogroup" aria-label={label}>
                    {RATING_ORDER.map((r) => {
                      const on = entry.rating === r;
                      return (
                        <button
                          key={r}
                          role="radio"
                          aria-checked={on}
                          disabled={!editable}
                          onClick={() => setInspection(order.id, key, { rating: on ? null : r })}
                          className={`flex h-6 items-center gap-1.5 rounded-[6px] px-2 text-xs font-medium transition-all ${on ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.14)]' : 'text-ink-3 hover:text-ink'}`}
                        >
                          <Dot className={on ? INSPECTION_RATINGS[r].dot : 'bg-ink-4/60'} size={6} />
                          {INSPECTION_RATINGS[r].short || INSPECTION_RATINGS[r].label}
                        </button>
                      );
                    })}
                  </div>
                  {kind && (
                    <span className="flex items-center gap-1">
                      <input
                        inputMode="decimal"
                        disabled={!editable}
                        defaultValue={entry.measure ?? ''}
                        key={`${key}:${entry.measure ?? ''}`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v === String(entry.measure ?? '')) return;
                          setInspection(order.id, key, { measure: v === '' ? null : Number(v), ...(v !== '' ? { rating: ratingForMeasurement(kind, v) } : {}) });
                        }}
                        className="h-7 w-14 rounded-[6px] border border-line bg-surface px-1.5 text-right text-sm tabular-nums outline-none focus:border-accent/60"
                        aria-label={`${label} measurement`}
                      />
                      <span className="text-xs text-ink-3">{kind === 'mm' ? 'mm' : '/32'}</span>
                    </span>
                  )}
                  <InlineText
                    value={entry.note}
                    placeholder="Note / measurement"
                    onCommit={(note) => setInspection(order.id, key, { note })}
                    disabled={!editable}
                    className="h-7 w-full rounded-[6px] border border-transparent bg-transparent px-2 text-sm text-ink-2 outline-none hover:border-line focus:border-accent/60 focus:bg-surface sm:w-48"
                  />
                  <MediaStrip order={order} filter={(m) => m.inspectionKey === key} extra={{ inspectionKey: key }} editable onOpen={onOpenMedia} label="" />
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}
