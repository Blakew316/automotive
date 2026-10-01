// Printable sign for the key drop box and the lobby: scan to check in.
import { Link } from 'react-router-dom';
import { ChevronLeft, Printer } from 'lucide-react';
import { useShop, useSite } from '../store/hooks';
import QrCode from '../components/QrCode';
import { checkinLink } from '../lib/operations';
import { phone as fmtPhone } from '../lib/format';

export default function CheckinSign() {
  const { state } = useShop();
  const site = useSite();
  const shop = state.shop;
  const link = checkinLink(state, site.current);
  return (
    <div className="min-h-screen bg-canvas pb-16">
      <div className="no-print glass sticky top-0 z-10 border-b border-line bg-canvas/80">
        <div className="mx-auto flex max-w-[760px] items-center gap-3 px-4 py-2.5">
          <Link to="/frontdesk" className="btn-plain -ml-2 px-1.5">
            <ChevronLeft size={17} strokeWidth={2} /> Front desk
          </Link>
          <button className="btn-primary ml-auto" onClick={() => window.print()} disabled={!link}>
            <Printer size={15} /> Print sign
          </button>
        </div>
      </div>
      <article className="force-light print-sheet mx-auto mt-8 flex max-w-[760px] flex-col items-center rounded-lg bg-surface px-12 py-14 text-center text-ink shadow-card">
        <div className="text-lg font-semibold text-ink-2">{shop.name}</div>
        <h1 className="mt-3 text-5xl font-bold tracking-tight">Check in here</h1>
        <p className="mt-3 text-xl text-ink-2">Before hours, after hours, or to skip the line</p>
        {link ? <QrCode text={link} size={320} className="mt-8" label="Check-in QR code" /> : <p className="mt-8 text-ink-3">Connect Shop Cloud to get your check-in link.</p>}
        <ol className="mt-8 space-y-2 text-left text-xl">
          <li><b>1.</b> Point your phone’s camera at the code</li>
          <li><b>2.</b> Tell us about your vehicle and sign</li>
          <li><b>3.</b> Drop your keys in the slot — we’ll text you</li>
        </ol>
        {shop.phone && <p className="mt-10 text-lg text-ink-2">Questions? Call {fmtPhone(shop.phone)}</p>}
      </article>
    </div>
  );
}
