import { CircleCheck, CircleAlert, Info } from 'lucide-react';
import { useUI } from '../store/hooks';

const ICONS = { success: CircleCheck, error: CircleAlert, default: Info };
const TINT = { success: 'text-ok', error: 'text-bad', default: 'text-white/70' };

export default function Toasts() {
  const { toasts, dismiss } = useUI();
  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICONS[t.tone] || Info;
        return (
          <div
            key={t.id}
            className="glass pointer-events-auto flex max-w-md animate-toast-in items-center gap-2.5 rounded-full bg-[rgb(30_30_32/0.88)] py-2 pl-3 pr-2 text-sm text-white shadow-pop"
          >
            <Icon size={16} strokeWidth={2} className={`shrink-0 ${TINT[t.tone] || TINT.default}`} />
            <span className="pr-1">{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action.onClick();
                  dismiss(t.id);
                }}
                className="rounded-full px-2.5 py-0.5 text-sm font-medium text-[rgb(100_180_255)] hover:bg-white/10"
              >
                {t.action.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
