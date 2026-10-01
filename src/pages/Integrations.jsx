import { Link } from 'react-router-dom';
import { Cloud, Landmark, Package, FileClock, CreditCard, HandCoins, MessageSquare, Star, CalendarDays, ScanLine, Upload, Download, ExternalLink as ExtIcon, ArrowRight, Smartphone, Globe } from 'lucide-react';
import { useShop, useUI } from '../store/hooks';
import { PageHeader, Card } from '../components/ui';
import { HistorySection } from './settings/IntegrationSections';
import { cloudConfig, cloudSession } from '../lib/cloudShare';
import { PAY_PROVIDERS } from '../lib/messaging';
import { B2B_PLATFORMS } from '../lib/suppliers';
import { appointmentsIcs } from '../lib/ics';
import { bookingLink, websiteLink } from '../lib/booking';

const STATUS_STYLE = {
  on: 'border-ok/40 bg-ok/[0.08] text-ok',
  setup: 'border-line text-ink-3',
  builtin: 'border-accent/30 bg-accent/[0.06] text-accent',
};

export default function Integrations() {
  const { state } = useShop();
  const { toast } = useUI();
  const shop = state.shop;
  const cfg = cloudConfig(shop);
  const signedIn = Boolean(cfg && cloudSession()?.url === cfg.url);
  const pay = PAY_PROVIDERS.find((p) => p.value === shop.payments?.provider);
  const payOn = pay && pay.value !== 'none' && (shop.payments.link || shop.payments.handle);

  const downloadIcs = () => {
    const url = URL.createObjectURL(new Blob([appointmentsIcs(state)], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${shop.name.replace(/[^\w]+/g, '-')}-appointments.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Calendar file downloaded — open it to add appointments to your calendar app', { tone: 'success' });
  };

  const groups = [
    {
      title: 'Customers & online',
      items: [
        {
          icon: Cloud,
          name: 'Shop Cloud',
          by: 'Supabase (your own free account)',
          body: 'Share links for reports, photos and video; online approvals with e-signature; customer replies; and the online booking inbox.',
          status: signedIn ? ['on', 'Connected'] : cfg ? ['setup', 'Sign in on this device'] : ['setup', 'Not set up'],
          action: <Link to="/settings?tab=cloud" className="btn-secondary btn-sm">{cfg ? 'Manage' : 'Set up'}</Link>,
        },
        {
          icon: CalendarDays,
          name: 'Online booking',
          by: 'Built in',
          body: 'A booking page for your website, Google Business Profile and texts. Requests land in Calendar for you to confirm.',
          status: shop.booking?.enabled ? ['on', bookingLink(state) && shop.booking?.published ? 'Live' : 'On'] : ['setup', 'Off'],
          action: <Link to="/settings?tab=booking" className="btn-secondary btn-sm">Settings</Link>,
        },
        {
          icon: Globe,
          name: 'Shop website',
          by: 'Built in',
          body: 'A one-page website with your services, reviews, hours, directions and online booking — ready for your Google Business Profile.',
          status: ['builtin', 'Ready'],
          action: (
            <span className="flex gap-1.5">
              <a href={websiteLink(state)} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                Open <ExtIcon size={12} />
              </a>
              <Link to="/settings?tab=website" className="btn-plain btn-sm">Edit</Link>
            </span>
          ),
        },
        {
          icon: Star,
          name: 'Google reviews',
          by: 'Google Business Profile',
          body: 'Review requests from Marketing include your Google review link.',
          status: shop.marketing?.reviewUrl ? ['on', 'Link added'] : ['setup', 'Add link'],
          action: <Link to="/settings?tab=messaging" className="btn-secondary btn-sm">Settings</Link>,
        },
        {
          icon: MessageSquare,
          name: 'Texting & email',
          by: 'Your phone and email',
          body: 'Messages open in your Messages or Mail app so they come from the shop’s own number and address, and are logged on the customer. Customers can also reply from their report link. Fully automated carrier texting (e.g. Twilio, Podium) needs a separate messaging service.',
          status: ['builtin', 'Built in'],
          action: <Link to="/messages" className="btn-secondary btn-sm">Messages</Link>,
        },
      ],
    },
    {
      title: 'Money',
      items: [
        {
          icon: Landmark,
          name: 'QuickBooks Online',
          by: 'Intuit',
          body: 'Export invoices, payments, expenses, a daily sales journal and your customer list in QuickBooks’ import layouts. Also works with Xero, Wave and spreadsheets.',
          status: ['builtin', 'CSV export'],
          action: <Link to="/accounting?tab=export" className="btn-secondary btn-sm">Exports</Link>,
        },
        {
          icon: CreditCard,
          name: 'Payment links',
          by: 'Stripe · Square · PayPal · Venmo · Cash App',
          body: 'Text-to-pay links on invoices and the customer report, paid into your own processor account. In-person card, cash and check payments are recorded on the RO with tips and surcharges.',
          status: payOn ? ['on', pay.label] : ['setup', 'Not set up'],
          action: <Link to="/settings?tab=payments" className="btn-secondary btn-sm">Settings</Link>,
        },
        {
          icon: HandCoins,
          name: 'Customer financing',
          by: shop.financing?.provider || 'Your lender',
          body: 'Show “as low as $/mo” on estimates and the customer report with a link to apply.',
          status: shop.financing?.enabled ? ['on', 'On'] : ['setup', 'Off'],
          action: <Link to="/settings?tab=payments" className="btn-secondary btn-sm">Settings</Link>,
        },
      ],
    },
    {
      title: 'Parts & vehicle data',
      items: [
        ...B2B_PLATFORMS.map((p) => ({
          icon: Package,
          name: p.name,
          by: 'Parts ordering',
          body: `${p.desc} Create a purchase order here to track it and receive parts into inventory and onto the RO.`,
          status: ['setup', 'Link'],
          action: (
            <span className="flex gap-1.5">
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                Open <ExtIcon size={12} />
              </a>
              <Link to="/parts?tab=orders" className="btn-plain btn-sm">POs</Link>
            </span>
          ),
        })),
        {
          icon: ScanLine,
          name: 'NHTSA vPIC & recalls',
          by: 'U.S. DOT',
          body: 'VIN decoding works offline from data stored with the app; open recalls are checked from NHTSA when online.',
          status: ['builtin', 'Built in'],
          action: <Link to="/vin" className="btn-secondary btn-sm">VIN decoder</Link>,
        },
      ],
    },
    {
      title: 'Calendar & data',
      items: [
        {
          icon: CalendarDays,
          name: 'Google · Apple · Outlook calendar',
          by: '.ics file',
          body: 'Download upcoming appointments as a calendar file to import into any calendar app.',
          status: ['builtin', 'Export'],
          action: (
            <button className="btn-secondary btn-sm" onClick={downloadIcs}>
              <Download size={12} /> .ics
            </button>
          ),
        },
        {
          icon: Upload,
          name: 'Data migration',
          by: 'Shopmonkey · Tekmetric · Mitchell 1 · spreadsheets',
          body: 'Import customers, vehicles and parts inventory from CSV with automatic column matching and duplicate checks.',
          status: ['builtin', 'Import'],
          action: <Link to="/import" className="btn-secondary btn-sm">Import</Link>,
        },
        {
          icon: Smartphone,
          name: 'Mobile app',
          by: 'iPhone · iPad · Android',
          body: 'Install AutoShop Pro on phones and tablets from the browser — it opens full-screen like a native app and works offline. Techs can clock in and snap inspection photos from the bay.',
          status: ['builtin', 'Install'],
          action: <Link to="/settings?tab=general#install" className="btn-secondary btn-sm">How to</Link>,
        },
      ],
    },
  ];

  return (
    <>
      <PageHeader title="Integrations" subtitle="Connect the services your shop already uses" />
      <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.title}>
            <h2 className="section-label mb-2">{g.title}</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {g.items.map((it) => (
                <Card key={it.name} className="flex flex-col p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-fill/[0.08] text-ink-2">
                      <it.icon size={18} strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{it.name}</div>
                      <div className="truncate text-xs text-ink-3">{it.by}</div>
                    </div>
                    <span className={`chip ${STATUS_STYLE[it.status[0]]}`}>{it.status[1]}</span>
                  </div>
                  <p className="mt-3 flex-1 text-sm text-ink-2">{it.body}</p>
                  <div className="mt-3 flex justify-end">{it.action}</div>
                </Card>
              ))}
            </div>
          </section>
        ))}
        <section>
          <h2 className="section-label mb-2">Vehicle history</h2>
          <HistorySection />
        </section>
        <p className="flex items-center gap-1.5 text-xs text-ink-3">
          Need something else connected? Everything can be exported from <Link to="/settings?tab=data" className="link">Settings → Data</Link> <ArrowRight size={11} />
        </p>
      </div>
    </>
  );
}
