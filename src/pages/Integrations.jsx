import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cloud, Landmark, Package, FileClock, CreditCard, HandCoins, MessageSquare, Star, CalendarDays, ScanLine, Upload, Download, ExternalLink as ExtIcon, ArrowRight, Smartphone, Globe, PhoneCall, Sparkles, Radio, Link2, Mail, Nfc } from 'lucide-react';
import { useShop, useUI, useSync, useAccess, usePhone, usePay, useEmail } from '../store/hooks';
import { shopQbo, shopCars } from '../lib/sync/api';
import { phone as fmtPhone } from '../lib/format';
import { PageHeader, Card } from '../components/ui';
import { HistorySection } from './settings/IntegrationSections';
import { cloudConfig, cloudSession } from '../lib/cloudShare';
import { SHOP_CLOUD } from '../lib/cloudDefaults';
import { PAY_PROVIDERS } from '../lib/messaging';
import { B2B_PLATFORMS } from '../lib/suppliers';
import { appointmentsIcs } from '../lib/ics';
import { bookingLink, websiteLink, webHref } from '../lib/booking';
import { PRODUCT } from '../brand/artwork';

const STATUS_STYLE = {
  on: 'border-ok/40 bg-ok/[0.08] text-ok',
  setup: 'border-line text-ink-3',
  builtin: 'border-accent/30 bg-accent/[0.06] text-accent',
};

/** QuickBooks and connected-car status from the shop's server (the phone line and Stripe come from their providers). */
function useServerStatus() {
  const sync = useSync();
  const { role } = useAccess();
  const cfg = sync?.cfg;
  const staff = Boolean(sync?.staff && cfg);
  const manager = ['owner', 'manager'].includes(role);
  const [st, setSt] = useState({});
  useEffect(() => {
    if (!staff) return undefined;
    let alive = true;
    if (manager) shopQbo(cfg, 'status').then((qbo) => alive && setSt((s) => ({ ...s, qbo })), () => {});
    shopCars(cfg, 'status', { vehicleIds: [] }).then((cars) => alive && setSt((s) => ({ ...s, cars })), () => {});
    return () => {
      alive = false;
    };
  }, [staff, manager, cfg]);
  return staff ? st : {};
}

