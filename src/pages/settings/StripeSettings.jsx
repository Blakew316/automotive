// Settings → Payments & financing → Online card payments: connect the shop's Stripe account so
// pay links, the live status page and the customer report take cards, wallets, bank payments and
// pay-over-time, and payments land on the repair order by themselves — plus Stripe card readers at
// the counter.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Check, Lock, RefreshCw, FlaskConical, Nfc, Trash2, Plus } from 'lucide-react';
import { useShop, useSync, useAccess, useUI, usePay } from '../../store/hooks';
import { Card, CardHeader, Spinner, ExternalLink } from '../../components/ui';
import { shopPay } from '../../lib/sync/api';
import { PRODUCT } from '../../brand/artwork';

export default function StripeSettings() {
  const sync = useSync();
  const { role } = useAccess();
  const { toast } = useUI();
  const pay = usePay();
  const st = pay.status;
  const owner = role === 'owner';
  const [busy, setBusy] = useState(false);
  const { refresh } = pay;
  // Keys may have just been saved in Keys & AI: check again when this screen opens.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    setBusy(true);
    try {
      const r = await shopPay(sync.cfg, 'connect');
      toast(r.mode === 'test' ? 'Stripe connected in test mode' : 'Stripe connected — customers can pay online', { tone: 'success' });
      pay.refresh();
    } catch (e) {
      toast(e.message || 'Couldn’t connect Stripe', { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (!sync?.staff)
    return (
      <Card className="px-4 py-4 text-sm text-ink-2">
        <Lock size={16} className="mb-2 text-ink-3" />
        Online card payments run on your Shop Cloud server. Sign in under Settings → Shop Cloud to set them up.
      </Card>
    );

  const connected = st?.configured && st?.connected;
  return (
    <Card>
      <CardHeader
        title="Online card payments"
        icon={CreditCard}
        subtitle={connected ? `Stripe${st.account?.name ? ` · ${st.account.name}` : ''} · ${st.mode === 'test' ? 'test mode' : 'live'}` : 'Customers pay their balance from a text, the status page or the report — it’s recorded on the RO by itself'}
        actions={
          connected && owner ? (
            <button className="btn-plain btn-sm" onClick={connect} disabled={busy} title="Register the payment webhook again">
              {busy ? <Spinner size={13} /> : <RefreshCw size={13} />} Reconnect
            </button>
          ) : null
        }
      />
      {!st ? (
        <div className="flex items-center justify-center py-8 text-ink-3">
          <Spinner size={18} />
        </div>
      ) : connected ? (
        <div className="space-y-3 px-4 pb-4 text-sm">
          {st.mode === 'test' && (
            <p className="flex items-start gap-2 rounded-[10px] border border-warn/40 bg-warn/[0.07] px-3 py-2">
              <FlaskConical size={15} className="mt-0.5 shrink-0 text-warn" />
              <span>Test mode: no real money moves. Pay with card 4242 4242 4242 4242 to try it. Swap in your live secret key (sk_live_…) in Keys & AI, then choose Reconnect.</span>
            </p>
          )}
          {st.account && !st.account.chargesEnabled && <p className="rounded-[10px] bg-bad/[0.07] px-3 py-2 text-bad">Stripe hasn’t enabled payments on this account yet — finish the account setup in the Stripe dashboard.</p>}
          <ul className="space-y-1.5 text-ink-2">
            {[
              'Payment requests and ready-for-pickup texts include a secure pay link for the exact balance.',
              'Live status pages get a Pay button once the vehicle is ready; a new link is made whenever the balance changes.',
              'Payments are added to the repair order with the card and Stripe’s fee, and the RO closes when it’s paid in full.',
              'Refund from the payment on the RO (owner or manager).',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <Check size={14} className="mt-0.5 shrink-0 text-ok" /> {t}
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-3">
            Customers see the payment methods you turn on in Stripe — cards, Apple Pay and Google Pay, Link, ACH bank payments, and pay-over-time with Affirm, Klarna or Afterpay (for eligible amounts).{' '}
            <ExternalLink href="https://dashboard.stripe.com/settings/payment_methods">Choose payment methods in Stripe</ExternalLink>
          </p>
          <CardReaders />
        </div>
      ) : (
        <div className="space-y-3 px-4 pb-4 text-sm">
          <ol className="space-y-1.5">
            <li className="flex items-start gap-2">
              <Step n={1} /> Create a Stripe account (or use yours). <ExternalLink href="https://dashboard.stripe.com/register">Stripe</ExternalLink>
            </li>
            <li className="flex items-start gap-2">
              <Step n={2} done={st.configured} /> Paste the secret key (Developers → API keys) in <Link to="/settings?tab=keys" className="link">Keys & AI</Link>.
            </li>
            <li className="flex items-start gap-2">
              <Step n={3} /> Connect — {PRODUCT} registers its payment webhook in your Stripe account for you.
            </li>
          </ol>
          {st.configured &&
            (owner ? (
              <button className="btn-primary" onClick={connect} disabled={busy}>
                {busy ? <Spinner size={14} /> : <CreditCard size={15} />} Connect Stripe
              </button>
            ) : (
              <p className="text-ink-3">The owner connects Stripe.</p>
            ))}
          <p className="text-xs text-ink-3">Payments go straight to your Stripe account at Stripe’s standard rates. {PRODUCT} adds no fees.</p>
        </div>
      )}
    </Card>
  );
}

function Step({ n, done }) {
  return <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-2xs font-semibold ${done ? 'bg-ok text-white' : 'bg-fill/[0.1] text-ink-2'}`}>{done ? <Check size={11} /> : n}</span>;
}

/** Stripe smart readers at the counter: add by pairing code, see which are online, remove. */
function CardReaders() {
  const { state } = useShop();
  const sync = useSync();
  const { role } = useAccess();
  const { toast } = useUI();
  const pay = usePay();
  const st = pay.status;
  const owner = role === 'owner';
  const readers = st?.terminal?.readers || [];
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('Front counter');
  const [busy, setBusy] = useState('');
  const shop = state.shop;

  const add = async (registration) => {
    setBusy('add');
    try {
      const r = await shopPay(sync.cfg, 'registerReader', { code: registration, label: label.trim() || 'Front counter', shopName: shop.name, address: { line1: shop.address, city: shop.city, state: shop.state, postal: shop.zip, country: 'US' } });
      toast(`${r.reader.label} added`, { tone: 'success' });
      setCode('');
      pay.refresh();
    } catch (e) {
      toast(e.message || 'Couldn’t add the reader', { tone: 'error' });
    } finally {
      setBusy('');
    }
  };
  const remove = async (r) => {
    setBusy(r.id);
    try {
      await shopPay(sync.cfg, 'removeReader', { readerId: r.id });
      toast(`${r.label} removed`);
      pay.refresh();
    } catch (e) {
      toast(e.message || 'Couldn’t remove the reader', { tone: 'error' });
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="rounded-[10px] border border-line px-3 py-3" data-testid="card-readers">
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <Nfc size={15} className="text-hue-indigo" /> Card readers at the counter
      </div>
      {readers.length > 0 && (
        <ul className="mb-3 divide-y divide-line/70 rounded-[8px] border border-line/70">
          {readers.map((r) => (
            <li key={r.id} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{r.label}</div>
                <div className="text-xs text-ink-3">{[r.simulated ? 'Simulated reader' : r.type.replace(/_/g, ' '), r.serial].filter(Boolean).join(' · ')}</div>
              </div>
              <span className={`pill ${r.status === 'online' ? 'bg-ok/[0.1] text-ok' : 'bg-fill/[0.1] text-ink-3'}`}>{r.status === 'online' ? 'Online' : 'Offline'}</span>
              {owner && (
                <button className="btn-ghost btn-icon btn-sm text-ink-3 hover:text-bad" onClick={() => remove(r)} disabled={busy === r.id} aria-label={`Remove ${r.label}`}>
                  {busy === r.id ? <Spinner size={13} /> : <Trash2 size={14} />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {owner ? (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Pairing code, e.g. sepia-cerulean-aardvark" aria-label="Reader pairing code" />
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name, e.g. Front counter" aria-label="Reader name" />
            <button className="btn-secondary" onClick={() => add(code.trim())} disabled={!code.trim() || busy === 'add'}>
              {busy === 'add' ? <Spinner size={13} /> : <Plus size={14} />} Add reader
            </button>
          </div>
          {st?.mode === 'test' && (
            <button className="btn-plain btn-sm" onClick={() => add('simulated-wpe')} disabled={busy === 'add'}>
              <FlaskConical size={13} /> Add a simulated reader (test mode)
            </button>
          )}
        </div>
      ) : (
        !readers.length && <p className="text-ink-3">The owner adds card readers.</p>
      )}
      <p className="mt-2 text-xs text-ink-3">
        Works with Stripe’s internet-connected smart readers (Stripe Reader S700 or BBPOS WisePOS E, bought from Stripe): on the reader, open Settings → Generate pairing code. From an RO, “Take payment” sends the amount to the reader and the payment lands on the RO when it’s approved — with the tip and any surcharge. Bluetooth readers and Tap to Pay on a phone need Stripe’s mobile apps; payments taken there can be recorded on the RO by hand.{' '}
        <ExternalLink href="https://stripe.com/terminal">Stripe Terminal</ExternalLink>
      </p>
    </div>
  );
}
