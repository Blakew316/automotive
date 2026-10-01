// Waiting-room screen for a lobby TV: where every vehicle in the shop is right now (first name and
// last initial only), plus the shop's messages, Wi-Fi and the self check-in code. Updates live as
// the shop's data changes; pages through long lists on its own.
import { useEffect, useMemo, useState } from 'react';
import { Wrench, Wifi, CircleCheck } from 'lucide-react';
import { useScopedShop, useSite } from '../store/hooks';
import QrCode from '../components/QrCode';
import { lobbyRows, checkinLink } from '../lib/operations';
import { time } from '../lib/format';

const PER_PAGE = 8;
const TONE = { ready: 'bg-ok text-white', in_progress: 'bg-accent text-on-accent', waiting_parts: 'bg-warn/90 text-ink', approved: 'bg-fill/[0.14] text-ink', estimate: 'bg-fill/[0.14] text-ink' };

export default function Lobby() {
  const { state } = useScopedShop();
  const site = useSite();
  const [now, setNow] = useState(() => new Date());
  const [page, setPage] = useState(0);
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  const rows = useMemo(() => lobbyRows(state, now), [state, now]);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const lobby = state.shop.frontDesk?.lobby || {};
  const messages = (lobby.messages || []).filter(Boolean);
  useEffect(() => {
    const t = setInterval(() => {
      setPage((p) => (p + 1) % pages);
      setTip((x) => x + 1);
    }, 12_000);
    return () => clearInterval(t);
  }, [pages]);
  const shown = rows.slice((page % pages) * PER_PAGE, (page % pages) * PER_PAGE + PER_PAGE);
  const link = checkinLink(state, site.current);

  return (
    <div className="force-light flex min-h-[100dvh] flex-col bg-canvas text-ink">
      <header className="flex items-center gap-4 bg-graphite px-10 py-6 text-white">
        <span className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-white/10">
          <Wrench size={24} />
        </span>
        <div className="flex-1">
          <div className="text-3xl font-bold tracking-tight">{state.shop.name}</div>
          <div className="text-lg text-white/70">Vehicle status</div>
        </div>
        <div className="tabular text-4xl font-semibold">{now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
      </header>

      <main className="grid flex-1 gap-8 px-10 py-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          {rows.length === 0 ? (
            <p className="mt-20 text-center text-2xl text-ink-3">No vehicles in progress right now.</p>
          ) : (
            <ul className="space-y-3">
              {shown.map((r) => (
                <li key={r.id} className={`flex items-center gap-6 rounded-[14px] bg-surface px-6 py-4 shadow-card ${r.status === 'ready' ? 'ring-2 ring-ok/60' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-2xl font-semibold">{r.name}</div>
                    <div className="truncate text-lg text-ink-2">{r.vehicle}</div>
                  </div>
                  {r.promisedAt && r.status !== 'ready' && <div className="text-lg text-ink-2">Est. {time(r.promisedAt)}</div>}
                  <span className={`flex items-center gap-2 rounded-full px-4 py-2 text-lg font-semibold ${TONE[r.status] || TONE.approved}`}>
                    {r.status === 'ready' && <CircleCheck size={20} />} {r.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {pages > 1 && (
            <p className="mt-4 text-center text-base text-ink-3">
              Page {(page % pages) + 1} of {pages}
            </p>
          )}
          {rows.some((r) => r.status === 'ready') && <p className="mt-6 text-center text-xl font-medium text-ok">Ready vehicles: please see the front counter.</p>}
        </section>

        <aside className="space-y-6">
          {messages.length > 0 && (
            <div className="rounded-[14px] bg-surface px-6 py-5 text-xl leading-snug shadow-card">{messages[tip % messages.length]}</div>
          )}
          {lobby.wifiName && (
            <div className="rounded-[14px] bg-surface px-6 py-5 shadow-card">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Wifi size={20} className="text-ink-3" /> Free Wi-Fi
              </div>
              <div className="mt-1 text-xl">{lobby.wifiName}</div>
              {lobby.wifiPassword && <div className="text-lg text-ink-2">Password: {lobby.wifiPassword}</div>}
            </div>
          )}
          {link && state.shop.frontDesk?.checkin?.enabled && (
            <div className="flex items-center gap-4 rounded-[14px] bg-surface px-6 py-5 shadow-card">
              <QrCode text={link} size={110} label="Check-in QR code" />
              <div className="text-lg leading-snug">
                <div className="font-semibold">Checking in?</div>
                <div className="text-ink-2">Scan to skip the line</div>
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
