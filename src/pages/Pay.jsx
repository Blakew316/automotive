// Public pay page (/pay/<link id>?p=<project>): opened from a texted or emailed pay link. Shows the
// shop, the repair order and the amount, then hands off to Stripe Checkout — cards, Apple Pay,
// Google Pay, and pay-over-time or bank options when the shop has them on in Stripe. No sign-in and
// no shop data beyond what's on the link.
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CreditCard, Lock, CheckCircle2, Link2Off, Phone, FlaskConical } from 'lucide-react';
import { PoweredBy, ShopBrand } from '../brand/Logo';
import { titleName, usePageTitle } from '../brand/title';
import { EmptyState, Spinner } from '../components/ui';
import { payFunction } from '../lib/payments';
import { SHOP_CLOUD } from '../lib/cloudDefaults';
import { money, phone as fmtPhone, telHref, dateShort } from '../lib/format';

const defaultRef = () => /^https:\/\/([a-z0-9]{20})\.supabase\./i.exec(SHOP_CLOUD?.url || '')?.[1] || '';

export default function Pay() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const ref = /^[a-z0-9]{20}$/i.test(params.get('p') || '') ? params.get('p') : defaultRef();
  const justPaid = params.get('paid') === '1';
  const valid = Boolean(ref) && /^[A-Za-z0-9]{8,24}$/.test(id || '');
  const [data, setData] = useState(null);
  const [error, setError] = useState(valid ? '' : 'This payment link is incomplete. Please contact the shop.');
  const [busy, setBusy] = useState(false);
  usePageTitle(data ? `Pay ${titleName(data.shop)}` : '');

  useEffect(() => {
    if (!valid) return undefined;
    let alive = true;
    let tries = 0;
    const load = async () => {
      try {
        const res = await fetch(`${payFunction(ref)}?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.message || 'This payment link isn’t available.');
        if (!alive) return;
        setData(json);
        // Back from checkout: Stripe confirms the payment a moment later.
        if (justPaid && json.status === 'open' && tries++ < 10) setTimeout(load, 2000);
      } catch (e) {
        if (alive) setError(e.message);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [valid, ref, id, justPaid]);

  const pay = async () => {
    setBusy(true);
    try {
      const res = await fetch(payFunction(ref), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) throw new Error(json.message || 'Online payment isn’t available right now.');
      window.location.assign(json.url);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  if (!data && !error)
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-canvas text-ink-3">
        <Spinner size={22} />
      </div>
    );
  if (!data)
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-canvas px-4">
        <EmptyState icon={Link2Off} title="Payment link unavailable" body={error} />
      </div>
    );

  const paid = data.status === 'paid';
  const processing = justPaid && !paid;
  return (
    <div className="min-h-[100dvh] bg-canvas">
      <header className="customer-header">
        <div className="mx-auto max-w-md px-4 pb-8 pt-6">
          <ShopBrand name={data.shop} />
          <p className="mt-6 text-sm text-ink-3">{data.title || (data.ro ? `Repair order #${data.ro}` : 'Invoice')}</p>
          <h1 className="tabular mt-1 text-4xl font-bold tracking-tight">{money(data.amount)}</h1>
          <p className="mt-1 text-sm text-ink-3">{paid ? `Paid${data.paidAt ? ` ${dateShort(data.paidAt)}` : ''}` : 'Amount due'}</p>
        </div>
      </header>
      <main className="mx-auto max-w-md space-y-4 px-4 py-6">
        {data.test && (
          <p className="flex items-center gap-2 rounded-[10px] border border-warn/40 bg-warn/[0.08] px-3 py-2 text-sm">
            <FlaskConical size={15} className="shrink-0 text-warn" /> Test mode — no real charge. Use card 4242 4242 4242 4242.
          </p>
        )}
        {paid || processing ? (
          <section className="card p-6 text-center">
            <span className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${paid ? 'bg-ok/15 text-ok' : 'bg-accent/10 text-accent'}`}>{paid ? <CheckCircle2 size={24} /> : <Spinner size={20} />}</span>
            <h2 className="text-lg font-semibold">{paid ? 'Thank you — you’re all paid' : 'Confirming your payment…'}</h2>
            <p className="mt-1 text-sm text-ink-2">{paid ? `${data.shop || 'The shop'} has your payment. A receipt is on its way if you gave your email.` : 'This takes a few seconds. You can close this page — the shop will see your payment.'}</p>
          </section>
        ) : (
          <section className="card space-y-4 p-5">
            {error && <p className="rounded-[8px] bg-bad/[0.07] px-3 py-2 text-sm text-bad">{error}</p>}
            <button className="btn-primary btn-lg h-12 w-full text-[15px]" onClick={pay} disabled={busy || !data.ready}>
              {busy ? <Spinner size={16} /> : <CreditCard size={17} />} Pay {money(data.amount)}
            </button>
            <p className="text-center text-xs text-ink-3">Card, Apple Pay or Google Pay. Pay-over-time options appear at checkout when available.</p>
            <p className="flex items-center justify-center gap-1.5 text-xs text-ink-3">
              <Lock size={12} /> Secure checkout by Stripe — the shop never sees your card number.
            </p>
          </section>
        )}
        {data.phone && (
          <a href={telHref(data.phone)} className="btn-secondary btn-lg h-12 w-full">
            <Phone size={16} /> Questions? Call {fmtPhone(data.phone)}
          </a>
        )}
        <PoweredBy name={data.shop} className="pt-4" />
      </main>
    </div>
  );
}
