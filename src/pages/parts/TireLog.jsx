// Tires: installed-tire DOT log for registration and recalls, plus tire stock at a glance.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Disc3, Download, ShieldCheck, ShieldAlert, TriangleAlert } from 'lucide-react';
import { useShop, useUI } from '../../store/hooks';
import { Card, CardHeader, EmptyState, Segmented, Toggle, Stat } from '../../components/ui';
import { tireLog, tireLogCsvRows, TIRE_LOG_COLUMNS, checkTin } from '../../lib/tires';
import { groupOf } from '../../lib/inventory';
import { toCsv } from '../../lib/serviceHistory';
import { downloadCsv } from '../../lib/accounting';
import { date, fullName, vehicleName, money0, number } from '../../lib/format';

export default function TireLog() {
  const { state, updateService } = useShop();
  const { toast } = useUI();
  const [filter, setFilter] = useState('all');
  const rows = useMemo(() => tireLog(state), [state]);
  const sets = useMemo(() => {
    // One row per installed set (service), for registration status.
    const m = new Map();
    for (const r of rows) if (!m.has(r.service.id)) m.set(r.service.id, r);
    return [...m.values()];
  }, [rows]);
  const missingDot = rows.filter((r) => !checkTin(r.dot).ok).length;
  const unregistered = sets.filter((r) => !r.registered).length;
  const tires = state.inventory.filter((p) => groupOf(p) === 'tires');
  const shown = sets.filter((r) => filter === 'all' || (filter === 'open' ? !r.registered || r.service.tires.dots.filter((d) => checkTin(d).ok).length < r.service.tires.qty : r.registered));

  const exportCsv = () => {
    downloadCsv(toCsv(TIRE_LOG_COLUMNS, tireLogCsvRows(rows)), `tire-registrations-${new Date().toISOString().slice(0, 10)}.csv`);
    toast('Tire log exported', { tone: 'success' });
  };

  return (
    <>
      <Card className="mb-5 grid grid-cols-2 divide-line p-1 lg:grid-cols-4 lg:divide-x">
        <Stat label="Tires installed" value={number(rows.length)} sub={`${sets.length} sets on invoiced ROs`} />
        <Stat label="Sets not registered" value={number(unregistered)} sub="Register so owners get recall notices" />
        <Stat label="Missing DOT numbers" value={number(missingDot)} sub="Enter the TIN from each sidewall" />
        <Stat label="Tires in stock" value={number(tires.reduce((s, p) => s + (Number(p.qty) || 0), 0))} sub={`${money0(tires.reduce((s, p) => s + p.qty * p.cost, 0))} at cost`} to="/parts?tab=inventory" />
      </Card>

      <Card>
        <CardHeader
          icon={Disc3}
          tone="slate"
          title="Tire registration log"
          subtitle="Every tire set installed, with DOT Tire Identification Numbers"
          actions={
            <>
              <Segmented
                size="sm"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'open', label: 'Needs attention' },
                  { value: 'done', label: 'Registered' },
                ]}
              />
              <button className="btn-secondary btn-sm" onClick={exportCsv} disabled={!rows.length}>
                <Download size={13} /> CSV
              </button>
            </>
          }
        />
        {shown.length ? (
          <ul className="divide-y divide-line/70">
            {shown.map((r) => {
              const q = r.service.tires;
              const checks = Array.from({ length: q.qty }, (_, i) => checkTin(q.dots?.[i]));
              const good = checks.filter((c) => c.ok).length;
              return (
                <li key={r.service.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-[200px] flex-1">
                    <div className="font-medium">{r.tire}</div>
                    <div className="text-xs text-ink-3">
                      {date(r.order.invoicedAt)} · <Link to={`/orders/${r.order.id}`} className="link">RO #{r.order.number}</Link> · {fullName(r.customer)}
                      {r.vehicle ? ` · ${vehicleName(r.vehicle)}` : ''}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {checks.map((c, i) => (
                        <span key={i} className={`rounded-[5px] border px-1.5 py-0.5 font-mono text-2xs ${c.ok ? (c.old ? 'border-warn/40 text-warn' : 'border-line text-ink-2') : 'border-bad/40 text-bad'}`} title={c.ok ? `Week ${c.week}, ${c.year}` : c.message || 'Missing'}>
                          {c.ok ? q.dots[i] : c.empty ? `Tire ${i + 1}: missing` : q.dots[i]}
                          {c.ok && c.old && <TriangleAlert size={10} className="ml-1 inline" />}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`pill ${good === q.qty ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad'}`}>{good}/{q.qty} DOT</span>
                    <label className="flex items-center gap-1.5 text-ink-2">
                      {r.registered ? <ShieldCheck size={14} className="text-ok" /> : <ShieldAlert size={14} className="text-warn" />}
                      Registered
                      <Toggle checked={r.registered} onChange={(v) => updateService(r.order.id, r.service.id, { tires: { ...q, registered: v } })} label={`Registered: ${r.tire}`} />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={Disc3} title={filter === 'all' ? 'No tires installed yet' : 'Nothing here'} body="Quote tires with “Quote tire options” on any service. Once the RO is invoiced, the set appears here for DOT registration." className="py-12" />
        )}
        <p className="border-t border-line/70 px-4 py-2.5 text-xs text-ink-3">
          Tire sellers must give buyers a way to register their tires with the manufacturer so they can be reached about recalls. Export this log for the manufacturer’s registration site or the registration service you use, then mark each set registered.
        </p>
      </Card>
    </>
  );
}
