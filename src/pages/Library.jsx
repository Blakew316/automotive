import { lazy, Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Cable, CircleAlert, Calculator, Landmark, ArrowUpRight, ShieldCheck, Siren } from 'lucide-react';
import { PageHeader, Card, CardHeader, Tabs, SearchInput, Spinner, ExternalLink } from '../components/ui';
import { oemPortals, freeDocuments, industryResources } from '../data/serviceInfo';
import Wiring from './library/Wiring';
import Tools from './library/Tools';

const Dtc = lazy(() => import('./library/Dtc'));

const TABS = [
  { value: 'oem', label: 'OEM service info', icon: BookOpen },
  { value: 'wiring', label: 'Wiring & diagrams', icon: Cable },
  { value: 'dtc', label: 'Trouble codes', icon: CircleAlert },
  { value: 'tools', label: 'Shop tools', icon: Calculator },
  { value: 'industry', label: 'Industry & safety', icon: Landmark },
];

export default function Library() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'oem';
  return (
    <>
      <PageHeader title="Service Library" subtitle="Factory service information, wiring references, trouble codes and shop calculators — in one place." />
      <Tabs className="mb-6" value={tab} onChange={(t) => setParams({ tab: t })} tabs={TABS} />
      {tab === 'oem' && <OemPortals />}
      {tab === 'wiring' && <Wiring />}
      {tab === 'dtc' && (
        <Suspense fallback={<div className="flex h-40 items-center justify-center"><Spinner /></div>}>
          <Dtc />
        </Suspense>
      )}
      {tab === 'tools' && <Tools />}
      {tab === 'industry' && <Industry />}
    </>
  );
}

function OemPortals() {
  const [q, setQ] = useState('');
  const list = useMemo(() => oemPortals.filter((p) => !q || `${p.makes.join(' ')} ${p.name} ${p.group}`.toLowerCase().includes(q.toLowerCase())), [q]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput value={q} onChange={setQ} placeholder="Find a make — Ford, Toyota, BMW…" className="w-full sm:w-80" />
        <p className="text-sm text-ink-3">{oemPortals.length} manufacturer portals · verified September 2026</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => (
          <Card key={p.id} className="flex flex-col p-4">
            <div className="text-xs text-ink-3">{p.makes.join(' · ')}</div>
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="group mt-0.5 flex items-start gap-1 text-md font-semibold leading-5 hover:text-accent">
              {p.name}
              <ArrowUpRight size={14} className="mt-0.5 shrink-0 text-ink-4 group-hover:text-accent" />
            </a>
            <div className="mt-2.5 flex flex-wrap gap-1">
              {p.offers.map((o) => (
                <span key={o} className="rounded-[5px] bg-fill/[0.09] px-1.5 py-0.5 text-2xs font-medium text-ink-2">{o}</span>
              ))}
            </div>
            <div className="mt-auto pt-3 text-xs text-ink-3">
              {p.access}
              {p.notes && <p className="mt-1 leading-4">{p.notes}</p>}
            </div>
          </Card>
        ))}
      </div>
      <Card className="p-4 text-sm text-ink-2">
        <span className="font-medium text-ink">Why these are paid:</span> Federal rules (40 CFR 86.1808) require automakers to make emissions-related service information and reprogramming available to independent shops, and EPA’s “Freedom to Fix” guidance reaffirms equal access to dealer-level information — but OEMs may charge for it. Most offer short-term subscriptions, so you can buy a day or three for a one-off job. Security procedures (key programming, immobilizer) also require a NASTF Vehicle Security Professional credential.
      </Card>
    </div>
  );
}

function Industry() {
  const erg = freeDocuments.filter((d) => d.category === 'Emergency response');
  const gov = freeDocuments.filter((d) => ['Government', 'Standards'].includes(d.category));
  const groups = ['Security', 'Training', 'Industry', 'Government'];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader icon={Siren} title="High-voltage & emergency response guides" subtitle="Official OEM guides: HV disconnects, cut zones, airbag & battery locations" />
        <ul className="divide-y divide-line/70">
          {erg.map((d) => (
            <li key={d.id} className="px-4 py-2.5">
              <ExternalLink href={d.url} className="text-sm font-medium">{d.title}</ExternalLink>
              <p className="text-xs text-ink-3">{d.description}</p>
            </li>
          ))}
        </ul>
      </Card>
      <div className="space-y-6">
        {groups.map((g) => {
          const items = industryResources.filter((r) => r.category === g);
          if (!items.length) return null;
          return (
            <Card key={g}>
              <CardHeader icon={g === 'Security' ? ShieldCheck : Landmark} title={g} />
              <ul className="divide-y divide-line/70">
                {items.map((r) => (
                  <li key={r.id} className="px-4 py-2.5">
                    <ExternalLink href={r.url} className="text-sm font-medium">{r.name}</ExternalLink>
                    <p className="text-xs text-ink-3">{r.description}</p>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
        <Card>
          <CardHeader icon={Landmark} title="Regulations & data" />
          <ul className="divide-y divide-line/70">
            {gov.map((d) => (
              <li key={d.id} className="px-4 py-2.5">
                <ExternalLink href={d.url} className="text-sm font-medium">{d.title}</ExternalLink>
                <p className="text-xs text-ink-3">{d.description}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
