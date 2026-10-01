import { Clock } from 'lucide-react';
import { useShop } from '../../store/hooks';
import { Toggle } from '../../components/ui';
import Section from './Section';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function HoursSection() {
  const { state, updateShop } = useShop();
  const hours = state.shop.hours || {};
  const set = (d, v) => updateShop({ hours: { ...hours, [d]: v } });
  return (
    <Section icon={Clock} title="Business hours" subtitle="Used for online booking and shown to customers">
      <ul className="-my-1 divide-y divide-line/60">
        {ORDER.map((d) => {
          const h = hours[d];
          return (
            <li key={d} className="flex flex-wrap items-center gap-3 py-2">
              <span className="w-28 text-sm font-medium">{DAYS[d]}</span>
              <Toggle checked={Boolean(h)} onChange={(on) => set(d, on ? ['08:00', '17:00'] : null)} label={`Open ${DAYS[d]}`} />
              {h ? (
                <span className="flex items-center gap-2 text-sm">
                  <input type="time" className="input h-8 w-auto py-0" value={h[0]} onChange={(e) => set(d, [e.target.value, h[1]])} aria-label={`${DAYS[d]} opens`} />
                  <span className="text-ink-3">to</span>
                  <input type="time" className="input h-8 w-auto py-0" value={h[1]} onChange={(e) => set(d, [h[0], e.target.value])} aria-label={`${DAYS[d]} closes`} />
                </span>
              ) : (
                <span className="text-sm text-ink-3">Closed</span>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
