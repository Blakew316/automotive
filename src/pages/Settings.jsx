import { useRef, useState } from 'react';
import { Download, Upload, RotateCcw, Trash2, Plus, Pencil, HardDrive } from 'lucide-react';
import { useShop, useUI } from '../store/hooks';
import { PageHeader, Card, CardHeader, Field, Toggle, Modal, NumInput, InlineText } from '../components/ui';
import { priceFromMatrix, DEFAULT_MATRIX } from '../lib/pricing';
import { money } from '../lib/format';

export default function Settings() {
  const { state, updateShop } = useShop();
  const shop = state.shop;
  const text = (k) => ({ value: shop[k] || '', onCommit: (v) => updateShop({ [k]: v }) });

  return (
    <>
      <PageHeader title="Settings" subtitle="Changes save automatically." />
      <div className="mx-auto max-w-4xl space-y-6">
        <Section title="Shop profile" subtitle="Appears on estimates, invoices and customer messages">
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

        <Section title="Rates & taxes">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Labor rate ($/hr)" hint="Default for new labor lines">{(id) => <NumInput id={id} align="left" className="input" value={shop.laborRate} onCommit={(v) => updateShop({ laborRate: v })} />}</Field>
            <Field label="Tech pay ($/hr)" hint="Used for gross-profit reporting">{(id) => <NumInput id={id} align="left" className="input" value={shop.techPayRate} onCommit={(v) => updateShop({ techPayRate: v })} />}</Field>
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

        <TechSection />
        <MenuSection />
        <DataSection />
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

function TechSection() {
  const { state, saveTechnician } = useShop();
  const [editing, setEditing] = useState(null);
  return (
    <Section title="Technicians" actions={<button className="btn-plain btn-sm" onClick={() => setEditing({ name: '', role: '', certs: '', payRate: 30 })}><Plus size={14} /> Add</button>}>
      <ul className="-my-2 divide-y divide-line/70">
        {state.technicians.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{t.name}</div>
              <div className="text-xs text-ink-3">{[t.role, t.certs].filter(Boolean).join(' · ')}</div>
            </div>
            <span className="tabular text-sm text-ink-2">{money(t.payRate)}/hr</span>
            <button className="btn-ghost btn-icon h-7 w-7" onClick={() => setEditing(t)} aria-label={`Edit ${t.name}`}><Pencil size={13} /></button>
          </li>
        ))}
      </ul>
      {editing && (
        <SimpleForm
          title={editing.id ? 'Edit technician' : 'Add technician'}
          initial={editing}
          fields={[['name', 'Name'], ['role', 'Role'], ['certs', 'Certifications'], ['payRate', 'Pay rate ($/hr)', 'number']]}
          onClose={() => setEditing(null)}
          onSave={(t) => {
            saveTechnician(t);
            setEditing(null);
          }}
        />
      )}
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
  const { toast } = useUI();
  const file = useRef(null);
  const [confirm, setConfirm] = useState(null);

  const exportData = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    a.download = `autoshop-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Backup downloaded', { tone: 'success' });
  };

  const size = new Blob([JSON.stringify(state)]).size;
  return (
    <Section title="Data & backup" subtitle="Everything is stored privately in this browser">
      <div className="mb-4 flex items-center gap-3 rounded-[10px] bg-fill/[0.06] px-3 py-2.5 text-sm text-ink-2">
        <HardDrive size={16} className="shrink-0 text-ink-3" />
        {state.customers.length} customers · {state.vehicles.length} vehicles · {state.orders.length} repair orders · {(size / 1024).toFixed(0)} KB. Export a backup regularly — clearing browser data erases it.
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={exportData}><Download size={14} /> Export backup</button>
        <button className="btn-secondary" onClick={() => file.current?.click()}><Upload size={14} /> Import backup</button>
        <input
          ref={file}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              importData(JSON.parse(await f.text()));
              toast('Backup restored', { tone: 'success' });
            } catch (err) {
              toast(err.message || 'Could not read that file', { tone: 'error' });
            }
            e.target.value = '';
          }}
        />
        <span className="flex-1" />
        <button className="btn-secondary" onClick={() => setConfirm('demo')}><RotateCcw size={14} /> Reload demo data</button>
        <button className="btn-danger" onClick={() => setConfirm('clear')}><Trash2 size={14} /> Start fresh</button>
      </div>
      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        size="sm"
        title={confirm === 'clear' ? 'Start with an empty shop?' : 'Reload demo data?'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setConfirm(null)}>Cancel</button>
            <button
              className="btn-primary !bg-bad"
              onClick={() => {
                if (confirm === 'clear') clearAll();
                else resetDemo();
                toast(confirm === 'clear' ? 'All customers, vehicles and orders removed' : 'Demo data reloaded');
                setConfirm(null);
              }}
            >
              {confirm === 'clear' ? 'Erase everything' : 'Replace my data'}
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          {confirm === 'clear'
            ? 'Removes all customers, vehicles, repair orders, appointments and inventory. Your shop profile, rates and service menu are kept.'
            : 'Replaces everything in this browser with the sample shop.'}{' '}
          Export a backup first if you might want it back.
        </p>
      </Modal>
    </Section>
  );
}
