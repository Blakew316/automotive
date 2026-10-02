import { useId, useState } from 'react';
import { Globe, Copy, Check, ExternalLink as ExtIcon, CalendarCheck, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useShop } from '../../store/hooks';
import { InlineText } from '../../components/ui';
import { websiteLink, webHref, bookingLink } from '../../lib/booking';
import { cloudConfig } from '../../lib/cloudShare';
import Section from './Section';

const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** Copies text to the clipboard and says so for a moment; the field next to it can be selected by hand if the clipboard is blocked. */
function CopyText({ text, label }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary shrink-0"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Select the field and copy by hand.
        }
      }}
    >
      {copied ? <Check size={14} className="text-ok" /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

/** The shop's own website, and a Book online button for it that opens the shop's booking page. */
export default function WebsiteSettings() {
  const { state, updateShop } = useShop();
  const w = state.shop.website || {};
  const site = websiteLink(state);
  const booking = bookingLink(state);
  const snippet = booking ? `<a href="${attr(booking)}">Book online</a>` : '';
  const cloud = Boolean(cloudConfig(state.shop));
  const urlId = useId();

  return (
    <Section id="website" icon={Globe} title="Your website & booking button" subtitle="Link your shop’s own website and add a Book online button that opens your booking page">
      <div className="space-y-5">
        <div>
          <label htmlFor={urlId} className="field-label">
            Website address
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <InlineText
              id={urlId}
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              className="input w-full min-w-0 sm:flex-1 font-mono text-sm"
              placeholder="https://www.yourshop.com"
              value={w.url || ''}
              onCommit={(url) => updateShop({ website: { ...w, url: webHref(url.trim()) } })}
            />
            {site && (
              <div className="flex shrink-0 gap-2">
                <CopyText text={site} label="Copy website address" />
                <a href={webHref(site)} target="_blank" rel="noopener noreferrer" className="btn-secondary shrink-0">
                  <ExtIcon size={14} /> Open
                </a>
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-3">Your shop’s own website, if it has one. Leave it blank if you don’t have one yet — the booking link below works on its own.</p>
        </div>

        <div className="rounded-[10px] border border-line p-3">
          <h3 className="text-sm font-semibold text-ink">Add online booking to your website</h3>
          {booking ? (
            <>
              <p className="mt-0.5 text-xs text-ink-3">Link a Book online button to your booking page — on your website, Google Business Profile and social pages.</p>
              <div className="field-label mt-3">Booking link</div>
              <div className="flex flex-col items-start gap-2 sm:flex-row">
                <input readOnly value={booking} onFocus={(e) => e.target.select()} className="input w-full min-w-0 sm:flex-1 font-mono text-xs" aria-label="Booking link" />
                <CopyText text={booking} label="Copy booking link" />
              </div>
              <div className="field-label mt-3">Button code to paste into your website</div>
              <div className="flex flex-col items-start gap-2 sm:flex-row">
                <textarea readOnly rows={3} value={snippet} onFocus={(e) => e.target.select()} className="input w-full min-w-0 sm:flex-1 resize-none font-mono text-xs" aria-label="Book online button code" spellCheck={false} />
                <CopyText text={snippet} label="Copy button code" />
              </div>
              <p className="mt-2 text-xs text-ink-3">
                Paste it where your website builder accepts HTML (often called an embed or code block), then style it like your other buttons. Change services, times and the message customers see under{' '}
                <Link to="/settings?tab=booking" className="link">
                  Online booking
                </Link>
                .
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-2">
              Online booking is off.{' '}
              <Link to="/settings?tab=booking" className="link">
                Turn it on
              </Link>{' '}
              to get a booking link and a button for your website.
            </p>
          )}
        </div>

        <ul className="divide-y divide-line/70 rounded-[10px] border border-line text-sm">
          <li className="flex gap-3 px-3 py-2.5">
            <CalendarCheck size={16} className="mt-0.5 shrink-0 text-accent" />
            <span className="text-ink-2">
              <b className="font-medium text-ink">Booking requests</b> from your booking page arrive in <Link to="/calendar" className="link">Calendar</Link> → Requests with the time the customer picked, ready to confirm.
            </span>
          </li>
          <li className="flex gap-3 px-3 py-2.5">
            <MessageSquare size={16} className="mt-0.5 shrink-0 text-accent" />
            <span className="text-ink-2">
              <b className="font-medium text-ink">Self check-ins</b> arrive on the <Link to="/frontdesk" className="link">Front Desk</Link>, and customer replies to the reports you share arrive in <Link to="/messages" className="link">Messages</Link>.
            </span>
          </li>
        </ul>
        <p className={`text-xs ${cloud ? 'text-ink-3' : 'text-warn'}`}>
          {cloud
            ? 'These travel through Shop Cloud and appear once a signed-in shop device has the app open.'
            : 'These travel through Shop Cloud. Without it, the booking page asks customers to send their request by text or email instead.'}{' '}
          {!cloud && (
            <Link to="/settings?tab=cloud" className="link">
              Set up Shop Cloud
            </Link>
          )}
        </p>
      </div>
    </Section>
  );
}
