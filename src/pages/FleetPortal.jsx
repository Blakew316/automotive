// Public fleet portal: a fleet manager's view of their units, maintenance due, what's in the shop,
// open invoices and the balance. Reads only the small file the shop publishes for this account.
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Phone, CalendarPlus, CreditCard, Link2Off, RefreshCw, Activity, FileText, Truck } from 'lucide-react';
import { PoweredBy, ShopBrand } from '../brand/Logo';
import { titleName, usePageTitle } from '../brand/title';
import { EmptyState, Spinner, Segmented } from '../components/ui';
import AgingBar from '../components/AgingBar';
import { parseShareSource } from '../lib/cloudShare';
import { phone as fmtPhone, telHref, money, relTime, dateShort, number } from '../lib/format';

const REFRESH_MS = 60_000;
const DOT = { overdue: 'bg-bad', due: 'bg-warn', ok: 'bg-ok', unknown: 'bg-ink-4' };
const TONE = { overdue: 'text-bad', due: 'text-warn', ok: 'text-ink-2', unknown: 'text-ink-3' };
const WORD = { unknown: 'No record yet' };

export default function FleetPortal() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const source = parseShareSource(params.get('from') || '', 'fleet');
  const [data, setData] = useState(null);
  const [error, setError] = useState(source ? '' : 'This link is incomplete.');
  const [filter, setFilter] = useState('all');
  usePageTitle(data ? `${data.company || 'Fleet account'} — ${titleName(data.shop?.name)}` : '');

  useEffect(() => {
    if (!source || !/^[\w-]{10,64}$/.test(id || '')) return undefined;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`${source}/${encodeURIComponent(id)}.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(res.status === 400 || res.status === 404 ? 'This fleet page isn’t available.' : 'Couldn’t load the latest information.');
        const json = await res.json();
        if (!alive) return;
        if (json.revoked) throw new Error('This fleet page has been turned off. Contact the shop for a new link.');
        setData(json);
        setError('');
      } catch (e) {
        if (alive) setError(e.message);
      }
    };
    load();
    const t = setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [source, id]);

  const units = useMemo(() => {
    const list = data?.units || [];
    if (filter === 'pm') return list.filter((u) => u.worst === 'overdue' || u.worst === 'due');
    if (filter === 'shop') return list.filter((u) => u.open);
    return list;
  }, [data, filter]);

  if (!data && !error)
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-canvas text-ink-3">
        <Spinner size={22} />
      </div>
    );
  if (!data)
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-canvas px-4">
        <EmptyState icon={Link2Off} title="Fleet page unavailable" body={error} />
      </div>
    );

  const needPm = data.units.filter((u) => u.worst === 'overdue' || u.worst === 'due').length;
  const inShop = data.units.filter((u) => u.open).length;

  return (
    <div className="min-h-[100dvh] bg-canvas">
      <header className="customer-header">
        <div className="mx-auto max-w-4xl px-4 pb-7 pt-6">
          <ShopBrand name={data.shop.name} />
          <h1 className="mt-5 text-3xl font-bold tracking-tight">{data.company}</h1>
          <p className="mt-1 text-[15px] text-ink-3">Fleet account · {data.terms}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeaderStat label="Units" value={data.units.length} />
            <HeaderStat label="Need maintenance" value={needPm} />
            <HeaderStat label="In the shop" value={inShop} />
            <HeaderStat label="Balance" value={money(data.balance)} sub={data.pastDue > 0 ? `${money(data.pastDue)} past due` : 'Nothing past due'} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <div className="grid gap-2 sm:grid-cols-3">
          {data.payLink && (
            <a href={data.payLink} target="_blank" rel="noopener noreferrer" className="btn-primary btn-lg h-12">
              <CreditCard size={16} /> Pay {money(data.balance)}
            </a>
          )}
          {data.bookLink && (
            <a href={data.bookLink} className="btn-secondary btn-lg h-12">
              <CalendarPlus size={16} /> Schedule service
            </a>
          )}
          {data.shop.phone && (
            <a href={telHref(data.shop.phone)} className="btn-secondary btn-lg h-12">
              <Phone size={16} /> Call {fmtPhone(data.shop.phone)}
            </a>
          )}
        </div>

        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 px-4 py-3">
            <h2 className="flex items-center gap-2 font-semibold">
              <Truck size={16} className="text-ink-3" /> Units
            </h2>
            <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'pm', label: `Need maintenance${needPm ? ` · ${needPm}` : ''}` }, { value: 'shop', label: `In the shop${inShop ? ` · ${inShop}` : ''}` }]} />
          </div>
          {units.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-3">{filter === 'pm' ? 'Every unit is up to date.' : filter === 'shop' ? 'Nothing in the shop right now.' : 'No units on file.'}</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {units.map((u, i) => (
                <li key={`${u.unit}-${u.vin}-${i}`} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] sm:items-start">
                  <div className="min-w-0">
                    <div className="font-semibold">{u.unit ? `Unit ${u.unit}` : u.vehicle}</div>
                    <div className="text-xs text-ink-3">{[u.unit && u.vehicle, u.plate, u.vin && `VIN …${u.vin}`].filter(Boolean).join(' · ')}</div>
                    <div className="text-xs text-ink-3">{[u.mileage && `${number(u.mileage)} mi`, u.driver].filter(Boolean).join(' · ')}</div>
                  </div>
                  <ul className="space-y-0.5 text-sm">
                    {u.pm.map((p) => (
                      <li key={p.label} className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[p.status]}`} />
                        <span>{p.label}</span>
                        <span className={`text-xs ${TONE[p.status]}`}>{p.status === 'unknown' ? WORD.unknown : p.text}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="text-sm sm:text-right">
                    {u.open ? (
                      <>
                        <div className="font-medium">RO #{u.open.ro} · {u.open.status}</div>
                        <div className="mt-1 flex gap-2 sm:justify-end">
                          {u.open.track && (
                            <a href={u.open.track} className="link inline-flex items-center gap-1 text-xs">
                              <Activity size={12} /> Live status
                            </a>
                          )}
                          {u.open.report && (
                            <a href={u.open.report} className="link inline-flex items-center gap-1 text-xs">
                              <FileText size={12} /> Estimate & photos
                            </a>
                          )}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-ink-3">Not in the shop</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="border-b border-line/70 px-4 py-3">
            <h2 className="font-semibold">Open invoices</h2>
            <p className="text-xs text-ink-3">{data.invoices.length ? `${data.invoices.length} open · ${money(data.balance)}` : 'Nothing owed — thank you!'}</p>
          </div>
          {data.invoices.length > 0 && (
            <>
              <AgingBar buckets={data.aging} className="border-b border-line/70 px-4 py-4" />
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th className="hidden sm:table-cell">Unit</th>
                      <th>Due</th>
                      <th className="text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoices.map((inv) => (
                      <tr key={inv.ro}>
                        <td>
                          <div className="tabular font-medium">#{inv.ro}</div>
                          <div className="text-xs text-ink-3">{dateShort(inv.date)}{inv.po ? ` · PO ${inv.po}` : ''}</div>
                        </td>
                        <td className="hidden text-ink-2 sm:table-cell">{inv.unit}</td>
                        <td className={inv.pastDue > 0 ? 'text-bad' : 'text-ink-2'}>
                          {dateShort(inv.due)}
                          {inv.pastDue > 0 && <span className="block text-xs">{inv.pastDue} days past due</span>}
                        </td>
                        <td className="tabular text-right font-medium">{money(inv.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {data.payments.length > 0 && (
          <section className="card px-4 py-3">
            <h2 className="mb-2 font-semibold">Recent payments</h2>
            <ul className="space-y-1.5 text-sm">
              {data.payments.map((p, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>
                    {dateShort(p.at)} · {p.method}
                    {p.ref ? ` ${p.ref}` : ''}
                    <span className="block text-xs text-ink-3">Invoice {p.ros.map((n) => `#${n}`).join(', ')}</span>
                  </span>
                  <span className="tabular font-medium">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-ink-3">
          {data.shop.address && <span>{data.shop.address}</span>}
          <span className="flex items-center gap-1">
            <RefreshCw size={11} /> Updated {relTime(data.updatedAt)} · refreshes automatically
          </span>
          {error && <span className="text-warn">{error}</span>}
        </p>
        <PoweredBy name={data.shop.name} />
      </main>
    </div>
  );
}

function HeaderStat({ label, value, sub }) {
  return (
    <div className="rounded-[10px] bg-surface/80 px-3 py-2.5 ring-1 ring-line">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="tabular text-xl font-semibold">{value}</div>
      {sub && <div className="text-[11px] text-ink-3">{sub}</div>}
    </div>
  );
}
