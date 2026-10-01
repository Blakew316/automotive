import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Users, Package, FileSpreadsheet, Download, ArrowRight, CircleCheck, TriangleAlert, ChevronLeft, ClipboardPaste } from 'lucide-react';
import { useShop, useUI } from '../store/hooks';
import { PageHeader, Card, CardHeader, EmptyState } from '../components/ui';
import { parseCsv, autoMap, buildImport, IMPORT_TYPES, SAMPLE_CSV } from '../lib/csvImport';
import { downloadCsv } from '../lib/accounting';
import { number, vehicleName, fullName } from '../lib/format';

const SOURCES = ['Shopmonkey', 'Tekmetric', 'Mitchell 1', 'ALLDATA Manage', 'Shop-Ware', 'NAPA TRACS', 'RO Writer', 'QuickBooks', 'Excel / Google Sheets'];
const TYPE_ICON = { customers: Users, inventory: Package };

export default function Import() {
  const { state, importRecords } = useShop();
  const { toast } = useUI();
  const [type, setType] = useState('customers');
  const [file, setFile] = useState(null);
  const [map, setMap] = useState({});
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [done, setDone] = useState(null);
  const input = useRef(null);
  const [dragging, setDragging] = useState(false);

  const load = (text, name) => {
    const parsed = parseCsv(text);
    if (!parsed.header.length) {
      toast('That file looks empty', { tone: 'error' });
      return;
    }
    setFile({ name, ...parsed });
    setMap(autoMap(type, parsed.header));
    setPasting(false);
  };
  const readFile = (f) => {
    if (!f) return;
    if (!/\.(csv|txt|tsv)$/i.test(f.name) && !/text|csv/.test(f.type)) {
      toast('Choose a .csv file — in Excel or Sheets use File → Save as / Download → CSV', { tone: 'error' });
      return;
    }
    f.text().then((t) => load(t, f.name));
  };

  const preview = useMemo(() => (file ? buildImport(type, file.rows, map, state) : null), [file, type, map, state]);
  const fields = IMPORT_TYPES[type].fields;

  const run = () => {
    importRecords(preview);
    setDone({ ...preview, type });
    setFile(null);
    toast('Import complete', { tone: 'success' });
  };

  if (done)
    return (
      <>
        <PageHeader title="Import data" back="/settings?tab=data" backText="Settings" />
        <Card className="mx-auto max-w-lg px-6 py-10 text-center">
          <CircleCheck size={40} className="mx-auto mb-3 text-ok" />
          <h2 className="text-xl font-semibold">Import complete</h2>
          <p className="mt-1 text-sm text-ink-2">
            {done.type === 'inventory'
              ? `${number(done.inventory.length)} new parts${done.inventoryUpdates.length ? `, ${number(done.inventoryUpdates.length)} updated` : ''}`
              : `${number(done.customers.length)} customers and ${number(done.vehicles.length)} vehicles added`}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link to={done.type === 'inventory' ? '/parts' : '/customers'} className="btn-primary">
              View {done.type === 'inventory' ? 'parts' : 'customers'} <ArrowRight size={14} />
            </Link>
            <button className="btn-secondary" onClick={() => setDone(null)}>Import another file</button>
          </div>
        </Card>
      </>
    );

  return (
    <>
      <PageHeader title="Import data" subtitle="Bring customers, vehicles and parts over from your current system" back="/settings?tab=data" backText="Settings" />

      {!file ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(IMPORT_TYPES).map(([k, t]) => {
                const Icon = TYPE_ICON[k];
                const on = type === k;
                return (
                  <button key={k} onClick={() => setType(k)} className={`card flex items-start gap-3 p-4 text-left transition-colors ${on ? 'ring-2 ring-accent' : 'hover:bg-fill/[0.03]'}`}>
                    <Icon size={20} className={on ? 'text-accent' : 'text-ink-3'} />
                    <span>
                      <span className="block font-semibold">{t.label}</span>
                      <span className="text-xs text-ink-3">{t.body}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <Card
              className={`flex flex-col items-center justify-center border-2 border-dashed px-6 py-12 text-center transition-colors ${dragging ? 'border-accent bg-accent/[0.04]' : 'border-line'}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                readFile(e.dataTransfer.files?.[0]);
              }}
            >
              <FileSpreadsheet size={34} strokeWidth={1.4} className="mb-3 text-ink-4" />
              <p className="font-semibold">Drop a CSV file here</p>
              <p className="mt-1 text-sm text-ink-3">or</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button className="btn-primary" onClick={() => input.current?.click()}>
                  <Upload size={15} /> Choose file
                </button>
                <button className="btn-secondary" onClick={() => setPasting(true)}>
                  <ClipboardPaste size={15} /> Paste from a spreadsheet
                </button>
              </div>
              <input ref={input} type="file" accept=".csv,.txt,.tsv,text/csv" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
              <button className="btn-plain btn-sm mt-4" onClick={() => downloadCsv(SAMPLE_CSV[type], `sample-${type}.csv`)}>
                <Download size={13} /> Sample {IMPORT_TYPES[type].label.toLowerCase()} file
              </button>
            </Card>
            {pasting && (
              <Card>
                <CardHeader title="Paste rows" subtitle="Copy cells including the header row from Excel or Google Sheets" />
                <div className="p-4">
                  <textarea rows={8} className="input font-mono text-xs" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={SAMPLE_CSV[type]} autoFocus aria-label="Pasted rows" />
                  <div className="mt-3 flex justify-end gap-2">
                    <button className="btn-secondary" onClick={() => setPasting(false)}>Cancel</button>
                    <button className="btn-primary" disabled={!pasted.trim()} onClick={() => load(pasted, 'Pasted rows')}>
                      Continue <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            )}
          </div>
          <Card>
            <CardHeader title="Moving from another system" />
            <div className="space-y-3 p-4 text-sm text-ink-2">
              <p>Export your customer list (with vehicles) and parts inventory as CSV from your current software — it’s usually under the Customers or Reports area, labelled Export or Download.</p>
              <div className="flex flex-wrap gap-1.5">
                {SOURCES.map((s) => (
                  <span key={s} className="chip">{s}</span>
                ))}
              </div>
              <p>Columns are matched automatically by their names, and you can fix any match before importing. Customers already on file (same phone or email), vehicles with a known VIN, and existing part numbers are not duplicated.</p>
              <p className="text-xs text-ink-3">
                Tip: <Link to="/settings?tab=data" className="link">download a backup</Link> first. Repair order history can be kept as a PDF/CSV archive from your old system; open ROs are best re-entered so pricing and statuses are correct.
              </p>
            </div>
          </Card>
        </div>
      ) : (
        <>
          <button className="btn-plain -ml-2 mb-3 h-7 px-1.5 text-sm" onClick={() => setFile(null)}>
            <ChevronLeft size={16} /> Choose a different file
          </button>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <Card>
              <CardHeader title="Match columns" subtitle={`${file.name} · ${number(file.rows.length)} rows`} />
              <div className="divide-y divide-line/60">
                {fields.map((f) => {
                  const idx = map[f.key];
                  const sample = idx != null && idx !== '' ? file.rows.find((r) => r[Number(idx)])?.[Number(idx)] : '';
                  return (
                    <div key={f.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-3 px-4 py-2">
                      <div className="min-w-0">
                        <div className="text-sm">{f.label}</div>
                        {sample && <div className="truncate text-xs text-ink-3">e.g. {sample}</div>}
                      </div>
                      <select className={`input h-8 py-0 text-sm ${idx != null && idx !== '' ? '' : 'text-ink-3'}`} value={idx ?? ''} onChange={(e) => setMap({ ...map, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) })} aria-label={`Column for ${f.label}`}>
                        <option value="">— Don’t import —</option>
                        {file.header.map((h, i) => (
                          <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </Card>
            <div className="space-y-6">
              <Card>
                <CardHeader title="Ready to import" />
                <div className="grid grid-cols-2 gap-px bg-line/60 sm:grid-cols-3">
                  {(type === 'inventory'
                    ? [
                        ['New parts', preview.inventory.length],
                        ['Updated quantities', preview.inventoryUpdates.length],
                        ['Duplicates skipped', preview.skipped],
                      ]
                    : [
                        ['New customers', preview.customers.length],
                        ['New vehicles', preview.vehicles.length],
                        ['Already on file', preview.skipped],
                      ]
                  ).map(([l, v]) => (
                    <div key={l} className="bg-surface px-4 py-3">
                      <div className="text-xs text-ink-3">{l}</div>
                      <div className="tabular text-2xl font-semibold">{number(v)}</div>
                    </div>
                  ))}
                </div>
                {preview.errors.length > 0 && (
                  <div className="border-t border-line/70 px-4 py-2.5 text-xs text-warn">
                    <TriangleAlert size={13} className="mr-1 inline" />
                    {preview.errors.length} row{preview.errors.length === 1 ? '' : 's'} will be skipped: {preview.errors.slice(0, 3).join('; ')}
                    {preview.errors.length > 3 ? '…' : ''}
                  </div>
                )}
                <div className="flex justify-end border-t border-line/70 px-4 py-3">
                  <button
                    className="btn-primary"
                    disabled={!(preview.customers.length + preview.vehicles.length + preview.inventory.length + preview.inventoryUpdates.length)}
                    onClick={run}
                  >
                    Import {type === 'inventory' ? 'parts' : 'customers & vehicles'}
                  </button>
                </div>
              </Card>
              <Card>
                <CardHeader title="Preview" subtitle="First rows as they’ll appear" />
                {type === 'inventory' ? (
                  preview.inventory.length ? (
                    <table className="table">
                      <tbody>
                        {preview.inventory.slice(0, 8).map((p) => (
                          <tr key={p.id}>
                            <td className="font-mono text-xs">{p.partNumber}</td>
                            <td>{p.description}</td>
                            <td className="tabular text-right">{p.qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <EmptyState title="No new parts" body="Map at least a part number or description." className="py-8" />
                  )
                ) : preview.customers.length || preview.vehicles.length ? (
                  <ul className="divide-y divide-line/60">
                    {preview.customers.slice(0, 8).map((c) => {
                      const vs = preview.vehicles.filter((v) => v.customerId === c.id);
                      return (
                        <li key={c.id} className="px-4 py-2 text-sm">
                          <div className="font-medium">{fullName(c)}</div>
                          <div className="text-xs text-ink-3">
                            {[c.phone, c.email, [c.city, c.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                            {vs.length > 0 && ` · ${vs.map((v) => vehicleName(v)).join(', ')}`}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyState title="Nothing new to import" body="Map at least a name, phone or email column." className="py-8" />
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}
