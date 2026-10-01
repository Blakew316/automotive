// Staff profiles, roles and PINs for this device.
import { useState } from 'react';
import { Plus, Trash2, KeyRound, ShieldCheck, Lock } from 'lucide-react';
import { useShop, useUI, useAccess } from '../../store/hooks';
import { Card, CardHeader, Modal, Field, Avatar } from '../../components/ui';
import { ROLES, hashPin } from '../../lib/access';
import { uid } from '../../lib/format';

export default function Access() {
  const { state, updateShop } = useShop();
  const { user } = useAccess();
  const { toast } = useUI();
  const staff = state.shop.staff || [];
  const [pinFor, setPinFor] = useState(null);
  const owners = staff.filter((s) => s.role === 'owner').length;
  const save = (next) => updateShop({ staff: next });
  const set = (id, patch) => save(staff.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader
          icon={ShieldCheck}
          tone="blue"
          title="Staff & access"
          subtitle="Who can use AutoShop Pro on this shop’s devices, and what each role can open"
          actions={
            <button className="btn-primary btn-sm" onClick={() => save([...staff, { id: uid('staff'), name: 'New team member', role: 'advisor', pin: '' }])}>
              <Plus size={13} /> Add person
            </button>
          }
        />
        <ul className="divide-y divide-line/70">
          {staff.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar name={s.name} size={34} />
              <input className="input h-8 w-auto min-w-[160px] flex-1" value={s.name} onChange={(e) => set(s.id, { name: e.target.value })} aria-label="Name" />
              <select
                className="input h-8 w-auto"
                value={s.role}
                onChange={(e) => {
                  if (s.role === 'owner' && owners === 1 && e.target.value !== 'owner') return toast('Keep at least one owner', { tone: 'error' });
                  set(s.id, { role: e.target.value });
                }}
                aria-label={`Role for ${s.name}`}
              >
                {Object.entries(ROLES).map(([k, r]) => (
                  <option key={k} value={k}>{r.label}</option>
                ))}
              </select>
              {s.role === 'tech' && (
                <select className="input h-8 w-auto" value={s.techId || ''} onChange={(e) => set(s.id, { techId: e.target.value || null })} aria-label="Technician profile">
                  <option value="">No tech profile</option>
                  {state.technicians.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
              <button className={`btn-sm ${s.pin ? 'btn-secondary' : 'btn-plain'}`} onClick={() => setPinFor(s)}>
                {s.pin ? <Lock size={13} /> : <KeyRound size={13} />} {s.pin ? 'PIN set' : 'Set PIN'}
              </button>
              <button
                className="btn-ghost btn-icon h-8 w-8"
                disabled={s.id === user.id || (s.role === 'owner' && owners === 1)}
                onClick={() => save(staff.filter((x) => x.id !== s.id))}
                aria-label={`Remove ${s.name}`}
                title={s.id === user.id ? 'You can’t remove yourself' : 'Remove'}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t border-line/70 px-4 py-2.5 text-xs text-ink-3">Switch people from the name at the bottom of the sidebar. PINs keep a shared counter tablet or bay phone on the right person — they aren’t encryption, since shop data is stored on the device.</p>
      </Card>
      <Card>
        <CardHeader title="What each role can open" />
        <ul className="divide-y divide-line/70">
          {Object.entries(ROLES).map(([k, r]) => (
            <li key={k} className="px-4 py-3">
              <div className="font-medium">{r.label}</div>
              <div className="text-sm text-ink-3">{r.desc}</div>
            </li>
          ))}
        </ul>
      </Card>
      {pinFor && <PinModal person={pinFor} onClose={() => setPinFor(null)} onSave={(pin) => set(pinFor.id, { pin: pin ? hashPin(pin) : '' })} />}
    </div>
  );
}

function PinModal({ person, onClose, onSave }) {
  const { toast } = useUI();
  const [pin, setPin] = useState('');
  const valid = /^\d{4}$/.test(pin);
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`PIN for ${person.name}`}
      footer={
        <>
          {person.pin && (
            <button
              className="btn-danger mr-auto"
              onClick={() => {
                onSave('');
                toast('PIN removed');
                onClose();
              }}
            >
              Remove PIN
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!valid}
            onClick={() => {
              onSave(pin);
              toast('PIN saved', { tone: 'success' });
              onClose();
            }}
          >
            Save PIN
          </button>
        </>
      }
    >
      <Field label="4-digit PIN" hint="Asked when switching to this person on a shared device">
        {(id) => <input id={id} className="input w-32 text-center font-mono text-lg tracking-[0.4em]" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} autoFocus />}
      </Field>
    </Modal>
  );
}