export default function Integrations() {
  const { state } = useShop();
  const { toast } = useUI();
  const phoneLine = usePhone();
  const stripe = usePay();
  const email = useEmail();
  const server = useServerStatus();
  const shop = state.shop;
  const cfg = cloudConfig(shop);
  const signedIn = Boolean(cfg && cloudSession()?.url === cfg.url);
  const pay = PAY_PROVIDERS.find((p) => p.value === shop.payments?.provider);
  const payOn = pay && pay.value !== 'none' && (shop.payments.link || shop.payments.handle);
  const site = websiteLink(state);

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
          by: cfg?.url === SHOP_CLOUD.url ? `${PRODUCT} cloud · Supabase` : 'Supabase (your own project)',
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
          name: 'Your website',
          by: 'Your shop’s own site',
          body: 'Link your shop’s own website and add a Book online button that opens your booking page.',
          status: site ? ['on', 'Live'] : ['setup', 'Add address'],
          action: (
            <span className="flex gap-1.5">
              {site && (
                <a href={webHref(site)} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                  Open <ExtIcon size={12} />
                </a>
              )}
              <Link to="/settings?tab=website" className="btn-plain btn-sm">{site ? 'Details' : 'Set up'}</Link>
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
          icon: PhoneCall,
          name: 'Business texting & calls',
          by: 'Twilio · your shop’s own number',
          body: 'Two-way texts and calls from the shop number, logged on the customer — with appointment reminders sent on schedule, photos from customers, voicemail, and an AI receptionist that can answer when you’re busy.',
          status: phoneLine.connected ? ['on', phoneLine.status?.phone ? fmtPhone(phoneLine.status.phone) : 'Connected'] : phoneLine.status?.configured ? ['setup', 'Connect number'] : ['setup', 'Not set up'],
          action: <Link to="/settings?tab=messaging" className="btn-secondary btn-sm">{phoneLine.connected ? 'Settings' : 'Set up'}</Link>,
        },
        {
          icon: Mail,
          name: 'Email from your address',
          by: 'Resend · your own domain',
          body: 'Estimates, invoices and receipts go out as PDF attachments from your shop’s address, with Delivered, Opened and Bounced on each message — plus a daily summary email for the owner.',
          status: email.ready ? ['on', 'On'] : email.status?.configured ? ['setup', 'Verify domain'] : ['setup', 'Not set up'],
          action: <Link to="/settings?tab=messaging#email" className="btn-secondary btn-sm">{email.ready ? 'Settings' : 'Set up'}</Link>,
        },
        {
          icon: MessageSquare,
          name: 'Phone & email apps',
          by: 'Your device',
          body: 'Without a business line, messages open in this device’s Messages or Mail app so they come from your own number and address — and are still logged on the customer. Customers can also reply from their report link.',
          status: ['builtin', 'Built in'],
          action: <Link to="/messages" className="btn-secondary btn-sm">Messages</Link>,
        },
        {
          icon: Sparkles,
          name: 'AI assistant',
          by: 'Claude · your Anthropic account',
          body: 'Drafts estimate explanations, status texts and replies, writes cause & correction from tech notes, suggests diagnostic plans and summarizes customers. Staff review everything before it goes out.',
          status: phoneLine.status?.aiReady ? ['on', 'On'] : ['setup', 'Add key'],
          action: <Link to="/settings?tab=keys" className="btn-secondary btn-sm">Keys &amp; AI</Link>,
        },
      ],
    },
    {
      title: 'Money',
      items: [
        {
          icon: Landmark,
          name: 'QuickBooks Online',
          by: 'Intuit · direct sync',
          body: 'Each day’s sales, payments, sales tax, tips and card fees post to QuickBooks as one journal entry — automatically every day, or by hand. Invoice, payment, expense and customer exports also work with Xero, Wave and spreadsheets.',
          status: server.qbo?.connected && !server.qbo.error ? ['on', server.qbo.env === 'production' ? (shop.qbo?.auto ? 'Syncing daily' : 'Connected') : 'Sandbox'] : server.qbo?.connected ? ['setup', 'Reconnect'] : server.qbo?.configured ? ['setup', 'Connect'] : ['builtin', 'CSV export'],
          action: <Link to="/accounting?tab=export" className="btn-secondary btn-sm">{server.qbo?.connected ? 'Sync' : 'Set up'}</Link>,
        },
        {
          icon: CreditCard,
          name: 'Online card payments',
          by: 'Stripe · your own account',
          body: 'Customers pay their balance from a text, the live status page or the report — cards, Apple Pay, Google Pay, bank and pay-over-time — and the payment lands on the RO by itself, with refunds from the RO.',
          status: stripe.ready ? ['on', stripe.status?.mode === 'test' ? 'Test mode' : 'Live'] : stripe.status?.configured ? ['setup', 'Connect'] : ['setup', 'Not set up'],
          action: <Link to="/settings?tab=payments" className="btn-secondary btn-sm">{stripe.ready ? 'Settings' : 'Set up'}</Link>,
        },
        {
          icon: Nfc,
          name: 'Card readers at the counter',
          by: 'Stripe Terminal · smart readers',
          body: 'Send the amount from the RO to a Stripe reader; the customer taps, inserts or swipes, and the payment lands on the RO with the tip, card and fee.',
          status: stripe.readers?.length ? ['on', `${stripe.readers.length} reader${stripe.readers.length === 1 ? '' : 's'}`] : stripe.ready ? ['setup', 'Add a reader'] : ['setup', 'Connect Stripe first'],
          action: <Link to="/settings?tab=payments" className="btn-secondary btn-sm">{stripe.readers?.length ? 'Settings' : 'Set up'}</Link>,
        },
        {
          icon: Link2,
          name: 'Other payment links',
          by: 'Square · PayPal · Venmo · Cash App',
          body: 'Prefer another processor? Add your pay link or handle and it’s included on invoices and the customer report. In-person card, cash and check payments are recorded on the RO with tips and surcharges.',
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
          icon: Radio,
          name: 'Connected cars',
          by: 'Smartcar · with the owner’s consent',
          body: 'Text a customer a link to connect their car, then see its real odometer, oil life, tire pressures and fuel on the vehicle page. Mileage stays current and oil-change reminders go out when the car says so.',
          status: server.cars?.configured ? ['on', shop.cars?.mode === 'simulated' ? 'Simulated' : 'Ready'] : ['setup', 'Not set up'],
          action: <Link to="/settings?tab=general#connected-cars" className="btn-secondary btn-sm">{server.cars?.configured ? 'Settings' : 'Set up'}</Link>,
        },
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
          body: `Install ${PRODUCT} on phones and tablets from the browser — it opens full-screen like a native app and works offline. Techs can clock in and snap inspection photos from the bay.`,
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
                <Card key={it.name} className="flex flex-col p-4" role="group" aria-label={it.name}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-fill/[0.08] text-ink-2">
                      <it.icon size={18} strokeWidth={1.8} />
                    </span>
                    {/* The by-line runs under the status too, so a long one (the cloud's full name) wraps instead of squeezing. */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 font-semibold">{it.name}</div>
                        <span className={`chip shrink-0 ${STATUS_STYLE[it.status[0]]}`}>{it.status[1]}</span>
                      </div>
                      <div className="text-xs text-ink-3">{it.by}</div>
                    </div>
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
