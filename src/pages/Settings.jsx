import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Download, Upload, RotateCcw, Trash2, Plus, Pencil, HardDrive, Store, Wrench, CreditCard, MessageSquareText, CalendarCheck, Cloud, ChevronRight, Globe } from 'lucide-react';
import { useShop, useUI, useSync, useAccess } from '../store/hooks';
import { PageHeader, Card, CardHeader, Field, Toggle, Modal, NumInput, InlineText, Tabs } from '../components/ui';
import { priceFromMatrix, DEFAULT_MATRIX } from '../lib/pricing';
import { money } from '../lib/format';
import { SharingSection } from './settings/IntegrationSections';
import HoursSection from './settings/HoursSection';
import { PaymentsSection, FinancingSection } from './settings/PaymentSettings';
import { TemplatesSection, MarketingSettings } from './settings/CommsSettings';
import BookingSettings from './settings/BookingSettings';
import InspectionTemplates from './settings/InspectionTemplates';
import InstallSection from './settings/InstallSection';
import WebsiteSettings from './settings/WebsiteSettings';
import { SyncSection, CloudBackups } from './settings/CloudData';
import { downloadJson } from '../lib/sync/labels';

const TABS = [
  { value: 'general', label: 'General', icon: Store },
  { value: 'menu', label: 'Services & inspections', icon: Wrench },
  { value: 'payments', label: 'Payments & financing', icon: CreditCard },
  { value: 'messaging', label: 'Messaging', icon: MessageSquareText },
  { value: 'booking', label: 'Online booking', icon: CalendarCheck },
  { value: 'website', label: 'Website', icon: Globe },
  { value: 'cloud', label: 'Shop Cloud', icon: Cloud },
  { value: 'data', label: 'Data', icon: HardDrive },
];

export default function Settings() {
  const { state, updateShop } = useShop();
  const shop = state.shop;
  const text = (k) => ({ value: shop[k] || '', onCommit: (v) => updateShop({ [k]: v }) });
  const { hash } = useLocation();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : hash === '#sharing' ? 'cloud' : 'general';
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <>
      <PageHeader title="Settings" subtitle="Changes save automatically." />
      <Tabs tabs={TABS} value={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} className="mb-6" />
      <div className="mx-auto max-w-4xl space-y-6">
        {tab === 'general' && (
          <>
            <Section title="Shop profile" subtitle="Appears on estimates, invoices, customer messages and your booking page">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Shop name" className="sm:col-span-2">{(id) => <InlineText id={id} className="input" {...text('name')} />}</Field>
                <Field label="Phone">{(id) => <InlineText id={id} className="input" {...text('phone')} />}</Field>
                <Field label="Email">{(id) => <InlineText id={id} className="input" {...text('email')} />}</Field>
                <Field label="Street address" className="sm:col-span-2">{(id) => <InlineText id={id} className="input" {...text('address')} />}</Field>
                <div className="grid grid-cols-[1fr_80px_110px] gap-3 sm:col-span-2">
                  <Field label="City">{(id) => <InlineText id={id} className="input" {...text('city')} />}</Field>
                  <Field label="State">{(id) => <InlineText id={id} className="input" maxLength={2} {...text('state')} />}</Field>
                  <Field label="ZIP">{(id) => <InlineText id={id} className="input" {...text('zip')} />}</Field>
                </div>
              </div>
            </Section>
            <HoursSection />
            <Section title="Rates & taxes">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Labor rate ($/hr)" hint="Default for new labor lines">{(id) => <NumInput id={id} align="left" className="input" value={shop.laborRate} onCommit={(v) => updateShop({ laborRate: v })} />}</Field>
                <Field label="Default tech cost ($/hr)" hint="Used for gross profit when a tech has no pay rate">{(id) => <NumInput id={id} align="left" className="input" value={shop.techPayRate} onCommit={(v) => updateShop({ techPayRate: v })} />}</Field>
                <Field label="Sales tax (%)">{(id) => <NumInput id={id} align="left" className="input" value={shop.taxRate} onCommit={(v) => updateShop({ taxRate: v })} />}</Field>
                <Field label="Shop supplies (% of labor)">{(id) => <NumInput id={id} align="left" className="input" value={shop.shopSuppliesPct} onCommit={(v) => updateShop({ shopSuppliesPct: v })} />}</Field>
                <Field label="Shop supplies cap ($)">{(id) => <NumInput id={id} align="left" className="input" value={shop.shopSuppliesCap} onCommit={(v) => updateShop({ shopSuppliesCap: v })} />}</Field>
                <div className="flex items-center justify-between gap-3 rounded-[8px] border border-line px-3 py-2 sm:mt-5 sm:h-8 sm:py-0">
                  <span className="text-sm">Tax labor</span>
                  <Toggle checked={Boolean(shop.taxLabor)} onChange={(v) => updateShop({ taxLabor: v })} label="Tax labor" />
                </div>
              </div>
            </Section>
            <MatrixSection />
            <Section title="Documents" subtitle="Printed at the bottom of estimates and invoices">
              <div className="space-y-3">
                <Field label="Warranty">{(id) => <InlineText id={id} className="input" {...text('warranty')} />}</Field>
                <Field label="Estimate terms">{(id) => <InlineText id={id} multiline rows={2} className="input" {...text('estimateTerms')} />}</Field>
                <Field label="Invoice terms">{(id) => <InlineText id={id} multiline rows={2} className="input" {...text('invoiceTerms')} />}</Field>
              </div>
            </Section>
            <InstallSection />
          </>
        )}
        {tab === 'menu' && (
          <>
            <MenuSection />
            <InspectionTemplates />
          </>
        )}
        {tab === 'payments' && (
          <>
            <PaymentsSection />
            <FinancingSection />
          </>
        )}
        {tab === 'messaging' && (
          <>
            <TemplatesSection />
            <MarketingSettings />
          </>
        )}
        {tab === 'booking' && <BookingSettings />}
        {tab === 'website' && <WebsiteSettings />}
        {tab === 'cloud' && (
          <>
            <SharingSection />
            <SyncSection />
          </>
        )}
        {tab === 'data' && (
          <>
            <Link to="/import" className="card flex items-center gap-3 px-4 py-3.5 hover:bg-fill/[0.03]">
              <Upload size={18} className="shrink-0 text-ink-3" />
              <span className="flex-1">
                <span className="block text-sm font-semibold">Import from another shop system</span>
                <span className="block text-xs text-ink-3">Customers, vehicles, inventory and service history from Shopmonkey, Tekmetric, Mitchell 1, ALLDATA or any CSV export</span>
              </span>
              <ChevronRight size={16} className="text-ink-4" />
            </Link>
            <DataSection />
            <CloudBackups />
          </>
        )}
      </div>
    </>
  );
}

