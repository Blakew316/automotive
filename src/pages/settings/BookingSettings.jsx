import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, Copy, Check, ExternalLink as ExtIcon, UploadCloud } from 'lucide-react';
import { useShop, useUI } from '../../store/hooks';
import { Field, InlineText, NumInput, Toggle, Spinner } from '../../components/ui';
import { bookingLink, bookingConfig } from '../../lib/booking';
import { cloudConfig, cloudSession, publishBooking } from '../../lib/cloudShare';
import { relTime } from '../../lib/format';
import Section from './Section';

export default function BookingSettings() {
  const { state, updateShop } = useShop();
  const { toast } = useUI();
  const b = state.shop.booking || {};
  const set = (patch) => updateShop({ booking: { ...b, ...patch } });
  const link = bookingLink(state);
  const cfg = cloudConfig(state.shop);
  const signedIn = cfg && cloudSession()?.url === cfg.url;
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const toggleJob = (id) => set({ jobIds: b.jobIds?.includes(id) ? b.jobIds.filter((x) => x !== id) : [...(b.jobIds || []), id] });

  const publish = async () => {
    setBusy(true);
    try {
      await publishBooking(cfg, bookingConfig(state, { includeBusy: true, includeSite: true }));
      set({ published: new Date().toISOString() });
      toast('Booking page published — open slots now reflect your calendar', { tone: 'success' });
    } catch (e) {
      toast(e.message || 'Could not publish', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section id="booking" icon={CalendarCheck} title="Online booking" subtitle="A booking page customers can open from your website, Google profile or a text">
      <div className="space-y-5">
        <label className="flex items-center justify-between gap-3 rounded-[8px] border border-line px-3 py-2 text-sm">
          <span>
            Accept online booking requests
            <span className="block text-xs text-ink-3">Requests land in Calendar → Requests for you to confirm</span>
          </span>
          <Toggle checked={Boolean(b.enabled)} onChange={(v) => set({ enabled: v })} label="Accept online booking" />
        </label>

        {b.enabled && link && (
          <div className="rounded-[10px] border border-line p-3">
            <div className="field-label">Your booking link</div>
            <div className="flex gap-2">
              <input readOnly value={link} onFocus={(e) => e.target.select()} className="input flex-1 font-mono text-xs" aria-label="Booking link" />
              <button
                className="btn-secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    // Select the field and copy manually.
                  }
                }}
              >
                {copied ? <Check size={14} className="text-ok" /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
              </button>
              <a href={link} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                <ExtIcon size={14} /> Open
              </a>
            </div>
            <p className="mt-2 text-xs text-ink-3">
              {cfg && b.published
                ? `Published ${relTime(b.published)}. Requests arrive in your inbox automatically; open times update when you publish (and automatically while you’re signed in).`
                : cfg
                  ? 'Publish once so the page shows real open times and requests arrive automatically.'
                  : 'Without Shop Cloud, requests are sent to you by text or email from the customer’s phone, and the page shows your business hours (not live availability). '}
              {!cfg && (
                <Link to="/settings?tab=cloud" className="text-accent hover:underline">
                  Connect Shop Cloud
                </Link>
              )}
            </p>
            {cfg && (
              <button className="btn-secondary btn-sm mt-2" disabled={!signedIn || busy} onClick={publish} title={signedIn ? '' : 'Sign in under Shop Cloud first'}>
                {busy ? <Spinner size={13} /> : <UploadCloud size={13} />} {b.published ? 'Publish again' : 'Publish booking page'}
              </button>
            )}
          </div>
        )}

        <div>
          <span className="field-label">Services customers can book</span>
          <div className="grid gap-1 sm:grid-cols-2">
            {state.cannedJobs.map((j) => (
              <label key={j.id} className="flex items-center gap-2 rounded-[6px] px-1.5 py-1 text-sm hover:bg-fill/[0.05]">
                <input type="checkbox" checked={Boolean(b.jobIds?.includes(j.id))} onChange={() => toggleJob(j.id)} className="accent-[rgb(var(--accent))]" />
                <span className="truncate">{j.title}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Slot length (min)">{(id) => <NumInput id={id} align="left" className="input" value={b.slotMinutes ?? 30} onCommit={(v) => set({ slotMinutes: [15, 30, 45, 60].includes(v) ? v : 30 })} />}</Field>
          <Field label="Notice needed (hrs)">{(id) => <NumInput id={id} align="left" className="input" value={b.leadHours ?? 2} onCommit={(v) => set({ leadHours: Math.max(0, v) })} />}</Field>
          <Field label="Book up to (days)">{(id) => <NumInput id={id} align="left" className="input" value={b.daysAhead ?? 21} onCommit={(v) => set({ daysAhead: Math.min(90, Math.max(1, v)) })} />}</Field>
          <Field label="Bookings at once">{(id) => <NumInput id={id} align="left" className="input" value={b.capacity ?? 2} onCommit={(v) => set({ capacity: Math.max(1, v) })} />}</Field>
        </div>
        <Field label="Message on the booking page">{(id) => <InlineText id={id} className="input" value={b.note || ''} onCommit={(v) => set({ note: v })} />}</Field>
        <p className="text-xs text-ink-3">
          Open times come from your <Link to="/settings?tab=general" className="text-accent hover:underline">business hours</Link>.
        </p>
      </div>
    </Section>
  );
}
