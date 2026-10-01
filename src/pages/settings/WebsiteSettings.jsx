import { useState } from 'react';
import { Globe, Copy, Check, ExternalLink as ExtIcon, Plus, Trash2, Star } from 'lucide-react';
import { useShop } from '../../store/hooks';
import { Field, InlineText, NumInput } from '../../components/ui';
import { websiteLink } from '../../lib/booking';
import { cloudConfig } from '../../lib/cloudShare';
import Section from './Section';

/** Content for the shop's public website page. */
export default function WebsiteSettings() {
  const { state, updateShop } = useShop();
  const w = state.shop.website || {};
  const set = (patch) => updateShop({ website: { ...w, ...patch } });
  const link = websiteLink(state);
  const cfg = cloudConfig(state.shop);
  const [copied, setCopied] = useState(false);
  const highlights = [...(w.highlights || []), '', '', '', ''].slice(0, 4);
  const testimonials = w.testimonials || [];
  const setT = (i, patch) => set({ testimonials: testimonials.map((t, k) => (k === i ? { ...t, ...patch } : t)) });

  return (
    <>
      <Section id="website" icon={Globe} title="Shop website" subtitle="A one-page site with your services, reviews, hours and online booking">
        <div className="space-y-4">
          <div className="rounded-[10px] border border-line p-3">
            <div className="field-label">Your website link</div>
            <div className="flex gap-2">
              <input readOnly value={link} onFocus={(e) => e.target.select()} className="input flex-1 font-mono text-xs" aria-label="Website link" />
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
              <a href={link} target="_blank" rel="noopener noreferrer" className="btn-primary">
                <ExtIcon size={14} /> Open
              </a>
            </div>
            <p className="mt-2 text-xs text-ink-3">
              Put it on your Google Business Profile, social pages and business cards, or point your own domain at it.
              {cfg ? ' With Shop Cloud published, the link stays short and updates whenever you publish.' : ' Connect Shop Cloud (Settings → Shop Cloud) for a short link that updates itself.'}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
            <Field label="Tagline">{(id) => <InlineText id={id} className="input" value={w.tagline || ''} onCommit={(tagline) => set({ tagline })} />}</Field>
            <Field label="In business since">{(id) => <NumInput id={id} align="left" className="input" value={w.since || ''} onCommit={(since) => set({ since: Math.round(since) || null })} />}</Field>
          </div>
          <Field label="About the shop">{(id) => <InlineText id={id} multiline rows={3} className="input" value={w.about || ''} onCommit={(about) => set({ about })} />}</Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Star rating" hint="Your average rating on Google (e.g. 4.8)">{(id) => <NumInput id={id} align="left" className="input" value={w.rating || ''} onCommit={(rating) => set({ rating: Math.max(0, Math.min(5, rating)) || null })} />}</Field>
            <Field label="Number of reviews">{(id) => <NumInput id={id} align="left" className="input" value={w.reviews || ''} onCommit={(reviews) => set({ reviews: Math.round(reviews) || null })} />}</Field>
          </div>
          <div>
            <span className="field-label">Highlights</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {highlights.map((h, i) => (
                <InlineText
                  key={i}
                  className="input"
                  placeholder={['ASE-certified technicians', 'Warranty on parts & labor', 'Digital inspections with photos', 'Shuttle / loaner available'][i]}
                  value={h}
                  onCommit={(v) => {
                    const next = [...highlights];
                    next[i] = v;
                    set({ highlights: next.filter(Boolean) });
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </Section>
      <Section
        icon={Star}
        title="Customer reviews"
        subtitle="Quotes shown on your website — use real reviews customers have given you"
        actions={
          <button className="btn-plain btn-sm" onClick={() => set({ testimonials: [...testimonials, { name: '', text: '' }] })}>
            <Plus size={14} /> Add review
          </button>
        }
      >
        <div className="space-y-3">
          {testimonials.map((t, i) => (
            <div key={i} className="grid gap-2 rounded-[10px] border border-line p-3 sm:grid-cols-[160px_minmax(0,1fr)_auto]">
              <InlineText className="input" placeholder="Name (e.g. Megan R.)" value={t.name} onCommit={(name) => setT(i, { name })} />
              <InlineText className="input" multiline rows={2} placeholder="What they said" value={t.text} onCommit={(text) => setT(i, { text })} />
              <button className="btn-ghost btn-icon self-start" onClick={() => set({ testimonials: testimonials.filter((_, k) => k !== i) })} aria-label="Remove review">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {!testimonials.length && <p className="text-sm text-ink-3">No reviews added yet.</p>}
        </div>
      </Section>
    </>
  );
}