function Section({ title, subtitle, actions, children }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} actions={actions} />
      <div className="p-4">{children}</div>
    </Card>
  );
}

function MatrixSection() {
  const { state, updateShop } = useShop();
  const matrix = state.shop.matrix;
  const set = (i, patch) => updateShop({ matrix: matrix.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  return (
    <Section
      title="Parts markup matrix"
      subtitle="Sell price = cost × (1 + markup). Tiers are by unit cost."
      actions={<button className="btn-plain btn-sm" onClick={() => updateShop({ matrix: DEFAULT_MATRIX })}><RotateCcw size={13} /> Default</button>}
    >
      <div className="-mx-4 overflow-x-auto px-4">
      <table className="table min-w-[460px]">
        <thead>
          <tr>
            <th className="!pl-0">Unit cost up to</th>
            <th>Markup</th>
            <th className="text-right">Example: cost → sell</th>
            <th className="text-right">Margin</th>
          </tr>
        </thead>
        <tbody>
          {matrix.map((t, i) => {
            const example = t.upTo ?? (matrix[i - 1]?.upTo || 0) * 2;
            const sell = priceFromMatrix(example, matrix);
            return (
              <tr key={i}>
                <td className="!pl-0">
                  {t.upTo == null ? (
                    <span className="text-ink-2">and above</span>
                  ) : (
                    <NumInput value={t.upTo} align="left" format={(v) => money(v)} onCommit={(v) => set(i, { upTo: v })} className="input h-7 w-28" />
                  )}
                </td>
                <td>
                  <div className="flex items-center gap-1.5">
                    <NumInput value={t.markup} align="left" onCommit={(v) => set(i, { markup: v })} className="input h-7 w-20" />
                    <span className="text-ink-3">%</span>
                  </div>
                </td>
                <td className="tabular text-right text-ink-2">{money(example)} → <span className="text-ink">{money(sell)}</span></td>
                <td className="tabular text-right text-ink-2">{Math.round((t.markup / (100 + t.markup)) * 100)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </Section>
  );
}

function MenuSection() {
  const { state, saveCannedJob, deleteCannedJob } = useShop();
  const [editing, setEditing] = useState(null);
  return (
    <Section title="Service menu" subtitle="Canned jobs used when building estimates — hours are your menu times" actions={<button className="btn-plain btn-sm" onClick={() => setEditing({ title: '', category: 'General', hours: 1 })}><Plus size={14} /> Add</button>}>
      <ul className="-my-2 divide-y divide-line/70">
        {state.cannedJobs.map((j) => {
          const hours = j.items.filter((i) => i.type === 'labor').reduce((s, i) => s + i.hours, 0);
          return (
            <li key={j.id} className="group flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{j.title}</div>
                <div className="text-xs text-ink-3">{j.category} · {j.items.filter((i) => i.type === 'part').length} parts</div>
              </div>
              <span className="tabular text-sm text-ink-2">{hours.toFixed(1)} hr</span>
              <button className="btn-ghost btn-icon h-7 w-7" onClick={() => setEditing({ ...j, hours })} aria-label="Edit"><Pencil size={13} /></button>
              <button className="btn-ghost btn-icon h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => deleteCannedJob(j.id)} aria-label="Delete"><Trash2 size={13} /></button>
            </li>
          );
        })}
      </ul>
      {editing && (
        <SimpleForm
          title={editing.id ? 'Edit canned job' : 'New canned job'}
          initial={editing}
          fields={[['title', 'Title'], ['category', 'Category'], ['hours', 'Labor hours', 'number']]}
          onClose={() => setEditing(null)}
          onSave={({ hours, ...j }) => {
            const items = j.items ? [...j.items] : [];
            const li = items.findIndex((i) => i.type === 'labor');
            if (li >= 0) items[li] = { ...items[li], hours: Number(hours) };
            else items.unshift({ type: 'labor', description: j.title, hours: Number(hours) });
            saveCannedJob({ ...j, items });
            setEditing(null);
          }}
        />
      )}
    </Section>
  );
}

function SimpleForm({ title, initial, fields, onClose, onSave }) {
  const [f, setF] = useState(initial);
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!f[fields[0][0]]} onClick={() => onSave(f)}>Save</button>
        </>
      }
    >
      <div className="space-y-3">
        {fields.map(([k, label, type], i) => (
          <Field key={k} label={label}>
            {(id) => <input id={id} autoFocus={i === 0} type={type || 'text'} step="0.1" className="input" value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: type === 'number' ? Number(e.target.value) : e.target.value })} />}
          </Field>
        ))}
      </div>
    </Modal>
  );
}

function DataSection() {
  const { state, resetDemo, clearAll, importData } = useShop();
  const sync = useSync();
  const { role } = useAccess();
  const { toast } = useUI();
  const file = useRef(null);
  const [confirm, setConfirm] = useState(null);
  const [pendingImport, setPendingImport] = useState(null);
  const shared = Boolean(sync?.enabled);
  const owner = role === 'owner';

  const exportData = () => {
    downloadJson(state, `autoshop-backup-${new Date().toISOString().slice(0, 10)}.json`);
    toast('Backup downloaded', { tone: 'success' });
  };

  const size = new Blob([JSON.stringify(state)]).size;
  return (
    <Section title="Data & backup" subtitle={shared ? 'Shared with every device in the shop through the cloud' : 'Everything is stored privately in this browser'}>
      <div className="mb-4 flex items-center gap-3 rounded-[10px] bg-fill/[0.06] px-3 py-2.5 text-sm text-ink-2">
        <HardDrive size={16} className="shrink-0 text-ink-3" />
        {state.customers.length} customers · {state.vehicles.length} vehicles · {state.orders.length} repair orders · {(size / 1024).toFixed(0)} KB.{' '}
        {shared
          ? 'Every change is kept in the change history and the whole shop is backed up nightly (below).'
          : 'Export a backup regularly — clearing browser data erases it. Photos and video stay on this device and aren’t included in the backup file. Turn on shared data under Shop Cloud for automatic cloud backups.'}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={exportData}><Download size={14} /> Export backup</button>
        {(!shared || owner) && (
          <button className="btn-secondary" onClick={() => file.current?.click()}><Upload size={14} /> Import backup</button>
        )}
        <input
          ref={file}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const data = JSON.parse(await f.text());
              if (data?.version !== 2 || !Array.isArray(data.orders)) throw new Error('Not an AutoShop Pro backup file');
              setPendingImport(data);
              setConfirm('import');
            } catch (err) {
              toast(err.message || 'Could not read that file', { tone: 'error' });
            }
          }}
        />
        <span className="flex-1" />
        {!shared && <button className="btn-secondary" onClick={() => setConfirm('demo')}><RotateCcw size={14} /> Reload demo data</button>}
        {(!shared || owner) && <button className="btn-danger" onClick={() => setConfirm('clear')}><Trash2 size={14} /> Start fresh</button>}
      </div>
      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        size="sm"
        title={confirm === 'clear' ? 'Start with an empty shop?' : confirm === 'import' ? 'Replace the shop’s data with this backup?' : 'Reload demo data?'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setConfirm(null)}>Cancel</button>
            <button
              className="btn-primary !bg-bad"
              onClick={() => {
                try {
                  if (confirm === 'clear') clearAll();
                  else if (confirm === 'import') importData(pendingImport);
                  else resetDemo();
                  toast(confirm === 'clear' ? 'All customers, vehicles and orders removed' : confirm === 'import' ? 'Backup restored' : 'Demo data reloaded', { tone: 'success' });
                } catch (err) {
                  toast(err.message || 'Could not restore that backup', { tone: 'error' });
                }
                setConfirm(null);
                setPendingImport(null);
              }}
            >
              {confirm === 'clear' ? 'Erase everything' : 'Replace the data'}
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          {confirm === 'clear'
            ? 'Removes all customers, vehicles, repair orders, appointments and inventory. Your shop profile, rates and service menu are kept.'
            : confirm === 'import'
              ? `Replaces everything with the backup (${pendingImport?.orders?.length || 0} repair orders, ${pendingImport?.customers?.length || 0} customers).`
              : 'Replaces everything in this browser with the sample shop.'}{' '}
          {shared ? 'This changes the shared data on every device; the change history and nightly backups can bring it back.' : 'Export a backup first if you might want it back.'}
        </p>
      </Modal>
    </Section>
  );
}
