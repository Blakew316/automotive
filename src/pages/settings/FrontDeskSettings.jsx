// Settings → Front desk: self check-in, loaner cars and the waiting-room screen.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, MonitorPlay, Printer } from 'lucide-react';
import { useShop, useSite } from '../../store/hooks';
import { Card, CardHeader, Field, Toggle, NumInput, InlineText, Modal, CopyButton } from '../../components/ui';
import QrCode from '../../components/QrCode';
import { FUEL, FRONT_DESK_DEFAULTS, checkinLink } from '../../lib/operations';
import { uid, relTime } from '../../lib/format';

export default function FrontDeskSettings() {
  const { state, updateShop } = useShop();
  const site = useSite();
  const fd = state.shop.frontDesk || FRONT_DESK_DEFAULTS;
  const ci = fd.checkin;
  const lobby = fd.lobby;
  const save = (patch) => updateShop({ frontDesk: { ...fd, ...patch } });
  const setCi = (patch) => save({ checkin: { ...ci, ...patch } });
  const setLobby = (patch) => save({ lobby: { ...lobby, ...patch } });
  const [editing, setEditing] = useState(null);
  const link = checkinLink(state, site.current);

  const saveLoaner = (l) => {
    save({ loaners: fd.loaners.some((x) => x.id === l.id) ? fd.loaners.map((x) => (x.id === l.id ? l : x)) : [...fd.loaners, l] });
    setEditing(null);
  };

  return (
    <>
      <Card>
        <CardHeader title="Self check-in" subtitle="Customers check in on the lobby tablet, or at the key drop with their phone — it opens a repair order for you" actions={<Toggle checked={Boolean(ci.enabled)} onChange={(v) => setCi({ enabled: v })} label="Self check-in" />} />
        <div className="grid gap-4 px-4 pb-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Diagnosis authorized up to ($)" hint="Shown above the customer’s signature; 0 to leave it out">
                {(id) => <NumInput id={id} align="left" className="input" value={ci.diagLimit} onCommit={(v) => setCi({ diagLimit: v })} />}
              </Field>
              <label className="flex items-center justify-between gap-3 rounded-[8px] border border-line px-3 py-2 sm:mt-5 sm:h-9 sm:py-0">
                <span className="text-sm">Ask for a key tag number</span>
                <Toggle checked={ci.askKeyTag !== false} onChange={(v) => setCi({ askKeyTag: v })} label="Ask for key tag" />
              </label>
            </div>
            <Field label="Authorization wording">{(id) => <InlineText id={id} multiline rows={2} className="input" value={ci.terms} onCommit={(terms) => setCi({ terms })} />}</Field>
            <Field label="After-hours / key drop instructions">{(id) => <InlineText id={id} multiline rows={2} className="input" value={ci.afterHours} onCommit={(afterHours) => setCi({ afterHours })} />}</Field>
          </div>
          {link ? (
            <div className="flex flex-col items-center gap-2 sm:w-52">
              <QrCode text={link} size={150} label="Check-in QR code" />
              <div className="flex w-full items-center gap-1 rounded-[8px] border border-line bg-raised px-2 py-1">
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-2">{link}</span>
                <CopyButton text={link} label="Copy check-in link" className="h-6 w-6 px-0" />
              </div>
              <Link to="/frontdesk/sign" className="btn-secondary btn-sm w-full"><Printer size={13} /> Print key-drop sign</Link>
              <p className="text-center text-[11px] text-ink-3">{ci.published ? `Published ${relTime(ci.published)}` : 'Publishes when a staff member is signed in'}</p>
            </div>
          ) : (
            <p className="text-sm text-ink-3 sm:w-52">Connect Shop Cloud (Settings → Shop Cloud) to get the check-in link and QR code.</p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Loaner cars" subtitle="Check them out and back in from a repair order’s Transportation box" actions={<button className="btn-plain btn-sm" onClick={() => setEditing({})}><Plus size={14} /> Add loaner</button>} />
        {fd.loaners.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-ink-3">No loaners yet.</p>
        ) : (
          <ul className="divide-y divide-line/70 border-t border-line/70">
            {fd.loaners.map((l) => (
              <li key={l.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{l.name}{l.active === false && <span className="ml-1.5 text-xs font-normal text-ink-3">· not in service</span>}</span>
                  <span className="block text-xs text-ink-3">{[l.plate, l.mileage && `${Number(l.mileage).toLocaleString()} mi`, l.fuel && `${l.fuel} tank`].filter(Boolean).join(' · ')}</span>
                </span>
                <button className="btn-ghost btn-icon h-7 w-7" onClick={() => setEditing(l)} aria-label={`Edit ${l.name}`}><Pencil size={13} /></button>
                <button className="btn-ghost btn-icon h-7 w-7 text-ink-3 hover:text-bad" onClick={() => save({ loaners: fd.loaners.filter((x) => x.id !== l.id) })} aria-label={`Remove ${l.name}`}><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-line/70 px-4 py-3">
          <Field label="Loaner agreement" hint="The customer signs this when they take the keys">{(id) => <InlineText id={id} multiline rows={2} className="input" value={fd.loanerTerms} onCommit={(loanerTerms) => save({ loanerTerms })} />}</Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Waiting-room screen" subtitle="Open it full screen on a lobby TV — it updates as work moves along" actions={<Link to="/lobby" target="_blank" className="btn-plain btn-sm"><MonitorPlay size={14} /> Open</Link>} />
        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
          <Field label="Messages (one per line)" className="sm:col-span-2">
            {(id) => <InlineText id={id} multiline rows={3} className="input" value={(lobby.messages || []).join('\n')} onCommit={(v) => setLobby({ messages: v.split('\n').map((x) => x.trim()).filter(Boolean) })} />}
          </Field>
          <Field label="Wi-Fi name">{(id) => <InlineText id={id} className="input" value={lobby.wifiName} onCommit={(wifiName) => setLobby({ wifiName })} />}</Field>
          <Field label="Wi-Fi password">{(id) => <InlineText id={id} className="input" value={lobby.wifiPassword} onCommit={(wifiPassword) => setLobby({ wifiPassword })} />}</Field>
          <label className="flex items-center justify-between gap-3 rounded-[8px] border border-line px-3 py-2 sm:col-span-2">
            <span className="text-sm">Show last initial (e.g. “Avery T.”) — first names only when off</span>
            <Toggle checked={lobby.lastInitial !== false} onChange={(v) => setLobby({ lastInitial: v })} label="Show last initial" />
          </label>
        </div>
      </Card>
      {editing && <LoanerModal initial={editing} onSave={saveLoaner} onClose={() => setEditing(null)} />}
    </>
  );
}

function LoanerModal({ initial, onSave, onClose }) {
  const [f, setF] = useState(() => ({ name: '', plate: '', vin: '', mileage: '', fuel: 'F', active: true, ...initial }));
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={initial.id ? 'Edit loaner' : 'Add loaner'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!f.name.trim()} onClick={() => onSave({ ...f, id: f.id || uid('loan'), name: f.name.trim(), plate: f.plate.trim().toUpperCase(), mileage: Number(String(f.mileage).replace(/\D/g, '')) || 0 })}>Save</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" className="col-span-2" hint="e.g. Loaner 1 — 2022 Toyota Camry">{(id) => <input id={id} className="input" value={f.name} onChange={set('name')} autoFocus />}</Field>
        <Field label="Plate">{(id) => <input id={id} className="input uppercase" value={f.plate} onChange={set('plate')} />}</Field>
        <Field label="Odometer">{(id) => <input id={id} inputMode="numeric" className="input" value={f.mileage} onChange={set('mileage')} />}</Field>
        <Field label="Fuel">
          {(id) => (
            <select id={id} className="input" value={f.fuel} onChange={set('fuel')}>
              {FUEL.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          )}
        </Field>
        <label className="flex items-center justify-between gap-3 rounded-[8px] border border-line px-3 py-2 sm:mt-5">
          <span className="text-sm">In service</span>
          <Toggle checked={f.active !== false} onChange={(v) => setF((x) => ({ ...x, active: v }))} label="In service" />
        </label>
      </div>
    </Modal>
  );
}
