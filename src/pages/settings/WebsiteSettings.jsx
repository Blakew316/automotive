import { useState } from 'react';
import { Globe, Copy, Check, ExternalLink as ExtIcon, CalendarCheck, MessageSquare, FileCode2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useShop } from '../../store/hooks';
import { Field, InlineText } from '../../components/ui';
import { websiteLink, websitePage, defaultWebsite } from '../../lib/booking';
import { cloudConfig } from '../../lib/cloudShare';
import Section from './Section';

const PAGES = [
  ['Home', ''],
  ['Book a service', 'appointment.html'],
  ['Services', 'services.html'],
  ['Specials', 'specials.html'],
  ['Contact', 'contact.html'],
];

/** The shop's public website (website/ in the repo) and how its forms reach the app. */
export default function WebsiteSettings() {
  const { state, updateShop } = useShop();
  const w = state.shop.website || {};
  const link = websiteLink(state);
  const cloud = Boolean(cloudConfig(state.shop));
  const [copied, setCopied] = useState(false);

  return (
    <Section id="website" icon={Globe} title="Shop website" subtitle="Your public website — services, specials, FAQ, contact and a booking form">
      <div className="space-y-4">
        {link ? (
          <div className="rounded-[10px] border border-line p-3">
            <div className="field-label">Your website</div>
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
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {PAGES.map(([label, page]) => (
                <a key={label} href={websitePage(state, page)} target="_blank" rel="noopener noreferrer" className="chip hover:border-accent/40 hover:text-accent">
                  {label}
                </a>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-3">Put it on your Google Business Profile, social pages and business cards.</p>
          </div>
        ) : (
          <p className="text-sm text-ink-2">The website is published together with WPI Driveline. Enter its address below if it’s hosted somewhere else.</p>
        )}

        <Field label="Website address" hint={`Leave blank to use the site published with WPI Driveline${defaultWebsite() ? ` (${defaultWebsite()})` : ''}. Enter your own domain once it points at the site.`}>
          {(id) => <InlineText id={id} className="input font-mono text-sm" placeholder={defaultWebsite() || 'https://www.yourshop.com'} value={w.url || ''} onCommit={(url) => updateShop({ website: { ...w, url: url.trim() } })} />}
        </Field>

        <ul className="divide-y divide-line/70 rounded-[10px] border border-line text-sm">
          <li className="flex gap-3 px-3 py-2.5">
            <CalendarCheck size={16} className="mt-0.5 shrink-0 text-accent" />
            <span className="text-ink-2">
              <b className="font-medium text-ink">Book a service</b> requests arrive in <Link to="/calendar" className="link">Calendar</Link> with the customer’s preferred day and time of day, ready to confirm.
            </span>
          </li>
          <li className="flex gap-3 px-3 py-2.5">
            <MessageSquare size={16} className="mt-0.5 shrink-0 text-accent" />
            <span className="text-ink-2">
              <b className="font-medium text-ink">Contact and fleet</b> messages arrive in <Link to="/messages" className="link">Messages</Link>; new people are added as customers.
            </span>
          </li>
          <li className="flex gap-3 px-3 py-2.5">
            <FileCode2 size={16} className="mt-0.5 shrink-0 text-ink-3" />
            <span className="text-ink-2">
              Phone, address, hours and pages are edited in the <code className="font-mono text-xs">website/</code> folder — shop details live in <code className="font-mono text-xs">website/business.json</code>; run <code className="font-mono text-xs">node website/scripts/sync.mjs</code> after changing them.
            </span>
          </li>
        </ul>
        {!cloud && (
          <p className="text-xs text-warn">
            Website requests travel through Shop Cloud. Connect it in <Link to="/settings?tab=cloud" className="link">Settings → Shop Cloud</Link> and sign in so they reach this app.
          </p>
        )}
      </div>
    </Section>
  );
}
