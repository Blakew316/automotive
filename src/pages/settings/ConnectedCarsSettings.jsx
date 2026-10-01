// Settings → General → Connected cars: set up Smartcar so the shop can text customers a link to
// connect their car, then read its odometer, oil life and tire pressures from the vehicle page.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, Check, Lock } from 'lucide-react';
import { useShop, useSync } from '../../store/hooks';
import { Segmented, Spinner, ExternalLink, CopyButton } from '../../components/ui';
import Section from './Section';
import { shopCars } from '../../lib/sync/api';
import { CAR_MODES } from '../../lib/connectedCars';

export default function ConnectedCarsSettings() {
  const { state, updateShop } = useShop();
  const sync = useSync();
  const cfg = sync?.cfg;
  const staff = Boolean(sync?.staff && cfg);
  const [status, setStatus] = useState(null);
  const mode = state.shop.cars?.mode === 'simulated' ? 'simulated' : 'live';

  useEffect(() => {
    if (!staff) return undefined;
    let alive = true;
    shopCars(cfg, 'status', { vehicleIds: [] })
      .then((st) => alive && setStatus(st))
      .catch(() => alive && setStatus({ error: true }));
    return () => {
      alive = false;
    };
  }, [staff, cfg]);

  return (
    <Section id="connected-cars" icon={Radio} title="Connected cars" subtitle="Real mileage, oil life and tire pressures from customers’ cars, with their permission">
      {!staff ? (
        <p className="flex items-start gap-2 text-sm text-ink-2">
          <Lock size={15} className="mt-0.5 shrink-0 text-ink-3" />
          Connected cars run on your Shop Cloud server. Sign in under Settings → Shop Cloud to set them up.
        </p>
      ) : !status ? (
        <div className="flex justify-center py-4 text-ink-3">
          <Spinner size={16} />
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <p className="text-ink-2">
            From a vehicle’s page, text the owner a link. They sign in to their car maker’s connected-services account through Smartcar and approve read-only access (no unlocking, starting or location). The vehicle page then shows the car’s odometer, oil life, tire pressures and fuel or charge, the vehicle’s mileage stays current, and oil-change reminders go out when the car says so.
          </p>
          <ol className="space-y-2.5">
            <Step n={1} done={status.configured}>
              Create a Smartcar account at <ExternalLink href="https://dashboard.smartcar.com">dashboard.smartcar.com</ExternalLink> and an application.
            </Step>
            <Step n={2} done={status.configured}>
              In the application’s <b>Configuration</b>, add this redirect URI:
              {status.redirectUri && (
                <span className="mt-1 flex items-center gap-1 rounded-[8px] bg-fill/[0.08] px-2 py-1">
                  <code className="min-w-0 flex-1 truncate font-mono text-xs" data-testid="cars-redirect">{status.redirectUri}</code>
                  <CopyButton text={status.redirectUri} label="Copy redirect URI" />
                </span>
              )}
            </Step>
            <Step n={3} done={status.configured}>
              Paste its Client ID and Client secret in <Link to="/settings?tab=keys" className="link">Settings → Keys &amp; AI</Link>.
            </Step>
          </ol>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium">Connect links use</span>
            <Segmented size="sm" options={CAR_MODES} value={mode} onChange={(m) => updateShop({ cars: { ...(state.shop.cars || {}), mode: m } })} />
          </div>
          <p className="rounded-[10px] bg-fill/[0.06] px-3 py-2 text-xs text-ink-3">
            Simulated mode connects Smartcar’s test vehicles so you can try it end to end. Smartcar is a paid service beyond its free developer tier, and which readings are available depends on the make, model and year — most 2015-and-newer cars from the larger brands are covered, and the owner needs an active account with the maker’s app. Owners can disconnect anytime from their maker’s app or by asking you.
          </p>
        </div>
      )}
    </Section>
  );
}

function Step({ n, done, children }) {
  return (
    <li className="flex gap-2.5">
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-2xs font-semibold ${done ? 'bg-ok text-white' : 'bg-fill/[0.12] text-ink-2'}`}>{done ? <Check size={12} strokeWidth={3} /> : n}</span>
      <div className="min-w-0 flex-1 text-ink-2">{children}</div>
    </li>
  );
}
