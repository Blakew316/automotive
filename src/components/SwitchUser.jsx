// "Who's working?" — pick a staff profile for this device, with an optional 4-digit PIN.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Delete, ShieldCheck } from 'lucide-react';
import { useAccess, useUI } from '../store/hooks';
import { Modal, Avatar } from './ui';
import { ROLES, hashPin, homeFor } from '../lib/access';

const TECH_KEY = 'autoshop-pro:tech';

export default function SwitchUser({ onClose }) {
  const { staff, user, setUserId } = useAccess();
  const { toast } = useUI();
  const navigate = useNavigate();
  const [picking, setPicking] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const become = (s) => {
    setUserId(s.id);
    if (s.role === 'tech' && s.techId) {
      try {
        localStorage.setItem(TECH_KEY, s.techId);
      } catch {
        // Tech view will ask who's using it.
      }
    }
    toast(`Signed in as ${s.name}`, { tone: 'success' });
    onClose();
    navigate(homeFor(s.role));
  };

  const choose = (s) => {
    if (s.id === user.id) return onClose();
    if (s.pin) {
      setPicking(s);
      setPin('');
      setError('');
    } else become(s);
  };

  const press = (d) => {
    const next = (pin + d).slice(0, 4);
    setPin(next);
    setError('');
    if (next.length === 4) {
      if (hashPin(next) === picking.pin) become(picking);
      else {
        setError('Wrong PIN — try again');
        setPin('');
      }
    }
  };

  return (
    <Modal open onClose={onClose} title={picking ? `Enter PIN for ${picking.name}` : 'Who’s working?'} subtitle={picking ? ROLES[picking.role]?.label : 'Each person sees the parts of WPI Driveline their role needs'} size="sm">
      {picking ? (
        <div className="mx-auto max-w-[240px]">
          <div className="mb-4 flex justify-center gap-3" aria-label={`${pin.length} of 4 digits entered`}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-3.5 w-3.5 rounded-full border-2 ${i < pin.length ? 'border-accent bg-accent' : 'border-ink-4'}`} />
            ))}
          </div>
          {error && <p className="mb-3 text-center text-sm text-bad">{error}</p>}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button key={d} className="btn-secondary h-12 text-lg" onClick={() => press(d)}>
                {d}
              </button>
            ))}
            <button className="btn-ghost h-12" onClick={() => setPicking(null)}>
              Back
            </button>
            <button className="btn-secondary h-12 text-lg" onClick={() => press('0')}>
              0
            </button>
            <button className="btn-ghost h-12" onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Delete digit">
              <Delete size={18} />
            </button>
          </div>
        </div>
      ) : (
        <ul className="-mx-1 space-y-1">
          {staff.map((s) => (
            <li key={s.id}>
              <button onClick={() => choose(s)} className={`flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-fill/[0.06] ${s.id === user.id ? 'bg-accent/[0.06] ring-1 ring-accent/30' : ''}`}>
                <Avatar name={s.name} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.name}</span>
                  <span className="block truncate text-xs text-ink-3">{ROLES[s.role]?.label}</span>
                </span>
                {s.id === user.id ? <ShieldCheck size={16} className="text-accent" /> : s.pin ? <Lock size={14} className="text-ink-4" /> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
